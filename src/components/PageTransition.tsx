import { motion } from 'framer-motion';
import { ReactNode, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const PageFallback = () => (
  <div className="min-h-[80vh] flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
  </div>
);

const PageTransition = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
  >
    <Suspense fallback={<PageFallback />}>
      {children}
    </Suspense>
  </motion.div>
);

export default PageTransition;
