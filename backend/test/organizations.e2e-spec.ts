import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrgRole, UserPlan } from '@prisma/client';
import {
  createTestUser,
  generateToken,
  createTestOrg,
  addOrgMember,
  cleanupByEmail,
} from './e2e-helpers';

const EMAIL_PREFIX = 'e2e-org-';

describe('Organizations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let joinerToken: string;
  let ownerId: string;
  let adminId: string;
  let memberId: string;
  let joinerId: string;
  let orgId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up any leftover data from previous failed runs
    await cleanupByEmail(prisma, EMAIL_PREFIX);

    // Create test users
    const owner = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}owner@test.com`,
      displayName: 'E2E Org Owner',
      plan: UserPlan.ENTERPRISE,
    });
    ownerId = owner.id;
    ownerToken = generateToken(app, owner);

    const admin = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}admin@test.com`,
      displayName: 'E2E Org Admin',
    });
    adminId = admin.id;
    adminToken = generateToken(app, admin);

    const member = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}member@test.com`,
      displayName: 'E2E Org Member',
    });
    memberId = member.id;
    memberToken = generateToken(app, member);

    const joiner = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}joiner@test.com`,
      displayName: 'E2E Org Joiner',
      plan: UserPlan.PREMIUM,
    });
    joinerId = joiner.id;
    joinerToken = generateToken(app, joiner);
  });

  afterAll(async () => {
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await prisma.$disconnect();
    await app.close();
  });

  // ─── Org CRUD ───────────────────────────────────────────────────────────────

  it('should create organization (POST /organizations)', async () => {
    const res = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E Test Organization' })
      .expect(201);

    orgId = res.body.id;
    expect(orgId).toBeDefined();
    expect(res.body.name).toBe('E2E Test Organization');
    expect(res.body.slug).toBeDefined();
  });

  it('should list my organizations (GET /organizations/my)', async () => {
    const res = await request(app.getHttpServer())
      .get('/organizations/my')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.some((o: any) => o.id === orgId)).toBeTruthy();
    expect(res.body.find((o: any) => o.id === orgId).myRole).toBe('OWNER');
  });

  it('should get org details (GET /organizations/:orgId)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.id).toBe(orgId);
    expect(res.body._count).toBeDefined();
  });

  it('should update org settings as OWNER (PATCH /organizations/:orgId)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Updated E2E Org' })
      .expect(200);

    expect(res.body.name).toBe('Updated E2E Org');
  });

  // ─── Member Invitation Flow ────────────────────────────────────────────────

  let inviteToken: string;

  it('should invite member by email (POST /:orgId/members/invite)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/members/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `${EMAIL_PREFIX}admin@test.com`, role: 'ADMIN' })
      .expect(201);

    const invite = await prisma.orgInvite.findFirst({
      where: { email: `${EMAIL_PREFIX}admin@test.com` },
    });
    inviteToken = invite!.token;
    expect(inviteToken).toBeDefined();
    expect(res.body.email).toBe(`${EMAIL_PREFIX}admin@test.com`);
    expect(res.body.status).toBe('PENDING');
  });

  it('should accept invite via token (POST /accept-invite/:token)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/accept-invite/${inviteToken}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(res.body.role).toBe('ADMIN');
    expect(res.body.orgId).toBe(orgId);
  });

  it('should reject already-accepted invite (POST /accept-invite/:token)', async () => {
    await request(app.getHttpServer())
      .post(`/organizations/accept-invite/${inviteToken}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  // ─── RBAC ──────────────────────────────────────────────────────────────────

  it('should allow ADMIN to invite members', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/members/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `${EMAIL_PREFIX}member@test.com`, role: 'MEMBER' })
      .expect(201);

    const invite = await prisma.orgInvite.findFirst({
      where: { email: `${EMAIL_PREFIX}member@test.com` },
    });

    // Accept with the member's token
    const acceptRes = await request(app.getHttpServer())
      .post(`/organizations/accept-invite/${invite!.token}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);

    expect(acceptRes.body.role).toBe('MEMBER');
  });

  it('should deny MEMBER from updating org (PATCH /:orgId → 403)', async () => {
    await request(app.getHttpServer())
      .patch(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hacked Name' })
      .expect(403);
  });

  // ─── Members CRUD ─────────────────────────────────────────────────────────

  it('should list members (GET /:orgId/members)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3); // owner + admin + member
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('should change member role (PATCH /:orgId/members/:userId)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/organizations/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'MANAGER' })
      .expect(200);

    expect(res.body.role).toBe('MANAGER');

    // Revert back for subsequent tests
    await request(app.getHttpServer())
      .patch(`/organizations/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'MEMBER' })
      .expect(200);
  });

  // ─── Join Link ──────────────────────────────────────────────────────────────

  let joinCode: string;

  it('should generate join link (POST /:orgId/join-links)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/join-links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect(201);

    joinCode = res.body.code;
    expect(joinCode).toBeDefined();
  });

  it('should join via link (GET /join/:code)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/join/${joinCode}`)
      .set('Authorization', `Bearer ${joinerToken}`)
      .expect(200);

    expect(res.body.orgId).toBe(orgId);
    expect(res.body.role).toBe('MEMBER');
  });

  // ─── Groups ─────────────────────────────────────────────────────────────────

  it('should create and list groups', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/groups`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Engineering', description: 'Dev team' })
      .expect(201);

    expect(createRes.body.name).toBe('Engineering');

    const listRes = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/groups`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(listRes.body).toBeInstanceOf(Array);
    expect(
      listRes.body.some((g: any) => g.name === 'Engineering'),
    ).toBeTruthy();
  });

  // ─── Delete ─────────────────────────────────────────────────────────────────

  it('should remove a member (DELETE /:orgId/members/:userId)', async () => {
    await request(app.getHttpServer())
      .delete(`/organizations/${orgId}/members/${joinerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    // Verify removed — joiner should get 403 now
    await request(app.getHttpServer())
      .get(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${joinerToken}`)
      .expect(403);
  });
});
