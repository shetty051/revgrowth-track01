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