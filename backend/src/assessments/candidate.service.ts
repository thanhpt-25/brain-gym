import {
  Injectable,
  NotFoundException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CandidateSubmitDto } from './dto/candidate-submit.dto';

@Injectable()
export class CandidateService {
  constructor(private readonly prisma: PrismaService) {}

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
      // Resume: return questions again
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

    // Check time limit
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: invite.assessmentId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    if (invite.startedAt) {
      const elapsed = (Date.now() - invite.startedAt.getTime()) / 1000;
      const timeLimitSec = assessment.timeLimit * 60;
      // Allow 30s grace
      if (elapsed > timeLimitSec + 30) {
        await this.prisma.candidateInvite.update({
          where: { id: invite.id },
          data: { status: 'EXPIRED' },
        });
        throw new BadRequestException('Time limit exceeded');
      }
    }

    // Load assessment questions with correct answers
    const assessmentQuestions = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId: invite.assessmentId },
      include: {
        orgQuestion: { include: { choices: true } },
        publicQuestion: { include: { choices: true } },
      },
    });

    // Evaluate answers
    const domainScores: Record<string, { correct: number; total: number }> = {};
    let totalCorrect = 0;
    const answerRecords: {
      inviteId: string;
      questionId: string;
      selectedChoices: string[];
      isCorrect: boolean;
    }[] = [];

    for (const aq of assessmentQuestions) {
      const question = aq.orgQuestion ?? aq.publicQuestion;
      if (!question) continue;

      const questionId = question.id;
      const submitted = dto.answers.find((a) => a.questionId === questionId);
      const selectedChoices = submitted?.selectedChoices ?? [];
      const correctChoiceIds = question.choices
        .filter((c) => c.isCorrect)
        .map((c) => c.id);

      const isCorrect =
        correctChoiceIds.length === selectedChoices.length &&
        correctChoiceIds.every((id) => selectedChoices.includes(id));

      if (isCorrect) totalCorrect++;

      // Domain scoring (use category from org questions or domain from public questions)
      const domainName =
        (question as any).domain?.name ??
        (question as any).category ??
        'General';
      if (!domainScores[domainName])
        domainScores[domainName] = { correct: 0, total: 0 };
      domainScores[domainName].total++;
      if (isCorrect) domainScores[domainName].correct++;

      answerRecords.push({
        inviteId: invite.id,
        questionId,
        selectedChoices,
        isCorrect,
      });
    }

    const totalQuestions = assessmentQuestions.length;
    const score =
      totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    const timeSpent = invite.startedAt
      ? Math.round((Date.now() - invite.startedAt.getTime()) / 1000)
      : null;

    // Save results in a transaction
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

  // ─── Helpers ──────────────────────────────────────────────────────────────

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

  private async buildQuestionPayload(assessmentId: string, inviteId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            orgQuestion: {
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
            publicQuestion: {
              include: { choices: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    let questions = assessment.questions
      .map((aq) => {
        const q = aq.orgQuestion ?? aq.publicQuestion;
        if (!q) return null;
        return {
          id: q.id,
          title: q.title,
          description: (q as any).description ?? null,
          questionType: (q as any).questionType ?? 'SINGLE_CHOICE',
          choices: q.choices.map((c) => ({
            id: c.id,
            label: c.label,
            content: c.content,
          })),
        };
      })
      .filter(Boolean);

    if (assessment.randomizeQuestions) {
      questions = questions.sort(() => Math.random() - 0.5);
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
}
