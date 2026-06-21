import { useQuery } from "@tanstack/react-query";
import { useOrgStore } from "@/stores/org.store";
import {
  getExecutiveDashboard,
  getExecutiveDashboardCsvUrl,
} from "@/services/executive-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck,
  Users,
  TrendingUp,
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color = "text-foreground",
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function OrgExecutiveDashboard() {
  const currentOrg = useOrgStore((s) => s.currentOrg);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["executive-dashboard", currentOrg?.id],
    queryFn: () => getExecutiveDashboard(currentOrg!.id),
    enabled: !!currentOrg,
    staleTime: 5 * 60 * 1000,
  });

  const handleExport = () => {
    if (!currentOrg) return;
    const url = getExecutiveDashboardCsvUrl(currentOrg.id);
    const a = document.createElement("a");
    a.href = url;
    a.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tổng quan tuân thủ, tuyển dụng và toàn vẹn
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Xuất CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? null : (
        <>
          {/* Compliance */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Tuân thủ chứng nhận
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Tỷ lệ chứng nhận"
                value={`${data.compliance.certRate}%`}
                sub={`${data.compliance.certifiedMembers} / ${data.compliance.totalMembers} thành viên`}
                icon={ShieldCheck}
                color="text-emerald-400"
              />
              <StatCard
                title="Chứng nhận hoạt động"
                value={data.compliance.certsByStatus.active}
                icon={ShieldCheck}
                color="text-emerald-400"
              />
              <StatCard
                title="Sắp hết hạn"
                value={data.compliance.certsByStatus.expiringSoon}
                sub="trong 30 ngày"
                icon={AlertTriangle}
                color="text-amber-400"
              />
              <StatCard
                title="Đã hết hạn"
                value={data.compliance.certsByStatus.expired}
                icon={AlertTriangle}
                color="text-rose-400"
              />
            </div>
            <Card>
              <CardContent className="pt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    Tỷ lệ tuân thủ tổng
                  </span>
                  <span className="font-medium">
                    {data.compliance.certRate}%
                  </span>
                </div>
                <Progress value={data.compliance.certRate} className="h-2" />
              </CardContent>
            </Card>
          </section>

          {/* Hiring Funnel */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Phễu tuyển dụng
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Ứng viên mời"
                value={data.funnel.totalCandidates}
                icon={Users}
                color="text-blue-400"
              />
              <StatCard
                title="Đã nộp bài"
                value={data.funnel.submitted}
                sub={`Tỷ lệ hoàn thành: ${data.funnel.conversionRate}%`}
                icon={TrendingUp}
                color="text-blue-400"
              />
              <StatCard
                title="Đạt yêu cầu"
                value={data.funnel.passed}
                sub={`Pass rate: ${data.funnel.passRate}%`}
                icon={TrendingUp}
                color="text-emerald-400"
              />
              <StatCard
                title="Campaign đang mở"
                value={data.funnel.activeCampaigns}
                sub={`/ ${data.funnel.campaigns} tổng`}
                icon={Users}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      Tỷ lệ hoàn thành
                    </span>
                    <span>{data.funnel.conversionRate}%</span>
                  </div>
                  <Progress
                    value={data.funnel.conversionRate}
                    className="h-2"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Tỷ lệ đậu</span>
                    <span>{data.funnel.passRate}%</span>
                  </div>
                  <Progress value={data.funnel.passRate} className="h-2" />
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Integrity */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              Toàn vẹn thi cử
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                title="Ứng viên bị gắn cờ"
                value={data.integrity.flaggedCount}
                sub={`${data.integrity.flagRate}% tổng nộp`}
                icon={AlertTriangle}
                color="text-rose-400"
              />
              <StatCard
                title="Điểm toàn vẹn TB"
                value={
                  data.integrity.avgIntegrityScore != null
                    ? data.integrity.avgIntegrityScore
                    : "—"
                }
                sub="/ 100"
                icon={ShieldCheck}
                color={
                  (data.integrity.avgIntegrityScore ?? 100) >= 80
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              />
              <StatCard
                title="Tổng nộp bài"
                value={data.integrity.totalSubmitted}
                icon={Users}
              />
            </div>
            {data.integrity.avgIntegrityScore != null && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      Điểm toàn vẹn trung bình
                    </span>
                    <span>{data.integrity.avgIntegrityScore} / 100</span>
                  </div>
                  <Progress
                    value={data.integrity.avgIntegrityScore}
                    className="h-2"
                  />
                </CardContent>
              </Card>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            Cập nhật lúc: {new Date(data.generatedAt).toLocaleString("vi-VN")} ·
            Cache 5 phút
          </p>
        </>
      )}
    </div>
  );
}
