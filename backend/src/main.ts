import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: ['http://localhost:8080', 'http://localhost:5173'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('CertGym API')
    .setDescription(
      'Brain Gym — Community-driven certification exam practice platform API',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .addTag('auth', 'Registration, login, token refresh')
    .addTag('users', 'Profile management')
    .addTag('certifications', 'Certification catalog & domains')
    .addTag('questions', 'CRUD, voting, reporting')
    .addTag('exams', 'Exam builder')
    .addTag('attempts', 'Exam simulation & results')
    .addTag('analytics', 'Score trends & insights')
    .addTag('comments', 'Discussion threads')
    .addTag('gamification', 'Points, badges, leaderboard')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 CertGym API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
