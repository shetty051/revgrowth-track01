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
    const { prisma } = await import('../db');

    const amountInRupees = Number(spendCap || 250);
    const amountInPaise = Math.round(amountInRupees * 100);

    const razorpayOrderPayload = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        opportunityId,
        targetName,
        campaignType: type || 'winback',
      },
    };

    const campaign = await prisma.campaign.create({
      data: {
        type: type || 'winback',
        status: 'active',
        audienceSize: Number(audienceSize || 1),
        offerPct: Number(offerPct || 15),
        spendCap: amountInRupees,
        result: JSON.stringify({
          opportunityId,
          targetName,
          currency: 'INR',
          razorpayOrderPayload,
          createdAt: new Date().toISOString(),
        }),
        logs: {
          create: {
            step: 'RAZORPAY_ORDER_CREATED',
            payload: JSON.stringify({
              status: 'active',
              currency: 'INR',
              amountInPaise,
              merchantConfirmedAt: new Date().toISOString(),
            }),
          },
        },
      },
    });

    res.json({ success: true, campaign, razorpayOrderPayload });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});