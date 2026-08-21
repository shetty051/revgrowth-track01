import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database...');
  await prisma.campaignLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.aiBuyerTransaction.deleteMany();
  await prisma.mandate.deleteMany();
  await prisma.coPurchasePair.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchant.deleteMany();

  console.log('Seeding Merchant...');
  await prisma.merchant.create({
    data: {
      name: 'RevGrowth Commerce Store',
      category: 'E-commerce SaaS & Hardware',
    },
  });

  console.log('Seeding 40 Products across 5 categories...');
  const categories = ['SaaS Subscriptions', 'Analytics Tools', 'Marketing Hardware', 'Dev APIs', 'Premium Services'];

  const productsData = [
    // SaaS Subscriptions (includes base tier + premium tier for upsell pattern)
    { name: 'Growth Analytics Starter Plan', category: 'SaaS Subscriptions', price: 3999, marginPct: 0.85, stock: 999, variants: JSON.stringify({ tier: 'starter' }) },
    { name: 'Growth Analytics Enterprise Plan', category: 'SaaS Subscriptions', price: 24999, marginPct: 0.90, stock: 999, variants: JSON.stringify({ tier: 'enterprise' }) },
    { name: 'Email Campaign Basic', category: 'SaaS Subscriptions', price: 2499, marginPct: 0.80, stock: 999, variants: JSON.stringify({ tier: 'starter' }) },
    { name: 'Email Campaign Pro', category: 'SaaS Subscriptions', price: 11999, marginPct: 0.88, stock: 999, variants: JSON.stringify({ tier: 'pro' }) },
    { name: 'Churn Guard Standard', category: 'SaaS Subscriptions', price: 5999, marginPct: 0.82, stock: 999, variants: JSON.stringify({ tier: 'starter' }) },
    { name: 'Churn Guard Suite Pro', category: 'SaaS Subscriptions', price: 29999, marginPct: 0.92, stock: 999, variants: JSON.stringify({ tier: 'enterprise' }) },

    // Analytics Tools (includes cross-sell pair items)
    { name: 'RevGrowth Core SDK', category: 'Analytics Tools', price: 7999, marginPct: 0.85, stock: 500, variants: JSON.stringify({ v: '2.0' }) },
    { name: 'RevGrowth AI Attribution Plugin', category: 'Analytics Tools', price: 15999, marginPct: 0.88, stock: 500, variants: JSON.stringify({ v: '1.5' }) },
    { name: 'Real-time Funnel Monitor', category: 'Analytics Tools', price: 9999, marginPct: 0.84, stock: 500, variants: JSON.stringify({ v: '3.0' }) },
    { name: 'Cohort Heatmap Engine', category: 'Analytics Tools', price: 12999, marginPct: 0.86, stock: 500, variants: JSON.stringify({ v: '1.2' }) },

    // Marketing Hardware (includes cross-sell pairs)
    { name: 'POS Smart Terminal Node', category: 'Marketing Hardware', price: 31999, marginPct: 0.45, stock: 150, variants: JSON.stringify({ color: 'black' }) },
    { name: 'Thermal Receipt Printer HD', category: 'Marketing Hardware', price: 11999, marginPct: 0.40, stock: 200, variants: JSON.stringify({ model: 'TH-200' }) },
    { name: 'NFC Customer Badge Scanner', category: 'Marketing Hardware', price: 6999, marginPct: 0.50, stock: 300, variants: JSON.stringify({ wireless: true }) },
    { name: 'Retail Beacon Sensor Pack', category: 'Marketing Hardware', price: 19999, marginPct: 0.55, stock: 100, variants: JSON.stringify({ pack: 5 }) },

    // Dev APIs
    { name: 'Revenue Webhook Gateway', category: 'Dev APIs', price: 2999, marginPct: 0.95, stock: 9999, variants: JSON.stringify({ rateLimit: '10k/min' }) },
    { name: 'Billing Sync Engine API', category: 'Dev APIs', price: 6999, marginPct: 0.92, stock: 9999, variants: JSON.stringify({ SLA: '99.99%' }) },
    { name: 'Stripe/Recurly Connector', category: 'Dev APIs', price: 4999, marginPct: 0.90, stock: 9999, variants: JSON.stringify({ sync: 'realtime' }) },
    { name: 'Customer Identity Matcher API', category: 'Dev APIs', price: 9999, marginPct: 0.94, stock: 9999, variants: JSON.stringify({ fuzzy: true }) },
  ];

  // Fill up to 40 products
  for (let i = 19; i <= 40; i++) {
    const cat = categories[i % categories.length];
    productsData.push({
      name: `${cat} Module ${i}`,
      category: cat,
      price: Math.floor(2499 + (i * 1150)),
      marginPct: Number((0.6 + (i % 30) * 0.01).toFixed(2)),
      stock: 100 + i * 10,
      variants: JSON.stringify({ sku: `SKU-${i}` }),
    });
  }

  const createdProducts = [];
  for (const p of productsData) {
    const created = await prisma.product.create({ data: p });
    createdProducts.push(created);
  }

  // Find specific products for explicit pattern engineering
  const starterPlan = createdProducts.find(p => p.name === 'Growth Analytics Starter Plan')!;
  const enterprisePlan = createdProducts.find(p => p.name === 'Growth Analytics Enterprise Plan')!;
  const sdkProd = createdProducts.find(p => p.name === 'RevGrowth Core SDK')!;
  const aiAttrProd = createdProducts.find(p => p.name === 'RevGrowth AI Attribution Plugin')!;
  const posTerminal = createdProducts.find(p => p.name === 'POS Smart Terminal Node')!;
  const receiptPrinter = createdProducts.find(p => p.name === 'Thermal Receipt Printer HD')!;

  const emailBasic = createdProducts.find(p => p.name === 'Email Campaign Basic')!;
  const webhookGateway = createdProducts.find(p => p.name === 'Revenue Webhook Gateway')!;

  console.log('Seeding 300 Customers...');
  const now = new Date('2026-08-21T00:00:00.000Z');
  const sixtyDaysAgo = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000);
  const recentTime = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const createdCustomers = [];
  for (let i = 1; i <= 300; i++) {
    const isInactive = i <= 45; // ~15% inactive (45 / 300 = 15%)
    const lastPurchase = isInactive
      ? new Date(sixtyDaysAgo.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      : new Date(recentTime.getTime() - Math.random() * 40 * 24 * 60 * 60 * 1000);

    const cust = await prisma.customer.create({
      data: {
        name: `Customer ${i}`,
        email: `customer${i}@revgrowth-demo.io`,
        phone: `+1-555-${String(i).padStart(4, '0')}`,
        createdAt: new Date(lastPurchase.getTime() - 120 * 24 * 60 * 60 * 1000),
        lastPurchaseAt: lastPurchase,
      },
    });
    createdCustomers.push(cust);
  }

  console.log('Seeding 1200 Transactions with engineered patterns...');
  let txCount = 0;

  // 1. Engineering Upsell Candidates (30 customers buy Starter 2 or 3 times)
  for (let i = 45; i < 75; i++) {
    const cust = createdCustomers[i];
    await prisma.transaction.create({
      data: {
        customerId: cust.id,
        productId: starterPlan.id,
        quantity: 1,
        amount: starterPlan.price,
        channel: 'web',
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.transaction.create({
      data: {
        customerId: cust.id,
        productId: starterPlan.id,
        quantity: 1,
        amount: starterPlan.price,
        channel: 'web',
        createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
    });
    txCount += 2;
  }

  // 2. Engineering Co-purchase Pair 1: SDK + AI Attribution
  for (let i = 75; i < 135; i++) {
    const cust = createdCustomers[i];
    const txTime = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    await prisma.transaction.create({
      data: {
        customerId: cust.id,
        productId: sdkProd.id,
        quantity: 1,
        amount: sdkProd.price,
        channel: 'web',
        createdAt: txTime,
      },
    });
    await prisma.transaction.create({
      data: {
        customerId: cust.id,
        productId: aiAttrProd.id,
        quantity: 1,
        amount: aiAttrProd.price,
        channel: 'web',
        createdAt: txTime,
      },
    });
    txCount += 2;
  }

  // 3. Engineering Co-purchase Pair 2: POS Terminal + Thermal Printer
  for (let i = 135; i < 185; i++) {
    const cust = createdCustomers[i];
    const txTime = new Date(now.getTime() - Math.random() * 35 * 24 * 60 * 60 * 1000);
    await prisma.transaction.create({
      data: {
        customerId: cust.id,
        productId: posTerminal.id,
        quantity: 1,
        amount: posTerminal.price,
        channel: 'direct_sales',
        createdAt: txTime,
      },
    });
    await prisma.transaction.create({
      data: {
        customerId: cust.id,
        productId: receiptPrinter.id,
        quantity: 1,
        amount: receiptPrinter.price,
        channel: 'direct_sales',
        createdAt: txTime,
      },
    });
    txCount += 2;
  }

  // 4. Engineering Co-purchase Pair 3: Email Basic + Revenue Webhook Gateway
  for (let i = 185; i < 235; i++) {
    const cust = createdCustomers[i];
    const txTime = new Date(now.getTime() - Math.random() * 25 * 24 * 60 * 60 * 1000);
    await prisma.transaction.create({
      data: {
        customerId: cust.id,
        productId: emailBasic.id,
        quantity: 1,
        amount: emailBasic.price,
        channel: 'api',
        createdAt: txTime,
      },
    });
    await prisma.transaction.create({
      data: {
        customerId: cust.id,
        productId: webhookGateway.id,
        quantity: 1,
        amount: webhookGateway.price,
        channel: 'api',
        createdAt: txTime,
      },
    });
    txCount += 2;
  }

  // 4. Fill remaining transactions across remaining active & inactive customers
  while (txCount < 1200) {
    const randomCust = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
    const randomProd = createdProducts[Math.floor(Math.random() * createdProducts.length)];
    await prisma.transaction.create({
      data: {
        customerId: randomCust.id,
        productId: randomProd.id,
        quantity: 1,
        amount: randomProd.price,
        channel: Math.random() > 0.3 ? 'web' : 'api',
        createdAt: new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      },
    });
    txCount++;
  }

  console.log('Materializing CoPurchasePair table...');
  // Compute co-purchases from transactions occurring within 5 minutes of each other by same customer
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const pairCounts = new Map<string, number>();

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const t1 = transactions[i];
      const t2 = transactions[j];
      if (t1.customerId === t2.customerId && t1.productId !== t2.productId) {
        const timeDiff = Math.abs(t1.createdAt.getTime() - t2.createdAt.getTime());
        if (timeDiff <= 5 * 60 * 1000) {
          const [pA, pB] = [t1.productId, t2.productId].sort();
          const key = `${pA}___${pB}`;
          pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        }
      }
    }
  }

  for (const [key, count] of pairCounts.entries()) {
    const [productAId, productBId] = key.split('___');
    await prisma.coPurchasePair.upsert({
      where: { productAId_productBId: { productAId, productBId } },
      update: { count },
      create: { productAId, productBId, count },
    });
  }

  console.log('Verification statistics:');
  const prodCount = await prisma.product.count();
  const custCount = await prisma.customer.count();
  const totalTx = await prisma.transaction.count();
  const inactiveCust = await prisma.customer.count({
    where: { lastPurchaseAt: { lte: sixtyDaysAgo } },
  });
  const topPairs = await prisma.coPurchasePair.findMany({
    take: 5,
    orderBy: { count: 'desc' },
  });

  console.log(`- Products: ${prodCount}`);
  console.log(`- Customers: ${custCount} (Inactive 60+ days: ${inactiveCust} -> ${(inactiveCust / custCount * 100).toFixed(1)}%)`);
  console.log(`- Total Transactions: ${totalTx}`);
  console.log(`- Top Co-Purchase Pairs: ${topPairs.length}`);
  topPairs.forEach((p, idx) => {
    console.log(`   Pair #${idx + 1}: Product A (${p.productAId}) + Product B (${p.productBId}) -> Count: ${p.count}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
