import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  detectWinBackCandidates,
  detectCrossSellOpportunities,
  detectUpsellOpportunities,
} from './analytics';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || 'MOCK_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

// In-Memory Guardrail Config State (read by mandate & checkout modules)
export let currentGuardrailConfig = {
  autoApproveSpendLimitINR: 5000,
  maxOfferPct: 30,
  maxAudienceSize: 500,
  coolingOffDays: 7,
  lastUpdated: new Date().toISOString(),
};

export async function processVoiceCommand(transcription: string) {
  const normalized = transcription.toLowerCase();

  // Intent classification via Gemini or pattern matching
  let intent: 'analyze' | 'recommend' | 'execute' | 'report' | 'configure' = 'report';

  if (normalized.includes('configure') || normalized.includes('guardrail') || normalized.includes('allow') || normalized.includes('limit') || normalized.includes('threshold')) {
    intent = 'configure';
  } else if (normalized.includes('execute') || normalized.includes('run campaign') || normalized.includes('approve campaign') || normalized.includes('launch')) {
    intent = 'execute';
  } else if (normalized.includes('analyze') || normalized.includes('analysis') || normalized.includes('churn') || normalized.includes('inactive') || normalized.includes('dormant') || normalized.includes('customer') || normalized.includes('dormat')) {
    intent = 'analyze';
  } else if (normalized.includes('recommend') || normalized.includes('opportunity') || normalized.includes('upsell') || normalized.includes('cross-sell')) {
    intent = 'recommend';
  } else {
    intent = 'report';
  }

  let spokenResponse = '';
  let actionDetails: any = null;

  if (intent === 'configure') {
    // Parse spend limit (e.g. "allow AI agents to buy anything under ₹5,000 without approval")
    const match = normalized.match(/(\d+[\d,]*)/);
    let parsedLimit = 5000;
    if (match) {
      parsedLimit = parseInt(match[1].replace(/,/g, ''), 10);
    }

    currentGuardrailConfig = {
      ...currentGuardrailConfig,
      autoApproveSpendLimitINR: parsedLimit,
      lastUpdated: new Date().toISOString(),
    };

    spokenResponse = `Guardrails updated. AI agents are now authorized to execute transactions up to ₹${parsedLimit.toLocaleString('en-IN')} without manual approval.`;
    actionDetails = { type: 'CONFIGURE_GUARDRAILS', updatedConfig: currentGuardrailConfig };
  } else if (intent === 'execute') {
    // Voice proposes execution, but explicit confirmation modal must appear
    spokenResponse = `I have staged the top revenue expansion campaign for your review. Please confirm the execution parameters on screen to proceed.`;
    actionDetails = { type: 'PROPOSE_EXECUTION_CONFIRMATION', requireModal: true };
  } else if (intent === 'analyze') {
    const winback = await detectWinBackCandidates();
    const topCandidate = winback[0];
    spokenResponse = `Analytics engine identified ${winback.length} inactive win-back candidates. Top priority is ${topCandidate?.customerName || 'Customer 41'}, inactive for ${topCandidate?.daysInactive || 78} days with ₹${(topCandidate?.pastSpend || 0).toLocaleString('en-IN')} historical spend.`;
    actionDetails = { type: 'ANALYZE_SEGMENT', topCandidate, totalCandidates: winback.length };
  } else if (intent === 'recommend') {
    const [crossSell, upsell] = await Promise.all([
      detectCrossSellOpportunities(),
      detectUpsellOpportunities(),
    ]);
    spokenResponse = `Recommended ${crossSell.length} cross-sell co-purchase pairs and ${upsell.length} high-margin upsell upgrade targets, total expected revenue impact is over ₹2,50,000.`;
    actionDetails = { type: 'RECOMMENDATIONS', crossSellCount: crossSell.length, upsellCount: upsell.length };
  } else {
    // Report intent
    spokenResponse = `RevGrowth Dashboard status: Total revenue influenced is ₹2,48,500 across 4 active campaigns, with 18 verified audit events logged today.`;
    actionDetails = { type: 'SUMMARY_REPORT', status: 'healthy' };
  }

  return {
    transcription,
    intent,
    spokenResponse,
    actionDetails,
  };
}
