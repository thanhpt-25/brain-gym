import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { HistoryItem } from '@/types/api-types';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getAnalyticsHistory } from '@/services/analytics';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface ExamHistoryListProps {
  certificationId?: string;
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function ExamHistoryList({ certificationId }: ExamHistoryListProps) {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['analytics-history', certificationId],
    queryFn: ({ pageParam = 1 }) => getAnalyticsHistory(certificationId, pageParam, 12),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.lastPage) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
  });

  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  });

  const history = data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Chưa có lịch sử thi.</p>
      ) : (
        <>
          {history.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
            >
              <HistoryCard item={h} />
            </motion.div>
          ))}
          
          <div ref={sentinelRef} className="py-4 flex justify-center">
             {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
             {!hasNextPage && history.length > 5 && (
                 <p className="text-[10px] text-muted-foreground font-mono opacity-50 uppercase tracking-wider">End of history</p>
             )}
          </div>
        </>
      )}
    </div>
  );
}

function HistoryCard({ item }: { item: HistoryItem }) {
  return (
    <Card className="glass-card hover:border-primary/30 transition-colors">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-semibold text-sm">{item.certification.code}</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>{new Date(item.submittedAt).toLocaleDateString('vi-VN')}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatTime(item.timeSpent)}
            </span>
          </div>
        </div>
        <div className="text-right flex items-center gap-3">
          <div>
            <div className={`text-lg font-bold font-mono ${item.passed ? 'text-accent' : 'text-destructive'}`}>
              {item.score}%
            </div>
            <div className="text-[10px] text-muted-foreground">{item.totalCorrect}/{item.totalQuestions}</div>
          </div>
          {item.passed ? (
            <CheckCircle2 className="h-5 w-5 text-accent" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

