import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OAuthProviderRegistry } from './oauth-provider.registry';
import { GoogleOAuthProvider } from './providers/google.provider';

describe('OAuthProviderRegistry', () => {
  let registry: OAuthProviderRegistry;

  const mockGoogleProvider = { name: 'google', verify: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OAuthProviderRegistry,
        { provide: GoogleOAuthProvider, useValue: mockGoogleProvider },
      ],
    }).compile();

    registry = module.get<OAuthProviderRegistry>(OAuthProviderRegistry);
    registry.onModuleInit();
  });

  it('returns the google provider', () => {
    const provider = registry.get('google');
    expect(provider.name).toBe('google');
  });

  it('throws NotFoundException for unsupported provider', () => {
    expect(() => registry.get('facebook')).toThrow(NotFoundException);
    expect(() => registry.get('facebook')).toThrow('"facebook" is not supported');
  });
});
