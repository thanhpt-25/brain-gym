import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import {
  createAssessment, updateAssessment, getAssessment, getPoolCount,
} from '@/services/assessments';
import { getOrgQuestions } from '@/services/org-questions';
import { getCertifications } from '@/services/certifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Save, Plus, Trash2, Loader2, ClipboardList,
  Search, ChevronUp, ChevronDown, Sparkles, List, Layers, Database,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  AssessmentQuestionPayload,
  AssessmentSelectionMode,
  BlueprintDomain,
  PoolConfig,
} from '@/types/assessment-types';
import SmartFillDialog from '@/components/org/SmartFillDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionEntry {
  id: string;
  orgQuestionId?: string;
  publicQuestionId?: string;
  title: string;
  type: 'public' | 'org';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Mode selector — 3 tabs */
const ModeSelector = ({
  mode,
  onChange,
  disabled,
}: {
  mode: AssessmentSelectionMode;
  onChange: (m: AssessmentSelectionMode) => void;
  disabled: boolean;
}) => {
  const options: {
    value: AssessmentSelectionMode;
    label: string;
    icon: React.ReactNode;
    desc: string;
  }[] = [
    { value: 'MANUAL', label: 'Manual', icon: <List className="h-4 w-4" />, desc: 'Pick questions one by one' },
    { value: 'BLUEPRINT', label: 'Blueprint', icon: <Layers className="h-4 w-4" />, desc: 'Auto-build by domain %' },
    { value: 'POOL', label: 'Pool', icon: <Database className="h-4 w-4" />, desc: 'Random draw per candidate' },
  ];

  return (
    <div className="space-y-2">
      <Label className="text-xs font-mono">Selection Mode</Label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`flex flex-col items-center gap-1 p-3 rounded-md border text-xs font-mono transition-colors ${
              mode === o.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50 text-muted-foreground'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {o.icon}
            <span className="font-semibold">{o.label}</span>
            <span className="text-[10px] text-center leading-tight opacity-70">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/** Blueprint domain editor */
const BlueprintEditor = ({
  totalQuestions,
  domains,
  difficulty,
  certificationId,
  onTotalChange,
  onDomainsChange,
  onDifficultyChange,
  onCertChange,
  certifications,
}: {
  totalQuestions: number;
  domains: BlueprintDomain[];
  difficulty: string;
  certificationId: string;
  onTotalChange: (v: number) => void;
  onDomainsChange: (d: BlueprintDomain[]) => void;
  onDifficultyChange: (v: string) => void;
  onCertChange: (v: string) => void;
  certifications: any[];
}) => {
  const totalPct = domains.reduce((s, d) => s + d.percentage, 0);
  const pctOk = Math.abs(totalPct - 100) <= 1;

  const updateDomain = (i: number, key: keyof BlueprintDomain, value: any) => {
    const copy = [...domains];
    copy[i] = { ...copy[i], [key]: value };
    onDomainsChange(copy);
  };

  return (
    <div className="space-y-4 p-4 rounded-md border border-border bg-muted/20">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-mono font-semibold">Blueprint Config</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-mono">Total Questions *</Label>
          <Input
            type="number"
            min={1}
            value={totalQuestions}
            onChange={(e) => onTotalChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="bg-secondary border-border"
          />
        </div>
        <div>
          <Label className="text-xs font-mono">Difficulty Filter</Label>
          <Select value={difficulty} onValueChange={onDifficultyChange}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder="Any difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any difficulty</SelectItem>
              <SelectItem value="EASY">Easy</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HARD">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs font-mono">Certification Filter</Label>
        <Select value={certificationId} onValueChange={onCertChange}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="Any certification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any certification</SelectItem>
            {certifications.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-mono">Domain Breakdown</Label>
          <span className={`text-[10px] font-mono ${pctOk ? 'text-emerald-400' : 'text-amber-400'}`}>
            {totalPct}% / 100%
          </span>
        </div>

        {domains.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={d.domain}
              onChange={(e) => updateDomain(i, 'domain', e.target.value)}
              placeholder="Domain / Category name"
              className="bg-secondary border-border text-xs flex-1"
            />
            <div className="flex items-center gap-1 shrink-0">
              <Input
                type="number"
                min={0}
                max={100}
                value={d.percentage}
                onChange={(e) => updateDomain(i, 'percentage', parseInt(e.target.value) || 0)}
                className="bg-secondary border-border text-xs w-20 text-center"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground w-14 text-right shrink-0">
              ~{Math.round((d.percentage / 100) * totalQuestions)} q
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive shrink-0"
              onClick={() =>
                onDomainsChange(domains.filter((_, idx) => idx !== i))
              }
              disabled={domains.length <= 1}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-mono text-xs w-full"
          onClick={() => onDomainsChange([...domains, { domain: '', percentage: 0 }])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Domain
        </Button>

        {!pctOk && (
          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono">
            <AlertCircle className="h-3.5 w-3.5" />
            Percentages must sum to 100 (currently {totalPct}%)
          </div>
        )}
      </div>
    </div>
  );
};

/** Pool filter editor */
const PoolEditor = ({
  drawCount,
  difficulty,
  certificationId,
  categories,
  tags,
  available,
  onDrawCountChange,
  onDifficultyChange,
  onCertChange,
  onCategoriesChange,
  onTagsChange,
  certifications,
}: {
  drawCount: number;
  difficulty: string;
  certificationId: string;
  categories: string;
  tags: string;
  available: number | null;
  onDrawCountChange: (v: number) => void;
  onDifficultyChange: (v: string) => void;
  onCertChange: (v: string) => void;
  onCategoriesChange: (v: string) => void;
  onTagsChange: (v: string) => void;
  certifications: any[];
}) => (
  <div className="space-y-4 p-4 rounded-md border border-border bg-muted/20">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <span className="text-sm font-mono font-semibold">Pool Config</span>
      </div>
      {available !== null && (
        <span
          className={`text-xs font-mono ${
            available >= drawCount ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {available} question{available !== 1 ? 's' : ''} available
        </span>
      )}
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs font-mono">Draw Count *</Label>
        <Input
          type="number"
          min={1}
          value={drawCount}
          onChange={(e) => onDrawCountChange(Math.max(1, parseInt(e.target.value) || 1))}
          className="bg-secondary border-border"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Each candidate gets {drawCount} random question{drawCount !== 1 ? 's' : ''}
        </p>
      </div>
      <div>
        <Label className="text-xs font-mono">Difficulty Filter</Label>
        <Select value={difficulty} onValueChange={onDifficultyChange}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="Any difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any difficulty</SelectItem>
            <SelectItem value="EASY">Easy</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HARD">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div>
      <Label className="text-xs font-mono">Certification Filter</Label>
      <Select value={certificationId} onValueChange={onCertChange}>
        <SelectTrigger className="bg-secondary border-border">
          <SelectValue placeholder="Any certification" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any certification</SelectItem>
          {certifications.map((c: any) => (
            <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label className="text-xs font-mono">Categories (comma-separated)</Label>
      <Input
        value={categories}
        onChange={(e) => onCategoriesChange(e.target.value)}
        placeholder="e.g. Networking, Storage, Compute"
        className="bg-secondary border-border text-sm"
      />
    </div>

    <div>
      <Label className="text-xs font-mono">Tags (comma-separated)</Label>
      <Input
        value={tags}
        onChange={(e) => onTagsChange(e.target.value)}
        placeholder="e.g. vpc, ec2, s3"
        className="bg-secondary border-border text-sm"
      />
    </div>

    {available !== null && available < drawCount && (
      <div className="flex items-center gap-2 text-red-400 text-xs font-mono">
        <AlertCircle className="h-3.5 w-3.5" />
        Not enough approved questions. Reduce draw count or broaden filters.
      </div>
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const AssessmentBuilder = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { aid } = useParams();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';
  const isEditing = !!aid;

  // ── Common settings ──
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(60);
  const [passingScore, setPassingScore] = useState<number | ''>('');
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeChoices, setRandomizeChoices] = useState(true);
  const [detectTabSwitch, setDetectTabSwitch] = useState(false);
  const [blockCopyPaste, setBlockCopyPaste] = useState(false);
  const [linkExpiryHours, setLinkExpiryHours] = useState(72);

  // ── Selection mode ──
  const [mode, setMode] = useState<AssessmentSelectionMode>('MANUAL');

  // ── MANUAL state ──
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionEntry[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [showSmartFill, setShowSmartFill] = useState(false);

  // ── BLUEPRINT state ──
  const [bpTotalQuestions, setBpTotalQuestions] = useState(20);
  const [bpDomains, setBpDomains] = useState<BlueprintDomain[]>([
    { domain: '', percentage: 50 },
    { domain: '', percentage: 50 },
  ]);
  const [bpDifficulty, setBpDifficulty] = useState('any');
  const [bpCertId, setBpCertId] = useState('any');

  // ── POOL state ──
  const [poolDrawCount, setPoolDrawCount] = useState(20);
  const [poolDifficulty, setPoolDifficulty] = useState('any');
  const [poolCertId, setPoolCertId] = useState('any');
  const [poolCategories, setPoolCategories] = useState('');
  const [poolTags, setPoolTags] = useState('');

  // ── Certifications ──
  const { data: certifications = [] } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  // ── Load existing assessment ──
  const { data: existingItem, isLoading: loadingItem } = useQuery({
    queryKey: ['assessment-detail', slug, aid],
    queryFn: () => getAssessment(slug, aid!),
    enabled: isEditing && !!slug,
  });

  // ── Org questions for MANUAL picker ──
  const { data: orgQuestionsData } = useQuery({
    queryKey: ['org-questions-picker', slug, pickerSearch],
    queryFn: () =>
      getOrgQuestions(slug, {
        status: 'APPROVED',
        search: pickerSearch || undefined,
        limit: 50,
      }),
    enabled: !!slug && mode === 'MANUAL',
  });
  const orgQuestions = orgQuestionsData?.data ?? [];

  // ── Pool count preview ──
  const poolFilterConfig = {
    difficulty:
      poolDifficulty !== 'any' ? (poolDifficulty as PoolConfig['difficulty']) : undefined,
    certificationId: poolCertId !== 'any' ? poolCertId : undefined,
    categories: poolCategories.trim()
      ? poolCategories.split(',').map((c) => c.trim()).filter(Boolean)
      : undefined,
    tags: poolTags.trim()
      ? poolTags.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined,
  };
  const { data: poolCountData } = useQuery({
    queryKey: ['pool-count', slug, poolFilterConfig],
    queryFn: () => getPoolCount(slug, poolFilterConfig),
    enabled: !!slug && mode === 'POOL',
  });
  const poolAvailable = poolCountData?.available ?? null;

  // ── Populate form when editing ──
  useEffect(() => {
    if (!existingItem) return;
    setTitle(existingItem.title);
    setDescription(existingItem.description ?? '');
    setTimeLimit(existingItem.timeLimit);
    setPassingScore(existingItem.passingScore ?? '');
    setRandomizeQuestions(existingItem.randomizeQuestions);
    setRandomizeChoices(existingItem.randomizeChoices);
    setDetectTabSwitch(existingItem.detectTabSwitch);
    setBlockCopyPaste(existingItem.blockCopyPaste);
    setLinkExpiryHours(existingItem.linkExpiryHours);
    setMode(existingItem.selectionMode ?? 'MANUAL');

    if (existingItem.selectionMode === 'BLUEPRINT' && existingItem.selectionConfig) {
      const cfg = existingItem.selectionConfig as any;
      setBpTotalQuestions(cfg.totalQuestions ?? 20);
      setBpDomains(cfg.domains ?? [{ domain: '', percentage: 100 }]);
      setBpDifficulty(cfg.difficulty ?? 'any');
      setBpCertId(cfg.certificationId ?? 'any');
    } else if (existingItem.selectionMode === 'POOL' && existingItem.selectionConfig) {
      const cfg = existingItem.selectionConfig as any;
      setPoolDrawCount(cfg.drawCount ?? 20);
      setPoolDifficulty(cfg.difficulty ?? 'any');
      setPoolCertId(cfg.certificationId ?? 'any');
      setPoolCategories((cfg.categories ?? []).join(', '));
      setPoolTags((cfg.tags ?? []).join(', '));
    } else if (existingItem.questions) {
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
  }, [existingItem]);

  // ── MANUAL helpers ──
  const addQuestion = (q: { id: string; title: string }) => {
    if (selectedQuestions.some((s) => s.orgQuestionId === q.id)) return;
    setSelectedQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), orgQuestionId: q.id, title: q.title, type: 'org' },
    ]);
  };

  const removeQuestion = (id: string) =>
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id));

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= selectedQuestions.length) return;
    const copy = [...selectedQuestions];
    [copy[index], copy[newIdx]] = [copy[newIdx], copy[index]];
    setSelectedQuestions(copy);
  };

  const handleSmartFill = (questions: QuestionEntry[]) => {
    setSelectedQuestions((prev) => {
      const existingIds = new Set(prev.map((q) => q.orgQuestionId).filter(Boolean));
      const newOnes = questions.filter(
        (q) => q.orgQuestionId && !existingIds.has(q.orgQuestionId),
      );
      return [...prev, ...newOnes.map((q) => ({ ...q, id: crypto.randomUUID() }))];
    });
  };

  // ── Validation ──
  const bpTotalPct = bpDomains.reduce((s, d) => s + d.percentage, 0);
  const bpValid =
    mode !== 'BLUEPRINT' ||
    (bpDomains.every((d) => d.domain.trim()) &&
      Math.abs(bpTotalPct - 100) <= 1 &&
      bpTotalQuestions >= 1);
  const poolValid =
    mode !== 'POOL' ||
    (poolDrawCount >= 1 && (poolAvailable === null || poolAvailable >= poolDrawCount));
  const manualValid = mode !== 'MANUAL' || selectedQuestions.length > 0;
  const canSave = !!title && bpValid && poolValid && manualValid;

  // ── Save ──
  const saveMutation = useMutation({
    mutationFn: () => {
      const base = {
        title,
        description: description || undefined,
        timeLimit,
        passingScore: passingScore !== '' ? Number(passingScore) : undefined,
        randomizeQuestions,
        randomizeChoices,
        detectTabSwitch,
        blockCopyPaste,
        linkExpiryHours,
        selectionMode: mode,
      };

      if (mode === 'BLUEPRINT') {
        return isEditing
          ? updateAssessment(slug, aid!, {
              ...base,
              selectionConfig: {
                totalQuestions: bpTotalQuestions,
                domains: bpDomains,
                difficulty: bpDifficulty !== 'any' ? bpDifficulty as any : undefined,
                certificationId: bpCertId !== 'any' ? bpCertId : undefined,
              },
            })
          : createAssessment(slug, {
              ...base,
              selectionConfig: {
                totalQuestions: bpTotalQuestions,
                domains: bpDomains,
                difficulty: bpDifficulty !== 'any' ? bpDifficulty as any : undefined,
                certificationId: bpCertId !== 'any' ? bpCertId : undefined,
              },
            });
      }

      if (mode === 'POOL') {
        const poolCfg = {
          drawCount: poolDrawCount,
          difficulty: poolDifficulty !== 'any' ? poolDifficulty as any : undefined,
          certificationId: poolCertId !== 'any' ? poolCertId : undefined,
          categories: poolCategories.trim()
            ? poolCategories.split(',').map((c) => c.trim()).filter(Boolean)
            : undefined,
          tags: poolTags.trim()
            ? poolTags.split(',').map((t) => t.trim()).filter(Boolean)
            : undefined,
        };
        return isEditing
          ? updateAssessment(slug, aid!, { ...base, selectionConfig: poolCfg })
          : createAssessment(slug, { ...base, selectionConfig: poolCfg });
      }

      // MANUAL
      const questions: AssessmentQuestionPayload[] = selectedQuestions.map((q, i) => ({
        orgQuestionId: q.orgQuestionId,
        publicQuestionId: q.publicQuestionId,
        sortOrder: i,
      }));
      return isEditing
        ? updateAssessment(slug, aid!, { ...base, questions })
        : createAssessment(slug, { ...base, questions });
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Assessment updated' : 'Assessment created');
      queryClient.invalidateQueries({ queryKey: ['org-assessments', slug] });
      navigate(`/org/${slug}/assessments`);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Save failed'),
  });

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
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Frontend Developer Screen"
          />
        </div>
        <div>
          <Label className="text-xs font-mono">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Brief description..."
          />
        </div>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-mono">Time Limit (min) *</Label>
          <Input
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            min={1}
          />
        </div>
        <div>
          <Label className="text-xs font-mono">Passing Score (%)</Label>
          <Input
            type="number"
            value={passingScore}
            onChange={(e) =>
              setPassingScore(e.target.value ? Number(e.target.value) : '')
            }
            min={0}
            max={100}
            placeholder="Optional"
          />
        </div>
        <div>
          <Label className="text-xs font-mono">Link Expiry (hours)</Label>
          <Input
            type="number"
            value={linkExpiryHours}
            onChange={(e) => setLinkExpiryHours(Number(e.target.value))}
            min={1}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        {(
          [
            { label: 'Randomize Questions', value: randomizeQuestions, set: setRandomizeQuestions },
            { label: 'Randomize Choices', value: randomizeChoices, set: setRandomizeChoices },
            { label: 'Detect Tab Switching', value: detectTabSwitch, set: setDetectTabSwitch },
            { label: 'Block Copy/Paste', value: blockCopyPaste, set: setBlockCopyPaste },
          ] as const
        ).map(({ label, value, set }) => (
          <div key={label} className="flex items-center justify-between">
            <Label className="text-xs font-mono">{label}</Label>
            <Switch checked={value} onCheckedChange={set} />
          </div>
        ))}
      </div>

      {/* Selection Mode */}
      <ModeSelector mode={mode} onChange={setMode} disabled={isEditing} />
      {isEditing && (
        <p className="text-[11px] text-muted-foreground font-mono -mt-2">
          Selection mode cannot be changed after creation.
        </p>
      )}

      {/* Mode-specific editors */}
      {mode === 'BLUEPRINT' && (
        <BlueprintEditor
          totalQuestions={bpTotalQuestions}
          domains={bpDomains}
          difficulty={bpDifficulty}
          certificationId={bpCertId}
          onTotalChange={setBpTotalQuestions}
          onDomainsChange={setBpDomains}
          onDifficultyChange={setBpDifficulty}
          onCertChange={setBpCertId}
          certifications={certifications}
        />
      )}

      {mode === 'POOL' && (
        <PoolEditor
          drawCount={poolDrawCount}
          difficulty={poolDifficulty}
          certificationId={poolCertId}
          categories={poolCategories}
          tags={poolTags}
          available={poolAvailable}
          onDrawCountChange={setPoolDrawCount}
          onDifficultyChange={setPoolDifficulty}
          onCertChange={setPoolCertId}
          onCategoriesChange={setPoolCategories}
          onTagsChange={setPoolTags}
          certifications={certifications}
        />
      )}

      {mode === 'MANUAL' && (
        <div className="space-y-3">
          <Label className="text-sm font-mono font-medium">
            Questions ({selectedQuestions.length} selected)
          </Label>

          {selectedQuestions.length > 0 && (
            <div className="space-y-2">
              {selectedQuestions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-center gap-2 p-2 rounded border border-border bg-muted/30"
                >
                  <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}</span>
                  <span className="text-xs font-mono flex-1 truncate">{q.title}</span>
                  <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveQuestion(i, -1)}
                    disabled={i === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveQuestion(i, 1)}
                    disabled={i === selectedQuestions.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeQuestion(q.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

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
                const alreadyAdded = selectedQuestions.some(
                  (s) => s.orgQuestionId === q.id,
                );
                return (
                  <div
                    key={q.id}
                    className={`flex items-center justify-between p-2 rounded text-xs font-mono ${
                      alreadyAdded
                        ? 'opacity-40'
                        : 'hover:bg-muted cursor-pointer'
                    }`}
                    onClick={() => !alreadyAdded && addQuestion(q)}
                  >
                    <span className="truncate flex-1">{q.title}</span>
                    {!alreadyAdded && (
                      <Plus className="h-3 w-3 text-primary shrink-0" />
                    )}
                  </div>
                );
              })}
              {orgQuestions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No approved questions found
                </p>
              )}
            </div>
          </div>

          <SmartFillDialog
            open={showSmartFill}
            onClose={() => setShowSmartFill(false)}
            onFill={handleSmartFill}
            slug={slug}
            existingIds={
              selectedQuestions
                .map((q) => q.orgQuestionId)
                .filter(Boolean) as string[]
            }
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          className="glow-cyan"
          disabled={!canSave || saveMutation.isPending}
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
