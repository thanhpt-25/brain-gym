import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getPublicLink,
  submitApplication,
  type PublicLinkInfo,
} from "@/services/apply";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ClipboardList,
  Clock,
  FileQuestion,
  CheckCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Success state ────────────────────────────────────────────────────────────

const SuccessScreen = ({
  token,
  alreadyApplied,
}: {
  token: string;
  alreadyApplied: boolean;
}) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <Card className="max-w-md w-full bg-card border-border">
      <CardContent className="p-8 text-center space-y-4">
        <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
        <h2 className="text-xl font-mono font-bold">
          {alreadyApplied ? "Already applied" : "Application submitted!"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {alreadyApplied
            ? "You have already applied for this role. Check your inbox for your assessment link."
            : "Your application has been received. You will get an assessment link by email shortly."}
        </p>
        <a
          href={`/assess/${token}`}
          className="inline-block text-sm text-primary underline underline-offset-4"
        >
          Start assessment now →
        </a>
      </CardContent>
    </Card>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const PublicApply = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState<{
    token: string;
    alreadyApplied: boolean;
  } | null>(null);

  const {
    data: linkInfo,
    isLoading,
    error,
  } = useQuery<PublicLinkInfo>({
    queryKey: ["public-apply", code],
    queryFn: () => getPublicLink(code!),
    enabled: !!code,
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      submitApplication(code!, {
        email: email.trim(),
        fullName: fullName.trim(),
        consentGiven,
        honeypot,
      }),
    onSuccess: (res) => setSubmitted(res),
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message || "Submission failed. Please try again.",
      ),
  });

  if (submitted) {
    return (
      <SuccessScreen
        token={submitted.token}
        alreadyApplied={submitted.alreadyApplied}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !linkInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-border">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
            <h2 className="text-xl font-mono font-bold">Link unavailable</h2>
            <p className="text-sm text-muted-foreground">
              This apply link is inactive, expired, or has reached its maximum
              uses.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSubmit =
    email.trim().includes("@") &&
    fullName.trim().length > 0 &&
    consentGiven &&
    !applyMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-mono font-bold">
            {linkInfo.jobRole.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Apply for this position
          </p>
        </div>

        {/* Assessment info */}
        <Card className="bg-card/50 border-border">
          <CardContent className="p-4 space-y-2">
            <h2 className="font-mono font-semibold text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              {linkInfo.assessment.title}
            </h2>
            {linkInfo.assessment.description && (
              <p className="text-xs text-muted-foreground">
                {linkInfo.assessment.description}
              </p>
            )}
            <div className="flex gap-4 text-[11px] text-muted-foreground font-mono pt-1">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {linkInfo.assessment.timeLimit} min
              </span>
              <span className="flex items-center gap-1">
                <FileQuestion className="h-3 w-3" />
                {linkInfo.assessment.questionCount} questions
              </span>
              {linkInfo.expiresAt && (
                <span className="flex items-center gap-1 text-amber-400">
                  Closes {new Date(linkInfo.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Apply form */}
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Full name *
              </label>
              <Input
                className="mt-1 font-mono text-sm bg-muted/30 border-border"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Email *
              </label>
              <Input
                type="email"
                className="mt-1 font-mono text-sm bg-muted/30 border-border"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* Honeypot — visually hidden from humans, bots fill it */}
            <input
              name="website"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="accent-primary mt-0.5 shrink-0"
              />
              <span className="text-xs text-muted-foreground">
                I consent to the processing of my personal data for recruitment
                purposes and agree to take the online assessment.
              </span>
            </label>

            <Button
              className="w-full glow-cyan"
              onClick={() => applyMutation.mutate()}
              disabled={!canSubmit}
            >
              {applyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Submit application"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicApply;
