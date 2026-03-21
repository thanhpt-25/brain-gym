import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
  sub?: string; // used in some places as alias for id from JWT payload
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
