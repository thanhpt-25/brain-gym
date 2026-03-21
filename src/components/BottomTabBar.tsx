import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Target, Dumbbell, BarChart3, Trophy } from 'lucide-react';

const tabs = [
  { label: 'Questions', href: '/questions', icon: BookOpen },
  { label: 'Exams', href: '/exams', icon: Target },
  { label: 'Training', href: '/training', icon: Dumbbell },
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { label: 'Board', href: '/leaderboard', icon: Trophy },
];

const BottomTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around h-14">
        {tabs.map(tab => {
          const active = isActive(tab.href);
          return (
            <button
              key={tab.href}
              onClick={() => navigate(tab.href)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <tab.icon className={`h-5 w-5 ${active ? 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]' : ''}`} />
              <span className="text-[10px] font-mono leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe area for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};

export default BottomTabBar;
