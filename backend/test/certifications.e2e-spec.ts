import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('Certifications CRUD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockAdmin = { id: 'admin-id', email: 'admin@example.com', role: UserRole.ADMIN };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockAdmin;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Cleanup the unique code used in tests
    await prisma.certification.deleteMany({
      where: { code: { in: ['E2E-TEST-01', 'E2E-UPDATED'] } }
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('should manage certification lifecycle', async () => {
    // 1. Create (POST)
    const createRes = await request(app.getHttpServer())
      .post('/certifications')
      .send({
        name: 'E2E Test Certification',
        provider: 'Cloud Provider',
        code: 'E2E-TEST-01',
        description: 'E2E test desc',
        domains: ['Domain 1', 'Domain 2']
      })
      .expect(201);

    const certId = createRes.body.id;
    expect(certId).toBeDefined();
    expect(createRes.body.domains).toHaveLength(2);

    // 2. Read All (GET)
    const listRes = await request(app.getHttpServer())
      .get('/certifications')
      .expect(200);
    
    expect(listRes.body.some((c: any) => c.id === certId)).toBeTruthy();

    // 3. Update (PUT)
    const updateRes = await request(app.getHttpServer())
      .put(`/certifications/${certId}`)
      .send({
        name: 'Updated E2E Name',
        code: 'E2E-UPDATED',
        domains: ['New Domain only']
      })
      .expect(200);
    
    expect(updateRes.body.name).toBe('Updated E2E Name');
    expect(updateRes.body.domains).toHaveLength(1);
    expect(updateRes.body.domains[0].name).toBe('New Domain only');

    // 4. Soft Delete (DELETE)
    await request(app.getHttpServer())
      .delete(`/certifications/${certId}`)
      .expect(200);
    
    // Verify it's no longer in the public list
    const publicList = await request(app.getHttpServer())
      .get('/certifications')
      .expect(200);
    expect(publicList.body.some((c: any) => c.id === certId)).toBeFalsy();

    // Verify it IS in the admin list
    const adminList = await request(app.getHttpServer())
      .get('/certifications?includeInactive=true')
      .expect(200);
    expect(adminList.body.some((c: any) => c.id === certId)).toBeTruthy();
  });

  it('should enforce code uniqueness', async () => {
    // Create first cert
    const code = 'UNIQUE-CODE-' + Date.now();
    await request(app.getHttpServer())
      .post('/certifications')
      .send({ name: 'First', provider: 'P', code })
      .expect(201);

    // Attempt second cert with same code
    await request(app.getHttpServer())
      .post('/certifications')
      .send({ name: 'Second', provider: 'P', code })
      .expect(409); // Conflict
  });
});
