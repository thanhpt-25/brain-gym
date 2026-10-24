import 'dotenv/config';
import { PrismaClient } from '../src/prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.user.update({
    where: { email: 'admin@braingym.com' },
    data: { featureFlags: { passPredictorBeta: true } },
  });
  console.log('Admin updated with beta flag.');

  await prisma.user.update({
    where: { email: 'contributor@braingym.com' },
    data: { featureFlags: { passPredictorBeta: false } },
  });
  console.log('Contributor updated without beta flag.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
