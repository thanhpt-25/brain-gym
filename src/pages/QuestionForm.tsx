import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCertifications } from '@/services/certifications';
import { createQuestion } from '@/services/questions';
import { Difficulty, QuestionType } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Brain, ArrowLeft, Save, Eye, Plus, X, CheckCircle2, XCircle, Tag, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChoiceInput {
  label: string;
  content: string;
  isCorrect: boolean;
}

export default function QuestionForm() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [explanation, setExplanation] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [certificationId, setCertificationId] = useState('');
  const [domainId, setDomainId] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [questionType, setQuestionType] = useState<QuestionType>(QuestionType.SINGLE);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  const [choices, setChoices] = useState<ChoiceInput[]>([
    { label: 'a', content: '', isCorrect: false },
    { label: 'b', content: '', isCorrect: false },
    { label: 'c', content: '', isCorrect: false },
    { label: 'd', content: '', isCorrect: false },
  ]);

  const { data: certifications = [] } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  const selectedCert = useMemo(
    () => certifications.find(c => c.id === certificationId),
    [certificationId, certifications]
  );

  const domains = selectedCert?.domains || [];

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
    if (e.key === ',' || e.key === ' ') { e.preventDefault(); addTag(); }
  };

  const toggleCorrect = (index: number) => {
    setChoices(prev => {
      if (questionType === QuestionType.SINGLE) {
        return prev.map((c, i) => ({ ...c, isCorrect: i === index }));
      }
      return prev.map((c, i) => i === index ? { ...c, isCorrect: !c.isCorrect } : c);
    });
  };

  const addChoice = () => {
    if (choices.length >= 6) return;
    const nextLabel = String.fromCharCode(97 + choices.length);
    setChoices(prev => [...prev, { label: nextLabel, content: '', isCorrect: false }]);
  };

  const removeChoice = (index: number) => {
    if (choices.length <= 2) return;
    setChoices(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((c, i) => ({ ...c, label: String.fromCharCode(97 + i) }));
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !explanation || !certificationId || !difficulty) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng điền đầy đủ các trường bắt buộc.', variant: 'destructive' });
      return;
    }
    if (!choices.some(c => c.isCorrect)) {
      toast({ title: 'Chưa chọn đáp án', description: 'Vui lòng chọn ít nhất một đáp án đúng.', variant: 'destructive' });
      return;
    }
    if (choices.some(c => !c.content.trim())) {
      toast({ title: 'Thiếu nội dung', description: 'Tất cả các lựa chọn đều cần có nội dung.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createQuestion({
        title, description: description || undefined, explanation, referenceUrl: referenceUrl || undefined,
        certificationId, domainId: domainId || undefined, difficulty: difficulty as Difficulty, questionType,
        choices: choices.map(c => ({ id: c.id, label: c.label, content: c.content, isCorrect: c.isCorrect })),
      });
      toast({ title: '✅ Đã lưu!', description: 'Câu hỏi đã được submit thành công.' });
      navigate('/questions');
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.response?.data?.message || 'Không thể tạo câu hỏi.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const difficultyColor = (d: string) => {
    if (d === 'EASY') return 'bg-accent/10 text-accent';
    if (d === 'MEDIUM') return 'bg-warning/10 text-[hsl(var(--warning))]';
    return 'bg-destructive/10 text-destructive';
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan">CertGym</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className={`font-mono text-xs ${showPreview ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Eye className="w-4 h-4 mr-1" /> Preview
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="font-mono text-xs">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
        </div>
      </nav>

      <div className="pt-20 pb-12 container">
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-mono">
            <Sparkles className="inline h-5 w-5 text-primary mr-2" />
            Contribute Question
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Tạo câu hỏi mới cho cộng đồng luyện thi.</p>
        </div>

        <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : 'max-w-3xl'}`}>
          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Certification & Domain */}
            <div className="glass-card p-5 space-y-4">
              <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Certification</div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={certificationId} onValueChange={(v) => { setCertificationId(v); setDomainId(''); }}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Chọn chứng chỉ" />
                  </SelectTrigger>
                  <SelectContent>
                    {certifications.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={domainId} onValueChange={setDomainId} disabled={!domains.length}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Chọn domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EASY">🟢 Easy</SelectItem>
                    <SelectItem value="MEDIUM">🟡 Medium</SelectItem>
                    <SelectItem value="HARD">🔴 Hard</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={questionType} onValueChange={(v) => {
                  setQuestionType(v as QuestionType);
                  if (v === QuestionType.SINGLE) {
                    // Keep only first correct
                    const firstCorrect = choices.findIndex(c => c.isCorrect);
                    setChoices(prev => prev.map((c, i) => ({ ...c, isCorrect: i === firstCorrect })));
                  }
                }}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">Single Answer</SelectItem>
                    <SelectItem value="MULTIPLE">Multiple Answers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Question Content */}
            <div className="glass-card p-5 space-y-4">
              <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Question</div>
              <Textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nội dung câu hỏi chính..."
                className="bg-secondary border-border min-h-[80px] text-sm"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả thêm / scenario (optional)..."
                className="bg-secondary border-border min-h-[60px] text-sm"
              />
            </div>

            {/* Choices */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  Choices {questionType === QuestionType.MULTIPLE && <span className="text-primary">(multi-select)</span>}
                </div>
                {choices.length < 6 && (
                  <Button type="button" variant="ghost" size="sm" onClick={addChoice} className="text-xs text-primary">
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                )}
              </div>
              <AnimatePresence>
                {choices.map((choice, i) => (
                  <motion.div
                    key={choice.label + i}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCorrect(i)}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-all ${
                        choice.isCorrect
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'bg-secondary border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {choice.label.toUpperCase()}
                    </button>
                    <Input
                      value={choice.content}
                      onChange={(e) => {
                        const next = [...choices];
                        next[i].content = e.target.value;
                        setChoices(next);
                      }}
                      placeholder={`Lựa chọn ${choice.label.toUpperCase()}`}
                      className={`bg-secondary border-border text-sm ${choice.isCorrect ? 'border-accent/30' : ''}`}
                    />
                    {choices.length > 2 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeChoice(i)} className="text-muted-foreground hover:text-destructive shrink-0 px-2">
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <p className="text-xs text-muted-foreground">Click vào chữ cái để đánh dấu đáp án đúng</p>
            </div>

            {/* Explanation & Reference */}
            <div className="glass-card p-5 space-y-4">
              <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Explanation</div>
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Giải thích tại sao đáp án đúng là đúng, và các đáp án khác sai ở đâu..."
                className="bg-secondary border-border min-h-[100px] text-sm"
              />
              <Input
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="Reference URL (optional)"
                className="bg-secondary border-border text-sm"
              />
            </div>

            {/* Tags */}
            <div className="glass-card p-5 space-y-3">
              <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                <Tag className="inline w-3 h-3 mr-1" /> Tags
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Nhập tag rồi Enter..."
                  className="bg-secondary border-border text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag} className="shrink-0 font-mono">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs font-mono gap-1 cursor-pointer hover:bg-destructive/20" onClick={() => removeTag(tag)}>
                      {tag}
                      <X className="w-2.5 h-2.5" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full glow-cyan font-mono" size="lg" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" /> {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </form>

          {/* PREVIEW */}
          {showPreview && (
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
                    {questionType === QuestionType.MULTIPLE && (
                      <span className="text-xs text-primary font-mono">MULTI</span>
                    )}
                  </div>

                  {/* Question */}
                  <h2 className="text-base font-medium mb-1">
                    {title || <span className="text-muted-foreground italic">Nội dung câu hỏi...</span>}
                  </h2>
                  {description && (
                    <p className="text-sm text-muted-foreground mb-4">{description}</p>
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
          )}
        </div>
      </div>
    </div>
  );
}
