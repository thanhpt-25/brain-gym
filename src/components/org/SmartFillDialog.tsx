import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles } from 'lucide-react';
import { getCertifications } from '@/services/certifications';
import { getOrgQuestions } from '@/services/org-questions';

interface QuestionEntry {
  id: string;
  orgQuestionId?: string;
  publicQuestionId?: string;
  title: string;
  type: 'public' | 'org';
}

interface SmartFillDialogProps {
  open: boolean;
  onClose: () => void;
  onFill: (questions: QuestionEntry[]) => void;
  slug: string;
  existingIds: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SmartFillDialog = ({ open, onClose, onFill, slug, existingIds }: SmartFillDialogProps) => {
  const [certificationId, setCertificationId] = useState('any');
  const [category, setCategory] = useState('');
  const [easyCt, setEasyCt] = useState(0);
  const [mediumCt, setMediumCt] = useState(5);
  const [hardCt, setHardCt] = useState(0);
  const [filling, setFilling] = useState(false);

  const { data: certifications = [] } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  // Preview counts per difficulty (using a single query per active difficulty, but for preview we just show total available)
  const baseFilters = {
    status: 'APPROVED' as const,
    certificationId: certificationId !== 'any' ? certificationId : undefined,
    category: category.trim() || undefined,
    limit: 1,
  };

  const { data: easyPreview } = useQuery({
    queryKey: ['smart-fill-preview', slug, 'EASY', certificationId, category],
    queryFn: () => getOrgQuestions(slug, { ...baseFilters, difficulty: 'EASY' }),
    enabled: open && !!slug,
  });

  const { data: mediumPreview } = useQuery({
    queryKey: ['smart-fill-preview', slug, 'MEDIUM', certificationId, category],
    queryFn: () => getOrgQuestions(slug, { ...baseFilters, difficulty: 'MEDIUM' }),
    enabled: open && !!slug,
  });

  const { data: hardPreview } = useQuery({
    queryKey: ['smart-fill-preview', slug, 'HARD', certificationId, category],
    queryFn: () => getOrgQuestions(slug, { ...baseFilters, difficulty: 'HARD' }),
    enabled: open && !!slug,
  });

  const handleFill = async () => {
    setFilling(true);
    try {
      const picked: QuestionEntry[] = [];

      const fetchAndPick = async (difficulty: 'EASY' | 'MEDIUM' | 'HARD', count: number) => {
        if (count <= 0) return;
        const res = await getOrgQuestions(slug, {
          status: 'APPROVED',
          certificationId: certificationId !== 'any' ? certificationId : undefined,
          category: category.trim() || undefined,
          difficulty,
          limit: 200,
        });
        const available = res.data.filter((q) => !existingIds.includes(q.id));
        const shuffled = shuffle(available).slice(0, count);
        shuffled.forEach((q) => {
          picked.push({
            id: q.id,
            orgQuestionId: q.id,
            title: q.title,
            type: 'org',
          });
        });
      };

      await Promise.all([
        fetchAndPick('EASY', easyCt),
        fetchAndPick('MEDIUM', mediumCt),
        fetchAndPick('HARD', hardCt),
      ]);

      onFill(picked);
      onClose();
    } finally {
      setFilling(false);
    }
  };

  const totalRequested = easyCt + mediumCt + hardCt;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Smart Fill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs">Certification</Label>
            <Select value={certificationId} onValueChange={setCertificationId}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Any certification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Certification</SelectItem>
                {certifications.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-xs">Category (optional)</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Networking, Storage..."
              className="bg-secondary border-border text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-xs">Question Count by Difficulty</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-emerald-400 text-center">
                  Easy ({easyPreview?.meta?.total ?? '…'} avail)
                </div>
                <Input
                  type="number"
                  min={0}
                  value={easyCt}
                  onChange={(e) => setEasyCt(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-secondary border-border text-sm text-center"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-amber-400 text-center">
                  Medium ({mediumPreview?.meta?.total ?? '…'} avail)
                </div>
                <Input
                  type="number"
                  min={0}
                  value={mediumCt}
                  onChange={(e) => setMediumCt(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-secondary border-border text-sm text-center"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-red-400 text-center">
                  Hard ({hardPreview?.meta?.total ?? '…'} avail)
                </div>
                <Input
                  type="number"
                  min={0}
                  value={hardCt}
                  onChange={(e) => setHardCt(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-secondary border-border text-sm text-center"
                />
              </div>
            </div>
          </div>

          {totalRequested > 0 && (
            <p className="text-xs font-mono text-muted-foreground text-center">
              Will add up to {totalRequested} questions (excluding already selected)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="font-mono text-xs">Cancel</Button>
          <Button
            onClick={handleFill}
            disabled={filling || totalRequested === 0}
            className="glow-cyan font-mono text-xs"
          >
            {filling ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
            Fill {totalRequested > 0 ? totalRequested : ''} Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SmartFillDialog;
