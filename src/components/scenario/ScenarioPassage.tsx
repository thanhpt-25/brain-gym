import ReactMarkdown from "react-markdown";

interface ScenarioPassageProps {
  passage: string;
}

export function ScenarioPassage({ passage }: ScenarioPassageProps) {
  const wordCount = passage.split(/\s+/).filter((w) => w.length > 0).length;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Passage</h2>
        <span className="text-sm text-gray-600">{wordCount} words</span>
      </div>

      <article className="prose prose-sm max-w-none bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-gray-700 leading-relaxed my-3">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside text-gray-700 my-3 space-y-1">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside text-gray-700 my-3 space-y-1">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="text-gray-700">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-blue-500 pl-4 my-3 italic text-gray-700">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-900">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-gray-100 p-4 rounded my-3 overflow-x-auto">
                {children}
              </pre>
            ),
          }}
        >
          {passage}
        </ReactMarkdown>
      </article>
    </div>
  );
}
