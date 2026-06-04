import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  children: string;
  /** Tailwind text-size class (default: 'text-sm') */
  size?: 'text-xs' | 'text-sm' | 'text-base';
  /** Tailwind text-color class (default: inherits via currentColor) */
  className?: string;
}

/**
 * Renders markdown content with dark-theme-aware styles that match the app's
 * design system. Use this everywhere explanation / rich text is displayed.
 *
 * Supported markdown: paragraphs, **bold**, *italic*, `inline code`,
 * code blocks, ordered/unordered lists, blockquotes, headings, horizontal rules.
 */
const MarkdownContent = ({
  children,
  size = 'text-sm',
  className = '',
}: MarkdownContentProps) => {
  return (
    <ReactMarkdown
      components={{
        // Paragraphs — spaced but not on the very first one (avoids top gap)
        p: ({ children: c }) => (
          <p className={`${size} leading-relaxed mt-2 first:mt-0 ${className}`}>{c}</p>
        ),

        // Headings (explanations rarely use h1; h2/h3 are most common)
        h1: ({ children: c }) => (
          <h1 className="text-base font-bold mt-4 mb-1 first:mt-0">{c}</h1>
        ),
        h2: ({ children: c }) => (
          <h2 className="text-sm font-bold mt-3 mb-1 first:mt-0">{c}</h2>
        ),
        h3: ({ children: c }) => (
          <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{c}</h3>
        ),

        // Lists
        ul: ({ children: c }) => (
          <ul className={`${size} list-disc list-outside pl-4 mt-2 space-y-1`}>{c}</ul>
        ),
        ol: ({ children: c }) => (
          <ol className={`${size} list-decimal list-outside pl-4 mt-2 space-y-1`}>{c}</ol>
        ),
        li: ({ children: c }) => (
          <li className="leading-relaxed">{c}</li>
        ),

        // Inline code
        code: ({ children: c, className: cls }) => {
          const isBlock = cls?.startsWith('language-');
          if (isBlock) {
            return (
              <code className="block bg-muted text-foreground font-mono text-xs rounded px-3 py-2 overflow-x-auto whitespace-pre">
                {c}
              </code>
            );
          }
          return (
            <code className="bg-muted text-foreground font-mono text-xs rounded px-1 py-0.5">
              {c}
            </code>
          );
        },

        // Code block wrapper
        pre: ({ children: c }) => (
          <pre className="bg-muted rounded-md mt-2 mb-1 overflow-x-auto">{c}</pre>
        ),

        // Blockquote
        blockquote: ({ children: c }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 mt-2 italic text-muted-foreground">
            {c}
          </blockquote>
        ),

        // Bold / Italic
        strong: ({ children: c }) => (
          <strong className="font-semibold text-foreground">{c}</strong>
        ),
        em: ({ children: c }) => (
          <em className="italic">{c}</em>
        ),

        // Horizontal rule
        hr: () => <hr className="my-3 border-border" />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
};

export default MarkdownContent;
