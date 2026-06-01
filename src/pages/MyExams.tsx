import { useNavigate } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getMyExams, deleteExam, ExamSummary } from "@/services/exams";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  FileText,
  Loader2,
  Plus,
  Users,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Link2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Breadcrumb from "@/components/Breadcrumb";
import { ExamGridSkeleton } from "@/components/PageSkeleton";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const visibilityMeta: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  PUBLIC: { label: "Public", icon: Eye },
  PRIVATE: { label: "Private", icon: EyeOff },
  LINK: { label: "Link only", icon: Link2 },
};

const MyExams = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["my-exams"],
      queryFn: ({ pageParam = 1 }) => getMyExams(pageParam, 12),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.meta.page < lastPage.meta.lastPage
          ? lastPage.meta.page + 1
          : undefined,
    });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExam(id),
    onSuccess: () => {
      toast.success("Exam deleted");
      queryClient.invalidateQueries({ queryKey: ["my-exams"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete exam");
    },
  });

  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const exams: ExamSummary[] = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="My Exams" />

      <section className="pt-24 pb-20">
        <div className="container max-w-6xl mx-auto">
          <Breadcrumb
            items={[{ label: "Exams", href: "/exams" }, { label: "My Exams" }]}
            className="mb-6"
          />

          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold font-mono text-gradient-cyan">
                My Exams
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage the mock exams you've created
              </p>
            </div>
            <Button
              className="glow-cyan font-mono"
              onClick={() => navigate("/exams/create")}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create Exam
            </Button>
          </div>

          {isLoading ? (
            <ExamGridSkeleton count={6} />
          ) : exams.length === 0 ? (
            <div className="text-center py-16 border border-border rounded-xl bg-muted/30">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold">No exams yet</h3>
              <p className="text-muted-foreground mt-1 mb-4">
                Create your first mock exam to get started.
              </p>
              <Button
                className="glow-cyan font-mono"
                onClick={() => navigate("/exams/create")}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Create Exam
              </Button>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exams.map((exam, i) => {
                  const vis =
                    visibilityMeta[exam.visibility] ?? visibilityMeta.PUBLIC;
                  const VisIcon = vis.icon;
                  return (
                    <motion.div
                      key={exam.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass-card p-5 flex flex-col hover:border-primary/30 transition-colors"
                    >
                      {/* Cert + visibility */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {exam.certification.code}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <VisIcon className="h-3 w-3" /> {vis.label}
                        </span>
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
                          <FileText className="h-3 w-3" /> {exam.questionCount}{" "}
                          Qs
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {exam.timeLimit}m
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {exam.attemptCount}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 font-mono"
                          onClick={() => navigate(`/exams/${exam.id}/edit`)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                              aria-label={`Delete ${exam.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete this exam?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                "{exam.title}" will be permanently deleted. This
                                action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteMutation.mutate(exam.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </motion.div>
                  );
                })}
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

export default MyExams;
