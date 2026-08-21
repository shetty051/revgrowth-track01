import { Router } from 'express';
import {
  getStructuredCatalog,
  processAgenticQuery,
  negotiateDraftOrder,
  assembleFinalOrder,
} from '../services/checkout';

export const checkoutRouter = Router();

// GET /api/catalog — Machine-readable catalog endpoint
checkoutRouter.get('/catalog', async (_req, res) => {
  try {
    const catalog = await getStructuredCatalog();
    res.json({
      merchant: 'RevGrowth Commerce Store',
      currency: 'INR',
      count: catalog.length,
      products: catalog,
    });
  } catch (error) {
    console.error('Error fetching catalog:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// POST /api/checkout/query — Natural language product query endpoint
checkoutRouter.post('/checkout/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query string is required' });
    }
    const result = await processAgenticQuery(query);
    res.json(result);
  } catch (error) {
    console.error('Error processing checkout query:', error);
    res.status(500).json({ error: 'Failed to process checkout query' });
  }
});

// POST /api/checkout/negotiate — Structured multi-turn negotiation endpoint
checkoutRouter.post('/checkout/negotiate', async (req, res) => {
  try {
    const { sessionId, action, itemIds } = req.body;
    const session = await negotiateDraftOrder(
      sessionId || `sess_${Date.now()}`,
      action || 'INQUIRE_BUNDLE',
      itemIds || []
    );
    res.json({ success: true, draftOrder: session });
  } catch (error) {
    console.error('Error negotiating draft order:', error);
    res.status(500).json({ error: 'Failed to negotiate draft order' });
  }
});

// POST /api/checkout/assemble — Finalize draft order for guardrail checking
checkoutRouter.post('/checkout/assemble', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required to assemble draft order' });
    }
    const assembledOrder = assembleFinalOrder(sessionId);
    res.json({ success: true, assembledOrder });
  } catch (error: any) {
    console.error('Error assembling final order:', error);
    res.status(400).json({ error: error.message || 'Failed to assemble final order' });
  }
});

// POST /mandates — Issue signed JWT mandate
checkoutRouter.post('/mandates', async (req, res) => {
  try {
    const { buyerAgentId, maxSpendINR, merchantId, expiresAt } = req.body;
    const { createSignedMandate } = await import('../services/mandate');

    const result = await createSignedMandate({
      buyerAgentId: buyerAgentId || `agent_${Date.now()}`,
      maxSpendINR: Number(maxSpendINR || 15000),
      merchantId: merchantId || 'mch_default',
      expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    res.json({ success: true, mandate: result });
  } catch (error: any) {
    console.error('Error creating mandate:', error);
    res.status(500).json({ error: 'Failed to issue signed mandate', details: error.message });
  }
});

// POST /api/checkout/execute — Verify mandate signature, validate spend limit, execute Razorpay order
checkoutRouter.post('/checkout/execute', async (req, res) => {
  try {
    const { mandateToken, assembledOrder } = req.body;
    if (!mandateToken || !assembledOrder) {
      return res.status(400).json({ error: 'mandateToken and assembledOrder are required' });
    }

    const { executeAgenticPurchase } = await import('../services/mandate');
    const result = await executeAgenticPurchase({ mandateToken, assembledOrder });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error executing purchase:', error);
    res.status(500).json({ error: 'Failed to execute agentic purchase' });
  }
});