import { motion } from 'framer-motion';
import { CheckCircle2, Eye, BookOpen } from 'lucide-react';
import { Certification, Difficulty, Domain, QuestionType } from '@/types/api-types';
import { difficultyColor } from '@/lib/question-utils';

interface ChoiceInput {
  label: string;
  content: string;
  isCorrect: boolean;
}

interface LivePreviewProps {
  difficulty: Difficulty | '';
  selectedCert: Certification | null;
  domainId: string;
  domains: Domain[];
  questionType: QuestionType;
  isScenario?: boolean;
  title: string;
  description: string;
  choices: ChoiceInput[];
  explanation: string;
  referenceUrl: string;
  tags: string[];
}

export function LivePreview({
  difficulty,
  selectedCert,
  domainId,
  domains,
  questionType,
  isScenario,
  title,
  description,
  choices,
  explanation,
  referenceUrl,
  tags
}: LivePreviewProps) {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-20 space-y-4">
        <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          <Eye className="inline w-3 h-3 mr-1" /> Live Preview
        </div>

        <motion.div
          className="glass-card p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {difficulty && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${difficultyColor(difficulty)}`}>
                  {difficulty}
                </span>
              )}
              {selectedCert && (
                <span className="text-xs text-muted-foreground">{selectedCert.icon} {selectedCert.code}</span>
              )}
              {domainId && domains.find(d => d.id === domainId) && (
                <span className="text-xs text-muted-foreground">· {domains.find(d => d.id === domainId)?.name}</span>
              )}
            </div>
            {questionType === 'MULTIPLE' && (
              <span className="text-xs text-primary font-mono">MULTI</span>
            )}
            {isScenario && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-mono flex items-center gap-1 border border-accent/20">
                <BookOpen className="h-3 w-3" /> SCENARIO
              </span>
            )}
          </div>

          {/* Question */}
          <h2 className="text-base font-medium mb-1">
            {title || <span className="text-muted-foreground italic">Nội dung câu hỏi...</span>}
          </h2>
          {isScenario && description ? (
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/10 mb-4 relative">
              <div className="absolute top-0 right-0 p-2 opacity-5">
                <BookOpen className="h-8 w-8" />
              </div>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed italic border-l-2 border-accent/20 pl-3">
                {description}
              </p>
            </div>
          ) : (
            description && (
              <p className="text-sm text-muted-foreground mb-4">{description}</p>
            )
          )}

          {/* Choices */}
          <div className="space-y-2 mt-4">
            {choices.map(choice => (
              <div
                key={choice.label}
                className={`p-3 rounded-lg border text-sm transition-all ${
                  choice.isCorrect
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-border bg-secondary/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {choice.isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded border border-border shrink-0" />
                  )}
                  <span className="font-mono font-semibold text-muted-foreground mr-1">{choice.label.toUpperCase()}.</span>
                  {choice.content || <span className="text-muted-foreground italic">...</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Explanation */}
          {explanation && (
            <div className="mt-5 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="text-xs font-mono font-semibold text-primary mb-1">Explanation</div>
              <p className="text-xs text-muted-foreground">{explanation}</p>
              {referenceUrl && (
                <a href={referenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                  Reference →
                </a>
              )}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono">{tag}</span>
              ))}
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <div className="glass-card p-4 text-xs text-muted-foreground space-y-1.5">
          <div className="flex justify-between">
            <span>Choices</span>
            <span className="font-mono">{choices.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Correct answers</span>
            <span className="font-mono text-accent">{choices.filter(c => c.isCorrect).length}</span>
          </div>
          <div className="flex justify-between">
            <span>Tags</span>
            <span className="font-mono">{tags.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Has explanation</span>
            <span className="font-mono">{explanation ? '✓' : '✗'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
