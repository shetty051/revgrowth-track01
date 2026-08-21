import { prisma } from './src/db';

async function checkTx() {
  const transactions = await prisma.aiBuyerTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('RECENT AI BUYER DB TRANSACTIONS:\n', JSON.stringify(transactions, null, 2));
}

checkTx().catch(console.error);