import { useNavigate } from 'react-router-dom';
import { Brain, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FlashcardStatsPanelProps {
  stats?: {
    totalFlashcards: number;
    dueToday: number;
    masteryBreakdown: Record<string, number>;
  };
}

export function FlashcardStatsPanel({ stats }: FlashcardStatsPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="glass-card md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Mastery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1">
            <div className="text-2xl font-bold font-mono">{stats?.totalFlashcards ?? 0}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Total Cards</div>
          </div>
          <div className="space-y-2 pt-4">
            {['MASTERED', 'REVIEW', 'LEARNING', 'NEW'].map((level) => {
              const count = stats?.masteryBreakdown?.[level] ?? 0;
              const total = stats?.totalFlashcards || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={level} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">{level}</span>
                    <span className="text-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        level === 'MASTERED' ? 'bg-accent shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 
                        level === 'REVIEW' ? 'bg-primary' : 
                        level === 'LEARNING' ? 'bg-yellow-500' : 'bg-muted-foreground/30'
                      }`}
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" /> Due for Review
          </CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono" onClick={() => navigate('/training')}>
            Review Now
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className={`text-6xl font-mono font-bold mb-2 ${stats?.dueToday === 0 ? 'text-accent opacity-20' : 'text-gradient-cyan'}`}>
              {stats?.dueToday ?? 0}
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {stats?.dueToday === 0 
                ? "You're all caught up! Come back tomorrow." 
                : "Flashcards waiting for your attention today."}
            </p>
            {(stats?.dueToday ?? 0) > 0 && (
              <div className="mt-8 flex gap-3">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 animate-pulse-slow">
                   <div className="text-xs font-mono text-primary mb-1 uppercase">Recommended</div>
                   <div className="text-sm">15-min Session</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
