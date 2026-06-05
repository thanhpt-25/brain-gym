import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Download } from 'lucide-react';
import { toast } from 'sonner';

interface CandidateRow {
  email: string;
  name?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (candidates: { email: string; name?: string }[]) => void;
  isPending: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseCsv = (text: string): CandidateRow[] => {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return [];

  // Detect header
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('email') || firstLine.includes('name');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Handle quoted CSV
      const cols = line
        .split(',')
        .map((c) => c.trim().replace(/^"|"$/g, '').trim());

      const email = cols[0] ?? '';
      const name = cols[1] || undefined;

      if (!email) return { email, name, error: 'Empty email' };
      if (!EMAIL_RE.test(email)) return { email, name, error: 'Invalid email' };
      return { email, name };
    });
};

const EXAMPLE_CSV = `email,name
alice@example.com,Alice Nguyen
bob@example.com,Bob Tran
carol@example.com`;

const CsvImportModal = ({ open, onClose, onImport, isPending }: Props) => {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => !!r.error);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error('Please upload a .csv or .txt file');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCsv(text));
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDownloadExample = () => {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidates-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = () => {
    if (validRows.length === 0) {
      toast.error('No valid candidates to import');
      return;
    }
    onImport(validRows.map(({ email, name }) => ({ email, name })));
  };

  const handleClose = () => {
    setRows([]);
    setFileName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Import Candidates from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          {rows.length === 0 ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-mono text-muted-foreground">
                Drop your CSV here, or <span className="text-primary underline">browse</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Columns: <code className="bg-muted px-1 rounded">email</code>,{' '}
                <code className="bg-muted px-1 rounded">name</code> (optional)
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* File info */}
              <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 inline mr-1.5" />
                  {fileName}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => { setRows([]); setFileName(''); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Summary badges */}
              <div className="flex gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {validRows.length} valid
                </Badge>
                {errorRows.length > 0 && (
                  <Badge className="bg-red-500/15 text-red-400 text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {errorRows.length} error{errorRows.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {/* Preview table */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-[11px] font-mono">
                  <thead className="sticky top-0 bg-muted/50">
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-border/50 ${row.error ? 'bg-red-500/5' : ''}`}
                      >
                        <td className="p-2">{row.email || '—'}</td>
                        <td className="p-2 text-muted-foreground">{row.name || '—'}</td>
                        <td className="p-2">
                          {row.error ? (
                            <span className="text-red-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {row.error}
                            </span>
                          ) : (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Example download */}
          <button
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            onClick={handleDownloadExample}
          >
            <Download className="h-3 w-3" /> Download example CSV
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="glow-cyan"
            onClick={handleSubmit}
            disabled={isPending || validRows.length === 0}
          >
            {isPending ? 'Importing…' : `Import ${validRows.length} candidate${validRows.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CsvImportModal;
