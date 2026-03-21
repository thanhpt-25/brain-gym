import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, Target, TrendingDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getWeakTopics } from '@/services/analytics';
import { startWeaknessTraining } from '@/services/training';
import { finishAttempt } from '@/services/attempts';
import { PracticeSession } from './PracticeSession';
import { Question } from '@/types/api-types';

interface WeaknessModeProps {
  certFilter: string;
  onBack: () => void;
}

export function WeaknessMode({ certFilter, onBack }: WeaknessModeProps) {
  const [session, setSession] = useState<{ questions: Question[]; attemptId?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: weakTopics } = useQuery({
    queryKey: ['weak-topics-training', certFilter],
    queryFn: () => getWeakTopics(certFilter || undefined, 5),
  });

  const weakDomainNames = useMemo(() => (weakTopics ?? []).filter(d => d.percentage < 75).map(d => d.domain), [weakTopics]);

  const handleStart = async () => {
    if (!certFilter) return;
    setLoading(true);
    try {
      const data = await startWeaknessTraining(certFilter, 10);
      setSession({ questions: data.questions, attemptId: data.attemptId });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (stats: { correct: number; wrong: number; skipped: number }) => {
    if (!session?.attemptId) {
      onBack();
      return;
    }
    
    try {
      await finishAttempt(session.attemptId);
      onBack();
    } catch (err) {
      console.error('Failed to complete training session:', err);
      onBack(); 
    }
  };

  if (!session) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-6 text-muted-foreground font-mono" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Hub
        </Button>
        <Card className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
            <TrendingDown className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-mono font-bold mb-2">Weakness Targeting</h2>
          <p className="text-muted-foreground mb-4">Tập trung vào các chủ đề bạn hay sai nhất</p>

          {!certFilter && (
            <p className="text-xs text-warning mb-6">⚠️ Please select a certification in the Hub first.</p>
          )}

          {weakDomainNames.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-2">Weak domains detected:</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {weakDomainNames.map(name => (
                  <span key={name} className="px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-mono">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button 
            className="glow-cyan font-mono" size="lg" 
            onClick={handleStart} 
            disabled={loading || !certFilter}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
            Start Weakness Training
          </Button>
        </Card>
      </motion.div>
    );
  }

  return (
    <PracticeSession
      questions={session.questions}
      attemptId={session.attemptId}
      modeLabel="Weakness Targeting"
      modeIcon={TrendingDown}
      onBack={onBack}
      onComplete={handleComplete}
      isLoading={false}
    />
  );
}
