/**
 * Skip-to-main-content link. Visible on focus only (sr-only by default).
 * Satisfies WCAG 2.4.1 Bypass Blocks. Place at the very top of the
 * document so it is the first focusable element on every page.
 */
const SkipToContent = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:font-mono focus:text-sm focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
  >
    Skip to main content
  </a>
);

export default SkipToContent;
