import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { joinViaLink } from '@/services/organizations';
import { useAuthStore } from '@/stores/auth.store';

const OrgJoin = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: () => joinViaLink(code!),
    onSuccess: (member) => {
      // Redirect to org after short delay
      setTimeout(() => navigate('/org'), 1500);
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/auth?redirect=/org/join/${code}`);
      return;
    }
    if (code) mutate();
  }, [code, isAuthenticated]);

  const errorMessage =
    (error as any)?.response?.data?.message || 'Failed to join organization';

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Join Organization" />
      <div className="container pt-20 pb-8 max-w-md flex items-center justify-center min-h-[60vh]">
        <Card className="bg-card border-border w-full">
          <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
            {isPending && (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-mono text-sm text-muted-foreground">Joining organization...</p>
              </>
            )}
            {isSuccess && (
              <>
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                <p className="font-mono text-sm">You have joined the organization!</p>
                <p className="text-xs text-muted-foreground">Redirecting...</p>
              </>
            )}
            {isError && (
              <>
                <XCircle className="h-10 w-10 text-destructive" />
                <p className="font-mono text-sm">{errorMessage}</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/org')}>
                  Go to Organizations
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrgJoin;
