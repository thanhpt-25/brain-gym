import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AttemptQuestion } from "@/types/api-types";

type ReviewFilter = "all" | "unanswered" | "flagged";

interface ExamReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: AttemptQuestion[];
  answers: Record<string, string[]>;
  marked: Set<string>;
  onGoTo: (index: number) => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * Last look before submitting: what is still unanswered or flagged, with a
 * jump to each question — like the review screen of the real exam.
 */
export function ExamReviewDialog({
  open,
  onOpenChange,
  questions,
  answers,
  marked,
  onGoTo,
  onSubmit,
  submitting = false,
}: ExamReviewDialogProps) {
  const unanswered = questions.filter((q) => !answers[q.id]?.length);
  const flagged = questions.filter((q) => marked.has(q.id));
  const answeredCount = questions.length - unanswered.length;
  const [filter, setFilter] = useState<ReviewFilter>(
    unanswered.length ? "unanswered" : flagged.length ? "flagged" : "all",
  );

  // Open on what most likely needs attention.
  useEffect(() => {
    if (open) {
      setFilter(
        unanswered.length ? "unanswered" : flagged.length ? "flagged" : "all",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rows = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) =>
      filter === "unanswered"
        ? !answers[q.id]?.length
        : filter === "flagged"
          ? marked.has(q.id)
          : true,
    );

  const tabs: { key: ReviewFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: questions.length },
    { key: "unanswered", label: "Unanswered", count: unanswered.length },
    { key: "flagged", label: "Flagged", count: flagged.length },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">Review before submitting</DialogTitle>
          <DialogDescription>
            {answeredCount}/{questions.length} answered
            {unanswered.length > 0 &&
              ` · ${unanswered.length} unanswered (scored as wrong)`}
            {flagged.length > 0 && ` · ${flagged.length} flagged`}
          </DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Filter questions" className="flex gap-1">
          {tabs.map((t) => (
            <Button
              key={t.key}
              role="tab"
              aria-selected={filter === t.key}
              size="sm"
              variant={filter === t.key ? "secondary" : "ghost"}
              className="font-mono text-xs"
              onClick={() => setFilter(t.key)}
            >
              {t.label} ({t.count})
            </Button>
          ))}
        </div>

        <ul className="max-h-72 overflow-y-auto space-y-1" aria-label="Questions">
          {rows.length === 0 && (
            <li className="text-sm text-muted-foreground py-4 text-center">
              Nothing here.
            </li>
          )}
          {rows.map(({ q, index }) => (
            <li key={q.id}>
              <button
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary text-sm"
                onClick={() => {
                  onGoTo(index);
                  onOpenChange(false);
                }}
              >
                <span className="font-mono text-xs text-muted-foreground w-8">
                  Q{index + 1}
                </span>
                <span className="flex-1 truncate">{q.title}</span>
                {marked.has(q.id) && (
                  <Flag className="h-3.5 w-3.5 text-warning" aria-label="Flagged" />
                )}
                {!answers[q.id]?.length && (
                  <span className="text-xs text-destructive font-mono">empty</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="font-mono"
            onClick={() => onOpenChange(false)}
          >
            Back to exam
          </Button>
          <Button
            variant="destructive"
            className="font-mono"
            disabled={submitting}
            onClick={onSubmit}
          >
            Submit exam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
