import { motion } from 'framer-motion';
import { ChevronLeft, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Certification } from '@/types/api-types';

interface ExamIntroProps {
  cert: Certification;
  questionCount: number;
  onBack: () => void;
  onStart: () => void;
}

export function ExamIntro({ cert, questionCount, onBack, onStart }: ExamIntroProps) {
  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="container max-w-2xl py-20">
        <Button variant="ghost" className="mb-8 text-muted-foreground" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
          <div className="text-sm font-mono text-muted-foreground mb-1">{cert.provider} · {cert.code}</div>
          <h1 className="text-2xl font-mono font-bold mb-2">{cert.name}</h1>
          <p className="text-muted-foreground mb-6">{cert.description}</p>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">{questionCount}</div>
              <div className="text-xs text-muted-foreground">Questions</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">130m</div>
              <div className="text-xs text-muted-foreground">Time Limit</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <div className="text-xl font-mono font-bold text-foreground">70%</div>
              <div className="text-xs text-muted-foreground">Pass Score</div>
            </div>
          </div>

          {cert.domains && cert.domains.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-mono font-semibold mb-2">Domains</div>
              <div className="flex flex-wrap gap-2">
                {cert.domains.map((d) => (
                  <span key={d.id} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{d.name}</span>
                ))}
              </div>
            </div>
          )}

          {questionCount === 0 ? (
            <p className="text-sm text-destructive font-mono text-center py-4">No approved questions available for this certification yet.</p>
          ) : (
            <Button className="w-full glow-cyan font-mono" size="lg" onClick={onStart}>
              <Brain className="h-4 w-4 mr-2" /> Start Exam
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
