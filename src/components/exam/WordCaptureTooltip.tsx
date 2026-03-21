import { motion, AnimatePresence } from 'framer-motion';
import { BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WordCaptureTooltipProps {
  selection: { text: string; x: number; y: number } | null;
  onCapture: () => void;
}

export function WordCaptureTooltip({ selection, onCapture }: WordCaptureTooltipProps) {
  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          initial={{ opacity: 0, y: 10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          className="fixed z-[100] pointer-events-none"
          style={{ left: selection.x, top: selection.y }}
        >
          <Button
            size="sm"
            className="pointer-events-auto h-8 px-3 py-1 text-[10px] font-mono shadow-xl glow-cyan animate-in fade-in slide-in-from-bottom-2"
            onClick={(e) => {
              e.stopPropagation();
              onCapture();
            }}
          >
            <BookmarkPlus className="h-3 w-3 mr-1.5" />
            Capture for Review
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
