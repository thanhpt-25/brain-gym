import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Circle, Clock, PenLine, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuthStore } from "@/stores/auth.store";
import { getCertifications } from "@/services/certifications";
import {
  cancelContributorRequest,
  createContributorRequest,
  getApiErrorCode,
  getContributorEligibility,
  getMyContributorRequest,
  syncRoleFromServer,
  type EligibilityCheck,
} from "@/services/contributorRequests";

const MAX_EXPERTISE = 10;

const contributorRequestSchema = z.object({
  motivation: z
    .string()
    .trim()
    .min(50, "Please write at least 50 characters")
    .max(1000, "Keep it under 1000 characters"),
  expertise: z.array(z.string()).max(MAX_EXPERTISE).default([]),
  sampleUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\/\S+\.\S+/.test(v), {
      message: "Must be an https:// link",
    })
    .optional()
    .or(z.literal("")),
});

type ContributorRequestForm = z.infer<typeof contributorRequestSchema>;

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "";

const CHECK_LABELS: Partial<Record<EligibilityCheck["key"], string>> = {
  ACCOUNT_AGE: "Account age (days)",
  COMPLETED_ATTEMPTS: "Completed exams",
};

const CONTRIBUTOR_QUERY_KEY = ["contributor-request", "me"];

export default function BecomeContributorCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isLearner = role === "LEARNER";
  const [formOpen, setFormOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: CONTRIBUTOR_QUERY_KEY,
    queryFn: getMyContributorRequest,
    enabled: isLearner,
    refetchOnWindowFocus: true,
  });

  const latest = mine?.request ?? null;
  const isPending = latest?.status === "PENDING";
  const inCooldown = latest?.status === "REJECTED" && !!latest.retryAfter;

  const { data: eligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["contributor-request", "eligibility"],
    queryFn: getContributorEligibility,
    enabled: isLearner && !!mine && !isPending && !inCooldown,
  });

  // Deep link from the Navbar CTA / QuestionForm gate: /profile#contributor
  const location = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (location.hash === "#contributor" && !mineLoading) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, mineLoading]);

  // Approved while the persisted store still says LEARNER → refresh the role.
  useEffect(() => {
    if (isLearner && latest?.status === "APPROVED") {
      syncRoleFromServer().catch(() => undefined);
    }
  }, [isLearner, latest?.status]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contributor-request"] });
  };

  const createMutation = useMutation({
    mutationFn: createContributorRequest,
    onSuccess: () => {
      toast({
        title: "Request sent",
        description: "An admin will review your request soon.",
      });
      setFormOpen(false);
      invalidate();
    },
    onError: (error) => {
      const code = getApiErrorCode(error);
      toast({
        title: "Could not send request",
        description:
          code === "REQUEST_ALREADY_PENDING"
            ? "You already have a pending request."
            : code === "COOLDOWN_ACTIVE"
              ? "Please wait until the cooldown ends."
              : code === "NOT_ELIGIBLE"
                ? "You don't meet the requirements yet."
                : "Please try again later.",
        variant: "destructive",
      });
      invalidate();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelContributorRequest,
    onSuccess: () => {
      toast({ title: "Request cancelled" });
      invalidate();
    },
    onError: () => {
      toast({ title: "Could not cancel request", variant: "destructive" });
      invalidate();
    },
  });

  if (!isLearner) return null;

  const previous = latest && !isPending && !inCooldown ? latest : null;

  return (
    <Card
      id="contributor"
      ref={cardRef}
      className="p-6 bg-card/60 border-border/60 scroll-mt-24"
      aria-labelledby="become-contributor-title"
    >
      <div className="flex items-center gap-2 mb-3">
        <PenLine className="h-4 w-4 text-primary" aria-hidden />
        <h3
          id="become-contributor-title"
          className="font-mono text-sm uppercase tracking-widest text-muted-foreground"
        >
          Become a contributor
        </h3>
      </div>

      {mineLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isPending ? (
        <div className="space-y-3" data-testid="contributor-pending">
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-500 gap-1"
          >
            <Clock className="h-3 w-3" aria-hidden /> Pending review
          </Badge>
          <p className="text-sm text-muted-foreground">
            Sent on {formatDate(latest.createdAt)}. We'll email you once an
            admin has reviewed it.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmCancel(true)}
            disabled={cancelMutation.isPending}
          >
            Cancel request
          </Button>
        </div>
      ) : inCooldown ? (
        <div className="space-y-3" data-testid="contributor-rejected">
          <Badge
            variant="outline"
            className="border-destructive/40 text-destructive gap-1"
          >
            <XCircle className="h-3 w-3" aria-hidden /> Not approved
          </Badge>
          {latest.decisionReason && (
            <p className="text-sm whitespace-pre-line">
              <span className="text-muted-foreground">Reason: </span>
              {latest.decisionReason}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            You can send a new request from {formatDate(latest.retryAfter)}.
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="contributor-apply">
          <p className="text-sm text-muted-foreground">
            Contributors write practice questions for the community. Every
            question is still reviewed before it goes live.
          </p>

          {eligibilityLoading || !eligibility ? (
            <p className="text-sm text-muted-foreground">
              Checking requirements…
            </p>
          ) : (
            <>
              <ul className="space-y-2" aria-label="Requirements">
                {eligibility.checks
                  .filter((c) => CHECK_LABELS[c.key])
                  .map((c) => (
                    <li
                      key={c.key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {c.passed ? (
                          <CheckCircle2
                            className="h-4 w-4 text-accent"
                            aria-label="met"
                          />
                        ) : (
                          <Circle
                            className="h-4 w-4 text-muted-foreground"
                            aria-label="not met"
                          />
                        )}
                        {CHECK_LABELS[c.key]}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {Math.min(c.current ?? 0, c.required ?? 0)}/
                        {c.required}
                      </span>
                    </li>
                  ))}
              </ul>
              <Button
                size="sm"
                className="w-full"
                disabled={!eligibility.eligible}
                onClick={() => setFormOpen(true)}
              >
                Request contributor access
              </Button>
            </>
          )}

          {previous && (
            <p className="text-xs text-muted-foreground">
              Your previous request ({formatDate(previous.createdAt)}) was{" "}
              {previous.status === "REJECTED" ? "not approved" : "cancelled"}.
            </p>
          )}
        </div>
      )}

      <ContributorRequestDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        submitting={createMutation.isPending}
        onSubmit={(values) =>
          createMutation.mutate({
            motivation: values.motivation.trim(),
            expertise: values.expertise,
            sampleUrl: values.sampleUrl?.trim() || undefined,
          })
        }
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your request?</AlertDialogTitle>
            <AlertDialogDescription>
              You can send a new request at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelMutation.mutate()}>
              Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ContributorRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ContributorRequestForm) => void;
  submitting: boolean;
}) {
  const { data: certifications = [] } = useQuery({
    queryKey: ["certifications"],
    queryFn: getCertifications,
    enabled: open,
  });

  const form = useForm<ContributorRequestForm>({
    resolver: zodResolver(contributorRequestSchema),
    defaultValues: { motivation: "", expertise: [], sampleUrl: "" },
  });
  const motivation = form.watch("motivation") ?? "";
  const expertise = form.watch("expertise") ?? [];
  const { errors } = form.formState;

  const toggleExpertise = (id: string, checked: boolean) => {
    const next = checked
      ? [...expertise, id].slice(0, MAX_EXPERTISE)
      : expertise.filter((e) => e !== id);
    form.setValue("expertise", next, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request contributor access</DialogTitle>
          <DialogDescription>
            Tell the admins why you'd like to write questions.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="contributor-motivation">Motivation</Label>
            <Textarea
              id="contributor-motivation"
              rows={5}
              maxLength={1000}
              aria-invalid={!!errors.motivation}
              aria-describedby="contributor-motivation-hint"
              {...form.register("motivation")}
            />
            <div
              id="contributor-motivation-hint"
              className="flex justify-between text-xs text-muted-foreground"
            >
              <span className={errors.motivation ? "text-destructive" : ""}>
                {errors.motivation?.message ?? "50–1000 characters"}
              </span>
              <span className="font-mono">{motivation.trim().length}/1000</span>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">
              Certifications you know well{" "}
              <span className="text-muted-foreground font-normal">
                (optional, up to {MAX_EXPERTISE})
              </span>
            </legend>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 p-2 space-y-1">
              {certifications.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1">
                  No certifications available.
                </p>
              ) : (
                certifications.map((c) => {
                  const checked = expertise.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 text-sm px-1 py-0.5 rounded hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={
                          !checked && expertise.length >= MAX_EXPERTISE
                        }
                        onCheckedChange={(v) => toggleExpertise(c.id, !!v)}
                      />
                      <span className="font-mono text-xs">{c.code}</span>
                      <span className="truncate">{c.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="contributor-sample-url">
              Portfolio / credential link{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="contributor-sample-url"
              type="url"
              placeholder="https://"
              aria-invalid={!!errors.sampleUrl}
              {...form.register("sampleUrl")}
            />
            {errors.sampleUrl && (
              <p className="text-xs text-destructive">
                {errors.sampleUrl.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
