import { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Upload, Download, FileText } from 'lucide-react';
import Papa from 'papaparse';

interface Props {
  open: boolean;
  onClose: () => void;
  onInvite: (candidates: { email: string; name?: string }[]) => void;
  isPending: boolean;
}

const CSV_TEMPLATE = 'email,name\njohn@example.com,John Doe\njane@example.com,Jane Smith';

const InviteCandidatesModal = ({ open, onClose, onInvite, isPending }: Props) => {
  const [tab, setTab] = useState<'text' | 'csv'>('text');
  const [input, setInput] = useState('');
  const [csvRows, setCsvRows] = useState<{ email: string; name?: string }[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidates_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = (results.data as any[])
          .filter((r) => r.email?.trim())
          .map((r) => ({ email: r.email.trim(), name: r.name?.trim() || undefined }));
        setCsvRows(rows);
      },
    });
  };

  const handleSubmit = () => {
    if (tab === 'text') {
      const lines = input.split(/[\n,;]/).map((l) => l.trim()).filter(Boolean);
      const candidates = lines.map((line) => {
        const match = line.match(/^(.+?)\s*<(.+?)>$/);
        if (match) return { name: match[1].trim(), email: match[2].trim() };
        return { email: line };
      });
      if (candidates.length === 0) return;
      onInvite(candidates);
    } else {
      if (csvRows.length === 0) return;
      onInvite(csvRows);
    }
  };

  const canSubmit = tab === 'text' ? input.trim().length > 0 : csvRows.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <UserPlus className="h-5 w-5 text-primary" /> Invite Candidates
          </DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-muted p-0.5 gap-0.5">
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors ${
              tab === 'text' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab('text')}
          >
            Text Input
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors ${
              tab === 'csv' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab('csv')}
          >
            CSV Upload
          </button>
        </div>

        {tab === 'text' ? (
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
                Use "Name &lt;email&gt;" format to include names.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Template download */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Need a template?
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Template
              </Button>
            </div>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (!file) return;
                setCsvFileName(file.name);
                Papa.parse(file, {
                  header: true,
                  skipEmptyLines: true,
                  complete: (results) => {
                    const rows = (results.data as any[])
                      .filter((r) => r.email?.trim())
                      .map((r) => ({ email: r.email.trim(), name: r.name?.trim() || undefined }));
                    setCsvRows(rows);
                  },
                });
              }}
            >
              <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
              {csvFileName ? (
                <p className="text-sm font-mono text-primary">{csvFileName}</p>
              ) : (
                <p className="text-xs text-muted-foreground font-mono">Drop CSV or click to browse</p>
              )}
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Preview */}
            {csvRows.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-mono text-muted-foreground">{csvRows.length} candidate{csvRows.length !== 1 ? 's' : ''} found</p>
                <div className="max-h-36 overflow-y-auto rounded border border-border">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-muted-foreground font-medium">Email</th>
                        <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="p-2 truncate max-w-[180px]">{r.email}</td>
                          <td className="p-2 text-muted-foreground">{r.name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="glow-cyan"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-1.5" />
            )}
            Send Invites{tab === 'csv' && csvRows.length > 0 ? ` (${csvRows.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InviteCandidatesModal;
