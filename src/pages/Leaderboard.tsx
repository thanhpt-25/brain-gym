import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowLeft, Trophy, Medal, Flame, Target, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { leaderboardData } from '@/data/mockLeaderboardData';

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
  const [certFilter, setCertFilter] = useState<string>('all');

  const uniqueCerts = useMemo(() => {
    const seen = new Map<string, { id: string; code: string; icon: string }>();
    leaderboardData.forEach(e => {
      if (!seen.has(e.certId)) seen.set(e.certId, { id: e.certId, code: e.certCode, icon: e.icon });
    });
    return Array.from(seen.values());
  }, []);

  const filtered = useMemo(() => {
    const data = certFilter === 'all' ? leaderboardData : leaderboardData.filter(e => e.certId === certFilter);
    return [...data].sort((a, b) => b.bestScore - a.bestScore);
  }, [certFilter]);

  // Re-rank after filter
  const ranked = filtered.map((e, i) => ({ ...e, rank: i + 1 }));
  const top3 = ranked.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan">Leaderboard</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
          </div>
        </div>
      </nav>

      <div className="container pt-24 pb-16 space-y-8">
        {/* Cert filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={certFilter === 'all' ? 'default' : 'outline'}
            className="font-mono text-xs"
            onClick={() => setCertFilter('all')}
          >
            All Certs
          </Button>
          {uniqueCerts.map(c => (
            <Button
              key={c.id}
              size="sm"
              variant={certFilter === c.id ? 'default' : 'outline'}
              className="font-mono text-xs"
              onClick={() => setCertFilter(c.id)}
            >
              {c.icon} {c.code}
            </Button>
          ))}
        </div>

        {/* Top 3 Podium */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[1, 0, 2].map((podiumIdx) => {
            const entry = top3[podiumIdx];
            if (!entry) return <div key={podiumIdx} />;
            const isFirst = entry.rank === 1;
            return (
              <motion.div
                key={entry.id}
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
                    <span className="text-2xl font-bold font-mono text-primary">{entry.bestScore}%</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Flame className="h-3 w-3 text-orange-400" /> {entry.streak} streak
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

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
                  <TableHead className="font-mono text-center">Cert</TableHead>
                  <TableHead className="font-mono text-center">Best</TableHead>
                  <TableHead className="font-mono text-center hidden sm:table-cell">Avg</TableHead>
                  <TableHead className="font-mono text-center hidden sm:table-cell">Exams</TableHead>
                  <TableHead className="font-mono text-center hidden md:table-cell">Streak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((entry, i) => (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border transition-colors hover:bg-muted/50"
                  >
                    <TableCell>
                      <span className={`font-mono font-bold text-sm ${rankColors[entry.rank] || 'text-muted-foreground'}`}>
                        {entry.rank <= 3 ? (
                          <span className="flex items-center gap-1">
                            {entry.rank === 1 && '🥇'}
                            {entry.rank === 2 && '🥈'}
                            {entry.rank === 3 && '🥉'}
                          </span>
                        ) : (
                          `#${entry.rank}`
                        )}
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
                    <TableCell className="text-center">
                      <span className="text-xs font-mono px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                        {entry.icon} {entry.certCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-mono font-bold text-sm ${
                        entry.bestScore >= 90 ? 'text-accent' : entry.bestScore >= 75 ? 'text-primary' : 'text-foreground'
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
                    <TableCell className="text-center hidden md:table-cell">
                      <span className="flex items-center justify-center gap-1 text-sm">
                        <Flame className="h-3.5 w-3.5 text-orange-400" />
                        <span className="font-mono">{entry.streak}</span>
                      </span>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Leaderboard;
