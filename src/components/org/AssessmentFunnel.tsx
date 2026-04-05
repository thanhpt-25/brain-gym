import { Card, CardContent } from '@/components/ui/card';
import { Users, Play, CheckCircle2, Award } from 'lucide-react';

interface Props {
  funnel: {
    total: number;
    started: number;
    submitted: number;
    passed: number | null;
  };
}

const AssessmentFunnel = ({ funnel }: Props) => {
  const stages = [
    { label: 'Invited', value: funnel.total, icon: Users, color: 'text-blue-400' },
    { label: 'Started', value: funnel.started, icon: Play, color: 'text-amber-400' },
    { label: 'Submitted', value: funnel.submitted, icon: CheckCircle2, color: 'text-emerald-400' },
    ...(funnel.passed != null
      ? [{ label: 'Passed', value: funnel.passed, icon: Award, color: 'text-primary' }]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stages.map((s) => (
        <Card key={s.label} className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-2 ${s.color}`} />
            <p className="text-2xl font-mono font-bold">{s.value}</p>
            <p className="text-xs font-mono text-muted-foreground">{s.label}</p>
            {funnel.total > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {((s.value / funnel.total) * 100).toFixed(0)}%
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AssessmentFunnel;
