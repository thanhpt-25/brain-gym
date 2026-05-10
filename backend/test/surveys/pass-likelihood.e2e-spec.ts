import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  createTestUser,
  generateToken,
  createTestCertification,
  cleanupByEmail,
  cleanupCertByCode,
} from '../e2e-helpers';

const EMAIL_PREFIX = 'e2e-pass-likelihood-';
const CERT_CODE_PREFIX = 'e2e-survey-cert-';

describe('PassLikelihoodSurvey (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let otherToken: string;
  let certId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await cleanupCertByCode(prisma, CERT_CODE_PREFIX);

    const user = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}primary@test.com`,
      displayName: 'Survey Primary',
    });
    const other = await createTestUser(prisma, {
      email: `${EMAIL_PREFIX}other@test.com`,
      displayName: 'Survey Other',
    });
    userToken = generateToken(app, user);
    otherToken = generateToken(app, other);

    const cert = await createTestCertification(prisma, {
      code: `${CERT_CODE_PREFIX}aws-saa`,
      name: 'AWS SAA (test)',
    });
    certId = cert.id;
  });

  afterAll(async () => {
    await prisma.passLikelihoodSurvey.deleteMany({
      where: { certificationId: certId },
    });
    await cleanupCertByCode(prisma, CERT_CODE_PREFIX);
    await cleanupByEmail(prisma, EMAIL_PREFIX);
    await app.close();
  });

  it('rejects out-of-range scores', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/surveys/pass-likelihood')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ certificationId: certId, score: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/surveys/pass-likelihood')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ certificationId: certId, score: 11 })
      .expect(400);
  });

  it('accepts a single submission and rejects a duplicate', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/surveys/pass-likelihood')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ certificationId: certId, score: 7 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/surveys/pass-likelihood')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ certificationId: certId, score: 8 })
      .expect(409);
  });

  it('GET status reflects the submitted score', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/surveys/pass-likelihood?certificationId=${certId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body).toEqual({ submitted: true, score: 7 });
  });

  it("does not leak another user's response", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/surveys/pass-likelihood?certificationId=${certId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    expect(res.body).toEqual({ submitted: false, score: null });
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/surveys/pass-likelihood')
      .send({ certificationId: certId, score: 5 })
      .expect(401);
  });
});
