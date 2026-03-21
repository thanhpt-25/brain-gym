import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, ChevronLeft, ChevronRight, Shuffle, Layers, CheckCircle2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Navbar from '@/components/Navbar';
import { Breadcrumb } from '@/components/Breadcrumb';
import { sampleQuestions } from '@/data/mockData';
import { questionsToFlashcards, type Flashcard } from '@/data/flashcardUtils';
import { certifications } from '@/data/mockData';

const FlashcardPage = () => {
  const navigate = useNavigate();
  const [selectedCert, setSelectedCert] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState(0);

  const allCards = useMemo(() => questionsToFlashcards(sampleQuestions), []);

  const cards = useMemo(() => {
    if (!selectedCert) return allCards;
    return allCards.filter(c => c.certificationId === selectedCert);
  }, [allCards, selectedCert]);

  const card = cards[currentIndex];
  const progress = cards.length > 0 ? ((knownIds.size / cards.length) * 100) : 0;

  const goNext = useCallback(() => {
    if (cards.length === 0) return;
    setDirection(1);
    setIsFlipped(false);
    setCurrentIndex(i => (i + 1) % cards.length);
  }, [cards.length]);

  const goPrev = useCallback(() => {
    if (cards.length === 0) return;
    setDirection(-1);
    setIsFlipped(false);
    setCurrentIndex(i => (i - 1 + cards.length) % cards.length);
  }, [cards.length]);

  const shuffle = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex(Math.floor(Math.random() * cards.length));
  }, [cards.length]);

  const markKnown = useCallback(() => {
    if (!card) return;
    setKnownIds(prev => {
      const next = new Set(prev);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
  }, [card]);

  const reset = useCallback(() => {
    setKnownIds(new Set());
    setCurrentIndex(0);
    setIsFlipped(false);
  }, []);

  // Cert selection screen
  if (!selectedCert && selectedCert !== '') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-4xl pt-20 px-4 pb-8">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Flashcards' }]} />

          <div className="mt-6 mb-8 text-center">
            <Layers className="h-10 w-10 text-primary mx-auto mb-3" />
            <h1 className="text-2xl md:text-3xl font-mono font-bold text-foreground mb-2">Flashcards</h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Biến câu hỏi MCQ thành flashcard để ghi nhớ nhanh hơn. Chọn certification để bắt đầu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* All cards option */}
            <button
              onClick={() => setSelectedCert('')}
              className="glass-card p-6 text-left hover:border-primary/50 transition-colors group"
            >
              <div className="text-2xl mb-2">🃏</div>
              <h3 className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">
                All Certifications
              </h3>
              <p className="text-xs text-muted-foreground mt-1">{allCards.length} cards</p>
            </button>

            {certifications.map(cert => {
              const count = allCards.filter(c => c.certificationId === cert.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={cert.id}
                  onClick={() => setSelectedCert(cert.id)}
                  className="glass-card p-6 text-left hover:border-primary/50 transition-colors group"
                >
                  <div className="text-2xl mb-2">{cert.icon}</div>
                  <h3 className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">
                    {cert.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{count} cards · {cert.code}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar />
      <div className="container max-w-2xl pt-20 px-4 pb-8">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Flashcards', href: '/flashcards' },
          { label: selectedCert ? certifications.find(c => c.id === selectedCert)?.code ?? 'All' : 'All' },
        ]} />

        {/* Header */}
        <div className="flex items-center justify-between mt-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedCert(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={shuffle}>
              <Shuffle className="h-3.5 w-3.5 mr-1" /> Shuffle
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-1.5">
            <span>Card {currentIndex + 1} / {cards.length}</span>
            <span className="text-primary">{knownIds.size} mastered</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Flashcard */}
        {card && (
          <div className="perspective-1000 mb-6">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={card.id + (isFlipped ? '-back' : '-front')}
                custom={direction}
                initial={{ opacity: 0, x: direction * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -60 }}
                transition={{ duration: 0.25 }}
                onClick={() => setIsFlipped(f => !f)}
                className={`glass-card p-8 min-h-[280px] md:min-h-[320px] flex flex-col justify-center cursor-pointer select-none transition-shadow ${
                  knownIds.has(card.id) ? 'border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.1)]' : ''
                }`}
              >
                {!isFlipped ? (
                  <div className="text-center">
                    <Badge variant="outline" className="mb-4 text-[10px] font-mono">
                      {card.difficulty}
                    </Badge>
                    <p className="text-foreground font-mono text-base md:text-lg leading-relaxed">
                      {card.front}
                    </p>
                    <p className="text-muted-foreground text-xs mt-6 font-mono">Tap to reveal answer</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Badge className="mb-4 text-[10px] font-mono bg-primary/20 text-primary border-primary/30">
                      Answer
                    </Badge>
                    <div className="text-foreground text-sm md:text-base leading-relaxed whitespace-pre-line">
                      {card.back}
                    </div>
                    {card.tags.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5 mt-5">
                        {card.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
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
          <Button variant="outline" size="icon" onClick={goPrev} className="h-10 w-10">
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant={knownIds.has(card?.id ?? '') ? 'default' : 'outline'}
            size="sm"
            onClick={markKnown}
            className={knownIds.has(card?.id ?? '') ? 'glow-cyan' : ''}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {knownIds.has(card?.id ?? '') ? 'Mastered' : 'Mark as Known'}
          </Button>

          <Button variant="outline" size="icon" onClick={goNext} className="h-10 w-10">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardPage;
