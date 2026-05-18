import { Controller, Patch, Body, HttpCode, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DigestGenerationService } from './digest-generation.service';

interface ToggleDigestDto {
  enabled: boolean;
}

interface ToggleDigestResponse {
  success: boolean;
  message: string;
}

@Controller('user/digest')
@UseGuards(JwtAuthGuard)
export class DigestController {
  constructor(private digestService: DigestGenerationService) {}

  @Patch('preference')
  @HttpCode(200)
  async toggleDigestPreference(
    @CurrentUser() user: { id: string },
    @Body() dto: ToggleDigestDto,
  ): Promise<ToggleDigestResponse> {
    const success = await this.digestService.toggleUserDigestPreference(
      user.id,
      dto.enabled,
    );

    return {
      success,
      message: success
        ? `Digest ${dto.enabled ? 'enabled' : 'disabled'} successfully`
        : 'Failed to update digest preference',
    };
  }
}
