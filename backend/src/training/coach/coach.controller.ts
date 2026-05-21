import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CoachService } from "./coach.service";

interface CoachSessionResponse {
  id: string;
  messages: Array<{ id: string; role: string; content: string; timestamp: string }>;
  createdAt: string;
  sessionCount: number;
}

@Controller("training/coach")
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private coachService: CoachService) {}

  @Get("session/:userId")
  async getCoachSession(
    @Param("userId") userId: string,
    @Request() req: any,
  ): Promise<CoachSessionResponse> {
    if (req.user.id !== userId) {
      throw new Error("Unauthorized");
    }
    return this.coachService.getOrCreateCoachSession(userId);
  }

  @Get("session-count")
  async getSessionCount(@Request() req: any): Promise<{ sessionCount: number }> {
    const count = await this.coachService.getSessionCount(req.user.id);
    return { sessionCount: count };
  }

  @Post("session/:sessionId/message")
  async sendMessage(
    @Param("sessionId") sessionId: string,
    @Body() body: { message: string },
    @Request() req: any,
    @Res() res: any,
  ): Promise<void> {
    if (!body.message || body.message.trim().length === 0) {
      throw new BadRequestException("Message cannot be empty");
    }

    // Stream response as Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      const stream = await this.coachService.sendMessage(
        sessionId,
        req.user.id,
        body.message,
      );

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
}
