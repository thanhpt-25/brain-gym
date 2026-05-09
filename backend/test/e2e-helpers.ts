import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole, OrgRole, UserPlan } from '@prisma/client';

// ─── User helpers ─────────────────────────────────────────────────────────────

export async function createTestUser(
  prisma: PrismaService,
  opts: {
    email: string;
    displayName: string;
    role?: UserRole;
    plan?: UserPlan;
  },
) {
  return prisma.user.create({
    data: {
      email: opts.email,
      passwordHash: 'e2e-test-hash',
      displayName: opts.displayName,
      role: opts.role ?? UserRole.LEARNER,
      plan: opts.plan ?? UserPlan.FREE,
    },
  });
}

export function generateToken(
  app: INestApplication,
  user: { id: string; email: string; role: string },
) {
  const jwtService = app.get<JwtService>(JwtService);
  const configService = app.get<ConfigService>(ConfigService);
  const jwtSecret = configService.get<string>('JWT_SECRET');

  return jwtService.sign(
    { sub: user.id, email: user.email, role: user.role },
    { secret: jwtSecret, expiresIn: '1h' },
  );
}

// ─── Organization helpers ─────────────────────────────────────────────────────

export async function createTestOrg(
  prisma: PrismaService,
  ownerId: string,
  opts: { name: string; slug?: string; maxSeats?: number },
) {
  const slug =
    opts.slug ??
    opts.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();

  const org = await prisma.organization.create({
    data: {
      name: opts.name,
      slug,
      maxSeats: opts.maxSeats ?? 50,
    },
  });

  const membership = await prisma.orgMember.create({
    data: {
      orgId: org.id,
      userId: ownerId,
      role: OrgRole.OWNER,
    },
  });

  return { org, membership };
}

export async function addOrgMember(
  prisma: PrismaService,
  orgId: string,
  userId: string,
  role: OrgRole,
) {
  return prisma.orgMember.create({
    data: { orgId, userId, role },
  });
}

// ─── Certification + Question helpers ─────────────────────────────────────────

export async function createTestCertification(
  prisma: PrismaService,
  opts: { name: string; code: string },
) {
  // Find or create provider, handling potential duplicates from previous test runs
  let provider = await prisma.provider.findUnique({
    where: { slug: 'e2e-test-provider' },
  });
  if (!provider) {
    try {
      provider = await prisma.provider.create({
        data: { name: 'E2E Test Provider', slug: 'e2e-test-provider' },
      });
    } catch (error: any) {
      // Name might already exist with different slug, find it by name
      if (error.code === 'P2002') {
        provider = await prisma.provider.findFirst({
          where: { name: 'E2E Test Provider' },
        });
      }
      if (!provider) throw error;
    }
  }

  const cert = await prisma.certification.upsert({
    where: { code: opts.code },
    update: { name: opts.name, providerId: provider.id },
    create: {
      name: opts.name,
      code: opts.code,
      providerId: provider.id,
    },
  });

  return { cert, provider };
}

export async function createTestPublicQuestion(
  prisma: PrismaService,
  opts: { certId: string; createdBy: string; title: string },
) {
  return prisma.question.create({
    data: {
      certificationId: opts.certId,
      createdBy: opts.createdBy,
      title: opts.title,
      status: 'APPROVED',
      choices: {
        create: [
          {
            label: 'a',
            content: 'Wrong answer',
            isCorrect: false,
            sortOrder: 0,
          },
          {
            label: 'b',
            content: 'Correct answer',
            isCorrect: true,
            sortOrder: 1,
          },
          {
            label: 'c',
            content: 'Another wrong',
            isCorrect: false,
            sortOrder: 2,
          },
        ],
      },
    },
    include: { choices: true },
  });
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function cleanupByEmail(
  prisma: PrismaService,
  emailPrefix: string,
) {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: emailPrefix } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  if (userIds.length === 0) return;

  // Delete org memberships → then orgs created by these users (via ownership)
  const memberships = await prisma.orgMember.findMany({
    where: { userId: { in: userIds }, role: OrgRole.OWNER },
    select: { orgId: true },
  });
  const ownedOrgIds = memberships.map((m) => m.orgId);

  if (ownedOrgIds.length > 0) {
    // Cascade deletes from org: members, invites, groups, questions, catalog, assessments, etc.
    await prisma.organization.deleteMany({
      where: { id: { in: ownedOrgIds } },
    });
  }

  // Delete custom standalone exams that might not cascade via Org
  await prisma.examAttempt.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.exam.deleteMany({ where: { createdBy: { in: userIds } } });

  // Delete public questions created by these users (choices first due to FK)
  const publicQuestions = await prisma.question.findMany({
    where: { createdBy: { in: userIds } },
    select: { id: true },
  });
  const publicQIds = publicQuestions.map((q) => q.id);
  if (publicQIds.length > 0) {
    await prisma.choice.deleteMany({
      where: { questionId: { in: publicQIds } },
    });
    await prisma.question.deleteMany({ where: { id: { in: publicQIds } } });
  }

  // Delete question generation jobs (references users)
  await prisma.questionGenerationJob.deleteMany({
    where: { userId: { in: userIds } },
  });

  // Delete users (cascades to non-org relations)
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

export async function cleanupCertByCode(
  prisma: PrismaService,
  codePrefix: string,
) {
  // Delete questions first (they reference certifications)
  const certs = await prisma.certification.findMany({
    where: { code: { startsWith: codePrefix } },
    select: { id: true },
  });
  const certIds = certs.map((c) => c.id);

  if (certIds.length > 0) {
    await prisma.question.deleteMany({
      where: { certificationId: { in: certIds } },
    });
    await prisma.certification.deleteMany({ where: { id: { in: certIds } } });
  }
}
