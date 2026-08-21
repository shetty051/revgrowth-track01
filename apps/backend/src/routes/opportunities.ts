import { Router } from 'express';
import {
  detectWinBackCandidates,
  detectCrossSellOpportunities,
  detectUpsellOpportunities,
} from '../services/analytics';

export const opportunitiesRouter = Router();

opportunitiesRouter.get('/', async (_req, res) => {
  try {
    const [winback, crossSell, upsell] = await Promise.all([
      detectWinBackCandidates(),
      detectCrossSellOpportunities(),
      detectUpsellOpportunities(),
    ]);

    const allOpportunities = [
      ...winback,
      ...crossSell,
      ...upsell,
    ].sort((a, b) => b.estimatedImpact - a.estimatedImpact);

    const summary = {
      totalOpportunities: allOpportunities.length,
      winbackCount: winback.length,
      crossSellCount: crossSell.length,
      upsellCount: upsell.length,
      totalPotentialImpact: Number(allOpportunities.reduce((acc, curr) => acc + curr.estimatedImpact, 0).toFixed(2)),
    };

    res.json({
      summary,
      winback,
      crossSell,
      upsell,
      allOpportunities,
    });
  } catch (error) {
    console.error('Error calculating opportunities:', error);
    res.status(500).json({ error: 'Failed to compute revenue opportunities' });
  }
});

opportunitiesRouter.post('/:id/explain', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await import('../services/gemini').then((m) => m.generateOpportunityExplanation(id));
    res.json(result);
  } catch (error) {
    console.error('Error generating explanation:', error);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

opportunitiesRouter.post('/campaigns', async (req, res) => {
  try {
    const { type, audienceSize, offerPct, spendCap, opportunityId, targetName } = req.body;
    const { executeRazorpayCampaignWorkflow } = await import('../services/razorpay');

    const result = await executeRazorpayCampaignWorkflow({
      type: type || 'winback',
      audienceSize: Number(audienceSize || 1),
      offerPct: Number(offerPct || 15),
      spendCap: Number(spendCap || 5000),
      opportunityId,
      targetName: targetName || 'Target Segment',
    });

    res.json(result);
  } catch (error) {
    console.error('Error executing campaign:', error);
    res.status(500).json({ error: 'Failed to execute campaign' });
  }
});

opportunitiesRouter.get('/audit', async (_req, res) => {
  try {
    const { prisma } = await import('../db');
    const logs = await prisma.campaignLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        campaign: true,
      },
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});