import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Link, Type, Trash2, Loader2, Upload, Plus, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getMaterials, uploadTextMaterial, uploadFileMaterial, deleteMaterial } from '@/services/ai-questions';
import { MaterialContentType } from '@/types/api-types';
import { toast } from 'sonner';

const TYPE_ICONS: Record<string, typeof FileText> = {
  PDF: FileText,
  DOCX: FileText,
  PPTX: FileText,
  XLSX: FileText,
  URL: Link,
  TEXT: Type,
};

const FILE_TYPES: MaterialContentType[] = ['PDF', 'DOCX', 'PPTX', 'XLSX'];

function getAcceptedExtensions(contentType: MaterialContentType): string {
  const map: Record<string, string> = {
    PDF: '.pdf',
    DOCX: '.docx',
    PPTX: '.pptx',
    XLSX: '.xlsx',
  };
  return map[contentType] ?? '';
}

interface Props {
  certificationId?: string;
  selectedId?: string;
  onSelect?: (id: string | undefined) => void;
  onSelectedProcessing?: (isProcessing: boolean) => void;
}

export default function MaterialLibrary({ certificationId, selectedId, onSelect, onSelectedProcessing }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  // 'file' mode pre-selects PDF and opens the form immediately with the file input visible.
  const [addMode, setAddMode] = useState<'file' | 'text'>('text');
  const [contentType, setContentType] = useState<MaterialContentType>('TEXT');
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // Fetch ALL user materials regardless of selected cert — filtering by cert
  // caused materials to vanish whenever the cert dropdown changed, which was
  // confusing. certificationId is still passed at upload time for association,
  // but the list is never filtered by it. A cert badge on each card shows which
  // cert the material is tagged to.
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => getMaterials(undefined),
    // Poll every 4s when any material is still processing
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return list.some((m: any) => m.status === 'processing') ? 4000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (FILE_TYPES.includes(contentType)) {
        const file = fileRef.current?.files?.[0];
        if (!file) throw new Error('Select a file');
        return uploadFileMaterial(file, title, contentType as any, certificationId);
      }
      return uploadTextMaterial({ title, contentType, certificationId, textContent, sourceUrl });
    },
    onSuccess: (material) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setAdding(false);
      setAddMode('text');
      setTitle(''); setTextContent(''); setSourceUrl('');
      if (material.status === 'processing') {
        toast.info('File uploaded — converting to markdown in background…');
      } else {
        toast.success('Material uploaded and chunked');
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMaterial,
    // Fix #7: Clear selection only after delete succeeds, so a failed delete
    // doesn't leave the UI in a desynced state.
    onSuccess: (_data, deletedId) => {
      if (deletedId === selectedId) onSelect?.(undefined);
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });

  // Fix #6: Notify parent of processing state changes, including when selectedId
  // becomes undefined (selection cleared while material was still processing).
  useEffect(() => {
    if (!onSelectedProcessing) return;
    if (!selectedId) {
      onSelectedProcessing(false);
      return;
    }
    const selected = materials.find((m: any) => m.id === selectedId);
    onSelectedProcessing(selected?.status === 'processing');
  }, [materials, selectedId, onSelectedProcessing]);

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Source Materials</span>
        {!adding && (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={() => {
                setAddMode('file');
                setContentType('PDF');
                setAdding(true);
              }}
            >
              <Upload className="h-3 w-3 mr-1" /> Upload File
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAddMode('text');
                setContentType('TEXT');
                setAdding(true);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Text / URL
            </Button>
          </div>
        )}
      </div>

      {adding && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Material title" value={title} onChange={e => setTitle(e.target.value)} />

            {/* File upload mode: show file-type selector + file picker immediately */}
            {addMode === 'file' && (
              <>
                <Select value={contentType} onValueChange={v => { setContentType(v as MaterialContentType); if (fileRef.current) fileRef.current.value = ''; }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF (.pdf)</SelectItem>
                    <SelectItem value="DOCX">Word Document (.docx)</SelectItem>
                    <SelectItem value="PPTX">PowerPoint (.pptx)</SelectItem>
                    <SelectItem value="XLSX">Excel (.xlsx)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-1">
                  <input ref={fileRef} type="file" accept={getAcceptedExtensions(contentType)} className="text-sm w-full" />
                  <p className="text-xs text-muted-foreground">File will be converted to Markdown automatically (may take up to 30 s for large files)</p>
                </div>
              </>
            )}

            {/* Text / URL mode: show type selector + relevant input */}
            {addMode === 'text' && (
              <>
                <Select value={contentType} onValueChange={v => setContentType(v as MaterialContentType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Plain Text</SelectItem>
                    <SelectItem value="URL">Web URL</SelectItem>
                  </SelectContent>
                </Select>
                {contentType === 'TEXT' && (
                  <Textarea
                    placeholder="Paste your study notes here (max 100,000 chars)"
                    className="min-h-[120px] text-xs"
                    value={textContent}
                    maxLength={100000}
                    onChange={e => setTextContent(e.target.value)}
                  />
                )}
                {contentType === 'URL' && (
                  <Input placeholder="https://docs.aws.amazon.com/..." value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
                )}
              </>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={() => uploadMutation.mutate()} disabled={!title || uploadMutation.isPending}>
                {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {addMode === 'file' ? 'Upload' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setAddMode('text'); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {materials.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No materials yet. Click <strong>Upload File</strong> to add a PDF, Word doc, PowerPoint, or Excel sheet, or <strong>Text / URL</strong> for pasted notes and links.
        </p>
      )}

      {materials.map((m: any) => {
        const Icon = TYPE_ICONS[m.contentType] ?? FileText;
        const isSelected = m.id === selectedId;
        const isProcessing = m.status === 'processing';
        const isFailed = m.status === 'failed';
        // Cert mismatch: material was tagged to a different cert than currently selected.
        // We still allow selection (material context is still useful) but show a hint.
        const certMismatch = certificationId && m.certificationId && m.certificationId !== certificationId;
        return (
          <Card
            key={m.id}
            className={`transition-colors ${isProcessing || isFailed ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
            onClick={() => !isProcessing && !isFailed && onSelect?.(isSelected ? undefined : m.id)}
          >
            <CardContent className="py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {isProcessing ? 'Converting…' : isFailed ? 'Conversion failed' : `${m._count.chunks} chunks`}
                    {certMismatch && <span className="ml-1 text-yellow-600" title={`Tagged to ${m.certification?.code ?? 'another cert'}`}>· {m.certification?.code ?? 'other cert'}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isProcessing && <Loader2 className="h-3 w-3 text-yellow-500 animate-spin" />}
                {isFailed && <AlertCircle className="h-3 w-3 text-destructive" />}
                {!isProcessing && !isFailed && <CheckCircle className="h-3 w-3 text-green-500" />}
                <Badge variant="outline" className="text-xs">{m.contentType}</Badge>
                <Button
                  size="sm" variant="ghost"
                  className="text-destructive hover:text-destructive h-6 w-6 p-0"
                  onClick={e => { e.stopPropagation(); deleteMutation.mutate(m.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
