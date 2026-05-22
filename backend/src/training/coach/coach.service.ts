import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { LlmUsageService } from "../../ai-question-bank/llm-usage/llm-usage.service";
import { CoachSafetyService } from "./coach-safety.service";

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
  private readonly logger = new Logger(CoachService.name);
  private readonly ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
  private readonly MODEL = "claude-3-5-haiku-20241022";
  private readonly API_KEY = process.env.ANTHROPIC_API_KEY;

  constructor(
    private prisma: PrismaService,
    private llmUsageService: LlmUsageService,
    private coachSafetyService: CoachSafetyService,
  ) {
    if (!this.API_KEY) {
      this.logger.warn("ANTHROPIC_API_KEY not set - coach LLM will be unavailable");
    }
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

    const sessionMessages = ((session.messages as any) || []) as CoachMessage[];
    return {
      id: session.id,
      messages: sessionMessages.map(m => ({
        id: `${m.timestamp}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
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
    const isJailbreak = this.coachSafetyService.detectJailbreakAttempt(userMessage);
    if (isJailbreak) {
      throw new BadRequestException(
        "Message violates safety guidelines. Please try again.",
      );
    }

    // Add user message to session
    const messages = ((session.messages as any) || []) as CoachMessage[];
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
    let inputTokens = 0;
    let outputTokens = 0;

    if (!this.API_KEY) {
      yield "[Coach Error] LLM service unavailable. Please try again later.";
      return;
    }

    try {
      const response = await fetch(this.ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": this.API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: 1024,
          stream: true,
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
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Keep last incomplete line in buffer
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line || !line.startsWith("data:")) continue;

          const data = line.slice(5).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              fullResponse += event.delta.text;
              yield event.delta.text;
            } else if (event.type === "message_delta" && event.usage) {
              outputTokens = event.usage.output_tokens;
            } else if (event.type === "message_start" && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens;
            }
          } catch {
            // Ignore parse errors for SSE frames
          }
        }
      }
    } catch (error) {
      this.logger.error(
        "Coach LLM error",
        error instanceof Error ? error.message : String(error),
      );
      yield `[Coach Error] Unable to process request. Please try again.`;
      throw error;
    }

    // Persist assistant response
    const assistantMsg: CoachMessage = {
      role: "assistant",
      content: fullResponse,
      timestamp: new Date().toISOString(),
    };
    sessionMessages.push(assistantMsg);

    const costUsd = ((inputTokens + outputTokens) / 1000000) * 0.8; // Haiku costs ~$0.80/1M tokens

    await this.prisma.coachSession.update({
      where: { id: sessionId },
      data: {
        messages: sessionMessages as any,
        costUsd: { increment: costUsd },
      },
    });

    // Track LLM usage
    try {
      await this.llmUsageService.recordUsageEvent({
        userId,
        feature: "coach",
        modelId: this.MODEL,
        inputTokens,
        outputTokens,
      });
    } catch (error) {
      this.logger.error(
        "Failed to track LLM usage",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
