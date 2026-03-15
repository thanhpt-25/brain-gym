import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Brain, ArrowLeft, Trophy, Medal, Flame, Crown, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Navbar from '@/components/Navbar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getCertifications } from '@/services/certifications';
import { getLeaderboard, LeaderboardEntry } from '@/services/gamification';

const rankColors: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
};

const rankBg: Record<number, string> = {
  1: 'bg-yellow-400/10 border-yellow-400/30',
  2: 'bg-gray-300/10 border-gray-300/20',
  3: 'bg-amber-600/10 border-amber-600/20',
};

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const [certFilter, setCertFilter] = useState<string>('');

  const { data: certifications } = useQuery({
    queryKey: ['certifications'],
    queryFn: getCertifications,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', certFilter],
    queryFn: () => getLeaderboard(certFilter || undefined, 30),
  });

  const isCertMode = !!certFilter;
  const top3 = entries.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Leaderboard" />

      <div className="container pt-24 pb-16 space-y-8">
        {/* Cert filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={!certFilter ? 'default' : 'outline'}
            className="font-mono text-xs"
            onClick={() => setCertFilter('')}
          >
            <Star className="h-3 w-3 mr-1" /> By Points
          </Button>
          {certifications?.map(c => (
            <Button
              key={c.id}
              size="sm"
              variant={certFilter === c.id ? 'default' : 'outline'}
              className="font-mono text-xs"
              onClick={() => setCertFilter(c.id)}
            >
              {c.code}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-mono">Chưa có dữ liệu. Hãy hoàn thành bài thi đầu tiên!</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                {[1, 0, 2].map((podiumIdx) => {
                  const entry = top3[podiumIdx];
                  if (!entry) return <div key={podiumIdx} />;
                  const isFirst = entry.rank === 1;
                  return (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: podiumIdx * 0.1 }}
                      className={`flex flex-col items-center ${isFirst ? '-mt-4' : 'mt-4'}`}
                    >
                      <Card className={`glass-card w-full border ${rankBg[entry.rank] || 'border-border'}`}>
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            {isFirst && <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 h-5 w-5 text-yellow-400" />}
                            <Avatar className={`${isFirst ? 'h-16 w-16' : 'h-12 w-12'} border-2 ${
                              entry.rank === 1 ? 'border-yellow-400' : entry.rank === 2 ? 'border-gray-300' : 'border-amber-600'
                            }`}>
                              <AvatarFallback className={`font-mono font-bold text-sm ${
                                entry.rank === 1 ? 'bg-yellow-400/20 text-yellow-400' : entry.rank === 2 ? 'bg-gray-300/20 text-gray-300' : 'bg-amber-600/20 text-amber-600'
                              }`}>
                                {getInitials(entry.displayName)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <span className={`text-lg font-bold font-mono ${rankColors[entry.rank] || 'text-foreground'}`}>
                            #{entry.rank}
                          </span>
                          <span className="font-semibold text-sm truncate w-full">{entry.displayName}</span>
                          {isCertMode ? (
                            <span className="text-2xl font-bold font-mono text-primary">{entry.bestScore}%</span>
                          ) : (
                            <span className="text-2xl font-bold font-mono text-primary">{entry.points} pts</span>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Full Table */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base font-mono flex items-center gap-2">
                  <Medal className="h-4 w-4 text-primary" /> Full Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 font-mono">Rank</TableHead>
                      <TableHead className="font-mono">Player</TableHead>
                      {isCertMode ? (
                        <>
                          <TableHead className="font-mono text-center">Best</TableHead>
                          <TableHead className="font-mono text-center hidden sm:table-cell">Avg</TableHead>
                          <TableHead className="font-mono text-center hidden sm:table-cell">Exams</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="font-mono text-center">Points</TableHead>
                          <TableHead className="font-mono text-center hidden sm:table-cell">Questions</TableHead>
                          <TableHead className="font-mono text-center hidden sm:table-cell">Exams</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry, i) => (
                      <motion.tr
                        key={entry.userId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border transition-colors hover:bg-muted/50"
                      >
                        <TableCell>
                          <span className={`font-mono font-bold text-sm ${rankColors[entry.rank] || 'text-muted-foreground'}`}>
                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs font-mono bg-secondary text-secondary-foreground">
                                {getInitials(entry.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{entry.displayName}</span>
                          </div>
                        </TableCell>
                        {isCertMode ? (
                          <>
                            <TableCell className="text-center">
                              <span className={`font-mono font-bold text-sm ${
                                (entry.bestScore ?? 0) >= 90 ? 'text-accent' : (entry.bestScore ?? 0) >= 75 ? 'text-primary' : 'text-foreground'
                              }`}>
                                {entry.bestScore}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <span className="font-mono text-sm text-muted-foreground">{entry.avgScore}%</span>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <span className="font-mono text-sm text-muted-foreground">{entry.totalExams}</span>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-center">
                              <span className="font-mono font-bold text-sm text-primary flex items-center justify-center gap-1">
                                <Flame className="h-3.5 w-3.5 text-orange-400" />
                                {entry.points}
                              </span>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <span className="font-mono text-sm text-muted-foreground">{entry.questionsCreated ?? 0}</span>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <span className="font-mono text-sm text-muted-foreground">{entry.examsCompleted ?? 0}</span>
                            </TableCell>
                          </>
                        )}
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
