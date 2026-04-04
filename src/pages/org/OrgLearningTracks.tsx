import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import {
  getTracks, createTrack, updateTrack, deleteTrack,
} from '@/services/exam-catalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  BookMarked, Plus, MoreHorizontal, Pencil, Trash2,
  Loader2, FileText, Clock, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LearningTrack } from '@/types/exam-catalog-types';

const OrgLearningTracks = () => {
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<LearningTrack | null>(null);

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ['org-tracks', slug],
    queryFn: () => getTracks(slug),
    enabled: !!slug,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['org-tracks', slug] });

  const deleteMutation = useMutation({
    mutationFn: (tid: string) => deleteTrack(slug, tid),
    onSuccess: () => { toast.success('Track deleted'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  const openCreate = () => { setEditingTrack(null); setDialogOpen(true); };
  const openEdit = (track: LearningTrack) => { setEditingTrack(track); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
            <BookMarked className="h-6 w-6 text-primary" /> Learning Tracks
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            Organize exams into structured learning paths
          </p>
        </div>
        <Button size="sm" className="glow-cyan" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New Track
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-16">
          <BookMarked className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">No learning tracks yet</p>
          <Button className="mt-4 glow-cyan" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Create first track
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onEdit={() => openEdit(track)}
              onDelete={() => {
                if (window.confirm(`Delete track "${track.name}"? Catalog items will be unassigned from this track.`)) {
                  deleteMutation.mutate(track.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      {dialogOpen && (
        <TrackFormDialog
          slug={slug}
          track={editingTrack}
          onClose={() => {
            setDialogOpen(false);
            setEditingTrack(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
};

// ─── Track Card ───────────────────────────────────────────────────────────────

interface TrackCardProps {
  track: LearningTrack;
  onEdit: () => void;
  onDelete: () => void;
}

const TrackCard = ({ track, onEdit, onDelete }: TrackCardProps) => {
  const itemCount = track._count?.catalogItems ?? track.catalogItems?.length ?? 0;

  return (
    <Card className={`bg-card border-border transition-colors ${
      track.isActive ? 'hover:border-primary/30' : 'opacity-60'
    }`}>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-mono font-medium flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{track.name}</span>
          </CardTitle>
          {!track.isActive && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground mt-1">
              Inactive
            </Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            <DropdownMenuItem className="font-mono text-xs" onClick={onEdit}>
              <Pencil className="h-3 w-3 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="font-mono text-xs text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="pt-0">
        {track.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{track.description}</p>
        )}

        {/* Exam count */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono mb-3">
          <FileText className="h-3 w-3" />
          <span>{itemCount} exam{itemCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Catalog items preview */}
        {track.catalogItems && track.catalogItems.length > 0 && (
          <div className="space-y-1.5">
            {track.catalogItems.slice(0, 4).map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground"
              >
                <span className="text-primary/50 shrink-0">{idx + 1}.</span>
                <span className="truncate flex-1">{item.title}</span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <Clock className="h-2.5 w-2.5" /> {item.timeLimit}m
                </span>
                {item.isMandatory && (
                  <AlertCircle className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                )}
              </div>
            ))}
            {track.catalogItems.length > 4 && (
              <p className="text-[10px] text-muted-foreground font-mono pl-4">
                +{track.catalogItems.length - 4} more
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Track Form Dialog ────────────────────────────────────────────────────────

interface TrackFormDialogProps {
  slug: string;
  track: LearningTrack | null;
  onClose: () => void;
}

const TrackFormDialog = ({ slug, track, onClose }: TrackFormDialogProps) => {
  const isEdit = !!track;
  const [name, setName] = useState(track?.name ?? '');
  const [description, setDescription] = useState(track?.description ?? '');
  const [isActive, setIsActive] = useState(track?.isActive ?? true);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), description: description.trim() || undefined, isActive };
      return isEdit
        ? updateTrack(slug, track!.id, payload)
        : createTrack(slug, payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Track updated' : 'Track created');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Save failed'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {isEdit ? 'Edit Track' : 'New Learning Track'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AWS Fundamentals"
              className="bg-muted border-border text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-mono">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="bg-muted border-border text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs font-mono">Active</Label>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="font-mono text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            className="glow-cyan font-mono text-xs"
            disabled={!name.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
            {isEdit ? 'Save Changes' : 'Create Track'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrgLearningTracks;
