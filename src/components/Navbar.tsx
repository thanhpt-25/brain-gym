import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Brain, Flame, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { getMyPoints } from '@/services/gamification';

interface NavbarProps {
  title?: string;
  showBack?: boolean;
}

const Navbar = ({ title, showBack }: NavbarProps) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  
  const { data: pointsData } = useQuery({
    queryKey: ['my-points'],
    queryFn: getMyPoints,
    enabled: isAuthenticated,
  });

  const canAddQuestion = user?.role === 'CONTRIBUTOR' || user?.role === 'ADMIN';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-1">
              <Brain className="h-5 w-5 rotate-90" />
            </Button>
          )}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-mono text-lg font-bold text-gradient-cyan hidden sm:inline">
              {title || 'CertGym'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex text-muted-foreground hover:text-foreground" 
            onClick={() => navigate('/questions')}
          >
            Questions
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex text-muted-foreground hover:text-foreground" 
            onClick={() => navigate('/exams')}
          >
            Exams
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hidden sm:flex text-muted-foreground hover:text-foreground" 
            onClick={() => navigate('/training')}
          >
            Training
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hidden sm:flex text-muted-foreground hover:text-foreground" 
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="hidden sm:flex text-muted-foreground hover:text-foreground" 
            onClick={() => navigate('/leaderboard')}
          >
            Leaderboard
          </Button>
          
          {isAuthenticated ? (
            <div className="flex items-center gap-2 md:gap-4 ml-1 md:ml-2">
              {pointsData && (
                <span className="flex items-center gap-1 text-sm font-mono text-orange-400">
                  <Flame className="h-3.5 w-3.5" /> {pointsData.points}
                </span>
              )}
              {canAddQuestion && (
                <Button 
                  size="sm" 
                  className="glow-cyan hidden md:flex h-8" 
                  onClick={() => navigate('/questions/new')}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add
                </Button>
              )}
              {user?.role === 'ADMIN' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="hidden md:flex h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/admin')}
                >
                  <Shield className="w-3.5 h-3.5 mr-1" /> Admin
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-8 px-2 md:px-3 text-xs md:text-sm" 
                onClick={() => logout()}
              >
                Logout
              </Button>
            </div>
          ) : (
            <Button size="sm" className="glow-cyan" onClick={() => navigate('/auth')}>
              Get Started
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
