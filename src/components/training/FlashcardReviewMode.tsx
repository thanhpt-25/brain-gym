import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Layers, Loader2, CheckCircle2, Star, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDueFlashcardReviews, submitFlashcardReview, toggleStarFlashcard } from '@/services/flashcards';
import { recordActivity } from '@/stores/streak.store';
import { Flashcard } from '@/types/api-types';
import { toast } from 'sonner';

interface FlashcardReviewModeProps {
  certFilter: string;
  onBack: () => void;
}

export function FlashcardReviewMode({ certFilter, onBack }: FlashcardReviewModeProps) {
  const [started, setStarted] = useState(false);

  const { data: dueReviews, isLoading } = useQuery({
    queryKey: ['flashcard-reviews-training', certFilter],
    queryFn: () => getDueFlashcardReviews(certFilter || undefined),
    enabled: started,
  });

  const cards = useMemo(() => (dueReviews ?? []).map((r) => r.flashcard), [dueReviews]);

  if (!started) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-6 text-muted-foreground font-mono" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Hub
        </Button>
        <Card className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
            <Layers className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-2xl font-mono font-bold mb-2">Flashcard Mastery</h2>
          <p className="text-muted-foreground mb-4">Ôn tập các thẻ ghi nhớ và khái niệm quan trọng</p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">Algorithm</div>
              <div className="text-sm font-semibold">SuperMemo-2</div>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">Focus</div>
              <div className="text-sm font-semibold">Retention</div>
            </div>
          </div>

          <Button className="glow-cyan font-mono" size="lg" onClick={() => setStarted(true)}>
            <Layers className="h-4 w-4 mr-2" /> Start Reviewing
          </Button>
        </Card>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-4" />
        <h3 className="text-lg font-mono font-bold mb-2">All Caught Up!</h3>
        <p className="text-sm text-muted-foreground mb-6">Bạn đã hoàn thành tất cả các thẻ cần ôn tập hôm nay.</p>
        <Button variant="outline" className="font-mono" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại Hub
        </Button>
      </div>
    );
  }

  return (
    <FlashcardPracticeSession
      cards={cards}
      onBack={onBack}
    />
  );
}

function FlashcardPracticeSession({ cards, onBack }: { cards: Flashcard[]; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const card = cards[index];
  const isFinished = index >= cards.length;

  const handleRate = async (quality: number) => {
    try {
      await submitFlashcardReview(card.id, quality);
      if (index + 1 >= cards.length) {
        recordActivity();
      }
      setIndex(prev => prev + 1);
      setIsFlipped(false);
    } catch (err) {
      toast.error('Failed to submit review');
    }
  };

  const toggleStar = async () => {
    try {
      await toggleStarFlashcard(card.id);
      card.isStarred = !card.isStarred;
      setIndex((i) => i);
    } catch (err) {}
  };

  if (isFinished) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto">
        <Card className="glass-card p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-4" />
          <h2 className="text-2xl font-mono font-bold mb-2">Session Complete!</h2>
          <p className="text-muted-foreground mb-6">Bạn đã ôn tập xong {cards.length} thẻ ghi nhớ.</p>
          <Button className="w-full glow-cyan font-mono" onClick={onBack}>
            Finish Session
          </Button>
        </Card>
      </motion.div>
    );
  }

  if (!card) return null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> End
        </Button>
        <span className="text-xs font-mono text-muted-foreground">
          Card {index + 1} of {cards.length}
        </span>
        <Button variant="ghost" size="sm" onClick={toggleStar} className={card.isStarred ? 'text-yellow-500' : 'text-muted-foreground'}>
          <Star className={`h-4 w-4 ${card.isStarred ? 'fill-current' : ''}`} />
        </Button>
      </div>

      <div className="h-1 bg-secondary rounded-full mb-8 overflow-hidden">
        <div 
          className="h-full bg-accent transition-all duration-300" 
          style={{ width: `${((index + 1) / cards.length) * 100}%` }} 
        />
      </div>

      <div 
        className="relative h-[350px] cursor-pointer perspective-1000 mb-8"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          className="w-full h-full preserve-3d relative"
        >
          {/* Front */}
          <Card className="absolute inset-0 backface-hidden glass-card flex flex-col items-center justify-center p-8 text-center">
            <div className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-widest">Question</div>
            <div className="text-xl font-medium leading-relaxed">{card.front}</div>
            <div className="mt-auto flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
              <Info className="h-3 w-3" /> Click to flip
            </div>
          </Card>

          {/* Back */}
          <Card 
            className="absolute inset-0 backface-hidden glass-card flex flex-col items-center justify-center p-8 text-center"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <div className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-widest">Answer</div>
            <div className="text-lg leading-relaxed text-foreground whitespace-pre-wrap">{card.back}</div>
            {card.hint && (
              <div className="mt-4 p-2 rounded bg-secondary/50 text-xs text-muted-foreground italic border border-border/50">
                Hint: {card.hint}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {!isFlipped ? (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Button className="w-full h-12 glow-cyan font-mono text-lg shadow-lg" onClick={() => setIsFlipped(true)}>
              Reveal Answer
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="rates"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-4 gap-2"
          >
            <Button variant="outline" className="flex-col h-16 border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRate(0)}>
              <span className="text-lg font-bold">0</span>
              <span className="text-[10px] font-mono">Forgot</span>
            </Button>
            <Button variant="outline" className="flex-col h-16 border-warning/30 hover:bg-warning/10 hover:text-warning" onClick={() => handleRate(3)}>
              <span className="text-lg font-bold">3</span>
              <span className="text-[10px] font-mono">Hard</span>
            </Button>
            <Button variant="outline" className="flex-col h-16 border-primary/30 hover:bg-primary/10 hover:text-primary" onClick={() => handleRate(4)}>
              <span className="text-lg font-bold">4</span>
              <span className="text-[10px] font-mono">Good</span>
            </Button>
            <Button variant="outline" className="flex-col h-16 border-accent/30 hover:bg-accent/10 hover:text-accent" onClick={() => handleRate(5)}>
              <span className="text-lg font-bold">5</span>
              <span className="text-[10px] font-mono">Easy</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
