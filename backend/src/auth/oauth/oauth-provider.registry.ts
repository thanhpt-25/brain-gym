import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { OAuthProvider } from './oauth-provider.interface';
import { GoogleOAuthProvider } from './providers/google.provider';

@Injectable()
export class OAuthProviderRegistry implements OnModuleInit {
  private providers = new Map<string, OAuthProvider>();

  constructor(private readonly googleProvider: GoogleOAuthProvider) {}

  onModuleInit() {
    this.register(this.googleProvider);
    // Add more providers here: this.register(this.facebookProvider);
  }

  private register(provider: OAuthProvider) {
    this.providers.set(provider.name, provider);
  }

  get(providerName: string): OAuthProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new NotFoundException(`OAuth provider "${providerName}" is not supported`);
    }
    return provider;
  }
}
