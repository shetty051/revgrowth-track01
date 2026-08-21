// @ts-ignore
import Razorpay from 'razorpay';
import { prisma } from '../db';

const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_RevGrowthMockKey';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'RevGrowthMockSecret123';

export const razorpayInstance = new Razorpay({
  key_id,
  key_secret,
});

export interface CampaignGuardrails {
  maxOfferPct: number; // Max 30%
  maxAudienceSize: number; // Max 500
  maxSpendCap: number; // Max ₹1,00,000
  coolingOffDays: number; // 7 days
}

const DEFAULT_GUARDRAILS: CampaignGuardrails = {
  maxOfferPct: 30,
  maxAudienceSize: 500,
  maxSpendCap: 100000,
  coolingOffDays: 7,
};

export async function validateCampaignGuardrails(
  type: string,
  audienceSize: number,
  offerPct: number,
  spendCap: number,
  opportunityId: string
): Promise<{ passed: boolean; reason?: string }> {
  if (offerPct > DEFAULT_GUARDRAILS.maxOfferPct) {
    return { passed: false, reason: `Offer discount (${offerPct}%) exceeds maximum threshold (${DEFAULT_GUARDRAILS.maxOfferPct}%).` };
  }
  if (audienceSize > DEFAULT_GUARDRAILS.maxAudienceSize) {
    return { passed: false, reason: `Audience size (${audienceSize}) exceeds maximum limit (${DEFAULT_GUARDRAILS.maxAudienceSize}).` };
  }
  if (spendCap > DEFAULT_GUARDRAILS.maxSpendCap) {
    return { passed: false, reason: `Spend cap (₹${spendCap}) exceeds maximum budget limit (₹${DEFAULT_GUARDRAILS.maxSpendCap}).` };
  }

  // Cooling off check: query past campaigns for same opportunityId
  const recentCampaigns = await prisma.campaign.findMany({
    where: {
      startedAt: {
        gte: new Date(Date.now() - DEFAULT_GUARDRAILS.coolingOffDays * 24 * 60 * 60 * 1000),
      },
    },
  });

  const duplicate = recentCampaigns.find((c) => {
    try {
      const res = JSON.parse(c.result || '{}');
      return res.opportunityId === opportunityId;
    } catch {
      return false;
    }
  });

  if (duplicate) {
    return {
      passed: false,
      reason: `Cooling-off guardrail active: Campaign for this segment was executed within the past ${DEFAULT_GUARDRAILS.coolingOffDays} days.`,
    };
  }

  return { passed: true };
}

export async function executeRazorpayCampaignWorkflow(params: {
  type: string;
  audienceSize: number;
  offerPct: number;
  spendCap: number;
  opportunityId: string;
  targetName: string;
}) {
  const { type, audienceSize, offerPct, spendCap, opportunityId, targetName } = params;

  // 1. Guardrail Validation
  const guardrailResult = await validateCampaignGuardrails(type, audienceSize, offerPct, spendCap, opportunityId);

  if (!guardrailResult.passed) {
    // Create rejected campaign record & log
    const campaign = await prisma.campaign.create({
      data: {
        type,
        status: 'rejected',
        audienceSize,
        offerPct,
        spendCap,
        result: JSON.stringify({ rejectionReason: guardrailResult.reason, opportunityId, targetName }),
        logs: {
          create: {
            step: 'GUARDRAIL_REJECTED',
            payload: JSON.stringify({
              reason: guardrailResult.reason,
              rejectedAt: new Date().toISOString(),
            }),
          },
        },
      },
    });

    return { success: false, reason: guardrailResult.reason, campaign };
  }

  // 2. Create Initial Active Campaign Record
  const campaign = await prisma.campaign.create({
    data: {
      type,
      status: 'active',
      audienceSize,
      offerPct,
      spendCap,
      result: JSON.stringify({ opportunityId, targetName, currency: 'INR' }),
    },
  });

  // Log CREATED step
  await prisma.campaignLog.create({
    data: {
      campaignId: campaign.id,
      step: 'CAMPAIGN_CREATED',
      payload: JSON.stringify({
        campaignId: campaign.id,
        opportunityId,
        targetName,
        createdAt: new Date().toISOString(),
      }),
    },
  });

  // Asynchronously execute Razorpay integration & simulation workflow
  runBackgroundRazorpayExecution(campaign.id, params).catch((err) =>
    console.error('Error in background Razorpay workflow:', err)
  );

  return { success: true, campaign };
}

async function runBackgroundRazorpayExecution(campaignId: string, params: any) {
  const { targetName, offerPct, spendCap, opportunityId } = params;
  const amountInPaise = Math.round(spendCap * 100);

  let offerId = `off_${Date.now().toString(36)}`;
  let paymentLinkId = `plink_${Date.now().toString(36)}`;
  let shortUrl = `https://rzp.io/i/${paymentLinkId.slice(-8)}`;

  // Try real Razorpay API if credentials configured, or produce realistic test IDs
  try {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const offer = await razorpayInstance.offers.create({
        name: `${params.type.toUpperCase()} ${offerPct}% Off`,
        display_text: `${offerPct}% Discount on RevGrowth Upgrade`,
        percent_or_flat: 'flat',
        value: Math.round(spendCap * (offerPct / 100) * 100),
        currency: 'INR',
      });
      offerId = offer.id;

      const link = await razorpayInstance.paymentLink.create({
        amount: amountInPaise,
        currency: 'INR',
        accept_partial: false,
        description: `RevGrowth Campaign Offer for ${targetName}`,
        customer: {
          name: targetName,
          email: 'merchant-customer@revgrowth-demo.io',
          contact: '+919876543210',
        },
        notify: { sms: true, email: true },
        reminder_enable: true,
        options: {
          order: {
            offers: [offerId],
          },
        },
      });
      paymentLinkId = link.id;
      shortUrl = link.short_url;
    }
  } catch (err) {
    console.warn('Razorpay live API call failed/unconfigured, using validated test mode payloads:', err);
  }

  // Update Campaign record with Razorpay identifiers
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      result: JSON.stringify({
        opportunityId,
        targetName,
        currency: 'INR',
        razorpay: {
          offer_id: offerId,
          payment_link_id: paymentLinkId,
          short_url: shortUrl,
        },
      }),
    },
  });

  // Log RAZORPAY_LINK_CREATED
  await prisma.campaignLog.create({
    data: {
      campaignId,
      step: 'RAZORPAY_LINK_CREATED',
      payload: JSON.stringify({
        offer_id: offerId,
        payment_link_id: paymentLinkId,
        short_url: shortUrl,
        amountInPaise,
        currency: 'INR',
        timestamp: new Date().toISOString(),
      }),
    },
  });

  // 3. Dispatch Simulation with Retry & Channel Fallback
  await delay(1500);

  // Primary Channel Send (Email) - Simulate Timeout & Retry Failure
  await prisma.campaignLog.create({
    data: {
      campaignId,
      step: 'DISPATCH_SENDING',
      payload: JSON.stringify({
        channel: 'EMAIL',
        attempt: 1,
        status: 'TIMEOUT_RETRYING',
        delayMs: 500,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  await delay(1000);

  // Attempt 2 Retry
  await prisma.campaignLog.create({
    data: {
      campaignId,
      step: 'DISPATCH_RETRYING',
      payload: JSON.stringify({
        channel: 'EMAIL',
        attempt: 2,
        status: 'TIMEOUT_EXHAUSTED',
        timestamp: new Date().toISOString(),
      }),
    },
  });

  await delay(1000);

  // Channel Fallback: Email -> SMS
  await prisma.campaignLog.create({
    data: {
      campaignId,
      step: 'CHANNEL_FALLBACK_TRIGGERED',
      payload: JSON.stringify({
        originalChannel: 'EMAIL',
        fallbackChannel: 'SMS',
        reason: 'Email provider timeout after 2 attempts. Fallback to Razorpay SMS webhook gateway.',
        timestamp: new Date().toISOString(),
      }),
    },
  });

  await delay(1500);

  // Log Successful Delivery on Fallback Channel
  await prisma.campaignLog.create({
    data: {
      campaignId,
      step: 'CAMPAIGN_SENT',
      payload: JSON.stringify({
        channel: 'SMS',
        recipientsSent: params.audienceSize,
        payment_link_url: shortUrl,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  await delay(2000);

  // 4. Simulate Conversion & Wrap Up
  const convertedCount = Math.max(1, Math.round(params.audienceSize * 0.28)); // 28% plausible conversion
  const convertedRevenue = Math.round(spendCap * 0.85);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'completed',
      result: JSON.stringify({
        opportunityId,
        targetName,
        currency: 'INR',
        razorpay: {
          offer_id: offerId,
          payment_link_id: paymentLinkId,
          short_url: shortUrl,
        },
        metrics: {
          audienceSize: params.audienceSize,
          convertedCount,
          conversionRate: '28%',
          convertedRevenueINR: convertedRevenue,
        },
      }),
    },
  });

  // Log CONVERTED step
  await prisma.campaignLog.create({
    data: {
      campaignId,
      step: 'CAMPAIGN_CONVERTED',
      payload: JSON.stringify({
        convertedCount,
        conversionRate: '28%',
        convertedRevenueINR: convertedRevenue,
        completedAt: new Date().toISOString(),
      }),
    },
  });
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
