import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('Flashcards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    const jwtService = app.get<JwtService>(JwtService);
    const configService = app.get<ConfigService>(ConfigService);
    const jwtSecret = configService.get<string>('JWT_SECRET');

    // Create test user (decks/flashcards cascade-delete with user)
    const user = await prisma.user.create({
      data: {
        email: 'e2e-flashcard-user@test.com',
        passwordHash: 'e2e-test-hash',
        displayName: 'E2E Flashcard User',
      },
    });
    testUserId = user.id;

    userToken = jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { secret: jwtSecret, expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    // Cascade: User → Deck → Flashcard → FlashcardReviewSchedule
    if (prisma && testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it('should create and list decks', async () => {
    const createDeckResponse = await request(app.getHttpServer())
      .post('/decks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Integration Test Deck', description: 'desc' })
      .expect(201);

    const deckId = createDeckResponse.body.id;
    expect(deckId).toBeDefined();

    const listDecksResponse = await request(app.getHttpServer())
      .get('/decks')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(listDecksResponse.body).toBeInstanceOf(Array);
    expect(
      listDecksResponse.body.some((d: { id: string }) => d.id === deckId),
    ).toBeTruthy();
  });

  it('should create and review flashcards', async () => {
    const deckRes = await request(app.getHttpServer())
      .post('/decks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Flashcard Test Deck' })
      .expect(201);
    const deckId = deckRes.body.id;

    const createCardRes = await request(app.getHttpServer())
      .post('/flashcards')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ deckId, front: 'What is SM2?', back: 'An algorithm' })
      .expect(201);
    const cardId = createCardRes.body.id;

    const reviewRes = await request(app.getHttpServer())
      .post(`/flashcards/${cardId}/review`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quality: 5 })
      .expect(201);

    expect(reviewRes.body.repetitions).toBe(1);
    expect(reviewRes.body.intervalDays).toBe(1);

    const dueRes = await request(app.getHttpServer())
      .get('/flashcards/srs/due')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(dueRes.body).toBeInstanceOf(Array);
  });
});
