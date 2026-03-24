import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Brain, Flame, Plus, Shield, Menu, X, BookOpen, BarChart3, Trophy, Target, Dumbbell, Layers, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useAuthStore } from '@/stores/auth.store';
import { getMyPoints } from '@/services/gamification';

interface NavbarProps {
  title?: string;
  showBack?: boolean;
  icon?: React.ElementType;
}

const navLinks = [
  { label: 'Questions', href: '/questions', icon: BookOpen },
  { label: 'Exams', href: '/exams', icon: Target },
  { label: 'Training', href: '/training', icon: Dumbbell },
  { label: 'Flashcards', href: '/decks', icon: Layers },
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
];

const Navbar = ({ title, showBack, icon: LogoIcon = Brain }: NavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  const { data: pointsData } = useQuery({
    queryKey: ['my-points'],
    queryFn: getMyPoints,
    enabled: isAuthenticated,
  });

  const canAddQuestion = user?.role === 'CONTRIBUTOR' || user?.role === 'ADMIN';
  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');

  const handleNav = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <LogoIcon className="h-6 w-6 text-primary" />
            <div className="flex items-center font-mono text-lg font-bold">
              <span className="text-gradient-cyan">CertGym</span>
              {title && (
                <span className="hidden sm:flex items-center text-muted-foreground font-normal ml-2">
                  <span className="mx-1 opacity-40">/</span> {title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              className={`font-mono text-xs ${
                isActive(link.href)
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => navigate(link.href)}
            >
              {link.label}
            </Button>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
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
                className="hidden md:flex border-destructive/50 text-destructive hover:bg-destructive/10 h-8 text-xs"
                onClick={() => logout()}
              >
                Logout
              </Button>
            </>
          ) : (
            <Button size="sm" className="glow-cyan hidden md:flex" onClick={() => navigate('/auth')}>
              Get Started
            </Button>
          )}

          {/* Mobile hamburger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border p-0">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <span className="font-mono font-bold text-gradient-cyan">CertGym</span>
                  </div>
                </div>

                {/* Nav links */}
                <div className="flex-1 py-4 space-y-1 px-3">
                  {navLinks.map(link => (
                    <button
                      key={link.href}
                      onClick={() => handleNav(link.href)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-mono transition-colors ${
                        isActive(link.href)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </button>
                  ))}

                  {canAddQuestion && (
                    <button
                      onClick={() => handleNav('/questions/new')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-mono text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Question
                    </button>
                  )}

                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleNav('/admin')}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Shield className="h-4 w-4" />
                      Admin
                    </button>
                  )}
                </div>

                {/* Footer: auth actions */}
                <div className="border-t border-border p-4">
                  {isAuthenticated ? (
                    <div className="space-y-3">
                      {pointsData && (
                        <div className="flex items-center gap-2 text-sm font-mono text-orange-400 px-1">
                          <Flame className="h-4 w-4" /> {pointsData.points} points
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={() => { setOpen(false); logout(); }}
                      >
                        Logout
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full glow-cyan"
                      onClick={() => handleNav('/auth')}
                    >
                      Get Started
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
