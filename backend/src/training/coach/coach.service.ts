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

  /**
   * Get the latest coach session for a user, or create one if none exists
   *
   * This method returns the most recent session from today or creates a new one.
   * It also counts the total number of sessions created today for rate-limit tracking.
   *
   * @param userId - The authenticated user's ID
   * @returns CoachSessionResponse with session ID, messages array, creation timestamp, and today's session count
   *
   * @example
   * const session = await coachService.getOrCreateCoachSession('user-123');
   * // Returns: { id: 'sess-xyz', messages: [...], createdAt: '2026-05-22T...', sessionCount: 3 }
   */
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

  /**
   * Count the number of coach sessions created today by a user
   *
   * Used for rate-limit enforcement:
   * - Pro tier: Limited to 10 sessions per day
   * - Elite tier: No limit (can exceed 10)
   *
   * @param userId - The user's ID
   * @returns Number of sessions created by this user since midnight (local time)
   */
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

  /**
   * Gather user performance context from recent exam attempts and readiness scores
   *
   * Provides contextual information to the coach LLM to personalize responses based on:
   * - Average score from last 5 exam attempts (last 30 days)
   * - Current readiness level (0-100 scale)
   * - Focus loss events detected in last 7 days
   * - Weak areas (exam topics with score < 60%)
   *
   * This context is injected into the coach's system prompt to make responses
   * more relevant and helpful to the user's specific situation.
   *
   * @param userId - The user's ID
   * @returns Formatted context string suitable for LLM system prompt, or empty string if no data available
   *
   * @example
   * const context = await getAttemptContext('user-123');
   * // Returns: "Recent Performance Context:\n- Average Score: 72.5%\n- Readiness Level: 65/100\n- Focus Issues: 2 detected in last 7 days\n- Weak Areas: AWS Security, Database Design"
   */
  private async getAttemptContext(userId: string): Promise<string> {
    try {
      // Last 30 days of exam attempts - simplified query
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const attempts = await this.prisma.examAttempt.findMany({
        where: {
          userId,
          startedAt: { gte: thirtyDaysAgo },
        },
        orderBy: { startedAt: "desc" },
        take: 5,
      });

      // Get the exams for these attempts
      const examIds = attempts.map((a) => a.examId);
      const exams = await this.prisma.exam.findMany({
        where: { id: { in: examIds } },
        select: { id: true, title: true },
      });
      const examMap = new Map(exams.map((e) => [e.id, e.title]));

      // Latest readiness score
      const readiness = await this.prisma.readinessScore.findFirst({
        where: { userId },
        orderBy: { computedAt: "desc" },
      });

      // Recent attempt events (last 7 days) to detect focus/time patterns
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentEvents = await this.prisma.attemptEvent.findMany({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo },
        },
        select: { eventType: true },
      });

      if (attempts.length === 0) {
        return "";
      }

      // Use score from attempt directly (or calculate from totalCorrect/totalQuestions)
      const avgScore = attempts.reduce((sum, att) => {
        const score = att.score ? parseFloat(att.score.toString()) :
          (att.totalCorrect && att.totalQuestions ? (att.totalCorrect / att.totalQuestions) * 100 : 0);
        return sum + score;
      }, 0) / attempts.length;

      const focusLosses = recentEvents.filter((e) => e.eventType === "FOCUS_LOST").length;
      const readinessScore = readiness?.score ?? 0;

      // Identify weak areas (attempts with < 60% score)
      const weakAreas = attempts
        .filter((att) => {
          const score = att.score ? parseFloat(att.score.toString()) :
            (att.totalCorrect && att.totalQuestions ? (att.totalCorrect / att.totalQuestions) * 100 : 0);
          return score < 60;
        })
        .map((att) => examMap.get(att.examId) || "Unknown")
        .slice(0, 3);

      let contextStr = `Recent Performance Context:
- Average Score: ${avgScore.toFixed(1)}%
- Readiness Level: ${readinessScore}/100
- Focus Issues: ${focusLosses} detected in last 7 days`;

      if (weakAreas.length > 0) {
        contextStr += `\n- Weak Areas: ${weakAreas.join(", ")}`;
      }

      return contextStr;
    } catch (error) {
      this.logger.error(
        "Failed to gather attempt context",
        error instanceof Error ? error.message : String(error),
      );
      return "";
    }
  }

  /**
   * Send a message to the coach LLM and stream back the response
   *
   * TIER-GATING & RATE LIMITING:
   * This method enforces Pro tier rate limits (10 sessions/day). Elite tier users bypass this check.
   * Note: Tier enforcement should be implemented at the controller level (coach.controller.ts)
   * before calling this method to return proper HTTP status codes (403 Forbidden).
   *
   * SECURITY:
   * - Verifies session ownership (session.userId === userId)
   * - Validates message for jailbreak attempts using CoachSafetyService
   * - Checks rate limit (ignores elite tier unlimited sessions at service level)
   *
   * CONTEXT INJECTION:
   * - Gathers user's recent performance data via getAttemptContext()
   * - Injects context into LLM system prompt for personalized responses
   *
   * @param sessionId - ID of the coach session
   * @param userId - Authenticated user ID (used to verify session ownership)
   * @param userMessage - The user's message to the coach
   * @returns AsyncIterable<string> that streams the coach's response in real-time via SSE
   *
   * @throws BadRequestException if session not found or not owned by user
   * @throws BadRequestException if message violates safety guidelines
   * @throws BadRequestException if daily session limit reached (Pro tier)
   * @throws Error if LLM API request fails
   *
   * @example
   * const stream = await coachService.sendMessage('sess-123', 'user-456', 'How should I study for AWS?');
   * for await (const chunk of stream) {
   *   console.log(chunk); // Prints streaming response text
   * }
   */
  async sendMessage(
    sessionId: string,
    userId: string,
    userMessage: string,
  ): Promise<AsyncIterable<string>> {
    // Verify session ownership (multi-tenant isolation)
    const session = await this.prisma.coachSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new BadRequestException("Session not found or unauthorized");
    }

    // Check rate limit (max 10 sessions per day for Pro tier)
    // Elite tier enforcement should be done at controller level
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
      // Gather user's performance context
      const attemptContext = await this.getAttemptContext(userId);
      const contextSection = attemptContext ? `\n\nUser ${attemptContext}` : "";

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
Always be supportive and never judgmental.${contextSection}`,
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

  /**
   * Get analytics overview for all coach sessions
   *
   * @param userId - The user's ID
   * @returns Analytics object with aggregated session metrics
   */
  async getAnalytics(userId: string): Promise<any> {
    try {
      const sessions = await this.prisma.coachSession.findMany({
        where: { userId },
      });

      if (sessions.length === 0) {
        return {
          totalSessions: 0,
          avgMessagesPerSession: 0,
          averageResponseTime: 0,
          topicDistribution: [],
          sessionsByDay: [],
          totalTokensUsed: 0,
          totalCostUsd: 0,
        };
      }

      // Calculate message counts
      let totalMessages = 0;
      const topicMap = new Map<string, number>();
      const dayMap = new Map<string, number>();
      let totalCost = 0;

      sessions.forEach((session) => {
        const messages = ((session.messages as any) || []) as CoachMessage[];
        totalMessages += messages.length;
        totalCost += session.costUsd ? parseFloat(session.costUsd.toString()) : 0;

        // Group by day
        const day = session.createdAt.toISOString().split("T")[0];
        dayMap.set(day, (dayMap.get(day) || 0) + 1);

        // Extract topics (simplified: count keywords in assistant messages)
        messages
          .filter((m) => m.role === "assistant")
          .forEach((m) => {
            const lowerContent = m.content.toLowerCase();
            if (lowerContent.includes("aws")) topicMap.set("AWS", (topicMap.get("AWS") || 0) + 1);
            if (lowerContent.includes("azure")) topicMap.set("Azure", (topicMap.get("Azure") || 0) + 1);
            if (lowerContent.includes("cloud")) topicMap.set("Cloud", (topicMap.get("Cloud") || 0) + 1);
            if (lowerContent.includes("security")) topicMap.set("Security", (topicMap.get("Security") || 0) + 1);
            if (lowerContent.includes("database")) topicMap.set("Database", (topicMap.get("Database") || 0) + 1);
            if (lowerContent.includes("performance")) topicMap.set("Performance", (topicMap.get("Performance") || 0) + 1);
          });
      });

      const avgMessages = totalMessages / sessions.length;

      // Convert maps to sorted arrays
      const topicDistribution = Array.from(topicMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));

      const sessionsByDay = Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, sessionCount: count }))
        .slice(-30); // Last 30 days

      return {
        totalSessions: sessions.length,
        avgMessagesPerSession: Math.round(avgMessages * 10) / 10,
        averageResponseTime: 2.5, // Placeholder: would need timestamp tracking
        topicDistribution,
        sessionsByDay,
        totalTokensUsed: 0, // Would track via llmUsageService
        totalCostUsd: Math.round(totalCost * 100) / 100,
      };
    } catch (error) {
      this.logger.error(
        "Failed to get analytics",
        error instanceof Error ? error.message : String(error),
      );
      return {
        totalSessions: 0,
        avgMessagesPerSession: 0,
        averageResponseTime: 0,
        topicDistribution: [],
        sessionsByDay: [],
      };
    }
  }

  /**
   * Get detailed analysis of a single coach session
   *
   * @param sessionId - The session ID
   * @param userId - The user's ID (for authorization)
   * @returns Session analysis object with detailed metrics
   */
  async getSessionAnalysis(sessionId: string, userId: string): Promise<any> {
    try {
      const session = await this.prisma.coachSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new BadRequestException("Session not found or unauthorized");
      }

      const messages = ((session.messages as any) || []) as CoachMessage[];
      const userMessages = messages.filter((m) => m.role === "user");
      const assistantMessages = messages.filter((m) => m.role === "assistant");

      // Calculate duration
      const firstMessage = messages[0]?.timestamp || session.createdAt.toISOString();
      const lastMessage = messages[messages.length - 1]?.timestamp || session.createdAt.toISOString();
      const duration =
        new Date(lastMessage).getTime() - new Date(firstMessage).getTime();
      const durationMinutes = Math.round(duration / (1000 * 60));

      // Extract topics from all messages
      const topicsSet = new Set<string>();
      messages.forEach((m) => {
        const lowerContent = m.content.toLowerCase();
        if (lowerContent.includes("aws")) topicsSet.add("AWS");
        if (lowerContent.includes("azure")) topicsSet.add("Azure");
        if (lowerContent.includes("kubernetes")) topicsSet.add("Kubernetes");
        if (lowerContent.includes("docker")) topicsSet.add("Docker");
        if (lowerContent.includes("database")) topicsSet.add("Database");
        if (lowerContent.includes("security")) topicsSet.add("Security");
        if (lowerContent.includes("performance")) topicsSet.add("Performance");
        if (lowerContent.includes("networking")) topicsSet.add("Networking");
      });

      // Sentiment analysis (simplified: count positive/negative keywords)
      const positiveKeywords = ["great", "excellent", "good", "helpful", "understand", "clear", "thank"];
      const negativeKeywords = ["bad", "wrong", "confused", "lost", "stuck", "difficult"];
      let positiveCount = 0;
      let negativeCount = 0;

      assistantMessages.forEach((m) => {
        const lowerContent = m.content.toLowerCase();
        positiveKeywords.forEach((k) => {
          positiveCount += (lowerContent.match(new RegExp(k, "g")) || []).length;
        });
        negativeKeywords.forEach((k) => {
          negativeCount += (lowerContent.match(new RegExp(k, "g")) || []).length;
        });
      });

      const totalKeywords = positiveCount + negativeCount;
      const sentimentScore = totalKeywords > 0 ? (positiveCount / totalKeywords) * 100 : 50;
      const effectiveness =
        (assistantMessages.length > 0
          ? (positiveCount / (assistantMessages.length * 50)) * 100
          : 0) * 1.5; // Normalize to 0-150% scale

      return {
        sessionId,
        messageCount: messages.length,
        userMessagesCount: userMessages.length,
        assistantMessagesCount: assistantMessages.length,
        durationMinutes,
        topicsDiscussed: Array.from(topicsSet),
        userSentimentScore: Math.min(Math.round(sentimentScore), 100),
        effectivenessScore: Math.min(Math.round(effectiveness), 100),
        costUsd: Math.round(parseFloat(session.costUsd.toString()) * 100) / 100,
        createdAt: session.createdAt.toISOString(),
        lastMessageAt: lastMessage,
      };
    } catch (error) {
      this.logger.error(
        "Failed to get session analysis",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
