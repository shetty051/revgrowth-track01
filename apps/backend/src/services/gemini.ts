import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import {
  detectWinBackCandidates,
  detectCrossSellOpportunities,
  detectUpsellOpportunities,
} from './analytics';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || 'MOCK_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

// Define tool schema get_opportunity_data
const getOpportunityDataTool: FunctionDeclaration = {
  name: 'get_opportunity_data',
  description: 'Fetches raw mathematical opportunity data by ID or target customer/product name.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      opportunityId: {
        type: SchemaType.STRING,
        description: 'The target customerId or product pair key to retrieve raw metrics for.',
      },
    },
    required: ['opportunityId'],
  },
};

export async function fetchRawOpportunityData(opportunityId: string) {
  const [winback, crossSell, upsell] = await Promise.all([
    detectWinBackCandidates(),
    detectCrossSellOpportunities(),
    detectUpsellOpportunities(),
  ]);

  const all = [...winback, ...crossSell, ...upsell];
  
  // Match by customerId, productA.id, or index
  const match = all.find(
    (item: any) =>
      item.customerId === opportunityId ||
      (item.productA && item.productA.id === opportunityId) ||
      (item.baseProduct && item.baseProduct.id === opportunityId)
  ) || all[0];

  return match;
}

export async function generateOpportunityExplanation(opportunityId: string) {
  const rawData = await fetchRawOpportunityData(opportunityId);

  // If mock API key, return deterministic grounded explanation
  if (apiKey === 'MOCK_API_KEY') {
    return formatGroundedFallbackExplanation(rawData);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [getOpportunityDataTool] }],
    });

    const systemPrompt = `You are a financial revenue analyst for RevGrowth.
CRITICAL CONSTRAINT: You may only state numbers that appear in the tool result. Never estimate, round creatively, or invent a statistic that isn't in the data. If the data is insufficient to make a claim, say so.

Your response MUST be exactly 2-3 sentences:
1. State the detected pattern using exact customer/product names and raw data numbers.
2. State the expected upside value using the exact estimatedImpact from the tool result.
3. State the explicit downside risk if the campaign underperforms.`;

    const chat = model.startChat({
      systemInstruction: systemPrompt,
    });

    const prompt = `Please call get_opportunity_data for opportunity ID "${opportunityId}" and generate the 2-3 sentence financial explanation based ONLY on the tool output.`;
    let result = await chat.sendMessage(prompt);
    
    const functionCalls = result.response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === 'get_opportunity_data') {
        const toolResult = await fetchRawOpportunityData(String(call.args.opportunityId || opportunityId));
        result = await chat.sendMessage([
          {
            functionResponse: {
              name: 'get_opportunity_data',
              response: { data: toolResult },
            },
          },
        ]);
      }
    }

    return {
      explanation: result.response.text().trim(),
      rawData,
    };
  } catch (error) {
    console.warn('Gemini API call failed or unconfigured, returning grounded formatted response:', error);
    return formatGroundedFallbackExplanation(rawData);
  }
}

function formatGroundedFallbackExplanation(rawData: any) {
  let explanation = '';
  if (rawData.opportunityType === 'winback') {
    explanation = `${rawData.customerName} has been inactive for ${rawData.daysInactive} days with $${rawData.pastSpend} in historical spend across ${rawData.totalTransactions} transactions. Engaging them yields an expected upside of $${rawData.estimatedImpact} in recovered revenue. Downside risk: campaign spend will be lost if customer engagement fails to convert.`;
  } else if (rawData.opportunityType === 'cross_sell') {
    explanation = `${rawData.productA.name} and ${rawData.productB.name} have a co-purchase count of ${rawData.coPurchaseCount} with a co-purchase rate of ${rawData.coPurchaseRate * 100}%. Targeting ${rawData.totalEligibleCount} eligible customers has an expected upside of $${rawData.estimatedImpact}. Downside risk: over-promoting secondary hardware may erode core brand focus if conversion drops.`;
  } else {
    explanation = `${rawData.customerName} purchased ${rawData.baseProduct.name} ${rawData.basePurchaseCount} times with total base spend of $${rawData.totalBaseSpend}. Upgrading to ${rawData.premiumProduct.name} yields an expected upside of $${rawData.estimatedImpact} with a price delta of $${rawData.priceDelta}. Downside risk: aggressive upsell messaging might trigger churn on existing tier subscriptions.`;
  }

  return {
    explanation,
    rawData,
  };
}
