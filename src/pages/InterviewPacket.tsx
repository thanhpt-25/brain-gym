import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getInterviewPacket } from "@/services/interview-packet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  User,
  Briefcase,
  Star,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Below Average",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

const RatingStars = ({ rating }: { rating: number | null }) => {
  if (!rating) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">
        {RATING_LABELS[rating]}
      </span>
    </div>
  );
};

const InterviewPacket = () => {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["interview-packet", token],
    queryFn: () => getInterviewPacket(token!),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    const status = (error as any)?.response?.status;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border">
          <CardContent className="p-8 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <h2 className="text-lg font-mono font-bold">
              {status === 410 ? "Link Expired" : "Link Invalid"}
            </h2>
            <p className="text-sm text-muted-foreground font-mono">
              {status === 410
                ? "This interview packet link has expired. Please request a new one from the hiring team."
                : "This link is not valid. Please check with the hiring team."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { candidate, assessment, competencies } = data;
  const ratedCount = competencies.filter((c) => c.rating !== null).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="border-b border-border bg-card/50 px-6 py-3 flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-primary" />
        <span className="font-mono text-sm font-semibold text-primary">
          CertGym
        </span>
        <span className="text-muted-foreground text-xs font-mono">
          / Interview Packet
        </span>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Assessment header */}
        <div>
          <h1 className="text-2xl font-mono font-bold">{assessment.title}</h1>
          {assessment.jobRole && (
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground font-mono">
              <Briefcase className="h-3.5 w-3.5" />
              {assessment.jobRole.title}
              {assessment.jobRole.department &&
                ` · ${assessment.jobRole.department}`}
            </div>
          )}
        </div>

        {/* Candidate summary */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Candidate Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  Name
                </p>
                <p className="font-mono text-sm mt-0.5">
                  {candidate.name || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  Email
                </p>
                <p className="font-mono text-sm mt-0.5">{candidate.email}</p>
              </div>
            </div>
            <div className="space-y-3">
              {candidate.score !== null && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                    Assessment Score
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xl font-bold text-primary">
                      {candidate.score}%
                    </span>
                    {candidate.percentile !== null && (
                      <Badge className="bg-primary/15 text-primary text-[10px]">
                        Top {100 - Math.round(candidate.percentile)}%
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {candidate.timeSpent !== null && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                    Time Spent
                  </p>
                  <p className="font-mono text-sm mt-0.5">
                    {Math.round(candidate.timeSpent / 60)} min
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Competency scorecard */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400" /> Competency Scorecard
              </CardTitle>
              <span className="text-[10px] text-muted-foreground font-mono">
                {ratedCount}/{competencies.length} rated
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {competencies.length === 0 ? (
              <p className="text-sm text-muted-foreground font-mono text-center py-4">
                No competencies defined for this assessment.
              </p>
            ) : (
              competencies.map((c) => (
                <div
                  key={c.competencyId}
                  className="border border-border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {c.competencyName}
                      </p>
                      {c.competencyDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.competencyDescription}
                        </p>
                      )}
                    </div>
                    <RatingStars rating={c.rating} />
                  </div>
                  {c.note && (
                    <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                      {c.note}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <p className="text-[10px] text-muted-foreground font-mono text-center pb-4">
          This is a read-only interview packet. Shared via a time-limited link.
        </p>
      </div>
    </div>
  );
};

export default InterviewPacket;
