import { motion } from "framer-motion";
import { ReactNode, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const PageFallback = () => (
  <div
    className="min-h-[80vh] flex items-center justify-center"
    role="status"
    aria-label="Loading page"
  >
    <Loader2
      className="h-8 w-8 animate-spin text-primary/50"
      aria-hidden="true"
    />
  </div>
);

const PageTransition = ({ children }: { children: ReactNode }) => {
  const prefersReducedMotion = useReducedMotion();

  // Respect prefers-reduced-motion (WCAG 2.3.3): drop transforms, keep a short
  // opacity fade so the route swap is still perceivable.
  const initial = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 };
  const animate = prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 };
  const exit = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 };
  const transition = {
    duration: prefersReducedMotion ? 0.15 : 0.25,
    ease: "easeOut" as const,
  };

  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
    >
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </motion.div>
  );
};

export default PageTransition;
