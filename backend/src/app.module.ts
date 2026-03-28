import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CertificationsModule } from './certifications/certifications.module';
import { QuestionsModule } from './questions/questions.module';
import { ExamsModule } from './exams/exams.module';
import { AttemptsModule } from './attempts/attempts.module';
import { CommentsModule } from './comments/comments.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GamificationModule } from './gamification/gamification.module';
import { TagsModule } from './tags/tags.module';
import { TrainingModule } from './training/training.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { CaptureModule } from './capture/capture.module';
import { AiQuestionBankModule } from './ai-question-bank/ai-question-bank.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    CertificationsModule,
    QuestionsModule,
    ExamsModule,
    AttemptsModule,
    CommentsModule,
    ReportsModule,
    AnalyticsModule,
    GamificationModule,
    TagsModule,
    TrainingModule,
    FlashcardsModule,
    CaptureModule,
    AiQuestionBankModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
