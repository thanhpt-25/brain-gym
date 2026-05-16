import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getCertifications } from "@/services/certifications";
import { getExams, ExamSummary } from "@/services/exams";
import { startAttempt } from "@/services/attempts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  FileText,
  Loader2,
  Plus,
  Users,
  Play,
  TrendingUp,
  Copy,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Breadcrumb from "@/components/Breadcrumb";
import { ExamGridSkeleton } from "@/components/PageSkeleton";
import { useAuthStore } from "@/stores/auth.store";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const ExamLibrary = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [certId, setCertId] = useState("");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: certifications } = useQuery({
    queryKey: ["certifications"],
    queryFn: getCertifications,
  });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["exams", certId, sort],
      queryFn: ({ pageParam = 1 }) =>
        getExams(certId || undefined, pageParam, 12, sort),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        if (lastPage.meta.page < lastPage.meta.lastPage) {
          return lastPage.meta.page + 1;
        }
        return undefined;
      },
    });

  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const exams = data?.pages?.flatMap((p) => p.data) ?? [];

  const handleStartExam = async (examId: string) => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    setStartingExamId(examId);
    try {
      const attempt = await startAttempt(examId);
      navigate(`/exam/${attempt.certification.id}`, {
        state: { attemptData: attempt },
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to start exam");
    } finally {
      setStartingExamId(null);
    }
  };

  const handleShare = (exam: ExamSummary) => {
    const url = exam.shareCode
      ? `${window.location.origin}/exams/share/${exam.shareCode}`
      : `${window.location.origin}/exams/${exam.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(exam.id);
    toast.success("Link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Exam Library" />

      <section className="pt-24 pb-20">
        <div className="container max-w-6xl mx-auto">
          <Breadcrumb items={[{ label: "Exams" }]} className="mb-6" />
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-mono text-gradient-cyan">
                Exam Library
              </h1>
              <p className="text-muted-foreground mt-1">
                Browse and take community-created mock exams
              </p>
            </div>
            {isAuthenticated && (
              <Button
                className="glow-cyan font-mono"
                onClick={() => navigate("/exams/create")}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Create Exam
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Select
              value={certId || "all"}
              onValueChange={(v) => setCertId(v === "all" ? "" : v)}
            >
              <SelectTrigger
                aria-label="Filter by certification"
                className="w-[200px] border-border bg-muted/50"
              >
                <SelectValue placeholder="All Certifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Certifications</SelectItem>
                {certifications?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger
                aria-label="Sort exams"
                className="w-[150px] border-border bg-muted/50"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Exam Grid */}
          {isLoading ? (
            <ExamGridSkeleton count={6} />
          ) : exams.length === 0 ? (
            <div className="text-center py-16 border border-border rounded-xl bg-muted/30">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold">No exams found</h3>
              <p className="text-muted-foreground mt-1">
                Be the first to create one!
              </p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exams.map((exam, i) => (
                  <motion.div
                    key={exam.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-5 flex flex-col hover:border-primary/30 transition-colors"
                  >
                    {/* Cert badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {exam.certification.code}
                      </span>
                      <button
                        onClick={() => handleShare(exam)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === exam.id ? (
                          <Check className="h-3.5 w-3.5 text-accent" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Title */}
                    <h3 className="font-mono font-semibold mb-1 line-clamp-2">
                      {exam.title}
                    </h3>
                    {exam.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {exam.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-auto pt-3">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {exam.questionCount} Qs
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {exam.timeLimit}m
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {exam.attemptCount}
                      </span>
                      {exam.avgScore != null && Number(exam.avgScore) > 0 && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />{" "}
                          {Math.round(Number(exam.avgScore))}% avg
                        </span>
                      )}
                    </div>

                    {exam.author && (
                      <div className="text-xs text-muted-foreground mt-2">
                        by {exam.author.displayName}
                      </div>
                    )}

                    {/* Action */}
                    <Button
                      className="w-full mt-4 font-mono"
                      size="sm"
                      onClick={() => handleStartExam(exam.id)}
                      disabled={startingExamId === exam.id}
                    >
                      {startingExamId === exam.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Take Exam
                    </Button>
                  </motion.div>
                ))}
              </div>

              {/* Loading sentinel */}
              <div ref={sentinelRef} className="py-12 flex justify-center">
                {isFetchingNextPage && (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                )}
                {!hasNextPage && exams.length > 0 && (
                  <p className="text-xs text-muted-foreground font-mono opacity-50">
                    All exams loaded
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default ExamLibrary;
