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
const CLIENT_TS_SKEW_MS = 60 * 60 * 1000; // allow ±1 hour skew

// In-memory OTP store — works for single-process (dev/single-pod).
// Replace otpStore.get/set/delete with Redis calls (SETEX + GET + DEL) for multi-process.
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
      select: { requireOtp: true },
    });
    if (!assessment?.requireOtp) {
      throw new BadRequestException('OTP is not required for this assessment');
    }

    // Fix #9: use cryptographically secure random integer
    const code = crypto.randomInt(100_000, 1_000_000).toString();
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    otpStore.set(invite.id, { hash, expiresAt: Date.now() + OTP_TTL_MS });

    // Fix #3: never log the raw OTP code — only log masked email for traceability
    const masked = invite.candidateEmail.replace(/(.{2}).+(@.+)/, '$1***$2');
    console.log(`[OTP] code sent to ${masked}`);

    // TODO: integrate real email service (Mailtrap dev → SES/SendGrid prod)
    // emailService.sendOtp(invite.candidateEmail, code);

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

    // Fix #6: guard applies for all maxAttempts values (including default 1).
    // Count all SUBMITTED invites for this email+assessment excluding this invite.
    // (status !== 'INVITED' already blocks this specific invite re-entry,
    //  but a second invite token for the same email would bypass that check.)
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

    // Fix #7: compute integrity score inside the transaction so the event snapshot
    // is consistent with the final integrityScore written to the row.
    const result = await this.prisma.$transaction(async (tx) => {
      const events = await tx.candidateEvent.findMany({
        where: { inviteId: invite.id },
        select: { eventType: true },
      });
      const integrityScore = this.calcIntegrityScore(events, invite.tabSwitchCount ?? 0);

      await tx.candidateAnswer.createMany({ data: answerRecords });
      await tx.candidateInvite.update({
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
      });

      return integrityScore;
    });

    return {
      score: Number(score.toFixed(2)),
      totalCorrect,
      totalQuestions,
      passed:
        assessment.passingScore != null
          ? score >= assessment.passingScore
          : null,
      timeSpent,
      integrityScore: result,
    };
  }

  async reportEvent(token: string, eventType: string, clientTs?: string, payload?: any) {
    const invite = await this.findInviteByToken(token);

    // Fix #5: clamp client-supplied timestamp to ±1 hour of server time
    const now = Date.now();
    const rawTs = clientTs ? new Date(clientTs).getTime() : now;
    const clampedTs = new Date(Math.max(now - CLIENT_TS_SKEW_MS, Math.min(now, rawTs)));

    await this.prisma.candidateEvent.create({
      data: {
        inviteId: invite.id,
        eventType: eventType.toUpperCase(),
        payload: payload ?? {},
        clientTs: clampedTs,
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

  // Fix #4: verify inviteId belongs to the given assessmentId before returning events
  async getEvents(inviteId: string, assessmentId: string) {
    const invite = await this.prisma.candidateInvite.findFirst({
      where: { id: inviteId, assessmentId },
      select: { id: true },
    });
    if (!invite) throw new NotFoundException('Candidate not found for this assessment');

    return this.prisma.candidateEvent.findMany({
      where: { inviteId },
      orderBy: { clientTs: 'asc' },
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  // Fix #7: pure function — called inside $transaction with pre-fetched events
  private calcIntegrityScore(
    events: { eventType: string }[],
    tabSwitchCount: number,
  ): number {
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
   * Atomic conditional UPDATE prevents the TOCTOU race where two concurrent
   * startAttempt calls both see drawnQuestionIds = [] and write different sets.
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
