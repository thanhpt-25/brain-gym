import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import {
  createOrgQuestion, updateOrgQuestion, getOrgQuestion,
} from '@/services/org-questions';
import { getCertifications } from '@/services/certifications';
import type { CreateOrgQuestionPayload } from '@/types/org-question-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft, Save, Plus, X, Tag, BookOpen, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChoiceInput {
  label: string;
  content: string;
  isCorrect: boolean;
}

const OrgQuestionForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { questionId } = useParams();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';
  const isEditing = !!questionId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [explanation, setExplanation] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [questionType, setQuestionType] = useState('SINGLE');
  const [category, setCategory] = useState('');
  const [certificationId, setCertificationId] = useState<string>('none');
  const [isScenario, setIsScenario] = useState(false);
  const [isTrapQuestion, setIsTrapQuestion] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
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

  const { data: existingQuestion, isLoading: loadingQuestion } = useQuery({
    queryKey: ['org-question', slug, questionId],
    queryFn: () => getOrgQuestion(slug, questionId!),
    enabled: isEditing && !!slug,
  });

  useEffect(() => {
    if (existingQuestion) {
      setTitle(existingQuestion.title);
      setDescription(existingQuestion.description || '');
      setExplanation(existingQuestion.explanation || '');
      setReferenceUrl(existingQuestion.referenceUrl || '');
      setCodeSnippet(existingQuestion.codeSnippet || '');
      setDifficulty(existingQuestion.difficulty);
      setQuestionType(existingQuestion.questionType);
      setCategory(existingQuestion.category || '');
      setCertificationId(existingQuestion.certificationId || 'none');
      setIsScenario(existingQuestion.isScenario);
      setIsTrapQuestion(existingQuestion.isTrapQuestion);
      setTags(existingQuestion.tags);
      setChoices(
        existingQuestion.choices
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c) => ({ label: c.label, content: c.content, isCorrect: c.isCorrect })),
      );
    }
  }, [existingQuestion]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTag();
    }
  };

  const toggleCorrect = (index: number) => {
    setChoices((prev) => {
      if (questionType === 'SINGLE') {
        return prev.map((c, i) => ({ ...c, isCorrect: i === index }));
      }
      return prev.map((c, i) => (i === index ? { ...c, isCorrect: !c.isCorrect } : c));
    });
  };

  const addChoice = () => {
    if (choices.length >= 6) return;
    const nextLabel = String.fromCharCode(97 + choices.length);
    setChoices((prev) => [...prev, { label: nextLabel, content: '', isCorrect: false }]);
  };

  const removeChoice = (index: number) => {
    if (choices.length <= 2) return;
    setChoices((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((c, i) => ({ ...c, label: String.fromCharCode(97 + i) }));
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateOrgQuestionPayload) => createOrgQuestion(slug, data),
    onSuccess: () => {
      toast({ title: 'Question created', description: 'Saved as draft.' });
      queryClient.invalidateQueries({ queryKey: ['org-questions', slug] });
      navigate(`/org/${slug}/questions`);
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e?.response?.data?.message || 'Failed to create question.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateOrgQuestionPayload>) => updateOrgQuestion(slug, questionId!, data),
    onSuccess: () => {
      toast({ title: 'Question updated', description: 'Status reset to draft.' });
      queryClient.invalidateQueries({ queryKey: ['org-questions', slug] });
      navigate(`/org/${slug}/questions`);
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e?.response?.data?.message || 'Failed to update question.', variant: 'destructive' });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Missing title', description: 'Please enter a question title.', variant: 'destructive' });
      return;
    }
    if (!choices.some((c) => c.isCorrect)) {
      toast({ title: 'No correct answer', description: 'Mark at least one correct choice.', variant: 'destructive' });
      return;
    }
    if (choices.some((c) => !c.content.trim())) {
      toast({ title: 'Empty choice', description: 'All choices must have content.', variant: 'destructive' });
      return;
    }

    const payload: CreateOrgQuestionPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      explanation: explanation.trim() || undefined,
      referenceUrl: referenceUrl.trim() || undefined,
      codeSnippet: codeSnippet.trim() || undefined,
      difficulty,
      questionType,
      category: category.trim() || undefined,
      certificationId: certificationId !== 'none' ? certificationId : undefined,
      isScenario,
      isTrapQuestion,
      tags: tags.length > 0 ? tags : undefined,
      choices: choices.map((c) => ({ label: c.label, content: c.content, isCorrect: c.isCorrect })),
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEditing && loadingQuestion) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${slug}/questions`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-mono font-bold">
          {isEditing ? 'Edit Question' : 'New Question'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cloned badge */}
        {existingQuestion?.sourceQuestionId && (
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-secondary/60 border border-border rounded-lg px-3 py-2">
            <BookOpen className="h-3 w-3 text-primary shrink-0" />
            Cloned from public bank — customize and submit for review when ready
          </div>
        )}

        {/* Meta */}
        <div className="glass-card p-5 space-y-4">
          <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Settings</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>

            <Select value={questionType} onValueChange={(v) => {
              setQuestionType(v);
              if (v === 'SINGLE') {
                const firstCorrect = choices.findIndex((c) => c.isCorrect);
                setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === firstCorrect })));
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

            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="bg-secondary border-border text-sm"
            />

            <Select value={certificationId} onValueChange={setCertificationId}>
              <SelectTrigger className="bg-secondary border-border col-span-2 sm:col-span-1">
                <SelectValue placeholder="Certification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Certification</SelectItem>
                {certifications.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch id="scenario" checked={isScenario} onCheckedChange={setIsScenario} />
              <Label htmlFor="scenario" className="text-xs font-mono cursor-pointer">Scenario</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="trap" checked={isTrapQuestion} onCheckedChange={setIsTrapQuestion} />
              <Label htmlFor="trap" className="text-xs font-mono text-destructive/80 cursor-pointer">Trap Question</Label>
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="glass-card p-5 space-y-4">
          <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Question</div>
          <Textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Question title..."
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
              placeholder={isScenario ? 'Describe the scenario...' : 'Additional context (optional)...'}
              className={`bg-secondary border-border text-sm transition-all duration-300 ${isScenario ? 'min-h-[140px] border-accent/30' : 'min-h-[60px]'}`}
            />
          </div>
          <Textarea
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            placeholder="Code snippet (optional)..."
            className="bg-secondary border-border min-h-[60px] text-sm font-mono"
          />
        </div>

        {/* Choices */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              Choices {questionType === 'MULTIPLE' && <span className="text-primary">(multi-select)</span>}
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
                  placeholder={`Choice ${choice.label.toUpperCase()}`}
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
          <p className="text-xs text-muted-foreground">Click a letter to mark correct answers</p>
        </div>

        {/* Explanation */}
        <div className="glass-card p-5 space-y-4">
          <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Explanation</div>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Why is this the correct answer..."
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
              placeholder="Add tag then Enter..."
              className="bg-secondary border-border text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag} className="shrink-0 font-mono">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs font-mono gap-1 cursor-pointer hover:bg-destructive/20"
                  onClick={() => removeTag(tag)}
                >
                  {tag}
                  <X className="w-2.5 h-2.5" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <Button type="submit" className="w-full glow-cyan font-mono" size="lg" disabled={isSubmitting}>
          <Save className="w-4 h-4 mr-2" /> {isSubmitting ? 'Saving...' : isEditing ? 'Update Question' : 'Save as Draft'}
        </Button>
      </form>
    </div>
  );
};

export default OrgQuestionForm;
