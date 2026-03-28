import { PrismaClient, UserRole, QuestionType, Difficulty, QuestionStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // 1. Create Admins and Contributors
  const passwordHash = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@braingym.com' },
    update: {},
    create: {
      email: 'admin@braingym.com',
      displayName: 'Admin User',
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const contributorUser = await prisma.user.upsert({
    where: { email: 'contributor@braingym.com' },
    update: {},
    create: {
      email: 'contributor@braingym.com',
      displayName: 'Contributor User',
      passwordHash,
      role: UserRole.CONTRIBUTOR,
    },
  });

  console.log('Users seeded');

  // 2. Create Providers
  const providersData = [
    { name: 'AWS', slug: 'aws', website: 'https://aws.amazon.com', description: 'Amazon Web Services cloud platform' },
    { name: 'Azure', slug: 'azure', website: 'https://azure.microsoft.com', description: 'Microsoft Azure cloud platform' },
    { name: 'Google Cloud', slug: 'google-cloud', website: 'https://cloud.google.com', description: 'Google Cloud Platform' },
    { name: 'CNCF', slug: 'cncf', website: 'https://www.cncf.io', description: 'Cloud Native Computing Foundation' },
    { name: 'PMI', slug: 'pmi', website: 'https://www.pmi.org', description: 'Project Management Institute' },
  ];

  const providerMap = new Map<string, string>();

  for (const p of providersData) {
    const provider = await prisma.provider.upsert({
      where: { slug: p.slug },
      update: {},
      create: p,
    });
    providerMap.set(p.name, provider.id);
  }

  console.log('Providers seeded');

  // 3. Create Certifications and Domains
  const certsData = [
    {
      id: 'aws-saa',
      providerName: 'AWS',
      name: 'Solutions Architect Associate',
      code: 'SAA-C03',
      description: 'Design distributed systems on AWS with high availability and fault tolerance.',
      domains: ['Design Resilient Architectures', 'Design High-Performing Architectures', 'Design Secure Applications', 'Design Cost-Optimized Architectures'],
    },
    {
      id: 'az-900',
      providerName: 'Azure',
      name: 'Azure Fundamentals',
      code: 'AZ-900',
      description: 'Foundational knowledge of cloud concepts and Azure services.',
      domains: ['Cloud Concepts', 'Azure Architecture', 'Azure Services', 'Security & Compliance'],
    },
    {
      id: 'gcp-pca',
      providerName: 'Google Cloud',
      name: 'Professional Cloud Architect',
      code: 'PCA',
      description: 'Design and manage solutions using Google Cloud technologies.',
      domains: ['Design & Plan', 'Manage & Provision', 'Security & Compliance', 'Analyzing Processes'],
    },
    {
      id: 'cka',
      providerName: 'CNCF',
      name: 'Certified Kubernetes Administrator',
      code: 'CKA',
      description: 'Demonstrate competence in Kubernetes cluster administration.',
      domains: ['Cluster Architecture', 'Workloads & Scheduling', 'Services & Networking', 'Storage', 'Troubleshooting'],
    },
    {
      id: 'pmp',
      providerName: 'PMI',
      name: 'Project Management Professional',
      code: 'PMP',
      description: 'Globally recognized project management certification.',
      domains: ['People', 'Process', 'Business Environment'],
    },
  ];

  const domainMap = new Map<string, string>(); // 'certId-domainName' -> domainId

  for (const cert of certsData) {
    const providerId = providerMap.get(cert.providerName)!;

    const createdCert = await prisma.certification.upsert({
      where: { code: cert.code },
      update: { providerId },
      create: {
        id: cert.id,
        providerId,
        name: cert.name,
        code: cert.code,
        description: cert.description,
      },
    });

    for (const domainName of cert.domains) {
      // Find or create domain
      let domain = await prisma.domain.findFirst({
        where: { certificationId: createdCert.id, name: domainName },
      });

      if (!domain) {
        domain = await prisma.domain.create({
          data: {
            certificationId: createdCert.id,
            name: domainName,
          },
        });
      }
      domainMap.set(`${cert.id}-${domainName}`, domain.id);
    }
  }

  console.log('Certifications seeded');

  // 4. Create Questions and Choices
  const questionsData = [
    {
      title: 'Which AWS service provides a managed relational database?',
      explanation: 'Amazon RDS (Relational Database Service) is a managed service that makes it easy to set up, operate, and scale a relational database in the cloud.',
      difficulty: Difficulty.EASY,
      domain: 'Design High-Performing Architectures',
      certificationId: 'aws-saa',
      choices: [
        { label: 'a', text: 'Amazon S3', isCorrect: false },
        { label: 'b', text: 'Amazon RDS', isCorrect: true },
        { label: 'c', text: 'Amazon SQS', isCorrect: false },
        { label: 'd', text: 'Amazon CloudFront', isCorrect: false },
      ]
    },
    {
      title: 'A company needs to store infrequently accessed data with rapid retrieval. Which S3 storage class should they use?',
      description: 'The company has regulatory requirements to retain data for 5 years but only accesses it once a quarter for audit purposes.',
      explanation: 'S3 Standard-IA is designed for data that is accessed less frequently but requires rapid access when needed. It offers lower storage costs than S3 Standard while maintaining the same low latency.',
      difficulty: Difficulty.MEDIUM,
      domain: 'Design Cost-Optimized Architectures',
      certificationId: 'aws-saa',
      choices: [
        { label: 'a', text: 'S3 Standard', isCorrect: false },
        { label: 'b', text: 'S3 Glacier Deep Archive', isCorrect: false },
        { label: 'c', text: 'S3 Standard-Infrequent Access', isCorrect: true },
        { label: 'd', text: 'S3 One Zone-IA', isCorrect: false },
      ]
    },
    {
      title: 'Which service enables you to create a logically isolated section of the AWS Cloud?',
      explanation: 'Amazon VPC (Virtual Private Cloud) lets you provision a logically isolated section of the AWS Cloud where you can launch AWS resources in a virtual network that you define.',
      difficulty: Difficulty.EASY,
      domain: 'Design Secure Applications',
      certificationId: 'aws-saa',
      choices: [
        { label: 'a', text: 'AWS IAM', isCorrect: false },
        { label: 'b', text: 'Amazon VPC', isCorrect: true },
        { label: 'c', text: 'AWS CloudTrail', isCorrect: false },
        { label: 'd', text: 'Amazon Route 53', isCorrect: false },
      ]
    }
  ];

  for (const q of questionsData) {
    const domainId = domainMap.get(`${q.certificationId}-${q.domain}`);

    // Check if question already exists by title
    const existingQ = await prisma.question.findFirst({
      where: { title: q.title }
    });

    if (!existingQ) {
      await prisma.question.create({
        data: {
          title: q.title,
          description: q.description || null,
          explanation: q.explanation,
          difficulty: q.difficulty,
          status: QuestionStatus.APPROVED,
          certificationId: q.certificationId,
          domainId: domainId,
          createdBy: contributorUser.id,
          choices: {
            create: q.choices.map((c, index) => ({
              label: c.label,
              content: c.text,
              isCorrect: c.isCorrect,
              sortOrder: index,
            }))
          }
        }
      });
    }
  }

  console.log('Questions seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
