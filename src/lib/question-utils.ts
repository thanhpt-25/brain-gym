export function difficultyColor(difficulty: string): string {
  if (difficulty === 'EASY') return 'bg-accent/10 text-accent';
  if (difficulty === 'MEDIUM') return 'bg-warning/10 text-[hsl(var(--warning))]';
  return 'bg-destructive/10 text-destructive';
}

/**
 * Returns a safe https/http URL string, or null if the URL is invalid or uses
 * a dangerous scheme (e.g. javascript:, data:, vbscript:).
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}
