import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminQuestions } from "@/services/admin";
import { deleteQuestion } from "@/services/questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileQuestion,
  Search,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "REMOVED", label: "Removed" },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  PENDING: "bg-warning/10 text-warning",
  APPROVED: "bg-accent/10 text-accent",
  REJECTED: "bg-destructive/10 text-destructive",
  REMOVED: "bg-muted text-muted-foreground line-through",
};

export function QuestionsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-questions", page, search, status],
    queryFn: () =>
      getAdminQuestions({
        search: search || undefined,
        status: status || undefined,
        page,
        limit: 20,
        includeDeleted: true,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
      setConfirmId(null);
      if (result.examUsageCount > 0) {
        toast.warning(
          `Question deleted. It was used in ${result.examUsageCount} active exam session(s).`,
        );
      } else {
        toast.success("Question deleted");
      }
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to delete question"),
  });

  const questions = (data?.data ?? []) as any[];
  const meta = data?.meta as any;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(pendingSearch);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-primary" /> All Questions
            {meta && (
              <Badge variant="secondary" className="font-mono">
                {meta.total} total
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by title..."
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  className="pl-8 h-8 text-sm font-mono"
                />
              </div>
              <Button type="submit" size="sm" className="h-8 font-mono text-xs">
                Search
              </Button>
            </form>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-36 h-8 text-xs font-mono">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : questions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No questions found
            </p>
          ) : (
            <div className="space-y-2">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded ${STATUS_COLORS[q.status] ?? "bg-secondary text-muted-foreground"}`}
                      >
                        {q.status}
                      </span>
                      {q.certification && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {q.certification.code}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        by {q.author?.displayName ?? "—"}
                      </span>
                    </div>
                    <p className="text-sm truncate">{q.title}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="View question"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        window.open(`/questions/${q.id}`, "_blank")
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete question"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      disabled={q.status === "REMOVED"}
                      onClick={() => setConfirmId(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              {meta && meta.lastPage > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </Button>
                  <span className="py-2 px-3 text-xs font-mono text-muted-foreground">
                    {page} / {meta.lastPage}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= meta.lastPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm dialog */}
      <Dialog
        open={!!confirmId}
        onOpenChange={(open) => !open && setConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">Delete Question</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this question? It will be marked as
            removed and hidden from public listings and future exams. Open
            reports will be auto-closed.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmId(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmId && deleteMutation.mutate(confirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
