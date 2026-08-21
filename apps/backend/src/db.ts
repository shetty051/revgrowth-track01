import { PrismaClient } from '../../../packages/db/node_modules/@prisma/client';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../../packages/db/prisma/dev.db');

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`,
    },
  },
});