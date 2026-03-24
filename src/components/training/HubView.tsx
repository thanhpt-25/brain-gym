import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Flame, Medal, Layers, TrendingDown, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCertifications } from '@/services/certifications';
import { getFlashcardStats, getDueFlashcardReviews } from '@/services/flashcards';
import { getStreakData } from '@/stores/streak.store';
import { ModeCard } from './ModeCard';

interface HubViewProps {
  certFilter: string;
  setCertFilter: (val: string) => void;
  onModeSelect: (mode: 'weakness' | 'daily' | 'flashcard') => void;
}

export function HubView({ certFilter, setCertFilter, onModeSelect }: HubViewProps) {
  const { data: certs, isLoading: certsLoading } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  const { data: dueReviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['flashcard-reviews-training', certFilter],
    queryFn: () => getDueFlashcardReviews(certFilter || undefined),
  });

  const { data: flashStats, isLoading: statsLoading } = useQuery({
    queryKey: ['flashcard-stats-training'],
    queryFn: getFlashcardStats,
  });

  const streak = useMemo(() => getStreakData(), []);
  const dueCount = dueReviews?.length || 0;
  const isLoading = certsLoading || reviewsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-4 w-full">
            <div className="h-10 w-48 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded-md" />
          </div>
          <div className="h-20 w-48 bg-muted animate-pulse rounded-xl self-end" />
        </div>
        <div className="h-12 w-full bg-muted animate-pulse rounded-lg" />
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header & Streak */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold text-gradient-cyan mb-2">Training Hub</h1>
          <p className="text-muted-foreground w-full md:w-3/4">
            Rèn luyện kỹ năng với các chế độ luyện tập thông minh. 
            Hệ thống phân tích điểm yếu và tối ưu hóa lộ trình học của bạn.
          </p>
        </div>

        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="shrink-0 w-full md:w-auto">
          <Card className="glass-card flex items-center gap-4 p-4 border-orange-500/20 bg-orange-500/5">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center relative">
              <Flame className="w-6 h-6 text-orange-500" />
              <div className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500 border-2 border-background"></span>
              </div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-orange-500 leading-none mb-1">
                {streak.currentStreak} <span className="text-sm font-normal text-muted-foreground">ngày</span>
              </div>
              <div className="text-xs text-muted-foreground">Kỷ lục: {streak.longestStreak} ngày</div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Cert Filter */}
      <div className="flex items-center gap-3 bg-secondary/30 p-3 rounded-lg border border-border/50">
        <Medal className="h-5 w-5 text-muted-foreground" />
        <Select value={certFilter} onValueChange={(val) => setCertFilter(val === 'all' ? '' : val)}>
          <SelectTrigger className="w-[200px] border-none bg-transparent focus:ring-0 shadow-none">
            <SelectValue placeholder="All Certifications" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Certifications</SelectItem>
            {certs?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <ModeCard
          icon={TrendingDown}
          title="Weakness Targeting"
          desc="Tập trung luyện tập vào các Knowledge Domain mà bạn có tỷ lệ trả lời đúng thấp nhất (<75%)."
          accentClass="text-destructive"
          bgClass="bg-destructive/10"
          onClick={() => onModeSelect('weakness')}
        />

        <ModeCard
          icon={Calendar}
          title="Daily Review"
          desc="Ôn tập 10-15 câu hỏi mỗi ngày theo phương pháp Spaced Repetition System (SRS)."
          accentClass="text-primary"
          bgClass="bg-primary/10"
          onClick={() => onModeSelect('daily')}
        />

        <ModeCard
          icon={Layers}
          title="Flashcards"
          desc={`Lật thẻ bài để ghi nhớ khái niệm. Thuật toán SuperMemo-2 tối ưu hóa thời điểm ôn tập lại.`}
          accentClass="text-accent"
          bgClass="bg-accent/10"
          badge={dueCount > 0 ? `${dueCount} due` : undefined}
          onClick={() => onModeSelect('flashcard')}
        />
      </div>

      {/* Analytics Mini-View (Flashcard Stats / Quick stats) - Just an example for a fuller hub */}
      {flashStats && flashStats.totalFlashcards > 0 && (
        <Card className="glass-card p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Flashcard Progress
            </h3>
            <div className="text-xs text-muted-foreground font-mono">
              Total: {flashStats.totalFlashcards}
            </div>
          </div>
          
          <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
            {Object.entries(flashStats.masteryBreakdown).map(([mastery, count]) => {
              const mappedCount = Number(count);
              if (mappedCount === 0) return null;
              const pct = (mappedCount / flashStats.totalFlashcards) * 100;
              const color = 
                mastery === 'MASTERED' ? 'bg-accent' :
                mastery === 'REVIEW' ? 'bg-primary' :
                mastery === 'LEARNING' ? 'bg-warning' : 'bg-destructive';
              return (
                <div key={mastery} style={{ width: `${pct}%` }} className={`h-full ${color} border-r border-background/20`} />
              );
            })}
          </div>
          
          <div className="flex justify-between mt-3 text-[10px] font-mono text-muted-foreground uppercase">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> New</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-warning" /> Learning</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /> Review</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-accent" /> Mastered</span>
          </div>
        </Card>
      )}
    </div>
  );
}
