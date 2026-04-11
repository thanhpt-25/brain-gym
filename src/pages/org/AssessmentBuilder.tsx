import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import {
  createAssessment, updateAssessment, getAssessment,
} from '@/services/assessments';
import { getOrgQuestions } from '@/services/org-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Save, Plus, Trash2, Loader2, ClipboardList,
  Search, ChevronUp, ChevronDown, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AssessmentQuestionPayload } from '@/types/assessment-types';
import SmartFillDialog from '@/components/org/SmartFillDialog';

interface QuestionEntry {
  id: string;
  orgQuestionId?: string;
  publicQuestionId?: string;
  title: string;
  type: 'public' | 'org';
}

const AssessmentBuilder = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { aid } = useParams();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';
  const isEditing = !!aid;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(60);
  const [passingScore, setPassingScore] = useState<number | ''>('');
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeChoices, setRandomizeChoices] = useState(true);
  const [detectTabSwitch, setDetectTabSwitch] = useState(false);
  const [blockCopyPaste, setBlockCopyPaste] = useState(false);
  const [linkExpiryHours, setLinkExpiryHours] = useState(72);
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionEntry[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [showSmartFill, setShowSmartFill] = useState(false);

  const { data: existingItem, isLoading: loadingItem } = useQuery({
    queryKey: ['assessment-detail', slug, aid],
    queryFn: () => getAssessment(slug, aid!),
    enabled: isEditing && !!slug,
  });

  const { data: orgQuestionsData } = useQuery({
    queryKey: ['org-questions-picker', slug, pickerSearch],
    queryFn: () => getOrgQuestions(slug, {
      status: 'APPROVED',
      search: pickerSearch || undefined,
      limit: 50,
    }),
    enabled: !!slug,
  });

  const orgQuestions = orgQuestionsData?.data ?? [];

  useEffect(() => {
    if (existingItem) {
      setTitle(existingItem.title);
      setDescription(existingItem.description ?? '');
      setTimeLimit(existingItem.timeLimit);
      setPassingScore(existingItem.passingScore ?? '');
      setRandomizeQuestions(existingItem.randomizeQuestions);
      setRandomizeChoices(existingItem.randomizeChoices);
      setDetectTabSwitch(existingItem.detectTabSwitch);
      setBlockCopyPaste(existingItem.blockCopyPaste);
      setLinkExpiryHours(existingItem.linkExpiryHours);
      if (existingItem.questions) {
        setSelectedQuestions(
          existingItem.questions.map((q) => {
            const source = q.orgQuestion ?? q.publicQuestion;
            return {
              id: q.id,
              orgQuestionId: q.orgQuestionId ?? undefined,
              publicQuestionId: q.publicQuestionId ?? undefined,
              title: source?.title ?? 'Unknown',
              type: q.orgQuestionId ? 'org' : 'public',
            };
          }),
        );
      }
    }
  }, [existingItem]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const questions: AssessmentQuestionPayload[] = selectedQuestions.map((q, i) => ({
        orgQuestionId: q.orgQuestionId,
        publicQuestionId: q.publicQuestionId,
        sortOrder: i,
      }));
      const payload = {
        title,
        description: description || undefined,
        timeLimit,
        passingScore: passingScore !== '' ? Number(passingScore) : undefined,
        randomizeQuestions,
        randomizeChoices,
        detectTabSwitch,
        blockCopyPaste,
        linkExpiryHours,
        questions,
      };
      return isEditing
        ? updateAssessment(slug, aid!, payload)
        : createAssessment(slug, payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Assessment updated' : 'Assessment created');
      queryClient.invalidateQueries({ queryKey: ['org-assessments', slug] });
      navigate(`/org/${slug}/assessments`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  const addQuestion = (q: { id: string; title: string }) => {
    if (selectedQuestions.some((s) => s.orgQuestionId === q.id)) return;
    setSelectedQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), orgQuestionId: q.id, title: q.title, type: 'org' },
    ]);
  };

  const removeQuestion = (id: string) => {
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleSmartFill = (questions: QuestionEntry[]) => {
    setSelectedQuestions((prev) => {
      const existingOrgIds = new Set(prev.map((q) => q.orgQuestionId).filter(Boolean));
      const newOnes = questions.filter((q) => q.orgQuestionId && !existingOrgIds.has(q.orgQuestionId));
      return [...prev, ...newOnes.map((q) => ({ ...q, id: crypto.randomUUID() }))];
    });
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= selectedQuestions.length) return;
    const copy = [...selectedQuestions];
    [copy[index], copy[newIdx]] = [copy[newIdx], copy[index]];
    setSelectedQuestions(copy);
  };

  if (isEditing && loadingItem) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          {isEditing ? 'Edit Assessment' : 'New Assessment'}
        </h1>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-mono">Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Developer Screen" />
        </div>
        <div>
          <Label className="text-xs font-mono">Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief description..." />
        </div>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-mono">Time Limit (min) *</Label>
          <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} min={1} />
        </div>
        <div>
          <Label className="text-xs font-mono">Passing Score (%)</Label>
          <Input
            type="number"
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value ? Number(e.target.value) : '')}
            min={0} max={100}
            placeholder="Optional"
          />
        </div>
        <div>
          <Label className="text-xs font-mono">Link Expiry (hours)</Label>
          <Input type="number" value={linkExpiryHours} onChange={(e) => setLinkExpiryHours(Number(e.target.value))} min={1} />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-mono">Randomize Questions</Label>
          <Switch checked={randomizeQuestions} onCheckedChange={setRandomizeQuestions} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-mono">Randomize Choices</Label>
          <Switch checked={randomizeChoices} onCheckedChange={setRandomizeChoices} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-mono">Detect Tab Switching</Label>
          <Switch checked={detectTabSwitch} onCheckedChange={setDetectTabSwitch} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-mono">Block Copy/Paste</Label>
          <Switch checked={blockCopyPaste} onCheckedChange={setBlockCopyPaste} />
        </div>
      </div>

      {/* Question Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-mono font-medium">
          Questions ({selectedQuestions.length} selected)
        </Label>

        {/* Selected questions list */}
        {selectedQuestions.length > 0 && (
          <div className="space-y-2">
            {selectedQuestions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2 p-2 rounded border border-border bg-muted/30">
                <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}</span>
                <span className="text-xs font-mono flex-1 truncate">{q.title}</span>
                <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(i, -1)} disabled={i === 0}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(i, 1)} disabled={i === selectedQuestions.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeQuestion(q.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Question picker */}
        <div className="border border-border rounded-md p-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search approved org questions..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="pl-10 bg-muted border-border text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-mono text-xs gap-1.5 shrink-0"
              onClick={() => setShowSmartFill(true)}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Smart Fill
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {orgQuestions.map((q: any) => {
              const alreadyAdded = selectedQuestions.some((s) => s.orgQuestionId === q.id);
              return (
                <div
                  key={q.id}
                  className={`flex items-center justify-between p-2 rounded text-xs font-mono ${
                    alreadyAdded ? 'opacity-40' : 'hover:bg-muted cursor-pointer'
                  }`}
                  onClick={() => !alreadyAdded && addQuestion(q)}
                >
                  <span className="truncate flex-1">{q.title}</span>
                  {!alreadyAdded && <Plus className="h-3 w-3 text-primary shrink-0" />}
                </div>
              );
            })}
            {orgQuestions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No approved questions found</p>
            )}
          </div>
        </div>
      </div>

      <SmartFillDialog
        open={showSmartFill}
        onClose={() => setShowSmartFill(false)}
        onFill={handleSmartFill}
        slug={slug}
        existingIds={selectedQuestions.map((q) => q.orgQuestionId).filter(Boolean) as string[]}
      />

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          className="glow-cyan"
          disabled={!title || selectedQuestions.length === 0 || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          {isEditing ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  );
};

export default AssessmentBuilder;
