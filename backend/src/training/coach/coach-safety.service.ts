import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface JailbreakPattern {
  name: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
}

@Injectable()
export class CoachSafetyService {
  private readonly logger = new Logger(CoachSafetyService.name);

  private readonly jailbreakPatterns: JailbreakPattern[] = [
    // System prompt injection
    {
      name: 'System prompt injection',
      pattern: /ignore\s+(previous|all)?\s*(instruction|system|prompt)/i,
      severity: 'high',
    },
    {
      name: 'Direct instruction override',
      pattern: /forget\s+(your|all)\s*(instruction|rule|constraint)/i,
      severity: 'high',
    },

    // Role-play escape
    {
      name: 'Role escape - pretend instruction',
      pattern:
        /pretend\s+(you|you're|you are)\s+(not\s+)?an?\s+(ai|assistant|chatbot|language model)/i,
      severity: 'high',
    },
    {
      name: 'Role escape - act as',
      pattern: /act\s+as\s+(?!.*exam|.*question|.*quiz)/i,
      severity: 'medium',
    },

    // Hypothetical scenarios
    {
      name: 'Hypothetical restriction bypass',
      pattern:
        /what\s+if\s+(you\s+had\s+)?no\s+(restriction|rule|constraint|safeguard)/i,
      severity: 'medium',
    },
    {
      name: 'Hypothetical unrestricted mode',
      pattern:
        /imagine\s+you\s+(are\s+)?an?\s+(unrestricted|jailbroken|unfiltered)/i,
      severity: 'medium',
    },

    // Direct harmful requests
    {
      name: 'Illegal content request',
      pattern:
        /(how\s+to|help\s+(me|us)?\s+(with|create|build|make)).*\b(bomb|weapon|poison|exploit|hack|malware|ransomware|drug|steal|fraud)/i,
      severity: 'high',
    },
    {
      name: 'Harmful content generation',
      pattern: /generate\s+(explicit|sexual|violent|hateful|abusive)/i,
      severity: 'high',
    },

    // Encoding/obfuscation
    {
      name: 'Base64 encoded payload',
      pattern: /base64|b64|decode.*base/i,
      severity: 'medium',
    },
    {
      name: 'ROT13 or similar encoding',
      pattern: /rot13|cipher|encode|decode.*secret/i,
      severity: 'low',
    },

    // Token smuggling/context confusion
    {
      name: 'Context confusion',
      pattern: /(DAN|STAN|JailBreak|Unleashed|GPT-[0-9])\s*:/i,
      severity: 'high',
    },
    {
      name: 'Prompt injection via preamble',
      pattern: /<system>|<admin>|<root>/i,
      severity: 'high',
    },
  ];

  private readonly harmfulKeywords = [
    'exploit',
    'bypass',
    'circumvent',
    'override',
    'disable',
    'remove.*filter',
    'unrestricted',
    'jailbreak',
  ];

  constructor(private prisma: PrismaService) {}

  detectJailbreakAttempt(userMessage: string): boolean {
    if (!userMessage || userMessage.trim().length === 0) {
      return false;
    }

    const detectionResults = this.jailbreakPatterns.map((jb) => ({
      ...jb,
      detected: jb.pattern.test(userMessage),
    }));

    const highSeverityDetected = detectionResults.some(
      (r) => r.detected && r.severity === 'high',
    );

    if (highSeverityDetected) {
      const detectedPatterns = detectionResults
        .filter((r) => r.detected && r.severity === 'high')
        .map((r) => r.name);
      this.logger.warn(
        `Jailbreak attempt detected: ${detectedPatterns.join(', ')}`,
      );
      return true;
    }

    const mediumSeverityCount = detectionResults.filter(
      (r) => r.detected && r.severity === 'medium',
    ).length;

    if (mediumSeverityCount >= 2) {
      this.logger.warn(
        `Multiple medium-severity jailbreak patterns detected (${mediumSeverityCount})`,
      );
      return true;
    }

    return false;
  }

  async logUnsafeAttempt(
    userId: string,
    userMessage: string,
    detectedPattern: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'JAILBREAK_ATTEMPT',
          targetType: 'AI_COACH',
          targetId: userId,
          metadata: {
            userMessage: userMessage.substring(0, 500),
            detectedPattern,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log unsafe attempt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  filterResponse(response: string): string | null {
    if (!response || response.trim().length === 0) {
      return response;
    }

    const lowercaseResponse = response.toLowerCase();

    const hasFlaggedContent = this.harmfulKeywords.some((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(response);
    });

    if (hasFlaggedContent) {
      this.logger.warn('Response filtered due to flagged content');
      return null;
    }

    if (
      lowercaseResponse.includes('i cannot') ||
      lowercaseResponse.includes("i can't") ||
      lowercaseResponse.includes('i cannot help') ||
      lowercaseResponse.includes('i cannot provide')
    ) {
      return response;
    }

    return response;
  }

  getSafeResponse(): string {
    return 'I appreciate your interest, but I can only assist with certification exam preparation and learning support. How can I help you with your studies?';
  }
}
