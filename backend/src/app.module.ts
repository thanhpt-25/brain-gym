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
import { ProvidersModule } from './providers/providers.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrgQuestionsModule } from './org-questions/org-questions.module';
import { ExamCatalogModule } from './exam-catalog/exam-catalog.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    ProvidersModule,
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
    AdminModule,
    MailModule,
    OrganizationsModule,
    OrgQuestionsModule,
    ExamCatalogModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
