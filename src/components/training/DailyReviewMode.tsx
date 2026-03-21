import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, Calendar, Clock, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getDueReviews } from '@/services/training';
import { PracticeSession } from './PracticeSession';

interface DailyReviewModeProps {
  certFilter: string;
  onBack: () => void;
}

export function DailyReviewMode({ certFilter, onBack }: DailyReviewModeProps) {
  const [started, setStarted] = useState(false);
  const DAILY_COUNT = 15;

  const { data: dueReviews, isLoading } = useQuery({
    queryKey: ['daily-review-questions', certFilter],
    queryFn: () => getDueReviews(certFilter || undefined, DAILY_COUNT),
    enabled: started,
  });

  const dailyQuestions = useMemo(() => (dueReviews ?? []).map((r) => r.question), [dueReviews]);

  if (!started) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-6 text-muted-foreground font-mono" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Hub
        </Button>
        <Card className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-mono font-bold mb-2">Daily Review</h2>
          <p className="text-muted-foreground mb-2">Ôn tập mỗi ngày theo phương pháp Spaced Repetition</p>
          <p className="text-sm text-muted-foreground mb-6">
            Hệ thống tự động chọn các câu hỏi đã đến lịch ôn tập (SRS).
          </p>

          <div className="flex items-center justify-center gap-6 mb-6 text-sm">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">~10-15 phút</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-muted-foreground">Builds streak</span>
            </div>
          </div>

          <Button className="glow-cyan font-mono" size="lg" onClick={() => setStarted(true)}>
            <Calendar className="h-4 w-4 mr-2" /> Start Daily Review
          </Button>
        </Card>
      </motion.div>
    );
  }

  return (
    <PracticeSession
      questions={dailyQuestions}
      modeLabel="Daily Review"
      modeIcon={Calendar}
      onBack={onBack}
      onComplete={() => {}}
      isLoading={isLoading}
    />
  );
}
