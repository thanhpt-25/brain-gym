import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Certification } from '@/types/exam';
import { BookOpen, Layers } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { AuthPromptDialog } from '@/components/landing/AuthPromptDialog';

interface CertificationCardProps {
  cert: Certification;
  onClick: () => void;
  /** True for the offline placeholder certs shown when the API has no data yet. */
  isFallback?: boolean;
}

const CertificationCard = ({ cert, onClick, isFallback }: CertificationCardProps) => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [authPrompt, setAuthPrompt] = useState<{ path: string; message: string } | null>(null);

  const goToStudy = () => navigate(`/study/${cert.id}`);
  const goToDecks = () => navigate('/decks');

  const withAuthGate = (path: string, message: string, action: () => void) => {
    if (isFallback) return;
    if (!isAuthenticated) {
      setAuthPrompt({ path, message });
      return;
    }
    action();
  };

  return (
    <div className="glass-card p-6 text-left w-full h-full flex flex-col hover:border-primary/30 transition-all group">
      <button
        onClick={() => !isFallback && withAuthGate(`/exam/${cert.id}`, 'Sign up free to take the timed mock exam and save your score.', onClick)}
        disabled={isFallback}
        className="w-full text-left flex-1 flex flex-col disabled:cursor-default"
      >
        <div className="flex items-start justify-between mb-4">
          <span className="text-3xl">{cert.icon}</span>
          <span className="text-xs font-mono px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            {cert.code}
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-mono mb-1">{typeof cert.provider === 'object' ? cert.provider?.name : cert.provider}</div>
        <h3 className="font-mono font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem]">
          {cert.name}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">{cert.description}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto">
          <span>{cert.questionCount} questions</span>
          <span>{cert.timeMinutes} min</span>
          <span>Pass: {cert.passingScore}%</span>
        </div>
        {isFallback && (
          <div className="mt-2 text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wide">
            Preview — reconnecting to live data
          </div>
        )}
      </button>
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isFallback) return;
            withAuthGate(`/exam/${cert.id}`, 'Sign up free to take the timed mock exam and save your score.', onClick);
          }}
          disabled={isFallback}
          className="flex-1 min-w-[80px] text-[10px] font-mono py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          Mock Exam
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isFallback) return;
            goToStudy();
          }}
          disabled={isFallback}
          className="flex-1 min-w-[80px] text-[10px] font-mono py-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-default"
        >
          <BookOpen className="w-3 h-3" /> Study
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isFallback) return;
            withAuthGate('/decks', 'Sign up free to unlock spaced-repetition flashcards.', goToDecks);
          }}
          disabled={isFallback}
          className="flex-1 min-w-[80px] text-[10px] font-mono py-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-default"
        >
          <Layers className="w-3 h-3" /> Flashcards
        </button>
      </div>
      <AuthPromptDialog
        open={!!authPrompt}
        onOpenChange={(open) => !open && setAuthPrompt(null)}
        redirectTo={authPrompt?.path ?? '/'}
        description={authPrompt?.message}
      />
    </div>
  );
};

export default CertificationCard;
