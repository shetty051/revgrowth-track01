import { prisma } from '../db';

export interface WinBackCandidate {
  opportunityType: 'winback';
  customerId: string;
  customerName: string;
  customerEmail: string;
  daysInactive: number;
  pastSpend: number;
  totalTransactions: number;
  lastPurchaseAt: string;
  estimatedImpact: number;
  confidence: number;
}

export interface CrossSellOpportunity {
  opportunityType: 'cross_sell';
  productA: { id: string; name: string; price: number };
  productB: { id: string; name: string; price: number };
  coPurchaseCount: number;
  coPurchaseRate: number;
  eligibleCustomers: Array<{
    id: string;
    name: string;
    email: string;
    productAPurchaseCount: number;
  }>;
  totalEligibleCount: number;
  estimatedImpact: number;
  confidence: number;
}

export interface UpsellOpportunity {
  opportunityType: 'upsell';
  customerId: string;
  customerName: string;
  customerEmail: string;
  baseProduct: { id: string; name: string; price: number; marginPct: number };
  premiumProduct: { id: string; name: string; price: number; marginPct: number };
  basePurchaseCount: number;
  totalBaseSpend: number;
  marginDelta: number;
  priceDelta: number;
  estimatedImpact: number;
  confidence: number;
}

export async function detectWinBackCandidates(): Promise<WinBackCandidate[]> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const candidates = await prisma.customer.findMany({
    where: {
      lastPurchaseAt: {
        lte: sixtyDaysAgo,
      },
    },
    include: {
      transactions: true,
    },
  });

  const results: WinBackCandidate[] = candidates.map((cust) => {
    const pastSpend = cust.transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const lastPurchase = cust.lastPurchaseAt ? new Date(cust.lastPurchaseAt) : new Date(cust.createdAt);
    const daysInactive = Math.floor((Date.now() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24));
    
    // Impact = expected recovery value (past average spend * 0.45 likelihood)
    const estimatedImpact = Number((pastSpend * 0.45).toFixed(2));
    const confidence = Number(Math.min(0.95, 0.60 + (pastSpend / 1000) * 0.2).toFixed(2));

    return {
      opportunityType: 'winback',
      customerId: cust.id,
      customerName: cust.name,
      customerEmail: cust.email,
      daysInactive,
      pastSpend: Number(pastSpend.toFixed(2)),
      totalTransactions: cust.transactions.length,
      lastPurchaseAt: lastPurchase.toISOString(),
      estimatedImpact,
      confidence,
    };
  });

  return results.sort((a, b) => b.pastSpend - a.pastSpend);
}

export async function detectCrossSellOpportunities(): Promise<CrossSellOpportunity[]> {
  // Query co-purchase pairs with count >= 5
  const pairs = await prisma.coPurchasePair.findMany({
    where: {
      count: { gte: 5 },
    },
    orderBy: {
      count: 'desc',
    },
  });

  const results: CrossSellOpportunity[] = [];

  for (const pair of pairs) {
    const productA = await prisma.product.findUnique({ where: { id: pair.productAId } });
    const productB = await prisma.product.findUnique({ where: { id: pair.productBId } });

    if (!productA || !productB) continue;

    // Total buyers of Product A
    const buyersA = await prisma.transaction.groupBy({
      by: ['customerId'],
      where: { productId: productA.id },
      _count: { id: true },
    });

    const totalBuyersA = buyersA.length;
    if (totalBuyersA === 0) continue;

    const coPurchaseRate = Number((pair.count / totalBuyersA).toFixed(2));

    // Find customers who bought A but NEVER bought B
    const buyersBSet = new Set(
      (await prisma.transaction.findMany({
        where: { productId: productB.id },
        select: { customerId: true },
      })).map((tx) => tx.customerId)
    );

    const eligibleBuyerIds = buyersA.filter((b) => !buyersBSet.has(b.customerId));
    const eligibleCustomersData = await prisma.customer.findMany({
      where: {
        id: { in: eligibleBuyerIds.map((b) => b.customerId).slice(0, 10) },
      },
    });

    const eligibleCustomers = eligibleCustomersData.map((c) => {
      const bObj = buyersA.find((b) => b.customerId === c.id);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        productAPurchaseCount: bObj ? bObj._count.id : 1,
      };
    });

    const estimatedImpact = Number((eligibleBuyerIds.length * productB.price * coPurchaseRate).toFixed(2));
    const confidence = Number(Math.min(0.95, 0.50 + coPurchaseRate * 0.4).toFixed(2));

    results.push({
      opportunityType: 'cross_sell',
      productA: { id: productA.id, name: productA.name, price: productA.price },
      productB: { id: productB.id, name: productB.name, price: productB.price },
      coPurchaseCount: pair.count,
      coPurchaseRate,
      eligibleCustomers,
      totalEligibleCount: eligibleBuyerIds.length,
      estimatedImpact,
      confidence,
    });
  }

  return results.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
}

export async function detectUpsellOpportunities(): Promise<UpsellOpportunity[]> {
  // Find all products categorized as SaaS Subscriptions or Starter plans
  const starterProducts = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'Starter' } },
        { name: { contains: 'Basic' } },
        { name: { contains: 'Standard' } },
      ],
    },
  });

  const results: UpsellOpportunity[] = [];

  for (const baseProd of starterProducts) {
    // Find matching enterprise/pro version in same category with higher price AND equal/higher margin
    const premiumProd = await prisma.product.findFirst({
      where: {
        category: baseProd.category,
        id: { not: baseProd.id },
        price: { gt: baseProd.price },
        marginPct: { gte: baseProd.marginPct },
      },
      orderBy: { price: 'desc' },
    });

    if (!premiumProd) continue;

    // Find customers who bought baseProd 2+ times
    const repeatBuyers = await prisma.transaction.groupBy({
      by: ['customerId'],
      where: { productId: baseProd.id },
      _count: { id: true },
      having: {
        id: {
          _count: { gte: 2 },
        },
      },
    });

    // Check that customer has NEVER bought premiumProd
    for (const buyer of repeatBuyers) {
      const premiumTxCount = await prisma.transaction.count({
        where: {
          customerId: buyer.customerId,
          productId: premiumProd.id,
        },
      });

      if (premiumTxCount === 0) {
        const customer = await prisma.customer.findUnique({
          where: { id: buyer.customerId },
        });

        if (!customer) continue;

        const marginDelta = Number((premiumProd.marginPct - baseProd.marginPct).toFixed(2));
        const priceDelta = Number((premiumProd.price - baseProd.price).toFixed(2));
        const totalBaseSpend = Number((buyer._count.id * baseProd.price).toFixed(2));
        const estimatedImpact = Number((priceDelta * 12 * 0.35).toFixed(2)); // Annualized value * conversion rate

        results.push({
          opportunityType: 'upsell',
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          baseProduct: { id: baseProd.id, name: baseProd.name, price: baseProd.price, marginPct: baseProd.marginPct },
          premiumProduct: { id: premiumProd.id, name: premiumProd.name, price: premiumProd.price, marginPct: premiumProd.marginPct },
          basePurchaseCount: buyer._count.id,
          totalBaseSpend,
          marginDelta,
          priceDelta,
          estimatedImpact,
          confidence: Number(Math.min(0.95, 0.65 + (buyer._count.id * 0.08)).toFixed(2)),
        });
      }
    }
  }

  return results.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
}
