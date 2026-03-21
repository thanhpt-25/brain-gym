import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('Flashcards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockUser = { id: 'test-user-id', email: 'test@example.com', role: 'LEARNER' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
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
    await prisma.$disconnect();
    await app.close();
  });

  it('should create and list decks', async () => {
    // Create deck
    const createDeckResponse = await request(app.getHttpServer())
      .post('/decks')
      .send({ name: 'Integration Test Deck', description: 'desc' })
      .expect(201);

    const deckId = createDeckResponse.body.id;
    expect(deckId).toBeDefined();

    // List decks
    const listDecksResponse = await request(app.getHttpServer())
      .get('/decks')
      .expect(200);

    expect(listDecksResponse.body).toBeInstanceOf(Array);
    expect(listDecksResponse.body.some((d: any) => d.id === deckId)).toBeTruthy();
  });

  it('should create and review flashcards', async () => {
    // Create a deck first
    const deckRes = await request(app.getHttpServer())
      .post('/decks')
      .send({ name: 'Flashcard Test Deck' })
      .expect(201);
    const deckId = deckRes.body.id;

    // Create flashcard
    const createCardRes = await request(app.getHttpServer())
      .post('/flashcards')
      .send({ deckId, front: 'What is SM2?', back: 'An algorithm' })
      .expect(201);
    const cardId = createCardRes.body.id;

    // Review flashcard
    const reviewRes = await request(app.getHttpServer())
      .post(`/flashcards/${cardId}/review`)
      .send({ quality: 5 })
      .expect(201);

    expect(reviewRes.body.repetitions).toBe(1);
    expect(reviewRes.body.interval).toBe(1);

    // Get due reviews
    const dueRes = await request(app.getHttpServer())
      .get('/flashcards/srs/due')
      .expect(200);
    
    // Note: Due reviews depend on current time and calculation. 
    // Usually it adds 1 day for quality 5 review if reps=1? No, SRS usually 1 day later.
    // So it might not be due immediately.
    expect(dueRes.body).toBeInstanceOf(Array);
  });
});
