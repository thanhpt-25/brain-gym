import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCertifications } from '@/services/certifications';
import { createQuestion, updateQuestionStatus } from '@/services/questions';
import { getTags } from '@/services/tags';
import { Difficulty, QuestionType } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Brain, ArrowLeft, Save, Eye, Plus, X, Tag, Sparkles, BookOpen } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { LivePreview } from '@/components/questions/LivePreview';

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
  const [isScenario, setIsScenario] = useState(false);
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

  const { data: existingTags = [] } = useQuery({
    queryKey: ['tags', certificationId],
    queryFn: () => getTags(certificationId),
    enabled: !!certificationId,
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
      toast({ title: 'Missing Information', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    if (!choices.some(c => c.isCorrect)) {
      toast({ title: 'No Correct Answer', description: 'Please select at least one correct answer.', variant: 'destructive' });
      return;
    }
    if (choices.some(c => !c.content.trim())) {
      toast({ title: 'Missing Content', description: 'All choices must have content.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const q = await createQuestion({
        title, description: description || undefined, explanation, referenceUrl: referenceUrl || undefined,
        certificationId, domainId: domainId || undefined, difficulty: difficulty as Difficulty, questionType,
        choices: choices.map((c) => ({ label: c.label, content: c.content, isCorrect: c.isCorrect })),
        tags: tags,
        isScenario: isScenario,
      });
      
      // Move from DRAFT to PENDING
      await updateQuestionStatus(q.id, 'PENDING');

      toast({ title: '✅ Saved!', description: 'Question submitted successfully for review.' });
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
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Question</div>
                <div className="flex items-center space-x-2">
                  <Switch id="is-scenario" checked={isScenario} onCheckedChange={setIsScenario} />
                  <Label htmlFor="is-scenario" className="text-xs font-mono text-muted-foreground cursor-pointer">Scenario Mode</Label>
                </div>
              </div>
              <Textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nội dung câu hỏi chính..."
                className="bg-secondary border-border min-h-[80px] text-sm"
              />
              <div className={`space-y-2 transition-all duration-300 ${isScenario ? 'p-3 rounded-lg bg-accent/5 border border-accent/20' : ''}`}>
                {isScenario && (
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-accent uppercase tracking-widest px-1">
                    <BookOpen className="w-3 h-3" /> Technical Context / Scenario
                  </div>
                )}
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isScenario ? "Mô tả chi tiết tình huống / scenario..." : "Mô tả thêm / context (optional)..."}
                  className={`bg-secondary border-border text-sm transition-all duration-300 ${isScenario ? 'min-h-[140px] border-accent/30' : 'min-h-[60px]'}`}
                />
              </div>
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

              {/* Tag Suggestions */}
              {existingTags.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest mb-2 opacity-50">Suggestions</div>
                  <div className="flex flex-wrap gap-1.5">
                    {existingTags
                      .filter(et => !tags.includes(et.name))
                      .slice(0, 10)
                      .map(et => (
                        <button
                          key={et.id}
                          type="button"
                          onClick={() => setTags(prev => [...prev, et.name])}
                          className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/5 bg-white/5 hover:bg-primary/10 hover:border-primary/30 transition-all text-muted-foreground hover:text-primary"
                        >
                          + {et.name}
                        </button>
                      ))}
                  </div>
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
            <LivePreview
              difficulty={difficulty as Difficulty | ''}
              selectedCert={selectedCert}
              domainId={domainId}
              domains={domains}
              questionType={questionType}
              isScenario={isScenario}
              title={title}
              description={description}
              choices={choices}
              explanation={explanation}
              referenceUrl={referenceUrl}
              tags={tags}
            />
          )}
        </div>
      </div>
    </div>
  );
}
