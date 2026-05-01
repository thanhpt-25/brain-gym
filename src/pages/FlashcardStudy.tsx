import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  Tag,
  Loader2,
  Frown,
  Meh,
  Smile,
  Target,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";
import Breadcrumb from "@/components/Breadcrumb";
import {
  getDueFlashcardReviews,
  getDeck,
  submitFlashcardReview,
} from "@/services/flashcards";

// Random shuffling helper
function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

const FlashcardStudy = () => {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState(0);
  const [pool, setPool] = useState<any[]>([]);

  // Fetch deck details
  const { data: deck, isLoading: isLoadingDeck } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => getDeck(deckId!),
    enabled: !!deckId,
  });

  // Fetch ALL due cards OR if studying all cards, just use the deck's cards.
  // For a basic study session, if they just clicked "Study Now", we can prefer due cards,
  // but if little due, supplement with new. Let's just study the whole deck for simplicity this version,
  // focusing on spaced repetition rating. Or better: use `getDueFlashcardReviews`
  const { data: dueReviews, isLoading: isLoadingDue } = useQuery({
    queryKey: ["due-flashcards", deckId],
    queryFn: () => getDueFlashcardReviews(deckId!),
    enabled: !!deckId,
  });

  // Decide the pool of cards.
  useEffect(() => {
    if (!deck || !dueReviews) return;

    // We mix due cards and new cards (cards without a schedule or with 0 reps)
    const dueIds = new Set(dueReviews.map((r) => r.flashcard.id));
    const allCards = deck.flashcards || [];

    // Cards that are explicitly due
    const dueCards = allCards.filter((c) => dueIds.has(c.id));

    // Cards that have no schedule yet (New)
    const newCards = allCards.filter((c) => !c.schedule);

    // Let's create a combined pool up to a reasonable limit, say 50 cards
    let sessionCards = [...dueCards, ...newCards].slice(0, 50);

    // If still empty (all mastered and none due), just show them some cards randomly for practice
    if (sessionCards.length === 0 && allCards.length > 0) {
      sessionCards = [...allCards].slice(0, 50);
    }

    setPool(shuffleArray(sessionCards));
  }, [deck, dueReviews]);

  const card = pool[currentIndex];
  const progress = pool.length > 0 ? (reviewedIds.size / pool.length) * 100 : 0;

  const goNext = useCallback(() => {
    if (pool.length === 0) return;
    setDirection(1);
    setIsFlipped(false);
    setCurrentIndex((i) => i + 1); // allow going out of bounds to trigger finish screen
  }, [pool.length]);

  const goPrev = useCallback(() => {
    if (pool.length === 0) return;
    setDirection(-1);
    setIsFlipped(false);
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, [pool.length]);

  const rateCard = (quality: number) => {
    if (!card) return;
    const idempotencyKey = `${card.id}-${Date.now()}`;
    submitFlashcardReview(card.id, quality, idempotencyKey).catch(() => {});
    setReviewedIds((prev) => new Set(prev).add(card.id));
    goNext();
  };

  const isFinished = currentIndex >= pool.length && pool.length > 0;

  if (isLoadingDeck || isLoadingDue) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="min-h-screen bg-background bg-grid">
        <Navbar title="Flashcards" icon={Layers} />
        <div className="container max-w-2xl pt-24 px-4 pb-8 flex flex-col items-center justify-center">
          <Layers className="h-16 w-16 text-primary mb-6" />
          <h2 className="text-3xl font-mono font-bold mb-4">
            Session Complete!
          </h2>
          <p className="text-muted-foreground mb-8 text-center max-w-sm">
            You've reviewed {reviewedIds.size} cards. Great job building your
            knowledge.
          </p>
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="font-mono gap-2"
              onClick={() => navigate(`/decks/${deckId}`)}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Deck
            </Button>
            <Button
              className="glow-cyan font-mono gap-2"
              onClick={() => {
                setCurrentIndex(0);
                setReviewedIds(new Set());
                setIsFlipped(false);
                setPool(shuffleArray(pool));
              }}
            >
              <RotateCcw className="h-4 w-4" /> Study Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar title="Flashcards" icon={Layers} />
      <div className="container max-w-2xl pt-20 px-4 pb-8">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Flashcards", href: "/decks" },
            { label: deck?.name || "Study", href: `/decks/${deckId}` },
            { label: "Study" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between mt-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/decks/${deckId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="text-sm font-mono text-muted-foreground">
            {deck?.name}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-1.5">
            <span>
              Card {Math.min(currentIndex + 1, pool.length)} / {pool.length}
            </span>
            <span className="text-primary">{reviewedIds.size} reviewed</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Flashcard */}
        {card && (
          <div className="perspective-1000 mb-6 touch-pan-y">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={card.id + (isFlipped ? "-back" : "-front")}
                custom={direction}
                initial={{ opacity: 0, x: direction * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -60 }}
                transition={{ duration: 0.25 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                onDragEnd={(_e, info) => {
                  if (info.offset.x < -80) goNext();
                  else if (info.offset.x > 80) goPrev();
                }}
                onClick={() => !isFlipped && setIsFlipped(true)}
                className={`relative glass-card p-8 min-h-[320px] md:min-h-[400px] flex flex-col justify-center cursor-pointer select-none transition-shadow ${
                  reviewedIds.has(card.id)
                    ? "border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
                    : ""
                }`}
              >
                {card.isStarred && (
                  <div className="absolute top-4 right-4">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  </div>
                )}
                {!isFlipped ? (
                  <div className="text-center w-full">
                    <Badge
                      variant="outline"
                      className="mb-4 text-[10px] font-mono"
                    >
                      {card.schedule?.mastery || "NEW"}
                    </Badge>
                    <p className="text-foreground font-mono text-xl md:text-2xl leading-relaxed whitespace-pre-wrap px-4">
                      {card.front}
                    </p>
                    <p className="text-muted-foreground text-xs mt-8 font-mono inline-flex items-center bg-secondary/50 px-3 py-1.5 rounded-full">
                      <Layers className="h-3.5 w-3.5 mr-2" /> Tap to reveal
                      answer
                    </p>
                  </div>
                ) : (
                  <div className="text-center w-full flex flex-col items-center">
                    <Badge className="mb-4 text-[10px] font-mono bg-primary/20 text-primary border-primary/30">
                      Answer
                    </Badge>
                    <div className="text-foreground font-medium text-base md:text-lg leading-relaxed whitespace-pre-wrap px-4">
                      {card.back}
                    </div>
                    {card.hint && (
                      <div className="mt-6 text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg w-full text-left">
                        <span className="font-mono text-xs font-bold block mb-1">
                          HINT / NOTES
                        </span>
                        {card.hint}
                      </div>
                    )}
                    {card.tags?.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5 mt-8">
                        {card.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded"
                          >
                            <Tag className="h-2.5 w-2.5" /> {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="h-10 w-10 shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {isFlipped && card ? (
            <div className="flex flex-wrap items-center justify-center gap-2 mx-4">
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground font-mono text-xs px-2 md:px-4"
                onClick={() => rateCard(2)}
              >
                <Frown className="h-3.5 w-3.5 mr-1" /> Again
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-warning/30 text-warning hover:bg-warning hover:text-warning-foreground font-mono text-xs px-2 md:px-4"
                onClick={() => rateCard(3)}
              >
                <Meh className="h-3.5 w-3.5 mr-1" /> Hard
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground font-mono text-xs px-2 md:px-4"
                onClick={() => rateCard(4)}
              >
                <Smile className="h-3.5 w-3.5 mr-1" /> Good
              </Button>
              <Button
                size="sm"
                variant="default"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs glow-cyan px-2 md:px-4"
                onClick={() => rateCard(5)}
              >
                <Target className="h-3.5 w-3.5 mr-1" /> Easy
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFlipped(true)}
            >
              <Layers className="h-4 w-4 mr-1.5" /> Reveal Answer
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={goNext}
            disabled={isFinished}
            className="h-10 w-10 shrink-0"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardStudy;
