import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { saveGeneratedQuestions } from "@/services/ai-questions";
import {
  GeneratedQuestionPreview,
  JobStatusResult,
  QualityTier,
} from "@/types/api-types";
import { toast } from "sonner";

const TIER_COLORS: Record<QualityTier, string> = {
  HIGH: "bg-green-100 text-green-700 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-red-100 text-red-700 border-red-200",
};

const TIER_LABEL: Record<QualityTier, string> = {
  HIGH: "Auto-publish",
  MEDIUM: "Needs review",
  LOW: "Low quality",
};

function normalizeQuestion(q: any): GeneratedQuestionPreview {
  if (!q || typeof q !== "object") {
    return {
      title: "",
      questionType: "SINGLE",
      difficulty: "MEDIUM",
      explanation: "",
      choices: [],
      tags: [],
      qualityScore: 0,
      qualityTier: null,
    } as unknown as GeneratedQuestionPreview;
  }
  const correctRaw = String(q.correct_answer ?? q.correctAnswer ?? "");
  const correctLetters = correctRaw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const rawOptions = Array.isArray(q.choices)
    ? q.choices
    : Array.isArray(q.options)
      ? q.options
      : [];
  const choices = rawOptions.map((opt: any, idx: number) => {
    if (typeof opt === "string") {
      const label =
        opt.match(/^\s*([A-Z])\b/)?.[1] ?? String.fromCharCode(65 + idx);
      const content = opt.replace(/^\s*[A-Z][.)]\s*/, "").trim();
      return { label, content, isCorrect: correctLetters.includes(label) };
    }
    const o = opt ?? {};
    const label =
      (typeof o.label === "string" && o.label) || String.fromCharCode(65 + idx);
    const content =
      (typeof o.content === "string" && o.content) ||
      (typeof o.text === "string" && o.text) ||
      "";
    const isCorrect =
      typeof o.isCorrect === "boolean"
        ? o.isCorrect
        : correctLetters.includes(String(label).toUpperCase());
    return { label: String(label).toUpperCase(), content, isCorrect };
  });
  const rawType = String(q.questionType ?? q.question_type ?? "").toUpperCase();
  const questionType =
    rawType === "MULTIPLE" || rawType === "MULTIPLE_CHOICE"
      ? "MULTIPLE"
      : rawType === "SINGLE" || rawType === "SINGLE_CHOICE"
        ? "SINGLE"
        : correctLetters.length > 1
          ? "MULTIPLE"
          : "SINGLE";

  const rawDiff = String(q.difficulty ?? "").toUpperCase();
  const difficulty =
    rawDiff === "EASY" || rawDiff === "MEDIUM" || rawDiff === "HARD"
      ? rawDiff
      : "MEDIUM";

  return {
    ...q,
    title: q.title ?? q.question ?? "",
    explanation: q.explanation ?? "",
    questionType,
    difficulty,
    choices,
    tags: Array.isArray(q.tags) ? q.tags : [],
    qualityScore: typeof q.qualityScore === "number" ? q.qualityScore : 0,
    qualityTier: q.qualityTier ?? null,
  } as GeneratedQuestionPreview;
}

interface Props {
  result: JobStatusResult;
  certificationId: string;
  domainId?: string;
  onReset: () => void;
}

export default function GeneratedQuestionsReview({
  result,
  certificationId,
  domainId,
  onReset,
}: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const questions = (result.questions ?? []).map((q) => normalizeQuestion(q));
  const [included, setIncluded] = useState<Set<number>>(
    new Set(
      questions
        .map((_, i) => i)
        .filter((i) => questions[i].qualityTier !== null),
    ),
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [edits, setEdits] = useState<
    Record<number, Partial<GeneratedQuestionPreview>>
  >({});

  const saveMutation = useMutation({
    mutationFn: () => {
      const toSave = Array.from(included).map((i) => ({
        ...questions[i],
        ...edits[i],
      }));
      return saveGeneratedQuestions({
        jobId: result.jobId,
        certificationId,
        domainId,
        questions: toSave,
      });
    },
    onSuccess: (data) => {
      toast.success(
        `Saved ${data.saved} questions${data.discarded ? `, ${data.discarded} discarded (low quality)` : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["generation-history"] });
      navigate("/questions?status=APPROVED&mine=true");
    },
    onError: () => toast.error("Failed to save questions"),
  });

  const toggleInclude = (i: number) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  const updateEdit = (i: number, field: string, value: string) => {
    setEdits((prev) => ({ ...prev, [i]: { ...prev[i], [field]: value } }));
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {questions.length} generated
          </span>
          <span className="font-medium">{included.size} selected</span>
          {result.tokenUsage && (
            <span className="text-xs text-muted-foreground">
              {result.tokenUsage.prompt + result.tokenUsage.completion} tokens
              used
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReset}>
            Generate More
          </Button>
          <Button
            size="sm"
            disabled={included.size === 0 || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save {included.size} Questions
          </Button>
        </div>
      </div>

      {questions.map((q, i) => {
        const tier = q.qualityTier;
        const isIncluded = included.has(i);
        const isExpanded = expanded.has(i);
        const edit = edits[i] || {};
        const displayQ = { ...q, ...edit };

        return (
          <Card
            key={i}
            className={`transition-opacity ${!isIncluded ? "opacity-50" : ""} ${
              tier === "HIGH"
                ? "border-green-200"
                : tier === "MEDIUM"
                  ? "border-yellow-200"
                  : "border-red-200"
            }`}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-start gap-2">
                <button
                  className="mt-0.5 flex-shrink-0"
                  onClick={() => toggleInclude(i)}
                >
                  {isIncluded ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {displayQ.title}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {tier && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${TIER_COLORS[tier]}`}
                    >
                      {TIER_LABEL[tier]} ({Math.round(q.qualityScore * 100)}%)
                    </span>
                  )}
                  {!tier && (
                    <Badge variant="destructive" className="text-xs">
                      Low — excluded
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleExpand(i)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 pb-4 px-4 space-y-3">
                {/* Choices */}
                <div className="space-y-1">
                  {displayQ.choices.map((c, ci) => (
                    <div
                      key={ci}
                      className={`flex items-start gap-2 text-sm rounded px-2 py-1 ${c.isCorrect ? "bg-green-50 text-green-800" : ""}`}
                    >
                      <span className="font-mono font-medium flex-shrink-0">
                        {c.label}.
                      </span>
                      <span>{c.content}</span>
                    </div>
                  ))}
                </div>

                {/* Explanation (editable) */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Explanation
                  </label>
                  <Textarea
                    className="text-xs min-h-[60px]"
                    value={displayQ.explanation || ""}
                    onChange={(e) =>
                      updateEdit(i, "explanation", e.target.value)
                    }
                  />
                </div>

                {/* Source passage */}
                {q.sourcePassage && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                      <label className="text-xs font-medium text-muted-foreground">
                        Source Passage
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 italic">
                      {q.sourcePassage}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {displayQ.tags && displayQ.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {displayQ.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
