import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RlsInterceptor } from './common/rls.interceptor';
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
import { AssessmentsModule } from './assessments/assessments.module';
import { OrgAnalyticsModule } from './org-analytics/org-analytics.module';
import { QueuesModule } from './queues/queues.module';
import { MasteryModule } from './mastery/mastery.module';
import { EventsModule } from './events/events.module';
import { InsightsModule } from './insights/insights.module';
import { PassLikelihoodModule } from './surveys/pass-likelihood.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 300,
      },
    ]),
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
    AssessmentsModule,
    OrgAnalyticsModule,
    QueuesModule,
    MasteryModule,
    EventsModule,
    InsightsModule,
    PassLikelihoodModule,
  ],
  providers: [
    // TODO: RLS interceptor disabled — current implementation tries to set context via request.prisma,
    // but services use injected this.prisma, so the context never applies to queries.
    // This causes 500 errors on analytics endpoints because RLS policies block access when
    // the context isn't properly set. Proper fix: pass transactional client to services
    // or implement RLS at a different layer (e.g., query-builder middleware).
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: RlsInterceptor,
    // },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
