import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import {
  createCatalogItem, updateCatalogItem, getCatalogItem, getTracks,
} from '@/services/exam-catalog';
import { getQuestions } from '@/services/questions';
import { getOrgQuestions } from '@/services/org-questions';
import { getCertifications } from '@/services/certifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft, Save, Plus, Trash2, Loader2, GraduationCap,
  Search, ChevronUp, ChevronDown,
} from 'lucide-react';
import type { ExamCatalogItemType, CatalogQuestionPayload } from '@/types/exam-catalog-types';

interface QuestionEntry {
  id: string; // unique row id
  publicQuestionId?: string;
  orgQuestionId?: string;
  title: string;
  type: 'public' | 'org';
}

const OrgCatalogBuilder = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { cid } = useParams();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';
  const isEditing = !!cid;

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ExamCatalogItemType>('FIXED');
  const [certificationId, setCertificationId] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(60);
  const [passingScore, setPassingScore] = useState<number | ''>('');
  const [timerMode, setTimerMode] = useState('STRICT');
  const [maxAttempts, setMaxAttempts] = useState<number | ''>('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [trackId, setTrackId] = useState('');
  const [prerequisiteId, setPrerequisiteId] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionEntry[]>([]);

  // Question picker state
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTab, setPickerTab] = useState<'public' | 'org'>('public');

  const { data: existingItem, isLoading: loadingItem } = useQuery({
    queryKey: ['org-catalog-item', slug, cid],
    queryFn: () => getCatalogItem(slug, cid!),
    enabled: isEditing && !!slug,
  });

  const { data: certifications = [] } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  const { data: tracks = [] } = useQuery({
    queryKey: ['org-tracks', slug],
    queryFn: () => getTracks(slug),
    enabled: !!slug,
  });

  const { data: publicQuestionsData } = useQuery({
    queryKey: ['public-questions-picker', certificationId, pickerSearch],
    queryFn: () => getQuestions(certificationId || undefined, 1, 30, undefined, 'APPROVED'),
    enabled: pickerTab === 'public',
  });

  const { data: orgQuestionsData } = useQuery({
    queryKey: ['org-questions-picker', slug, pickerSearch],
    queryFn: () => getOrgQuestions(slug, { status: 'APPROVED', search: pickerSearch || undefined, limit: 30 }),
    enabled: pickerTab === 'org' && !!slug,
  });

  useEffect(() => {
    if (existingItem) {
      setTitle(existingItem.title);
      setDescription(existingItem.description ?? '');
      setType(existingItem.type);
      setCertificationId(existingItem.certificationId ?? '');
      setQuestionCount(existingItem.questionCount);
      setTimeLimit(existingItem.timeLimit);
      setPassingScore(existingItem.passingScore ?? '');
      setTimerMode(existingItem.timerMode);
      setMaxAttempts(existingItem.maxAttempts ?? '');
      setAvailableFrom(existingItem.availableFrom ? existingItem.availableFrom.slice(0, 10) : '');
      setAvailableUntil(existingItem.availableUntil ? existingItem.availableUntil.slice(0, 10) : '');
      setIsMandatory(existingItem.isMandatory);
      setIsActive(existingItem.isActive);
      setTrackId(existingItem.trackId ?? '');
      setPrerequisiteId(existingItem.prerequisiteId ?? '');
      // Load existing questions
      if ('questions' in existingItem && Array.isArray((existingItem as any).questions)) {
        const qs = (existingItem as any).questions as any[];
        setSelectedQuestions(
          qs.map((q) => ({
            id: q.id,
            publicQuestionId: q.publicQuestionId ?? undefined,
            orgQuestionId: q.orgQuestionId ?? undefined,
            title: q.publicQuestion?.title ?? q.orgQuestion?.title ?? 'Question',
            type: q.publicQuestionId ? 'public' : 'org',
          })),
        );
      }
    }
  }, [existingItem]);

  const createMutation = useMutation({
    mutationFn: () =>
      createCatalogItem(slug, {
        title, description: description || undefined, type, certificationId: certificationId || undefined,
        questionCount, timeLimit, passingScore: passingScore !== '' ? passingScore : undefined,
        timerMode: timerMode as any, maxAttempts: maxAttempts !== '' ? maxAttempts : undefined,
        availableFrom: availableFrom || undefined, availableUntil: availableUntil || undefined,
        isMandatory, isActive, trackId: trackId || undefined, prerequisiteId: prerequisiteId || undefined,
        questions: type === 'FIXED' ? selectedQuestions.map((q, i): CatalogQuestionPayload => ({
          publicQuestionId: q.publicQuestionId,
          orgQuestionId: q.orgQuestionId,
          sortOrder: i,
        })) : undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Catalog item created' });
      queryClient.invalidateQueries({ queryKey: ['org-catalog-manage', slug] });
      navigate(`/org/${slug}/catalog/manage`);
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCatalogItem(slug, cid!, {
        title, description: description || undefined, type, certificationId: certificationId || undefined,
        questionCount, timeLimit, passingScore: passingScore !== '' ? passingScore : undefined,
        timerMode: timerMode as any, maxAttempts: maxAttempts !== '' ? maxAttempts : undefined,
        availableFrom: availableFrom || undefined, availableUntil: availableUntil || undefined,
        isMandatory, isActive, trackId: trackId || undefined, prerequisiteId: prerequisiteId || undefined,
        questions: type === 'FIXED' ? selectedQuestions.map((q, i): CatalogQuestionPayload => ({
          publicQuestionId: q.publicQuestionId,
          orgQuestionId: q.orgQuestionId,
          sortOrder: i,
        })) : undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Catalog item updated' });
      queryClient.invalidateQueries({ queryKey: ['org-catalog-manage', slug] });
      navigate(`/org/${slug}/catalog/manage`);
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message || 'Failed', variant: 'destructive' }),
  });

  const isBusy = createMutation.isPending || updateMutation.isPending;

  const addPublicQuestion = (q: any) => {
    if (selectedQuestions.some((s) => s.publicQuestionId === q.id)) return;
    setSelectedQuestions((prev) => [...prev, {
      id: `pub-${q.id}`,
      publicQuestionId: q.id,
      title: q.title,
      type: 'public',
    }]);
  };

  const addOrgQuestion = (q: any) => {
    if (selectedQuestions.some((s) => s.orgQuestionId === q.id)) return;
    setSelectedQuestions((prev) => [...prev, {
      id: `org-${q.id}`,
      orgQuestionId: q.id,
      title: q.title,
      type: 'org',
    }]);
  };

  const removeQuestion = (id: string) =>
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id));

  const moveQuestion = (id: string, dir: 'up' | 'down') => {
    setSelectedQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (dir === 'up' && idx === 0) return prev;
      if (dir === 'down' && idx === prev.length - 1) return prev;
      const newArr = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      [newArr[idx], newArr[swap]] = [newArr[swap], newArr[idx]];
      return newArr;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' }); return;
    }
    if (isEditing) updateMutation.mutate(); else createMutation.mutate();
  };

  if (isEditing && loadingItem) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const publicQuestions = publicQuestionsData?.data ?? [];
  const orgQuestions = orgQuestionsData?.data ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${slug}/catalog/manage`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          {isEditing ? 'Edit Exam' : 'New Exam'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="glass-card p-5 space-y-4">
          <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Exam title *" className="bg-secondary border-border text-sm" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)" className="bg-secondary border-border min-h-[60px] text-sm" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Select value={type} onValueChange={(v) => setType(v as ExamCatalogItemType)}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Fixed Questions</SelectItem>
                <SelectItem value="DYNAMIC">Dynamic (Random)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={certificationId} onValueChange={setCertificationId}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Certification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {certifications.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timerMode} onValueChange={setTimerMode}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STRICT">Strict Timer</SelectItem>
                <SelectItem value="ACCELERATED">Accelerated</SelectItem>
                <SelectItem value="RELAXED">Relaxed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Questions *</Label>
              <Input type="number" min="1" value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="bg-secondary border-border text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Time Limit (min) *</Label>
              <Input type="number" min="1" value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="bg-secondary border-border text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Passing Score (%)</Label>
              <Input type="number" min="0" max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 70"
                className="bg-secondary border-border text-sm" />
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="glass-card p-5 space-y-4">
          <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Scheduling</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Available From</Label>
              <Input type="date" value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="bg-secondary border-border text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Available Until</Label>
              <Input type="date" value={availableUntil}
                onChange={(e) => setAvailableUntil(e.target.value)}
                className="bg-secondary border-border text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Max Attempts</Label>
              <Input type="number" min="1"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value ? Number(e.target.value) : '')}
                placeholder="Unlimited"
                className="bg-secondary border-border text-sm" />
            </div>
            <div className="flex items-center gap-6 pt-5">
              <div className="flex items-center space-x-2">
                <Switch id="mandatory" checked={isMandatory} onCheckedChange={setIsMandatory} />
                <Label htmlFor="mandatory" className="text-xs font-mono cursor-pointer">Mandatory</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="active" className="text-xs font-mono cursor-pointer">Active</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Track & Prerequisite */}
        <div className="glass-card p-5 space-y-4">
          <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Organization</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Learning Track</Label>
              <Select value={trackId} onValueChange={setTrackId}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="No track" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No track</SelectItem>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Prerequisite Exam</Label>
              <Input value={prerequisiteId} onChange={(e) => setPrerequisiteId(e.target.value)}
                placeholder="Catalog item ID (optional)"
                className="bg-secondary border-border text-sm" />
            </div>
          </div>
        </div>

        {/* Questions (FIXED type only) */}
        {type === 'FIXED' && (
          <div className="glass-card p-5 space-y-4">
            <div className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              Questions ({selectedQuestions.length} selected)
            </div>

            {/* Selected list */}
            {selectedQuestions.length > 0 && (
              <div className="space-y-2 mb-4">
                {selectedQuestions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                    <span className="flex-1 text-xs truncate">{q.title}</span>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${q.type === 'org' ? 'border-primary/30 text-primary' : ''}`}>
                      {q.type}
                    </Badge>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveQuestion(q.id, 'up')}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveQuestion(q.id, 'down')}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-destructive" onClick={() => removeQuestion(q.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Question Picker */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex border-b border-border">
                {(['public', 'org'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`flex-1 py-2 text-xs font-mono font-semibold transition-colors ${
                      pickerTab === tab ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setPickerTab(tab)}
                  >
                    {tab === 'public' ? 'Public Questions' : 'Org Questions'}
                  </button>
                ))}
              </div>
              <div className="p-3">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 bg-secondary border-border text-xs h-8"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {(pickerTab === 'public' ? publicQuestions : orgQuestions).map((q: any) => {
                    const alreadyAdded = selectedQuestions.some(
                      (s) => s.publicQuestionId === q.id || s.orgQuestionId === q.id,
                    );
                    return (
                      <div
                        key={q.id}
                        className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                          alreadyAdded
                            ? 'opacity-50 cursor-default'
                            : 'hover:bg-secondary/80'
                        }`}
                        onClick={() => {
                          if (!alreadyAdded) {
                            pickerTab === 'public' ? addPublicQuestion(q) : addOrgQuestion(q);
                          }
                        }}
                      >
                        <span className="truncate flex-1 mr-2">{q.title}</span>
                        {alreadyAdded ? (
                          <span className="text-primary text-[10px] shrink-0">Added</span>
                        ) : (
                          <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {type === 'DYNAMIC' && (
          <div className="glass-card p-5">
            <p className="text-sm text-muted-foreground font-mono">
              Dynamic exams randomly select <strong>{questionCount}</strong> questions from
              approved public questions for the selected certification at exam time.
              {!certificationId && (
                <span className="text-amber-400 block mt-1">⚠ Select a certification above to enable dynamic exams.</span>
              )}
            </p>
          </div>
        )}

        {/* Submit */}
        <Button type="submit" className="w-full glow-cyan font-mono" size="lg" disabled={isBusy}>
          <Save className="w-4 h-4 mr-2" />
          {isBusy ? 'Saving...' : isEditing ? 'Update Exam' : 'Create Exam'}
        </Button>
      </form>
    </div>
  );
};

export default OrgCatalogBuilder;
