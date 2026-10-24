/** Roles that may edit questions written by someone else (mirrors backend canEditAnyQuestion). */
const EDIT_ANY_ROLES = ["ADMIN", "REVIEWER", "CONTRIBUTOR"];

export function canEditQuestion(
  user: { id?: string; role?: string } | null | undefined,
  question: { createdBy?: string; author?: { id?: string } } | null | undefined,
): boolean {
  if (!user?.id || !question) return false;
  const authorId = question.author?.id ?? question.createdBy;
  if (authorId && authorId === user.id) return true;
  return EDIT_ANY_ROLES.includes(user.role ?? "");
}
