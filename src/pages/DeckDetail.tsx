import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Play, MoreVertical, Trash2, Edit2, Loader2, Star, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import Breadcrumb from '@/components/Breadcrumb';
import { getDeck, createFlashcard, deleteFlashcard, toggleStarFlashcard } from '@/services/flashcards';
import { toast } from 'sonner';

const DeckDetail = () => {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  const { data: deck, isLoading } = useQuery({
    queryKey: ['deck', deckId],
    queryFn: () => getDeck(deckId!),
    enabled: !!deckId,
  });

  const createCardMutation = useMutation({
    mutationFn: createFlashcard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] });
      setFront('');
      setBack('');
      // Don't close setIsAdding so user can quickly add multiple cards
      toast.success('Card added');
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: deleteFlashcard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] });
      toast.success('Card deleted');
    },
  });

  const toggleStarMutation = useMutation({
    mutationFn: toggleStarFlashcard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deck', deckId] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    createCardMutation.mutate({ deckId: deckId!, front, back });
  };

  const handleStudy = () => {
    if (!deck?.flashcards?.length) {
      toast.error('Deck is empty!');
      return;
    }
    navigate(`/decks/${deckId}/study`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <h2 className="text-xl mb-4">Deck not found</h2>
        <Button onClick={() => navigate('/decks')}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid pb-20 md:pb-0">
      <Navbar title="Flashcards" icon={Layers} />
      <div className="container max-w-4xl pt-24 px-4">
        <Breadcrumb items={[
          { label: 'Home', href: '/' },
          { label: 'Flashcards', href: '/decks' },
          { label: deck.name }
        ]} />

        <div className="flex items-center gap-2 mt-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/decks')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 bg-secondary/30 border border-border/50 p-6 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3" />
          <div className="relative z-10">
            <h1 className="text-3xl font-mono font-bold text-foreground mb-2">{deck.name}</h1>
            {deck.description && <p className="text-muted-foreground text-sm max-w-md mb-4">{deck.description}</p>}
            <p className="text-xs font-mono text-muted-foreground">
              {deck.flashcards?.length || 0} cards total
            </p>
          </div>
          <div className="flex gap-2 relative z-10">
            <Button variant="outline" onClick={() => setIsAdding(!isAdding)}>
              <Plus className="h-4 w-4 mr-2" /> Add Card
            </Button>
            <Button className="glow-cyan" onClick={handleStudy} disabled={!deck.flashcards?.length}>
              <Play className="h-4 w-4 mr-2" /> Study Now
            </Button>
          </div>
        </div>

        {isAdding && (
          <Card className="glass-card mb-8 border-primary/30">
            <CardContent className="p-6">
              <h3 className="font-mono font-bold mb-4">Add new flashcard</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Front (Term / Question)</label>
                    <textarea
                      required
                      value={front}
                      onChange={(e) => setFront(e.target.value)}
                      className="w-full h-32 bg-background/50 border border-border rounded-md p-3 text-sm focus:outline-none focus:border-primary resize-none"
                      placeholder="e.g. EC2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Back (Definition / Answer)</label>
                    <textarea
                      required
                      value={back}
                      onChange={(e) => setBack(e.target.value)}
                      className="w-full h-32 bg-background/50 border border-border rounded-md p-3 text-sm focus:outline-none focus:border-primary resize-none"
                      placeholder="e.g. Elastic Compute Cloud - Virtual servers in the cloud"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setIsAdding(false); setFront(''); setBack(''); }}>Close</Button>
                  <Button type="submit" disabled={createCardMutation.isPending || !front.trim() || !back.trim()}>
                    {createCardMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h3 className="font-mono font-bold text-lg">Cards</h3>
          {!deck.flashcards?.length ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No cards established yet.</p>
              <Button variant="link" onClick={() => setIsAdding(true)}>Add your first card</Button>
            </div>
          ) : (
            deck.flashcards.map((card) => (
              <Card key={card.id} className="glass-card">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">
                    <div className="p-4 md:w-1/2 flex items-start justify-between">
                      <div className="text-sm font-medium whitespace-pre-wrap">{card.front}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ml-2 shrink-0 ${card.isStarred ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
                        onClick={() => toggleStarMutation.mutate(card.id)}
                      >
                        <Star className={`h-4 w-4 ${card.isStarred ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                    <div className="p-4 md:w-1/2 flex items-start justify-between bg-muted/20">
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{card.back}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 ml-2"
                        onClick={() => {
                          if (confirm('Delete this card?')) deleteCardMutation.mutate(card.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DeckDetail;
