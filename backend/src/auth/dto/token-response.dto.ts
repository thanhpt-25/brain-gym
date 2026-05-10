import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    plan: string;
    featureFlags: any;
    orgMemberships: {
      orgId: string;
      slug: string;
      name: string;
      role: string;
    }[];
  };
}
