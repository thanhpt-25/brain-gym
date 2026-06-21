import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useOrgStore } from "@/stores/org.store";
import { getPoolStats, type PoolStats } from "@/services/assessments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shuffle, Database, TrendingDown, Loader2 } from "lucide-react";

export default function OrgPoolStats() {
  const { aid } = useParams<{ aid: string }>();
  const currentOrg = useOrgStore((s) => s.currentOrg);

  const { data, isLoading } = useQuery<PoolStats>({
    queryKey: ["pool-stats", currentOrg?.slug, aid],
    queryFn: () => getPoolStats(currentOrg!.slug, aid!),
    enabled: !!currentOrg && !!aid,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const overlapColor =
    data.overlapPct >= 80
      ? "text-rose-400"
      : data.overlapPct >= 50
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Thống kê Question Pool</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Phân tích mức độ đa dạng và trùng lặp câu hỏi
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="h-4 w-4" />
              Kích thước pool
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.poolSize}</div>
            <div className="text-xs text-muted-foreground">
              câu hỏi khả dụng
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shuffle className="h-4 w-4" />
              Số câu rút
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.drawCount}</div>
            <div className="text-xs text-muted-foreground">mỗi lần thi</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tỷ lệ trùng lặp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${overlapColor}`}>
              {data.overlapPct}%
            </div>
            <div className="text-xs text-muted-foreground">
              overlap giữa các lần thi
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-emerald-400" />
              Đa dạng câu hỏi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">
              {data.uniqueQuestionRatio}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Mức độ trùng lặp</span>
            <span className={overlapColor}>{data.overlapPct}%</span>
          </div>
          <Progress value={data.overlapPct} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {data.overlapPct >= 80
              ? "⚠ Pool nhỏ — mỗi bộ đề trùng nhiều câu. Hãy bổ sung thêm câu hỏi."
              : data.overlapPct >= 50
                ? "Pool trung bình — nên thêm câu hỏi để tăng tính bảo mật."
                : "Pool tốt — đủ đa dạng để giảm thiểu trùng lặp."}
          </p>
        </CardContent>
      </Card>

      {data.leastUsedQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Câu hỏi ít được sử dụng nhất
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID câu hỏi</TableHead>
                  <TableHead className="text-right">Số lần xuất hiện</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.leastUsedQuestions.map((q) => (
                  <TableRow key={q.questionId}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {q.questionId}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{q.usedCount}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        Chế độ chọn câu hỏi:{" "}
        <Badge variant="outline" className="text-xs">
          {data.selectionMode}
        </Badge>
      </div>
    </div>
  );
}
