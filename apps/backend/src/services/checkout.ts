import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { prisma } from '../db';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || 'MOCK_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

// --- 1. Pure DB Tool Functions ---

export async function checkStock(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    // Try searching by name or category if ID is fuzzy
    const fuzzy = await prisma.product.findFirst({
      where: { name: { contains: productId } },
    });
    if (fuzzy) {
      return {
        productId: fuzzy.id,
        productName: fuzzy.name,
        stock: fuzzy.stock,
        inStock: fuzzy.stock > 0,
      };
    }
    return { error: `Product '${productId}' not found in database.` };
  }
  return {
    productId: product.id,
    productName: product.name,
    stock: product.stock,
    inStock: product.stock > 0,
  };
}

export async function getPrice(productId: string, variant?: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    const fuzzy = await prisma.product.findFirst({
      where: { name: { contains: productId } },
    });
    if (fuzzy) {
      return {
        productId: fuzzy.id,
        productName: fuzzy.name,
        priceINR: fuzzy.price,
        variant: variant || 'standard',
        currency: 'INR',
      };
    }
    return { error: `Product '${productId}' not found in database.` };
  }
  return {
    productId: product.id,
    productName: product.name,
    priceINR: product.price,
    variant: variant || 'standard',
    currency: 'INR',
  };
}

export async function checkBundleDiscount(productIds: string[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  const totalBasePrice = products.reduce((acc, p) => acc + p.price, 0);
  const bundleDiscountPct = products.length >= 2 ? 15 : 0; // 15% discount for 2+ items
  const discountAmountINR = Math.round(totalBasePrice * (bundleDiscountPct / 100));
  const finalBundlePriceINR = totalBasePrice - discountAmountINR;

  return {
    itemCount: products.length,
    productNames: products.map((p) => p.name),
    totalBasePriceINR: totalBasePrice,
    bundleDiscountPct,
    discountAmountINR,
    finalBundlePriceINR,
    currency: 'INR',
  };
}

// --- 2. Gemini Function Declarations ---

const checkStockTool: FunctionDeclaration = {
  name: 'checkStock',
  description: 'Checks real-time inventory stock levels for a product in the database.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      productId: { type: SchemaType.STRING, description: 'Product ID or exact product name' },
    },
    required: ['productId'],
  },
};

const getPriceTool: FunctionDeclaration = {
  name: 'getPrice',
  description: 'Fetches the official catalog price for a product or variant in INR.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      productId: { type: SchemaType.STRING, description: 'Product ID or product name' },
      variant: { type: SchemaType.STRING, description: 'Optional variant tier/SKU' },
    },
    required: ['productId'],
  },
};

const checkBundleDiscountTool: FunctionDeclaration = {
  name: 'checkBundleDiscount',
  description: 'Calculates co-purchase bundle discount for multiple product IDs.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      productIds: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: 'Array of product IDs to bundle',
      },
    },
    required: ['productIds'],
  },
};

// --- 3. Machine-Readable Catalog Endpoint Function ---

export async function getStructuredCatalog() {
  const products = await prisma.product.findMany({
    take: 40,
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      stock: true,
      variants: true,
    },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    priceINR: p.price,
    currency: 'INR',
    stock: p.stock,
    inStock: p.stock > 0,
    deliveryEstimate: p.stock > 0 ? '2-4 business days' : 'Out of stock',
    variants: parseVariants(p.variants),
  }));
}

function parseVariants(variantsStr: string | null) {
  try {
    return variantsStr ? JSON.parse(variantsStr) : {};
  } catch {
    return { raw: variantsStr };
  }
}

// --- 4. Query & Negotiate Logic ---

export async function processAgenticQuery(naturalLanguageQuery: string) {
  // Search database for matching products
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: naturalLanguageQuery } },
        { category: { contains: naturalLanguageQuery } },
      ],
    },
    take: 5,
  });

  if (products.length === 0) {
    return {
      query: naturalLanguageQuery,
      groundedResults: [],
      responseText: `Product "${naturalLanguageQuery}" is currently Out of Stock (0 units found in database catalog).`,
    };
  }

  // Grounding Tool Execution
  const toolResults = await Promise.all(
    products.map(async (p) => {
      const stockInfo = await checkStock(p.id);
      const priceInfo = await getPrice(p.id);
      return { ...p, stockInfo, priceInfo };
    })
  );

  if (apiKey === 'MOCK_API_KEY') {
    return {
      query: naturalLanguageQuery,
      groundedResults: toolResults.map((tr) => ({
        id: tr.id,
        name: tr.name,
        priceINR: tr.price,
        stock: tr.stock,
        status: tr.stock > 0 ? `In Stock (${tr.stock} units available)` : 'Out of stock (0 units in DB)',
      })),
      responseText: `Found ${toolResults.length} matching item(s) in catalog. ${
        toolResults[0].stock > 0
          ? `${toolResults[0].name} is priced at ₹${toolResults[0].price} with ${toolResults[0].stock} units available.`
          : `${toolResults[0].name} is currently Out of Stock (0 units in DB).`
      }`,
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [checkStockTool, getPriceTool, checkBundleDiscountTool] }],
    });

    const prompt = `System Constraint: You are an Agentic Checkout AI. You MUST state stock and price numbers ONLY if returned by tools. Never invent or estimate numbers.
User Query: "${naturalLanguageQuery}"
Available Products Tool Output Data: ${JSON.stringify(toolResults)}`;

    const result = await model.generateContent(prompt);
    return {
      query: naturalLanguageQuery,
      groundedResults: toolResults,
      responseText: result.response.text().trim(),
    };
  } catch (err) {
    return {
      query: naturalLanguageQuery,
      groundedResults: toolResults,
      responseText: `Catalog Query Output: ${toolResults.map(t => `${t.name}: ₹${t.price} (Stock: ${t.stock})`).join('; ')}`,
    };
  }
}

// In-Memory Server-Side Draft Order Session Store
const draftOrderSessions: Record<string, any> = {};

export async function negotiateDraftOrder(sessionId: string, action: string, itemIds: string[]) {
  let session = draftOrderSessions[sessionId] || {
    sessionId,
    items: [],
    quantities: {},
    shippingINR: 99,
    subtotalINR: 0,
    discountINR: 0,
    totalINR: 0,
    turns: [],
  };

  // Fetch DB details for itemIds
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: itemIds } },
  });

  const bundleResult = itemIds.length >= 2 ? await checkBundleDiscount(itemIds) : null;

  dbProducts.forEach((p) => {
    if (!session.items.find((existing: any) => existing.id === p.id)) {
      session.items.push({
        id: p.id,
        name: p.name,
        priceINR: p.price,
        stock: p.stock,
      });
      session.quantities[p.id] = 1;
    }
  });

  // Calculate Running Totals Server-Side
  const subtotal = session.items.reduce((acc: number, item: any) => acc + item.priceINR * (session.quantities[item.id] || 1), 0);
  const discount = bundleResult ? bundleResult.discountAmountINR : 0;
  const total = subtotal - discount + session.shippingINR;

  session.subtotalINR = subtotal;
  session.discountINR = discount;
  session.totalINR = total;

  const turnLog = {
    turnId: session.turns.length + 1,
    action,
    requestedItems: itemIds,
    toolVerification: {
      itemsVerifiedInDB: session.items.map((i: any) => ({ name: i.name, stock: i.stock, priceINR: i.priceINR })),
      bundleDiscountApplied: bundleResult,
    },
    timestamp: new Date().toISOString(),
  };

  session.turns.push(turnLog);
  draftOrderSessions[sessionId] = session;

  return session;
}

export function assembleFinalOrder(sessionId: string) {
  const session = draftOrderSessions[sessionId];
  if (!session) {
    throw new Error(`Draft order session '${sessionId}' not found.`);
  }

  const orderObject = {
    orderId: `order_draft_${Date.now().toString(36)}`,
    sessionId: session.sessionId,
    currency: 'INR',
    items: session.items.map((i: any) => ({
      productId: i.id,
      name: i.name,
      unitPriceINR: i.priceINR,
      quantity: session.quantities[i.id] || 1,
    })),
    subtotalINR: session.subtotalINR,
    discountINR: session.discountINR,
    shippingINR: session.shippingINR,
    totalINR: session.totalINR,
    totalAmountInPaise: Math.round(session.totalINR * 100),
    status: 'ASSEMBLED_PENDING_GUARDRAIL',
    assembledAt: new Date().toISOString(),
  };

  return orderObject;
}
