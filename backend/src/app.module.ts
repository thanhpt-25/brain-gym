import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule { }
