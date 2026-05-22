import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  MessageSquare,
  Target,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { getCoachSessionAnalysis } from '@/services/api';
import { format } from 'date-fns';

interface SessionReplayModalProps {
  sessionId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionReplayModal({
  sessionId,
  isOpen,
  onOpenChange,
}: SessionReplayModalProps) {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ['coach-session-analysis', sessionId],
    queryFn: () => getCoachSessionAnalysis(sessionId),
    enabled: isOpen && !!sessionId,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-mono">
            Coach Session Replay
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-muted-foreground">Loading analysis...</div>
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Session Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                      Messages
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono">
                    {analysis.messageCount}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-accent" />
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                      Duration
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono">
                    {analysis.durationMinutes}m
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                      Sentiment
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-green-500">
                    {analysis.userSentimentScore}%
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                      Cost
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono">
                    ${analysis.costUsd.toFixed(3)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Topics Discussed */}
            {analysis.topicsDiscussed && analysis.topicsDiscussed.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-mono font-semibold text-muted-foreground">
                  Topics Discussed
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.topicsDiscussed.map((topic: string) => (
                    <Badge key={topic} variant="secondary" className="font-mono">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Effectiveness Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-mono font-semibold text-muted-foreground">
                  Session Effectiveness
                </div>
                <div className="text-lg font-bold font-mono">
                  {analysis.effectivenessScore}%
                </div>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                  style={{
                    width: `${Math.min(analysis.effectivenessScore, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Session Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-mono">
                  {format(
                    new Date(analysis.createdAt),
                    'MMM dd, yyyy HH:mm:ss'
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">User Messages</span>
                <span className="font-mono">{analysis.userMessagesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coach Responses</span>
                <span className="font-mono">
                  {analysis.assistantMessagesCount}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            No analysis available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
