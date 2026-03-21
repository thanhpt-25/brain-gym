import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface ModeCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  accentClass: string;
  bgClass: string;
  badge?: string;
  onClick: () => void;
}

export function ModeCard({ icon: Icon, title, desc, accentClass, bgClass, badge, onClick }: ModeCardProps) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
      <Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer h-full" onClick={onClick}>
        <CardContent className="p-6 flex flex-col h-full">
          <div className={`w-12 h-12 rounded-xl ${bgClass} border flex items-center justify-center mb-4 relative`}>
            <Icon className={`h-6 w-6 ${accentClass}`} />
            {badge && (
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                {badge}
              </span>
            )}
          </div>
          <h3 className="text-lg font-mono font-bold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground flex-1">{desc}</p>
          <Button className="mt-4 font-mono w-full" variant="outline">
            Start Training →
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
