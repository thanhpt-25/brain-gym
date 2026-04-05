import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onInvite: (candidates: { email: string; name?: string }[]) => void;
  isPending: boolean;
}

const InviteCandidatesModal = ({ open, onClose, onInvite, isPending }: Props) => {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    const lines = input
      .split(/[\n,;]/)
      .map((l) => l.trim())
      .filter(Boolean);

    const candidates = lines.map((line) => {
      // Support "Name <email>" or just "email"
      const match = line.match(/^(.+?)\s*<(.+?)>$/);
      if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
      }
      return { email: line };
    });

    if (candidates.length === 0) return;
    onInvite(candidates);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <UserPlus className="h-5 w-5 text-primary" /> Invite Candidates
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-mono">
              Email addresses (one per line, or comma-separated)
            </Label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={6}
              placeholder={`john@example.com\nJane Doe <jane@example.com>\ndev@company.com`}
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use "Name {'<email>'}" format to include names.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="glow-cyan"
            onClick={handleSubmit}
            disabled={!input.trim() || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-1.5" />
            )}
            Send Invites
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InviteCandidatesModal;
