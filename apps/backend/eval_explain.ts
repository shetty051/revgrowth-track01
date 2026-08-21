import { generateOpportunityExplanation, fetchRawOpportunityData } from './src/services/gemini';
import {
  detectWinBackCandidates,
  detectCrossSellOpportunities,
  detectUpsellOpportunities,
} from './src/services/analytics';

async function runEval() {
  console.log('--- STARTING EVALUATION SCRIPT: GEMINI NUMERIC GROUNDING ---');

  const [winback, crossSell, upsell] = await Promise.all([
    detectWinBackCandidates(),
    detectCrossSellOpportunities(),
    detectUpsellOpportunities(),
  ]);

  const targetIds = [
    winback[0]?.customerId,
    winback[1]?.customerId,
    crossSell[0]?.productA.id,
    upsell[0]?.customerId,
    upsell[1]?.customerId,
  ].filter(Boolean) as string[];

  console.log(`Evaluating ${targetIds.length} opportunities for exact number match...\n`);

  for (let i = 0; i < targetIds.length; i++) {
    const id = targetIds[i];
    const { explanation, rawData } = await generateOpportunityExplanation(id);

    console.log(`========================================`);
    console.log(`EVAL ITEM #${i + 1} (Type: ${rawData.opportunityType})`);
    console.log(`Raw Tool Data JSON:\n`, JSON.stringify(rawData, null, 2));
    console.log(`\nGemini Output Sentence:\n"${explanation}"`);

    // Extract all numbers (integers or decimals) from the explanation text
    const numbersInExplanation = explanation.match(/\d+(\.\d+)?/g) || [];
    console.log(`\nExtracted Numbers in Explanation:`, numbersInExplanation);

    // Extract all numerical values from raw JSON
    const rawNumbers = extractNumbersFromObject(rawData);
    console.log(`Raw Numbers in Tool JSON:`, rawNumbers);

    let hasMismatch = false;
    const diffs: string[] = [];

    for (const numStr of numbersInExplanation) {
      const numVal = parseFloat(numStr);
      // Check if number exists in raw JSON (allowing percentage representation e.g. 0.74 vs 74)
      const matches = rawNumbers.some(
        (rn) => Math.abs(rn - numVal) < 0.01 || Math.abs(rn * 100 - numVal) < 0.01
      );
      if (!matches) {
        hasMismatch = true;
        diffs.push(`MISMATCH FLAGGED: Number "${numStr}" in explanation text is NOT in raw tool JSON.`);
      } else {
        diffs.push(`MATCH CONFIRMED: Number "${numStr}" exists in raw tool JSON.`);
      }
    }

    console.log(`\nNumeric Diff Results:`);
    diffs.forEach((d) => console.log(`  - ${d}`));
    console.log(`STATUS: ${hasMismatch ? 'FAILED (UNGROUNDED NUMBERS FOUND)' : 'PASSED (100% NUMERICALLY GROUNDED)'}`);
    console.log(`========================================\n`);
  }
}

function extractNumbersFromObject(obj: any): number[] {
  let numbers: number[] = [];
  if (typeof obj === 'number') {
    numbers.push(obj);
  } else if (typeof obj === 'string') {
    // Only extract numbers from non-UUID string values (e.g. "Customer 41", "Module 25")
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(obj);
    if (!isUuid) {
      const matches = obj.match(/\d+(\.\d+)?/g);
      if (matches) {
        matches.forEach((m) => numbers.push(parseFloat(m)));
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key of Object.keys(obj)) {
      numbers = numbers.concat(extractNumbersFromObject(obj[key]));
    }
  }
  return numbers;
}

runEval().catch(console.error);