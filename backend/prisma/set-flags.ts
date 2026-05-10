import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.update({
    where: { email: 'admin@braingym.com' },
    data: { featureFlags: { passPredictorBeta: true } }
  });
  console.log('Admin updated with beta flag.');

  await prisma.user.update({
    where: { email: 'contributor@braingym.com' },
    data: { featureFlags: { passPredictorBeta: false } }
  });
  console.log('Contributor updated without beta flag.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
