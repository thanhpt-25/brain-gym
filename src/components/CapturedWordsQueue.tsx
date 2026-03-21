import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, Trash2, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPendingCaptures, updateCaptureStatus, createFlashcard, getDecks } from '@/services/flashcards';
import { toast } from 'sonner';

const CapturedWordsQueue = () => {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [definition, setDefinition] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState('');

  const { data: captures, isLoading } = useQuery({
    queryKey: ['pending-captures'],
    queryFn: getPendingCaptures,
  });

  const { data: decks } = useQuery({
    queryKey: ['decks'],
    queryFn: getDecks,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: 'processed' | 'discarded' }) => 
      updateCaptureStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-captures'] });
    },
  });

  const createCardMutation = useMutation({
    mutationFn: createFlashcard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] });
      toast.success('Flashcard created from capture');
      setProcessingId(null);
      setDefinition('');
    },
  });

  const handleProcess = async (id: string, word: string) => {
    if (!selectedDeckId) {
      toast.error('Please select a deck first');
      return;
    }
    if (!definition.trim()) {
      toast.error('Please enter a definition');
      return;
    }

    try {
      await createCardMutation.mutateAsync({
        deckId: selectedDeckId,
        front: word,
        back: definition,
        tags: ['captured'],
      });
      await statusMutation.mutateAsync({ id, status: 'processed' });
    } catch (err) {
      toast.error('Failed to process word');
    }
  };

  const handleDiscard = (id: string) => {
    if (confirm('Discard this captured word?')) {
      statusMutation.mutate({ id, status: 'discarded' });
    }
  };

  if (!captures?.length && !isLoading) return null;

  return (
    <div className="mb-10">
      <div 
        className="flex items-center justify-between mb-4 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-xl font-mono font-bold flex items-center gap-2">
          <BookmarkPlus className="h-5 w-5 text-accent" /> 
          Capture Queue 
          <Badge variant="secondary" className="ml-2 font-mono h-5 px-1.5">{captures?.length || 0}</Badge>
        </h2>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            captures?.map((cap) => (
              <Card key={cap.id} className="glass-card border-accent/20 overflow-hidden">
                <CardContent className="p-4">
                  {processingId === cap.id ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-mono font-bold text-accent">{cap.word}</span>
                        <Button variant="ghost" size="sm" onClick={() => setProcessingId(null)}>Cancel</Button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-mono text-muted-foreground uppercase">Target Deck</label>
                          <select 
                            className="bg-background/50 border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary"
                            value={selectedDeckId}
                            onChange={(e) => setSelectedDeckId(e.target.value)}
                          >
                            <option value="">Select a deck...</option>
                            {decks?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-mono text-muted-foreground uppercase">Definition / Flashcard Back</label>
                          <textarea 
                            className="bg-background/50 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary min-h-[80px]"
                            placeholder="Explain this concept..."
                            value={definition}
                            onChange={(e) => setDefinition(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button 
                          size="sm" 
                          className="glow-cyan font-mono text-xs"
                          onClick={() => handleProcess(cap.id, cap.word)}
                          disabled={createCardMutation.isPending}
                        >
                          {createCardMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                          Create Flashcard
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-foreground truncate">{cap.word}</span>
                          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">
                            {new Date(cap.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 italic">
                           "{cap.context}"
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 px-2 text-[10px] font-mono border-accent/30 text-accent hover:bg-accent/10"
                          onClick={() => {
                            setProcessingId(cap.id);
                            if (decks?.length && !selectedDeckId) setSelectedDeckId(decks[0].id);
                          }}
                        >
                          Process
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDiscard(cap.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CapturedWordsQueue;
