import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Link, Type, Trash2, Loader2, Plus, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getMaterials, uploadTextMaterial, uploadPdfMaterial, deleteMaterial } from '@/services/ai-questions';
import { MaterialContentType } from '@/types/api-types';
import { toast } from 'sonner';

const TYPE_ICONS = {
  PDF: FileText,
  URL: Link,
  TEXT: Type,
};

interface Props {
  certificationId?: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export default function MaterialLibrary({ certificationId, selectedId, onSelect }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [contentType, setContentType] = useState<MaterialContentType>('TEXT');
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials', certificationId],
    queryFn: () => getMaterials(certificationId),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (contentType === 'PDF') {
        const file = fileRef.current?.files?.[0];
        if (!file) throw new Error('Select a PDF file');
        return uploadPdfMaterial(file, title, certificationId);
      }
      return uploadTextMaterial({ title, contentType, certificationId, textContent, sourceUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setAdding(false);
      setTitle(''); setTextContent(''); setSourceUrl('');
      toast.success('Material uploaded and chunked');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMaterial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] }),
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Source Materials</span>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        )}
      </div>

      {adding && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Material title" value={title} onChange={e => setTitle(e.target.value)} />
            <Select value={contentType} onValueChange={v => setContentType(v as MaterialContentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Plain Text</SelectItem>
                <SelectItem value="URL">Web URL</SelectItem>
                <SelectItem value="PDF">PDF File</SelectItem>
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
            {contentType === 'PDF' && (
              <input ref={fileRef} type="file" accept=".pdf" className="text-sm" />
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => uploadMutation.mutate()} disabled={!title || uploadMutation.isPending}>
                {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Upload & Chunk
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {materials.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-4">No materials yet. Add study notes, PDFs, or URLs.</p>
      )}

      {materials.map(m => {
        const Icon = TYPE_ICONS[m.contentType];
        const isSelected = m.id === selectedId;
        return (
          <Card
            key={m.id}
            className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
            onClick={() => onSelect?.(m.id)}
          >
            <CardContent className="py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m._count.chunks} chunks</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {m.status === 'ready'
                  ? <CheckCircle className="h-3 w-3 text-green-500" />
                  : <Clock className="h-3 w-3 text-yellow-500 animate-spin" />}
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
