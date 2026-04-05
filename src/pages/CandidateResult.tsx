import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { loadCandidateAssessment } from '@/services/assessments';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';

const CandidateResult = () => {
  const { token } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['candidate-result', token],
    queryFn: () => loadCandidateAssessment(token!),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground font-mono text-sm">Unable to load results</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-card border-border">
        <CardContent className="p-8 text-center">
          <ClipboardList className="h-10 w-10 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-mono font-bold mb-2">Assessment Complete</h1>
          {data.candidateName && (
            <p className="text-muted-foreground text-sm mb-4">
              Thank you, {data.candidateName}
            </p>
          )}
          <p className="text-sm text-muted-foreground mb-6">
            Your responses for <strong>{data.title}</strong> have been submitted successfully.
          </p>
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-mono text-muted-foreground">
              The results will be reviewed by the assessment administrators.
              You will be contacted with the outcome.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CandidateResult;
