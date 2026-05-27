export interface OAuthUserInfo {
  providerUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface OAuthProvider {
  readonly name: string;
  verify(token: string): Promise<OAuthUserInfo>;
}
