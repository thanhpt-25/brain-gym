import {
  Injectable,
  NotFoundException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentsService } from './assessments.service';
import { CandidateSubmitDto } from './dto/candidate-submit.dto';
import { AssessmentSelectionMode } from '@prisma/client';

@Injectable()
export class CandidateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentsService: AssessmentsService,
  ) {}

  async loadAssessment(token: string) {
    const invite = await this.findInviteByToken(token);
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: invite.assessmentId },
      select: {
        title: true,
        description: true,
        questionCount: true,
        timeLimit: true,
        detectTabSwitch: true,
        blockCopyPaste: true,
      },
    });
    return {
      ...assessment,
      candidateName: invite.candidateName,
      status: invite.status,
      startedAt: invite.startedAt,
    };
  }

  async startAttempt(token: string, ipAddress?: string) {
    const invite = await this.findInviteByToken(token);

    if (invite.status === 'STARTED') {
      // Resume — return same question payload
      return this.buildQuestionPayload(invite.assessmentId, invite.id);
    }

    if (invite.status !== 'INVITED') {
      throw new BadRequestException(
        `Cannot start: current status is ${invite.status}`,
      );
    }

    await this.prisma.candidateInvite.update({
      where: { id: invite.id },
      data: {
        status: 'STARTED',
        startedAt: new Date(),
        ipAddress: ipAddress ?? null,
      },
    });

    return this.buildQuestionPayload(invite.assessmentId, invite.id);
  }

  async submitAttempt(token: string, dto: CandidateSubmitDto) {
    const invite = await this.findInviteByToken(token);

    if (invite.status === 'SUBMITTED') {
      throw new BadRequestException('Assessment already submitted');
    }
    if (invite.status !== 'STARTED') {
      throw new BadRequestException(
        `Cannot submit: current status is ${invite.status}`,
      );
    }

    const assessment = await this.prisma.assessment.findUnique({
      where: { id: invite.assessmentId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    // Enforce time limit (+30s grace)
    if (invite.startedAt) {
      const elapsed = (Date.now() - invite.startedAt.getTime()) / 1000;
      if (elapsed > assessment.timeLimit * 60 + 30) {
        await this.prisma.candidateInvite.update({
          where: { id: invite.id },
          data: { status: 'EXPIRED' },
        });
        throw new BadRequestException('Time limit exceeded');
      }
    }

    // Load questions for scoring (mode-aware)
    const scoringQuestions = await this.loadQuestionsForScoring(
      assessment.selectionMode as AssessmentSelectionMode,
      invite.assessmentId,
      invite.id,
    );

    // Evaluate answers
    const domainScores: Record<string, { correct: number; total: number }> = {};
    let totalCorrect = 0;
    const answerRecords: {
      inviteId: string;
      questionId: string;
      selectedChoices: string[];
      isCorrect: boolean;
    }[] = [];

    for (const { questionId, question, domain } of scoringQuestions) {
      if (!question) continue;

      const submitted = dto.answers.find((a) => a.questionId === questionId);
      const selectedChoices = submitted?.selectedChoices ?? [];
      const correctChoiceIds = (question.choices ?? [])
        .filter((c: any) => c.isCorrect)
        .map((c: any) => c.id);

      const isCorrect =
        correctChoiceIds.length === selectedChoices.length &&
        correctChoiceIds.every((id: string) => selectedChoices.includes(id));

      if (isCorrect) totalCorrect++;

      if (!domainScores[domain]) domainScores[domain] = { correct: 0, total: 0 };
      domainScores[domain].total++;
      if (isCorrect) domainScores[domain].correct++;

      answerRecords.push({
        inviteId: invite.id,
        questionId,
        selectedChoices,
        isCorrect,
      });
    }

    const totalQuestions = scoringQuestions.length;
    const score = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    const timeSpent = invite.startedAt
      ? Math.round((Date.now() - invite.startedAt.getTime()) / 1000)
      : null;

    await this.prisma.$transaction([
      this.prisma.candidateAnswer.createMany({ data: answerRecords }),
      this.prisma.candidateInvite.update({
        where: { id: invite.id },
        data: {
          status: 'SUBMITTED',
          score,
          totalCorrect,
          totalQuestions,
          domainScores,
          timeSpent,
          submittedAt: new Date(),
        },
      }),
    ]);

    return {
      score: Number(score.toFixed(2)),
      totalCorrect,
      totalQuestions,
      passed:
        assessment.passingScore != null
          ? score >= assessment.passingScore
          : null,
      timeSpent,
    };
  }

  async reportEvent(token: string, eventType: string) {
    const invite = await this.findInviteByToken(token);

    if (eventType === 'tab_switch') {
      await this.prisma.candidateInvite.update({
        where: { id: invite.id },
        data: { tabSwitchCount: (invite.tabSwitchCount ?? 0) + 1 },
      });
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async findInviteByToken(token: string) {
    const invite = await this.prisma.candidateInvite.findUnique({
      where: { token },
    });
    if (!invite) throw new NotFoundException('Invalid assessment link');

    if (invite.status === 'EXPIRED') {
      throw new GoneException('This assessment link has expired');
    }
    if (new Date() > invite.expiresAt && invite.status === 'INVITED') {
      await this.prisma.candidateInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      throw new GoneException('This assessment link has expired');
    }
    return invite;
  }

  /**
   * Load questions with correct-answer info for scoring.
   * POOL  → load from CandidateInvite.drawnQuestionIds (snapshot)
   * MANUAL/BLUEPRINT → load from AssessmentQuestion table
   */
  private async loadQuestionsForScoring(
    mode: AssessmentSelectionMode,
    assessmentId: string,
    inviteId: string,
  ): Promise<{ questionId: string; question: any; domain: string }[]> {
    if (mode === AssessmentSelectionMode.POOL) {
      const invite = await this.prisma.candidateInvite.findUnique({
        where: { id: inviteId },
        select: { drawnQuestionIds: true },
      });
      const ids = invite?.drawnQuestionIds ?? [];

      const questions = await this.prisma.orgQuestion.findMany({
        where: { id: { in: ids } },
        include: { choices: true },
      });

      return questions.map((q) => ({
        questionId: q.id,
        question: q,
        domain: q.category ?? 'General',
      }));
    }

    // MANUAL / BLUEPRINT
    const aqRows = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId },
      include: {
        orgQuestion: { include: { choices: true } },
        publicQuestion: { include: { choices: true } },
      },
    });

    return aqRows
      .map((aq) => {
        const q = aq.orgQuestion ?? aq.publicQuestion;
        if (!q) return null;
        const domain =
          (q as any).domain?.name ?? (q as any).category ?? 'General';
        return { questionId: q.id, question: q, domain };
      })
      .filter(Boolean) as { questionId: string; question: any; domain: string }[];
  }

  /**
   * Build the question payload sent to the candidate browser.
   * POOL mode: draws and snapshots question IDs on first call (idempotent on resume).
   */
  private async buildQuestionPayload(assessmentId: string, inviteId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            orgQuestion: { include: { choices: { orderBy: { sortOrder: 'asc' } } } },
            publicQuestion: { include: { choices: { orderBy: { sortOrder: 'asc' } } } },
          },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    let questions: any[];

    if (assessment.selectionMode === AssessmentSelectionMode.POOL) {
      questions = await this.buildPoolQuestions(assessment, inviteId);
    } else {
      // MANUAL / BLUEPRINT
      questions = assessment.questions
        .map((aq) => {
          const q = aq.orgQuestion ?? aq.publicQuestion;
          return q ? this.toClientQuestion(q) : null;
        })
        .filter(Boolean);
    }

    if (assessment.randomizeQuestions) {
      questions = [...questions].sort(() => Math.random() - 0.5);
    }
    if (assessment.randomizeChoices) {
      questions = questions.map((q: any) => ({
        ...q,
        choices: [...q.choices].sort(() => Math.random() - 0.5),
      }));
    }

    return {
      assessmentTitle: assessment.title,
      timeLimit: assessment.timeLimit,
      detectTabSwitch: assessment.detectTabSwitch,
      blockCopyPaste: assessment.blockCopyPaste,
      totalQuestions: questions.length,
      questions,
    };
  }

  /**
   * For POOL mode: draw random questions and snapshot IDs to CandidateInvite
   * so the same set is returned on resume/reload (idempotent).
   */
  private async buildPoolQuestions(
    assessment: any,
    inviteId: string,
  ): Promise<any[]> {
    const invite = await this.prisma.candidateInvite.findUnique({
      where: { id: inviteId },
      select: { drawnQuestionIds: true },
    });

    let ids: string[] = invite?.drawnQuestionIds ?? [];

    if (ids.length === 0) {
      // First call — draw from pool and snapshot
      const config = assessment.selectionConfig as any;
      ids = await this.assessmentsService.drawFromPool(
        assessment.orgId,
        config,
      );
      await this.prisma.candidateInvite.update({
        where: { id: inviteId },
        data: { drawnQuestionIds: ids },
      });
    }

    const orgQuestions = await this.prisma.orgQuestion.findMany({
      where: { id: { in: ids } },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });

    // Preserve draw order
    const qMap = new Map(orgQuestions.map((q) => [q.id, q]));
    return ids
      .map((id) => qMap.get(id))
      .filter(Boolean)
      .map((q) => this.toClientQuestion(q));
  }

  /** Map a DB question row to the client-facing shape (strips isCorrect). */
  private toClientQuestion(q: any) {
    return {
      id: q.id,
      title: q.title,
      description: q.description ?? null,
      questionType: q.questionType ?? 'SINGLE',
      choices: (q.choices ?? []).map((c: any) => ({
        id: c.id,
        label: c.label,
        content: c.content,
      })),
    };
  }
}
