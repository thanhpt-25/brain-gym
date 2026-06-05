import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentsService } from './assessments.service';
import { CandidateSubmitDto } from './dto/candidate-submit.dto';
import { AssessmentSelectionMode } from '@prisma/client';
import * as crypto from 'crypto';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory OTP store (Redis-ready interface — swap with Redis in production)
const otpStore = new Map<string, { hash: string; expiresAt: number }>();

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
        requireFullscreen: true,
        requireOtp: true,
        maxAttempts: true,
      },
    });
    return {
      ...assessment,
      candidateName: invite.candidateName,
      candidateEmail: invite.candidateEmail,
      status: invite.status,
      startedAt: invite.startedAt,
      otpVerifiedAt: invite.otpVerifiedAt,
    };
  }

  async requestOtp(token: string) {
    const invite = await this.findInviteByToken(token);
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: invite.assessmentId },
      select: { requireOtp: true, title: true },
    });
    if (!assessment?.requireOtp) {
      throw new BadRequestException('OTP is not required for this assessment');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    otpStore.set(invite.id, { hash, expiresAt: Date.now() + OTP_TTL_MS });

    // TODO: integrate real email service; for now log in dev
    console.log(`[OTP] ${invite.candidateEmail} → ${code} (assessment: ${assessment.title})`);

    return { message: `OTP sent to ${invite.candidateEmail}` };
  }

  async verifyOtp(token: string, code: string) {
    const invite = await this.findInviteByToken(token);
    const entry = otpStore.get(invite.id);

    if (!entry) {
      throw new BadRequestException('No OTP requested — please request a new code');
    }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(invite.id);
      throw new BadRequestException('OTP has expired — please request a new code');
    }

    const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    if (inputHash !== entry.hash) {
      throw new BadRequestException('Invalid OTP');
    }

    otpStore.delete(invite.id);
    await this.prisma.candidateInvite.update({
      where: { id: invite.id },
      data: { otpVerifiedAt: new Date() },
    });

    return { verified: true };
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

    const assessment = await this.prisma.assessment.findUnique({
      where: { id: invite.assessmentId },
      select: { requireOtp: true, maxAttempts: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    // Guard: OTP must be verified first
    if (assessment.requireOtp && !invite.otpVerifiedAt) {
      throw new ForbiddenException('OTP verification required before starting');
    }

    // Guard: maxAttempts — count previous SUBMITTED invites for same email+assessment
    if (assessment.maxAttempts > 1) {
      const previousAttempts = await this.prisma.candidateInvite.count({
        where: {
          assessmentId: invite.assessmentId,
          candidateEmail: invite.candidateEmail,
          status: 'SUBMITTED',
          id: { not: invite.id },
        },
      });
      if (previousAttempts >= assessment.maxAttempts) {
        throw new ForbiddenException(
          `Maximum attempts (${assessment.maxAttempts}) reached for this assessment`,
        );
      }
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

    const integrityScore = await this.computeIntegrityScore(invite.id, invite.tabSwitchCount ?? 0);

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
          integrityScore,
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
      integrityScore,
    };
  }

  async reportEvent(token: string, eventType: string, clientTs?: string, payload?: any) {
    const invite = await this.findInviteByToken(token);

    const ts = clientTs ? new Date(clientTs) : new Date();

    await this.prisma.candidateEvent.create({
      data: {
        inviteId: invite.id,
        eventType: eventType.toUpperCase(),
        payload: payload ?? {},
        clientTs: ts,
      },
    });

    // Also increment tabSwitchCount for backward compat
    if (eventType.toUpperCase() === 'TAB_SWITCH') {
      await this.prisma.candidateInvite.update({
        where: { id: invite.id },
        data: { tabSwitchCount: (invite.tabSwitchCount ?? 0) + 1 },
      });
    }
  }

  async getEvents(inviteId: string) {
    return this.prisma.candidateEvent.findMany({
      where: { inviteId },
      orderBy: { clientTs: 'asc' },
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async computeIntegrityScore(inviteId: string, tabSwitchCount: number): Promise<number> {
    const events = await this.prisma.candidateEvent.findMany({
      where: { inviteId },
      select: { eventType: true },
    });

    const countOf = (type: string) =>
      events.filter((e) => e.eventType === type).length;

    const fullscreenExits = countOf('FULLSCREEN_EXIT');
    const hasCopyPaste = countOf('COPY') > 0 || countOf('PASTE') > 0;

    let score = 100;
    score -= Math.min(tabSwitchCount * 5, 40);
    score -= Math.min(fullscreenExits * 3, 30);
    if (hasCopyPaste) score -= 15;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

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
        const domain = (q as any).category ?? 'General';
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
      requireFullscreen: assessment.requireFullscreen,
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
      const config = assessment.selectionConfig as any;
      const drawn = await this.assessmentsService.drawFromPool(
        assessment.orgId,
        config,
      );

      const affected = await this.prisma.$executeRaw`
        UPDATE candidate_invites
        SET drawn_question_ids = ${drawn}::text[]
        WHERE id = ${inviteId}::uuid
          AND drawn_question_ids = '{}'::text[]
      `;

      if (affected > 0) {
        ids = drawn;
      } else {
        const fresh = await this.prisma.candidateInvite.findUnique({
          where: { id: inviteId },
          select: { drawnQuestionIds: true },
        });
        ids = fresh?.drawnQuestionIds ?? drawn;
      }
    }

    const orgQuestions = await this.prisma.orgQuestion.findMany({
      where: { id: { in: ids } },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });

    const qMap = new Map(orgQuestions.map((q) => [q.id, q]));
    return ids
      .map((id) => qMap.get(id))
      .filter(Boolean)
      .map((q) => this.toClientQuestion(q));
  }

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
