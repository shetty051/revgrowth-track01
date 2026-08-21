import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:4000/api';

export type PromptVariant = 'budget-conscious' | 'brand-loyal' | 'urgent';

export async function runTestBuyerAgent(variant: PromptVariant = 'budget-conscious', tamperMode: boolean = false) {
  console.log(`\n========================================`);
  console.log(`RUNNING AI SHOPPING AGENT [Variant: ${variant.toUpperCase()}]`);
  if (tamperMode) console.log(`*** DELIBERATE TAMPER TEST MODE ACTIVE ***`);
  console.log(`========================================\n`);

  // 1. Define prompt intent parameters based on variant
  let searchKeyword = 'Email Campaign';
  let budgetINR = 15000;

  if (variant === 'brand-loyal') {
    searchKeyword = 'Growth Analytics';
    budgetINR = 30000;
  } else if (variant === 'urgent') {
    searchKeyword = 'POS Smart Terminal';
    budgetINR = 45000;
  }

  console.log(`1. Agent Prompt Intent: Seeking "${searchKeyword}" with budget cap of ₹${budgetINR}...`);

  // 2. Fetch Catalog & Query
  console.log(`2. Querying machine-readable catalog (/api/checkout/query)...`);
  const queryRes = await fetch(`${BASE_URL}/checkout/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: searchKeyword }),
  });
  const queryData = await queryRes.json();

  console.log(`   Catalog Tool Query Result: ${queryData.responseText}`);
  const targetItem = queryData.groundedResults?.[0];

  if (!targetItem) {
    console.log(`❌ Agent stopped: No catalog items matching intent.`);
    return;
  }

  // 3. Negotiate Draft Order
  const sessionId = `sess_agent_${variant}_${Date.now()}`;
  console.log(`\n3. Negotiating multi-turn draft order (/api/checkout/negotiate) [Session: ${sessionId}]...`);
  const negRes = await fetch(`${BASE_URL}/checkout/negotiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      action: 'INQUIRE_BUNDLE',
      itemIds: [targetItem.id],
    }),
  });
  const negData = await negRes.json();
  console.log(`   Server-Side Verified Subtotal: ₹${negData.draftOrder.subtotalINR}`);

  // 4. Issue Mandate Token from Human Customer
  console.log(`\n4. Requesting signed JWT mandate from Customer (/api/mandates)...`);
  const mandateRes = await fetch(`${BASE_URL}/mandates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerAgentId: `agent_${variant}`,
      maxSpendINR: budgetINR,
      merchantId: 'mch_revgrowth_01',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  const mandateData = await mandateRes.json();
  let mandateToken = mandateData.mandate.token;
  console.log(`   Received Signed JWT Mandate Token: ${mandateToken.slice(0, 35)}...`);

  // 5. If Tamper Mode, modify claims after signing
  if (tamperMode) {
    console.log(`\n⚠️ TAMPERING DEMO: Modifying signed JWT claims (bypassing signature check)...`);
    const decoded = jwt.decode(mandateToken) as any;
    decoded.maxSpendINR = 999999; // Forged unauthorized high spend claim
    mandateToken = `${jwt.sign(decoded, 'FORGED_INVALID_SECRET_KEY')}`;
    console.log(`   Forged Token Payload maxSpendINR modified to ₹999,999.`);
  }

  // 6. Assemble Final Order
  console.log(`\n6. Assembling final draft order (/api/checkout/assemble)...`);
  const assembleRes = await fetch(`${BASE_URL}/checkout/assemble`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  const assembleData = await assembleRes.json();
  const assembledOrder = assembleData.assembledOrder;
  console.log(`   Assembled Order Total: ₹${assembledOrder.totalINR} (${assembledOrder.totalAmountInPaise} paise)`);

  // 7. Execute Agentic Purchase
  console.log(`\n7. Executing Agentic Purchase (/api/checkout/execute)...`);
  const executeRes = await fetch(`${BASE_URL}/checkout/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mandateToken,
      assembledOrder,
    }),
  });
  const executeData = await executeRes.json();

  if (executeData.success) {
    console.log(`\n✅ AGENTIC PURCHASE APPROVED & EXECUTED!`);
    console.log(`   Razorpay Test Order ID: ${executeData.razorpayOrderId}`);
    console.log(`   DB AiBuyerTransaction Record ID: ${executeData.transactionRecord.id}`);
  } else {
    console.log(`\n🛑 AGENTIC PURCHASE BLOCKED BY GUARDRAIL MIDDLEWARE!`);
    console.log(`   Status: ${executeData.status}`);
    console.log(`   Rejection Reason: ${executeData.reason}`);
    console.log(`   Logged to DB AiBuyerTransaction Record ID: ${executeData.transactionRecord?.id}`);
  }
}

// CLI Execution Handler
const mode = process.argv[2] || 'legit';
const variant = (process.argv[3] as PromptVariant) || 'budget-conscious';

if (mode === 'tamper') {
  runTestBuyerAgent('budget-conscious', true).catch(console.error);
} else {
  runTestBuyerAgent(variant, false).catch(console.error);
}
