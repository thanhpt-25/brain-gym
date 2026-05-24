const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.questionEmbedding.count();
    console.log(`Total rows in question_embeddings: ${count}`);
    
    // Check if IVFFlat index exists
    const indexCheck = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'question_embeddings' 
      AND indexname LIKE '%ivfflat%'
    `;
    console.log(`IVFFlat index exists: ${indexCheck.length > 0}`);
    if (indexCheck.length > 0) {
      console.log('Indexes found:', indexCheck);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
