import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PassLikelihoodStatusDto } from './dto/submit-pass-likelihood.dto';

@Injectable()
export class PassLikelihoodService {
  private readonly logger = new Logger(PassLikelihoodService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submit(
    userId: string,
    certificationId: string,
    score: number,
  ): Promise<{ id: string; score: number; submittedAt: Date }> {
    const cert = await this.prisma.certification.findFirst({
      where: {
        OR: [{ id: certificationId }, { code: certificationId }],
      },
      select: { id: true },
    });
    if (!cert) {
      throw new NotFoundException(`Certification ${certificationId} not found`);
    }

    try {
      const row = await this.prisma.passLikelihoodSurvey.create({
        data: { userId, certificationId: cert.id, score },
        select: { id: true, score: true, submittedAt: true },
      });
      this.logger.debug(
        `Pass-likelihood submitted user=${userId} cert=${certificationId} score=${score}`,
      );
      return row;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Pass-likelihood survey already submitted for this certification',
        );
      }
      throw error;
    }
  }

  async getStatus(
    userId: string,
    certificationId: string,
  ): Promise<PassLikelihoodStatusDto> {
    const cert = await this.prisma.certification.findFirst({
      where: {
        OR: [{ id: certificationId }, { code: certificationId }],
      },
      select: { id: true },
    });

    if (!cert) {
      return { submitted: false, score: null };
    }

    const row = await this.prisma.passLikelihoodSurvey.findUnique({
      where: { userId_certificationId: { userId, certificationId: cert.id } },
      select: { score: true },
    });
    return row
      ? { submitted: true, score: row.score }
      : { submitted: false, score: null };
  }
}
