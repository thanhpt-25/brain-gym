import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import {
  getCatalogItemsManage, deleteCatalogItem, updateCatalogItem,
  assignExam, getTracks,
} from '@/services/exam-catalog';
import { getGroups, getMembers } from '@/services/organizations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Users,
  ToggleLeft, ToggleRight, Loader2, GraduationCap, Clock,
  FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ExamCatalogItem } from '@/types/exam-catalog-types';

const OrgCatalogManage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [assignItem, setAssignItem] = useState<ExamCatalogItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['org-catalog-manage', slug, { search, page }],
    queryFn: () => getCatalogItemsManage(slug, { search: search || undefined, page, limit: 20 }),
    enabled: !!slug,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['org-groups', slug],
    queryFn: () => getGroups(slug),
    enabled: !!slug,
  });

  const { data: membersData } = useQuery({
    queryKey: ['org-members', slug],
    queryFn: () => getMembers(slug),
    enabled: !!slug,
  });

  const deleteMutation = useMutation({
    mutationFn: (cid: string) => deleteCatalogItem(slug, cid),
    onSuccess: () => {
      toast.success('Catalog item deleted');
      queryClient.invalidateQueries({ queryKey: ['org-catalog-manage', slug] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ cid, isActive }: { cid: string; isActive: boolean }) =>
      updateCatalogItem(slug, cid, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-catalog-manage', slug] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> Manage Catalog
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            {meta?.total ?? 0} items
          </p>
        </div>
        <Button
          size="sm"
          className="glow-cyan"
          onClick={() => navigate(`/org/${slug}/catalog/create`)}
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Exam
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search exams..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-10 bg-muted border-border"
        />
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">No exams yet</p>
          <Button className="mt-4 glow-cyan" onClick={() => navigate(`/org/${slug}/catalog/create`)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create first exam
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`bg-card border-border transition-colors ${
                item.isActive ? 'hover:border-primary/30' : 'opacity-60'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-mono font-medium truncate">{item.title}</span>
                      {!item.isActive && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                      {item.certification && (
                        <span>{item.certification.code}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {item.questionCount} Q
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {item.timeLimit} min
                      </span>
                      {item.isMandatory && (
                        <span className="text-amber-400">Mandatory</span>
                      )}
                      {item.track && (
                        <span className="text-primary/70">📂 {item.track.name}</span>
                      )}
                      <span>{item._count?.assignments ?? 0} assignments</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem
                        className="font-mono text-xs"
                        onClick={() => navigate(`/org/${slug}/catalog/${item.id}/edit`)}
                      >
                        <Pencil className="h-3 w-3 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="font-mono text-xs"
                        onClick={() => setAssignItem(item)}
                      >
                        <Users className="h-3 w-3 mr-2" /> Assign
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="font-mono text-xs"
                        onClick={() => toggleMutation.mutate({ cid: item.id, isActive: !item.isActive })}
                      >
                        {item.isActive ? (
                          <><ToggleLeft className="h-3 w-3 mr-2" /> Deactivate</>
                        ) : (
                          <><ToggleRight className="h-3 w-3 mr-2" /> Activate</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="font-mono text-xs text-destructive"
                        onClick={() => {
                          if (window.confirm('Delete this catalog item?')) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground">{page} / {meta.lastPage}</span>
          <Button
            variant="outline" size="sm"
            disabled={page >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Assign Dialog */}
      {assignItem && (
        <AssignDialog
          slug={slug}
          item={assignItem}
          groups={groups}
          members={membersData?.data ?? []}
          onClose={() => {
            setAssignItem(null);
            queryClient.invalidateQueries({ queryKey: ['org-catalog-manage', slug] });
          }}
        />
      )}
    </div>
  );
};

// ─── Assign Dialog ────────────────────────────────────────────────────────────

interface AssignDialogProps {
  slug: string;
  item: ExamCatalogItem;
  groups: any[];
  members: any[];
  onClose: () => void;
}

const AssignDialog = ({ slug, item, groups, members, onClose }: AssignDialogProps) => {
  const [assignType, setAssignType] = useState<'group' | 'member'>('group');
  const [targetId, setTargetId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const assignMutation = useMutation({
    mutationFn: () =>
      assignExam(slug, item.id, {
        groupId: assignType === 'group' ? targetId || undefined : undefined,
        memberId: assignType === 'member' ? targetId || undefined : undefined,
        dueDate: dueDate || undefined,
      }),
    onSuccess: () => {
      toast.success('Exam assigned successfully');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Assignment failed'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">Assign: {item.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={assignType === 'group' ? 'default' : 'outline'}
              onClick={() => setAssignType('group')}
              className="flex-1 font-mono text-xs"
            >
              Group
            </Button>
            <Button
              size="sm"
              variant={assignType === 'member' ? 'default' : 'outline'}
              onClick={() => setAssignType('member')}
              className="flex-1 font-mono text-xs"
            >
              Member
            </Button>
          </div>

          {assignType === 'group' ? (
            <div className="space-y-1">
              <Label className="text-xs font-mono">Group</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs font-mono">Member</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.user?.displayName ?? m.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-mono">Due Date (optional)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-muted border-border text-sm"
            />
          </div>

          <Button
            className="w-full glow-cyan font-mono"
            disabled={!targetId || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            {assignMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Assign Exam
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrgCatalogManage;
