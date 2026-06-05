import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import {
  getJobRoles, createJobRole, updateJobRole, deleteJobRole,
} from '@/services/job-roles';
import type { JobRole } from '@/types/assessment-types';
import type { CreateJobRolePayload, UpdateJobRolePayload } from '@/services/job-roles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Briefcase, Plus, MoreVertical, Pencil, Trash2,
  Loader2, Building2, ClipboardList, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Job Role Form Modal ──────────────────────────────────────────────────────

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: JobRole | null;
  onSave: (data: CreateJobRolePayload | UpdateJobRolePayload) => void;
  isPending: boolean;
}

const JobRoleFormModal = ({
  open,
  onClose,
  initial,
  onSave,
  isPending,
}: FormModalProps) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  // Reset when opened with new initial value
  const handleOpen = () => {
    setTitle(initial?.title ?? '');
    setDepartment(initial?.department ?? '');
    setDescription(initial?.description ?? '');
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      department: department.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            {initial ? 'Edit Job Role' : 'New Job Role'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Title *
            </label>
            <Input
              className="mt-1 font-mono text-sm bg-muted/30 border-border"
              placeholder="e.g. Senior Backend Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Department
            </label>
            <Input
              className="mt-1 font-mono text-sm bg-muted/30 border-border"
              placeholder="e.g. Engineering"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Description
            </label>
            <Textarea
              className="mt-1 font-mono text-xs bg-muted/30 border-border resize-none min-h-[80px]"
              placeholder="Optional role description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="glow-cyan"
            onClick={handleSubmit}
            disabled={isPending || !title.trim()}
          >
            {isPending ? 'Saving…' : initial ? 'Save changes' : 'Create role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const OrgJobRoles = () => {
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<JobRole | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['job-roles', slug],
    queryFn: () => getJobRoles(slug),
    enabled: !!slug,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateJobRolePayload) => createJobRole(slug, data),
    onSuccess: () => {
      toast.success('Job role created');
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['job-roles', slug] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Create failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateJobRolePayload }) =>
      updateJobRole(slug, id, data),
    onSuccess: () => {
      toast.success('Updated');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['job-roles', slug] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJobRole(slug, id),
    onSuccess: () => {
      toast.success('Deleted');
      queryClient.invalidateQueries({ queryKey: ['job-roles', slug] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  const toggleActive = (role: JobRole) => {
    updateMutation.mutate({ id: role.id, data: { isActive: !role.isActive } });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Job Roles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage open positions and link them to assessments
          </p>
        </div>
        <Button className="glow-cyan" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Role
        </Button>
      </div>

      {/* Empty state */}
      {roles.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground font-mono text-sm">No job roles yet</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create first role
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card
              key={role.id}
              className={`bg-card border-border transition-opacity ${
                role.isActive ? '' : 'opacity-50'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-mono font-semibold text-sm truncate">
                      {role.title}
                    </h3>
                    {role.department && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {role.department}
                      </p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs font-mono w-40">
                      <DropdownMenuItem onClick={() => setEditTarget(role)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(role)}>
                        {role.isActive ? (
                          <>
                            <ToggleLeft className="h-3.5 w-3.5 mr-2" /> Deactivate
                          </>
                        ) : (
                          <>
                            <ToggleRight className="h-3.5 w-3.5 mr-2" /> Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={() => {
                          if (confirm(`Delete "${role.title}"? This cannot be undone.`)) {
                            deleteMutation.mutate(role.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {role.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {role.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <Badge
                    className={
                      role.isActive
                        ? 'bg-emerald-500/15 text-emerald-400 text-[10px]'
                        : 'bg-zinc-500/15 text-zinc-400 text-[10px]'
                    }
                  >
                    {role.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {role._count?.assessments != null && role._count.assessments > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <ClipboardList className="h-3 w-3" />
                      {role._count.assessments} assessment{role._count.assessments !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create modal */}
      <JobRoleFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={(data) => createMutation.mutate(data as CreateJobRolePayload)}
        isPending={createMutation.isPending}
      />

      {/* Edit modal */}
      <JobRoleFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        initial={editTarget}
        onSave={(data) =>
          editTarget && updateMutation.mutate({ id: editTarget.id, data })
        }
        isPending={updateMutation.isPending}
      />
    </div>
  );
};

export default OrgJobRoles;
