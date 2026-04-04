import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import { getCatalogItems, getMyAssignments, startCatalogExam } from '@/services/exam-catalog';
import { getTracks } from '@/services/exam-catalog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen, Search, Clock, FileText, CheckCircle2, Loader2,
  Lock, AlertTriangle, GraduationCap, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ExamCatalogItem, MyAssignment } from '@/types/exam-catalog-types';
import type { StartAttemptResponse } from '@/services/attempts';

const timerLabel: Record<string, string> = {
  STRICT: 'Strict',
  ACCELERATED: 'Accelerated',
  RELAXED: 'Relaxed',
};

const OrgExamCatalog = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';

  const [search, setSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState('all');
  const [startingId, setStartingId] = useState<string | null>(null);

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['org-catalog', slug, { search, trackFilter }],
    queryFn: () => getCatalogItems(slug, { search: search || undefined, trackId: trackFilter !== 'all' ? trackFilter : undefined }),
    enabled: !!slug,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['my-assignments', slug],
    queryFn: () => getMyAssignments(slug),
    enabled: !!slug,
  });

  const { data: tracks = [] } = useQuery({
    queryKey: ['org-tracks', slug],
    queryFn: () => getTracks(slug),
    enabled: !!slug,
  });

  const startMutation = useMutation({
    mutationFn: (cid: string) => startCatalogExam(slug, cid),
    onSuccess: (attemptData: StartAttemptResponse, cid: string) => {
      queryClient.invalidateQueries({ queryKey: ['my-assignments', slug] });
      // Navigate to exam page, passing attemptData via location state
      navigate(`/exam/org-catalog`, { state: { attemptData } });
    },
    onError: (e: any) => {
      setStartingId(null);
      toast.error(e?.response?.data?.message || 'Failed to start exam');
    },
  });

  const handleStart = (cid: string) => {
    setStartingId(cid);
    startMutation.mutate(cid);
  };

  const items = catalogData?.data ?? [];

  // Build assignment map by catalogItemId
  const assignmentMap = assignments.reduce<Record<string, MyAssignment>>((acc, a) => {
    acc[a.catalogItemId] = a;
    return acc;
  }, {});

  // Pending assignments (assigned but not yet completed)
  const pendingAssignments = assignments.filter(
    (a) => a.attemptsCount === 0 || a.passed === false,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" /> Exam Catalog
        </h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Browse and take exams assigned by your organization
        </p>
      </div>

      {/* Pending assignments banner */}
      {pendingAssignments.length > 0 && (
        <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-sm mb-3">
            <AlertTriangle className="h-4 w-4" />
            {pendingAssignments.length} pending assignment{pendingAssignments.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingAssignments.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant="outline"
                className="border-amber-500/30 text-amber-400 text-xs font-mono"
                onClick={() => handleStart(a.catalogItemId)}
              >
                {a.catalogItem.title}
                {a.dueDate && (
                  <span className="ml-1 opacity-70">
                    · due {new Date(a.dueDate).toLocaleDateString()}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted border-border"
          />
        </div>
        {tracks.length > 0 && (
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="w-[180px] bg-muted border-border">
              <SelectValue placeholder="Filter by track" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tracks</SelectItem>
              {tracks.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Catalog Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">No exams available</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              assignment={assignmentMap[item.id]}
              isStarting={startingId === item.id}
              onStart={handleStart}
              onDetail={() => navigate(`/org/${slug}/catalog/${item.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface CatalogCardProps {
  item: ExamCatalogItem;
  assignment?: MyAssignment;
  isStarting: boolean;
  onStart: (cid: string) => void;
  onDetail: () => void;
}

const CatalogCard = ({ item, assignment, isStarting, onStart, onDetail }: CatalogCardProps) => {
  const passed = assignment?.passed;
  const attempts = assignment?.attemptsCount ?? 0;
  const bestScore = assignment?.bestScore;
  const canRetake = !item.maxAttempts || attempts < item.maxAttempts;
  const isLocked = !canRetake;

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors flex flex-col">
      <CardContent className="p-5 flex flex-col h-full">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {item.isMandatory && (
            <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">
              Mandatory
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">
            {item.type}
          </Badge>
          {item.certification && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {item.certification.code}
            </Badge>
          )}
          {passed === true && (
            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-0 ml-auto">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Passed
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-mono font-medium mb-2 flex-1">{item.title}</h3>
        {item.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono mb-4">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" /> {item.questionCount} Q
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {item.timeLimit} min
          </span>
          {item.passingScore && (
            <span>{item.passingScore}% to pass</span>
          )}
        </div>

        {/* Progress bar if attempted */}
        {attempts > 0 && bestScore != null && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
              <span>Best: {bestScore.toFixed(0)}%</span>
              <span>{attempts} attempt{attempts > 1 ? 's' : ''}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  passed ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(bestScore, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 font-mono text-xs text-muted-foreground"
            onClick={onDetail}
          >
            Details <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
          {isLocked ? (
            <Button size="sm" variant="outline" disabled className="flex-1 font-mono text-xs">
              <Lock className="h-3 w-3 mr-1" /> Max Attempts
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 glow-cyan font-mono text-xs"
              disabled={isStarting}
              onClick={() => onStart(item.id)}
            >
              {isStarting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              {attempts > 0 ? 'Retake' : 'Start'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrgExamCatalog;
