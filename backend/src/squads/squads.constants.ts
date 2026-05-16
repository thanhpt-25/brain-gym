/**
 * Squad feature constants and error messages
 * RFC-011: Squads are Organization rows with kind='SQUAD'
 */

export const SQUADS = {
  // Organization kind for squads
  ORG_KIND: 'SQUAD',

  // Invite token configuration
  INVITE_LINK_DAILY_LIMIT: 10, // Max 10 invite links per owner per day
  INVITE_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds

  // Error messages
  ERRORS: {
    FREE_USER_CANNOT_CREATE:
      'Free users cannot create squads. Upgrade to Premium or Enterprise.',
    CERTIFICATION_NOT_FOUND: 'Certification not found',
    SQUAD_NOT_FOUND: 'Squad not found',
    INVITE_EXPIRED: 'Invite link has expired',
    INVITE_ALREADY_ACCEPTED: 'Invite link has already been accepted',
    INVITE_LIMIT_EXCEEDED: 'Daily invite limit (10 per day) exceeded',
    SQUAD_AT_CAPACITY: 'Squad is at capacity',
  },
};

// Legacy exports for backward compatibility (if needed)
export const FF_SQUADS_BETA = 'FF_SQUADS_BETA';
export const SQUAD_INVITE_TTL_DAYS =
  SQUADS.INVITE_TOKEN_TTL_MS / (24 * 60 * 60 * 1000);
export const SQUAD_INVITE_DAILY_LIMIT = SQUADS.INVITE_LINK_DAILY_LIMIT;
