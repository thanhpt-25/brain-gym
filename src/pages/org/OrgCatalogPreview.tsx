import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import { getCatalogItem } from '@/services/exam-catalog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, ArrowRight, Eye, Clock, FileText, CheckCircle2, GraduationCap, Loader2,
} from 'lucide-react';

const OrgCatalogPreview = () => {
  const navigate = useNavigate();
  const { cid } = useParams();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['org-catalog-item', slug, cid],
    queryFn: () => getCatalogItem(slug, cid!),
    enabled: !!slug && !!cid,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-16 font-mono text-muted-foreground">Exam not found.</div>
    );
  }

  const questions: any[] = ('questions' in item && Array.isArray((item as any).questions))
    ? (item as any).questions
    : [];

  const currentQ = questions[currentIndex];
  const choices: any[] = currentQ?.publicQuestion?.choices ?? currentQ?.orgQuestion?.choices ?? [];
  const title: string = currentQ?.publicQuestion?.title ?? currentQ?.orgQuestion?.title ?? '';
  const explanation: string = currentQ?.publicQuestion?.explanation ?? currentQ?.orgQuestion?.explanation ?? '';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Preview Banner */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <div className="flex items-center gap-2 text-amber-400 text-sm font-mono">
          <Eye className="h-4 w-4" />
          PREVIEW MODE — responses are not recorded
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/org/${slug}/catalog/manage`)}
          className="font-mono text-xs"
        >
          <ArrowLeft className="h-3 w-3 mr-1" /> Back to Manage
        </Button>
      </div>

      {/* Exam Info */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-mono font-bold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                {item.title}
              </h1>
              {item.description && (
                <p className="text-sm text-muted-foreground font-mono mt-1">{item.description}</p>
              )}
            </div>
            <Badge variant="outline" className="shrink-0 font-mono text-xs">{item.type}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {item.questionCount} questions</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.timeLimit} min</span>
            {item.passingScore && <span>Pass: {item.passingScore}%</span>}
            {item.certification && <span className="text-primary">{item.certification.code}</span>}
            {item.isMandatory && <span className="text-amber-400">Mandatory</span>}
          </div>
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <div className="text-center py-12 font-mono text-muted-foreground text-sm">
          {item.type === 'DYNAMIC'
            ? 'Dynamic exam — questions are selected randomly at exam time.'
            : 'No questions have been added to this exam yet.'}
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>Question {currentIndex + 1} of {questions.length}</span>
              <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-mono leading-relaxed">{title}</p>

              <div className="space-y-2">
                {choices.map((c: any) => (
                  <div
                    key={c.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-sm font-mono transition-colors ${
                      revealed && c.isCorrect
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-current text-[10px] mt-0.5">
                      {c.label}
                    </span>
                    <span className="flex-1">{c.content}</span>
                    {revealed && c.isCorrect && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                    )}
                  </div>
                ))}
              </div>

              {revealed && explanation && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs font-mono text-muted-foreground">
                  <span className="text-primary font-semibold">Explanation: </span>{explanation}
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevealed((r) => !r)}
                  className="font-mono text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  {revealed ? 'Hide Answer' : 'Reveal Answer'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => { setCurrentIndex((i) => i - 1); setRevealed(false); }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <span className="text-xs font-mono text-muted-foreground">
              {currentIndex + 1} / {questions.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex >= questions.length - 1}
              onClick={() => { setCurrentIndex((i) => i + 1); setRevealed(false); }}
            >
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default OrgCatalogPreview;
