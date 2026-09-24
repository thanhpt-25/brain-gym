import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDb, createAdminUser, createTestUser } from './helpers';

// Keep the suite independent of exam fixtures; account age is set per test.
process.env.CONTRIBUTOR_REQUEST_MIN_ATTEMPTS = '0';

const MOTIVATION =
  'I passed SAA-C03 last year and would like to write scenario questions.';

describe('Contributor role requests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDb(prisma as any);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  async function createLearner(suffix: string) {
    const learner = await createTestUser(app, { suffix });
    await prisma.user.update({
      where: { id: learner.userId },
      data: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    return learner;
  }

  it('learner requests, admin approves, learner can act as contributor', async () => {
    const learner = await createLearner('cr-learner');
    const admin = await createAdminUser(app, 'cr-admin');
    const server = app.getHttpServer();

    // Learner cannot create questions yet (role guard)
    await request(server)
      .post('/questions')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({})
      .expect(403);

    const eligibility = await request(server)
      .get('/contributor-requests/me/eligibility')
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(200);
    expect(eligibility.body.eligible).toBe(true);

    const created = await request(server)
      .post('/contributor-requests')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ motivation: MOTIVATION })
      .expect(201);
    expect(created.body.status).toBe('PENDING');

    // Only one pending request per user
    const dup = await request(server)
      .post('/contributor-requests')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ motivation: MOTIVATION })
      .expect(409);
    expect(dup.body.code).toBe('REQUEST_ALREADY_PENDING');

    // Learners cannot reach admin endpoints
    await request(server)
      .get('/admin/contributor-requests')
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(403);

    const stats = await request(server)
      .get('/admin/contributor-requests/stats')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(stats.body.pending).toBe(1);

    const list = await request(server)
      .get('/admin/contributor-requests')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].user.id).toBe(learner.userId);

    await request(server)
      .post(`/admin/contributor-requests/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ note: 'Welcome aboard' })
      .expect(201);

    // Second decision on the same request is a conflict
    const again = await request(server)
      .post(`/admin/contributor-requests/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Changed my mind about this one' })
      .expect(409);
    expect(again.body.code).toBe('REQUEST_NOT_PENDING');

    const user = await prisma.user.findUnique({
      where: { id: learner.userId },
    });
    expect(user?.role).toBe(UserRole.CONTRIBUTOR);

    // Same (old) token: the role guard reads the DB role, so the guard now
    // passes and the empty body fails validation instead of authorization.
    await request(server)
      .post('/questions')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({})
      .expect(400);

    const actions = (
      await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'CONTRIBUTOR_REQUEST_CREATED',
        'CONTRIBUTOR_REQUEST_APPROVED',
        'ROLE_CHANGED',
      ]),
    );
  });

  it('rejection requires a reason and starts the cooldown', async () => {
    const learner = await createLearner('cr-rejected');
    const admin = await createAdminUser(app, 'cr-admin-2');
    const server = app.getHttpServer();

    const created = await request(server)
      .post('/contributor-requests')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ motivation: MOTIVATION })
      .expect(201);

    await request(server)
      .post(`/admin/contributor-requests/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'short' })
      .expect(400);

    await request(server)
      .post(`/admin/contributor-requests/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ reason: 'Please complete more practice exams first' })
      .expect(201);

    const mine = await request(server)
      .get('/contributor-requests/me')
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(200);
    expect(mine.body.request.status).toBe('REJECTED');
    expect(mine.body.request.decisionReason).toBe(
      'Please complete more practice exams first',
    );
    expect(mine.body.request.retryAfter).toBeTruthy();
    expect(mine.body.request.reviewedById).toBeUndefined();

    const retry = await request(server)
      .post('/contributor-requests')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ motivation: MOTIVATION })
      .expect(429);
    expect(retry.body.code).toBe('COOLDOWN_ACTIVE');
  });

  it('learner can cancel; manual role change auto-cancels', async () => {
    const learner = await createLearner('cr-cancel');
    const admin = await createAdminUser(app, 'cr-admin-3');
    const server = app.getHttpServer();

    await request(server)
      .post('/contributor-requests')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ motivation: MOTIVATION })
      .expect(201);
    await request(server)
      .delete('/contributor-requests/me')
      .set('Authorization', `Bearer ${learner.token}`)
      .expect(200);

    // Cancelled requests do not trigger a cooldown
    const second = await request(server)
      .post('/contributor-requests')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ motivation: MOTIVATION })
      .expect(201);

    await request(server)
      .put(`/users/${learner.userId}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: UserRole.REVIEWER })
      .expect(200);

    const row = await prisma.contributorRequest.findUnique({
      where: { id: second.body.id },
    });
    expect(row?.status).toBe('CANCELLED');
  });

  it('validates the request body', async () => {
    const learner = await createLearner('cr-validate');
    await request(app.getHttpServer())
      .post('/contributor-requests')
      .set('Authorization', `Bearer ${learner.token}`)
      .send({ motivation: 'too short', sampleUrl: 'http://insecure.example' })
      .expect(400);
  });
});
