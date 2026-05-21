import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { LlmUsageService } from "../../ai-question-bank/llm-usage/llm-usage.service";
import { CoachSafetyService } from "./coach-safety.service";
import Anthropic from "@anthropic-ai/sdk";

interface CoachSessionResponse {
  id: string;
  messages: Array<{ id: string; role: string; content: string; timestamp: string }>;
  createdAt: string;
  sessionCount: number;
}

interface CoachMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

@Injectable()
export class CoachService {
  private anthropic: Anthropic;

  constructor(
    private prisma: PrismaService,
    private llmUsageService: LlmUsageService,
    private coachSafetyService: CoachSafetyService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async getOrCreateCoachSession(userId: string): Promise<CoachSessionResponse> {
    const session = await this.prisma.coachSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (!session) {
      const newSession = await this.prisma.coachSession.create({
        data: {
          userId,
          messages: [],
          costUsd: 0,
        },
      });

      return {
        id: newSession.id,
        messages: [],
        createdAt: newSession.createdAt.toISOString(),
        sessionCount: 1,
      };
    }

    // Count sessions today for rate limiting
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionCount = await this.prisma.coachSession.count({
      where: {
        userId,
        createdAt: {
          gte: today,
        },
      },
    });

    return {
      id: session.id,
      messages: session.messages || [],
      createdAt: session.createdAt.toISOString(),
      sessionCount,
    };
  }

  async getSessionCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.coachSession.count({
      where: {
        userId,
        createdAt: {
          gte: today,
        },
      },
    });
  }

  async sendMessage(
    sessionId: string,
    userId: string,
    userMessage: string,
  ): Promise<AsyncIterable<string>> {
    // Verify session ownership
    const session = await this.prisma.coachSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new BadRequestException("Session not found or unauthorized");
    }

    // Check rate limit (max 10 sessions per day)
    const sessionCount = await this.getSessionCount(userId);
    if (sessionCount >= 10) {
      throw new BadRequestException("Daily session limit reached");
    }

    // Validate user message for jailbreak/safety issues
    const safetyResult = await this.coachSafetyService.detectJailbreakAttempt(
      userMessage,
    );
    if (safetyResult.isJailbreak) {
      throw new BadRequestException(
        "Message violates safety guidelines. Please try again.",
      );
    }

    // Add user message to session
    const messages = (session.messages as CoachMessage[]) || [];
    const userMsg: CoachMessage = {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    messages.push(userMsg);

    // Prepare messages for LLM (convert to Anthropic format)
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Stream LLM response
    return this.streamCoachResponse(sessionId, userId, anthropicMessages, messages);
  }

  private async *streamCoachResponse(
    sessionId: string,
    userId: string,
    anthropicMessages: any[],
    sessionMessages: CoachMessage[],
  ): AsyncIterable<string> {
    let fullResponse = "";
    let costUsd = 0;

    try {
      const stream = await this.anthropic.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are an empathetic AI coach helping certification exam candidates.
Your role is to:
- Provide targeted study recommendations based on weak areas
- Offer encouragement and break suggestions when needed
- Explain concepts clearly with real-world examples
- Identify learning patterns and suggest optimizations
- Detect burnout signs and recommend appropriate actions

Keep responses concise (2-3 sentences max for quick tips, longer for explanations).
Always be supportive and never judgmental.`,
        messages: anthropicMessages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text;
          yield event.delta.text;
        }
      }

      // Get final message for cost calculation
      const finalMessage = await stream.finalMessage();
      costUsd =
        ((finalMessage.usage.input_tokens + finalMessage.usage.output_tokens) / 1000) *
        0.03; // Haiku costs ~$0.03/1M tokens
    } catch (error) {
      yield `[Coach Error] Unable to process request. Please try again.`;
      throw error;
    }

    // Persist assistant response and update session
    const assistantMsg: CoachMessage = {
      role: "assistant",
      content: fullResponse,
      timestamp: new Date().toISOString(),
    };
    sessionMessages.push(assistantMsg);

    await this.prisma.coachSession.update({
      where: { id: sessionId },
      data: {
        messages: sessionMessages,
        costUsd: { increment: costUsd },
      },
    });

    // Track LLM usage
    await this.llmUsageService.trackUsage({
      userId,
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      inputTokens: sessionMessages.length * 200, // Rough estimate
      outputTokens: Math.ceil(fullResponse.length / 4),
      costUsd,
      context: "coach_session",
    });
  }
}
