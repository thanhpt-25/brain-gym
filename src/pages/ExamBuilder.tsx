import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getCertifications } from "@/services/certifications";
import {
  createExam,
  updateExam,
  getExamById,
  CreateExamPayload,
  UpdateExamPayload,
} from "@/services/exams";
import { getQuestions } from "@/services/questions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  Clock,
  Coffee,
  LayoutGrid,
  Loader2,
  Plus,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import BlueprintEditor from "@/components/exam/BlueprintEditor";
import type { TimerMode, ExamBlueprint } from "@/types/api-types";

const ExamBuilder = () => {
  const navigate = useNavigate();
  const { id: examId } = useParams<{ id: string }>();
  const isEditMode = !!examId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [certId, setCertId] = useState("");
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(60);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE" | "LINK">(
    "PUBLIC",
  );
  const [timerMode, setTimerMode] = useState<TimerMode>("STRICT");
  const [mode, setMode] = useState<"random" | "pick" | "blueprint">("random");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [blueprint, setBlueprint] = useState<ExamBlueprint | null>(null);
  const [questionPage, setQuestionPage] = useState(1);
  const [searchCert, setSearchCert] = useState("");
  const handleBlueprintChange = useCallback(
    (bp: ExamBlueprint | null) => setBlueprint(bp),
    [],
  );

  const { data: certifications } = useQuery({
    queryKey: ["certifications"],
    queryFn: getCertifications,
  });

  // Edit mode: load the existing exam to prefill the form.
  const { data: existingExam, isLoading: examLoading } = useQuery({
    queryKey: ["exam-edit", examId],
    queryFn: () => getExamById(examId!),
    enabled: isEditMode,
  });

  // Prefill once when the exam loads. Editing replaces the full question set,
  // so the form is locked to "pick" mode with the current questions selected.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!existingExam || prefilled.current) return;
    prefilled.current = true;
    setTitle(existingExam.title ?? "");
    setDescription(existingExam.description ?? "");
    setCertId(existingExam.certificationId ?? "");
    setTimeLimit(existingExam.timeLimit ?? 60);
    setVisibility(existingExam.visibility ?? "PUBLIC");
    setTimerMode(existingExam.timerMode ?? "STRICT");
    setMode("pick");
    setSelectedQuestionIds(
      (existingExam.examQuestions ?? []).map(
        (eq: any) => eq.question?.id ?? eq.questionId,
      ),
    );
  }, [existingExam]);

  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: ["builder-questions", certId, questionPage],
    queryFn: () => getQuestions(certId, questionPage, 20),
    enabled: mode === "pick" && !!certId,
  });

  // Reset blueprint state when mode changes away from blueprint.
  useEffect(() => {
    if (mode !== "blueprint") setBlueprint(null);
  }, [mode]);

  const mutation = useMutation({
    mutationFn: (data: CreateExamPayload | UpdateExamPayload) =>
      isEditMode
        ? updateExam(examId!, data as UpdateExamPayload)
        : createExam(data as CreateExamPayload),
    onSuccess: () => {
      toast.success(
        isEditMode
          ? "Exam updated successfully!"
          : "Exam created successfully!",
      );
      navigate(isEditMode ? "/exams/mine" : "/exams");
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          (isEditMode ? "Failed to update exam" : "Failed to create exam"),
      );
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!certId) return toast.error("Please select a certification");
    if (mode === "pick" && selectedQuestionIds.length === 0)
      return toast.error("Please select at least one question");
    if (mode === "blueprint" && !blueprint)
      return toast.error(
        "Blueprint is not valid — check the total % and available question counts",
      );

    if (isEditMode) {
      const base = {
        title: title.trim(),
        description: description.trim() || undefined,
        timeLimit,
        visibility,
        timerMode,
      };
      const payload: UpdateExamPayload =
        mode === "blueprint"
          ? { ...base, selectionStrategy: "BLUEPRINT", blueprint: blueprint! }
          : {
              ...base,
              // Only send questionIds when pick mode has an actual selection;
              // sending an empty array fails the backend @ArrayNotEmpty guard.
              ...(selectedQuestionIds.length > 0
                ? { questionIds: selectedQuestionIds }
                : {}),
            };
      mutation.mutate(payload);
      return;
    }

    const payload: CreateExamPayload =
      mode === "blueprint"
        ? {
            title: title.trim(),
            description: description.trim() || undefined,
            certificationId: certId,
            // BlueprintEditor.distributeByPercent guarantees sum(counts) === questionCount,
            // so the state value is the source of truth — no need to re-derive.
            questionCount,
            timeLimit,
            visibility,
            timerMode,
            selectionStrategy: "BLUEPRINT",
            blueprint: blueprint!,
          }
        : {
            title: title.trim(),
            description: description.trim() || undefined,
            certificationId: certId,
            questionCount:
              mode === "pick" ? selectedQuestionIds.length : questionCount,
            timeLimit,
            visibility,
            timerMode,
            questionIds: mode === "pick" ? selectedQuestionIds : undefined,
          };

    mutation.mutate(payload);
  };

  const toggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id],
    );
  };

  if (isEditMode && examLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Exam Builder" />
        <div className="flex items-center justify-center pt-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Exam Builder" />

      <section className="pt-24 pb-20">
        <div className="container max-w-3xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6 text-muted-foreground"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl font-bold font-mono mb-6">
              {isEditMode ? "Edit Mock Exam" : "Create Mock Exam"}
            </h1>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="text-sm font-mono text-muted-foreground mb-1.5 block">
                  Title *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AWS SAA Practice Test #1"
                  className="bg-white/5 border-white/10"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-mono text-muted-foreground mb-1.5 block">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  className="bg-white/5 border-white/10 min-h-[80px]"
                />
              </div>

              {/* Certification */}
              <div>
                <label className="text-sm font-mono text-muted-foreground mb-1.5 block">
                  Certification *
                </label>
                <Select
                  value={certId || undefined}
                  disabled={isEditMode}
                  onValueChange={(v) => {
                    setCertId(v);
                    setSelectedQuestionIds([]);
                    setQuestionPage(1);
                  }}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 disabled:opacity-60">
                    <SelectValue placeholder="Select certification" />
                  </SelectTrigger>
                  <SelectContent>
                    {certifications?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEditMode && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Certification can't be changed after an exam is created.
                  </p>
                )}
              </div>

              {/* Time & Visibility */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-mono text-muted-foreground mb-1.5 block">
                    Time Limit (minutes)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={timeLimit}
                    onChange={(e) =>
                      setTimeLimit(parseInt(e.target.value) || 1)
                    }
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <label className="text-sm font-mono text-muted-foreground mb-1.5 block">
                    Visibility
                  </label>
                  <Select
                    value={visibility}
                    onValueChange={(v) => setVisibility(v as any)}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                      <SelectItem value="PRIVATE">Private</SelectItem>
                      <SelectItem value="LINK">Link Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Timer Mode */}
              <div>
                <label className="text-sm font-mono text-muted-foreground mb-2 block">
                  Timer Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      value: "RELAXED" as TimerMode,
                      label: "Relaxed",
                      desc: "No pressure indicators",
                      icon: <Coffee className="h-3.5 w-3.5" />,
                    },
                    {
                      value: "STRICT" as TimerMode,
                      label: "Standard",
                      desc: "Red timer at 5 min",
                      icon: <Clock className="h-3.5 w-3.5" />,
                    },
                    {
                      value: "ACCELERATED" as TimerMode,
                      label: "Accelerated",
                      desc: "0.75× time budget",
                      icon: <Zap className="h-3.5 w-3.5" />,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTimerMode(opt.value)}
                      className={`p-3 rounded-lg border text-left text-sm font-mono transition-all ${timerMode === opt.value ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 font-semibold">
                        {opt.icon}
                        {opt.label}
                      </div>
                      <div className="text-xs opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Selection Mode
                  Edit mode hides "Random": random on update would be a
                  no-op (no questionIds → metadata-only path in backend).
                  Users can re-roll via "Blueprint" or adjust via "Manual pick". */}
              <div>
                <label className="text-sm font-mono text-muted-foreground mb-2 block">
                  Question Selection
                </label>
                <div className={`grid gap-2 ${isEditMode ? "grid-cols-2" : "grid-cols-3"}`}>
                  {!isEditMode && (
                    <button
                      onClick={() => setMode("random")}
                      className={`p-3 rounded-lg border text-sm font-mono transition-all text-left ${mode === "random" ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"}`}
                    >
                      <div className="font-semibold mb-0.5">Random</div>
                      <div className="text-xs opacity-70">
                        Auto-pick from the approved question bank
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => setMode("blueprint")}
                    className={`p-3 rounded-lg border text-sm font-mono transition-all text-left ${mode === "blueprint" ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"}`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Blueprint
                    </div>
                    <div className="text-xs opacity-70">
                      Declare difficulty or domain percentages
                    </div>
                  </button>
                  <button
                    onClick={() => setMode("pick")}
                    className={`p-3 rounded-lg border text-sm font-mono transition-all text-left ${mode === "pick" ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"}`}
                  >
                    <div className="font-semibold mb-0.5">Manual pick</div>
                    <div className="text-xs opacity-70">
                      Select individual questions
                    </div>
                  </button>
                </div>
              </div>

              {/* Random mode: question count */}
              {mode === "random" && (
                <div>
                  <label className="text-sm font-mono text-muted-foreground mb-1.5 block">
                    Number of Questions
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={questionCount}
                    onChange={(e) =>
                      setQuestionCount(parseInt(e.target.value) || 1)
                    }
                    className="bg-white/5 border-white/10 w-32"
                  />
                </div>
              )}

              {/* Blueprint mode */}
              {mode === "blueprint" && certId && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-mono text-muted-foreground mb-1.5 block">
                      Total Questions
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={questionCount}
                      onChange={(e) =>
                        setQuestionCount(parseInt(e.target.value) || 1)
                      }
                      className="bg-white/5 border-white/10 w-32"
                    />
                  </div>
                  <BlueprintEditor
                    certificationId={certId}
                    totalCount={questionCount}
                    onChange={handleBlueprintChange}
                  />
                </div>
              )}

              {mode === "blueprint" && !certId && (
                <p className="text-xs text-muted-foreground font-mono">
                  Select a certification first to configure the blueprint.
                </p>
              )}

              {/* Pick mode: question browser */}
              {mode === "pick" && certId && (
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-mono text-muted-foreground">
                      {selectedQuestionIds.length} question
                      {selectedQuestionIds.length !== 1 ? "s" : ""} selected
                    </span>
                  </div>

                  {questionsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />{" "}
                      Loading questions...
                    </div>
                  ) : questionsData?.data.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No approved questions found for this certification.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {questionsData?.data.map((q) => (
                          <label
                            key={q.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedQuestionIds.includes(q.id) ? "border-primary/50 bg-primary/5" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                          >
                            <Checkbox
                              checked={selectedQuestionIds.includes(q.id)}
                              onCheckedChange={() => toggleQuestion(q.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {q.title}
                              </div>
                              <div className="flex gap-2 mt-1">
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded font-mono ${q.difficulty === "EASY" ? "bg-accent/10 text-accent" : q.difficulty === "MEDIUM" ? "bg-yellow-500/10 text-yellow-500" : "bg-destructive/10 text-destructive"}`}
                                >
                                  {q.difficulty}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {q.domain?.name}
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      {questionsData && questionsData.meta.lastPage > 1 && (
                        <div className="flex justify-center mt-3 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={questionPage === 1}
                            onClick={() => setQuestionPage((p) => p - 1)}
                          >
                            Prev
                          </Button>
                          <span className="py-1.5 px-3 text-xs font-mono text-muted-foreground">
                            {questionPage}/{questionsData.meta.lastPage}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              questionPage >= questionsData.meta.lastPage
                            }
                            onClick={() => setQuestionPage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Submit */}
              <Button
                className="w-full glow-cyan font-mono"
                size="lg"
                onClick={handleSubmit}
                disabled={
                  mutation.isPending ||
                  (mode === "blueprint" && !blueprint)
                }
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                {isEditMode ? "Save Changes" : "Create Exam"}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default ExamBuilder;
