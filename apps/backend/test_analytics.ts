import {
  detectWinBackCandidates,
  detectCrossSellOpportunities,
  detectUpsellOpportunities,
} from './src/services/analytics';

async function test() {
  console.log('Testing pure analytics functions...');
  const winback = await detectWinBackCandidates();
  const crossSell = await detectCrossSellOpportunities();
  const upsell = await detectUpsellOpportunities();

  console.log(`\n1. WinBack Candidates Detected: ${winback.length}`);
  if (winback.length > 0) {
    console.log('Top WinBack Candidate:', JSON.stringify(winback[0], null, 2));
  }

  console.log(`\n2. CrossSell Opportunities Detected: ${crossSell.length}`);
  if (crossSell.length > 0) {
    console.log('Top CrossSell Pair:', JSON.stringify(crossSell[0], null, 2));
  }

  console.log(`\n3. Upsell Opportunities Detected: ${upsell.length}`);
  if (upsell.length > 0) {
    console.log('Top Upsell Candidate:', JSON.stringify(upsell[0], null, 2));
  }
}

test().catch(console.error);