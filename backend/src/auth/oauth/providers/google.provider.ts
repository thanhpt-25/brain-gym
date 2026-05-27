import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { OAuthProvider, OAuthUserInfo } from '../oauth-provider.interface';

const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/userinfo/v2/me';

@Injectable()
export class GoogleOAuthProvider implements OAuthProvider {
  readonly name = 'google';
  // OAuth2Client is used only for token introspection if needed in the future
  private client = new OAuth2Client();

  async verify(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new UnauthorizedException('Invalid or expired Google access token');
    }
    const data: any = await response.json();
    if (!data.id || !data.email) {
      throw new UnauthorizedException('Google did not return required user info');
    }
    return {
      providerUserId: data.id,
      email: data.email,
      displayName: data.name || data.email.split('@')[0],
      avatarUrl: data.picture,
    };
  }
}
