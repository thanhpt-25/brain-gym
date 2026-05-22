import { useState, useEffect, useRef } from "react";

interface ScenarioDiagramProps {
  diagramUrl: string | null | undefined;
  title?: string;
}

export function ScenarioDiagram({ diagramUrl, title }: ScenarioDiagramProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "50px" },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!diagramUrl) {
    return null;
  }

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      ref={ref}
      className="my-6 flex justify-center"
      aria-label={title ? `Diagram: ${title}` : "Scenario diagram"}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 overflow-hidden"
        style={{
          maxWidth: "100%",
          opacity: prefersReducedMotion ? 1 : undefined,
          transition: prefersReducedMotion
            ? "none"
            : "opacity 0.3s ease-in-out",
        }}
      >
        {isVisible && !isError ? (
          <>
            {!isLoaded && (
              <div className="bg-gray-100 animate-pulse h-64 w-full flex items-center justify-center">
                <span className="text-gray-500 text-sm">Loading diagram...</span>
              </div>
            )}
            <img
              src={diagramUrl}
              alt={title || "Scenario diagram"}
              onLoad={() => setIsLoaded(true)}
              onError={() => {
                setIsLoaded(false);
                setIsError(true);
              }}
              loading="lazy"
              decoding="async"
              width={800}
              height={400}
              style={{
                maxWidth: "100%",
                height: "auto",
                display: isLoaded ? "block" : "none",
              }}
            />
          </>
        ) : null}

        {isError && (
          <div className="bg-gray-100 h-64 w-full flex items-center justify-center">
            <span className="text-gray-500 text-sm">Failed to load diagram</span>
          </div>
        )}
      </div>
    </div>
  );
}
