/**
 * Response DTO for invite link generation
 * Returned when creating a new squad invite link
 */
export class InviteLinkDto {
  /**
   * UUID token for accepting the invite
   * @example "a1b2c3d4-e5f6-41d4-a716-446655440000"
   */
  token: string;

  /**
   * Invite expiration timestamp (7 days from creation)
   * @example "2026-06-22T12:34:56.000Z"
   */
  expiresAt: Date;

  /**
   * Name of the squad being invited to
   * @example "AWS SAA-C03 Study Group"
   */
  squadName: string;

  /**
   * Full URL to join squad (includes app domain + token)
   * @example "https://brain-gym.com/squads/join/a1b2c3d4-e5f6-41d4-a716-446655440000"
   */
  joinUrl: string;

  constructor(partial: Partial<InviteLinkDto>) {
    Object.assign(this, partial);
  }
}
