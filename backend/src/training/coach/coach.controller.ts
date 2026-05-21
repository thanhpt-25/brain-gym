import { Controller, Get, Param, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CoachService } from "./coach.service";

@Controller("training/coach")
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private coachService: CoachService) {}

  @Get("session/:userId")
  async getCoachSession(@Param("userId") userId: string, @Request() req: any) {
    // Ensure user can only access their own session
    if (req.user.id !== userId) {
      throw new Error("Unauthorized");
    }

    return this.coachService.getOrCreateCoachSession(userId);
  }

  @Get("session-count")
  async getSessionCount(@Request() req: any) {
    const count = await this.coachService.getSessionCount(req.user.id);
    return { sessionCount: count };
  }
}
