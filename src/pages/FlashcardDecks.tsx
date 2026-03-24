import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, ChevronRight, BookOpen, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import { getDecks, createDeck, deleteDeck } from '@/services/flashcards';
import { toast } from 'sonner';
import CapturedWordsQueue from '@/components/CapturedWordsQueue';

const FlashcardDecks = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');

  const { data: decks, isLoading } = useQuery({
    queryKey: ['decks'],
    queryFn: getDecks,
  });

  const createMutation = useMutation({
    mutationFn: createDeck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] });
      setIsCreating(false);
      setNewDeckName('');
      setNewDeckDesc('');
      toast.success('Deck created successfully');
    },
    onError: () => {
      toast.error('Failed to create deck');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeck,
    onMutate: async (deckId) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['decks'] });

      // Snapshot the previous value
      const previousDecks = queryClient.getQueryData<any[]>(['decks']);

      // Optimistically update to the new value
      if (previousDecks) {
        queryClient.setQueryData(['decks'], 
          previousDecks.filter(d => d.id !== deckId)
        );
      }

      return { previousDecks };
    },
    onError: (err, deckId, context: any) => {
      // Rollback to previous value if mutation fails
      if (context?.previousDecks) {
        queryClient.setQueryData(['decks'], context.previousDecks);
      }
      toast.error('Failed to delete deck');
    },
    onSuccess: () => {
      toast.success('Deck deleted');
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're in sync with the server
      queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    createMutation.mutate({ name: newDeckName, description: newDeckDesc });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this deck? All flashcards inside will be lost.')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid pb-20 md:pb-0">
      <Navbar title="Flashcards" icon={Layers} />
      <div className="container max-w-4xl pt-24 px-4">
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Flashcards' }]} />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-mono font-bold text-foreground mb-2 flex items-center gap-2">
              <Layers className="h-8 w-8 text-primary" /> Flashcards
            </h1>
            <p className="text-muted-foreground text-sm">
              Create and manage your personal flashcard collections for spaced repetition study.
            </p>
          </div>
          <Button className="glow-cyan font-mono" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="h-4 w-4 mr-2" /> New Deck
          </Button>
        </div>

        <CapturedWordsQueue />


        {isCreating && (
          <Card className="glass-card mb-8">
            <CardContent className="p-6">
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">Deck Name <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    required
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    placeholder="e.g. AWS Key Terms"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">Description (Optional)</label>
                  <input
                    type="text"
                    value={newDeckDesc}
                    onChange={(e) => setNewDeckDesc(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || !newDeckName.trim()}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !decks?.length ? (
          <div className="text-center py-20 glass-card rounded-xl">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-mono font-bold mb-2">You don't have any decks</h3>
            <p className="text-sm text-muted-foreground mb-6">Create your first deck to start adding flashcards.</p>
            <Button variant="outline" className="font-mono" onClick={() => setIsCreating(true)}>
              Create Deck
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map((deck) => (
              <Card
                key={deck.id}
                className="glass-card cursor-pointer hover:border-primary/40 transition-colors group relative overflow-hidden"
                onClick={() => navigate(`/decks/${deck.id}`)}
              >
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                      onClick={(e) => handleDelete(e, deck.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-mono font-bold text-lg mb-1 line-clamp-1">{deck.name}</h3>
                  {deck.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{deck.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50">
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                      {deck._count?.flashcards || 0} cards
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlashcardDecks;
