import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrgStore } from "@/stores/org.store";
import {
  getComplianceDashboard,
  type ComplianceRow,
  type CertStatus,
} from "@/services/competency-cert";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  EXPIRING_SOON: "bg-amber-500/15 text-amber-400",
  EXPIRED: "bg-rose-500/15 text-rose-400",
  NOT_CERTIFIED: "bg-zinc-500/15 text-zinc-400",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Hoạt động",
  EXPIRING_SOON: "Sắp hết hạn",
  EXPIRED: "Hết hạn",
  NOT_CERTIFIED: "Chưa cấp",
};

export default function OrgComplianceDashboard() {
  const { org } = useOrgStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["compliance", org?.id, statusFilter],
    queryFn: () =>
      getComplianceDashboard(org!.id, {
        status: statusFilter === "ALL" ? undefined : statusFilter,
      }),
    enabled: !!org,
  });

  const rows: ComplianceRow[] = (data?.rows ?? []).filter(
    (r) =>
      search === "" ||
      r.memberName.toLowerCase().includes(search.toLowerCase()) ||
      r.competencyName.toLowerCase().includes(search.toLowerCase()),
  );

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tuân thủ chứng nhận</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Theo dõi trạng thái chứng nhận năng lực của tất cả thành viên
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Đã chứng nhận
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {s?.certified ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              / {s?.totalMembers ?? "—"} thành viên
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Sắp hết hạn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {s?.expiringSoon ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">trong 30 ngày</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-400" />
              Hết hạn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">
              {s?.expired ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chưa cấp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-400">
              {s?.notCertified ?? "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Tìm kiếm thành viên / năng lực..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả</SelectItem>
            <SelectItem value="ACTIVE">Hoạt động</SelectItem>
            <SelectItem value="EXPIRING_SOON">Sắp hết hạn</SelectItem>
            <SelectItem value="EXPIRED">Hết hạn</SelectItem>
            <SelectItem value="NOT_CERTIFIED">Chưa cấp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Năng lực</TableHead>
                  <TableHead>Cấp độ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Hết hạn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      Không có dữ liệu
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, i) => (
                    <TableRow key={`${row.memberId}-${row.competencyId}-${i}`}>
                      <TableCell className="font-medium">
                        {row.memberName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.groupName ?? "—"}
                      </TableCell>
                      <TableCell>{row.competencyName}</TableCell>
                      <TableCell>
                        {row.achievedLevel != null ? (
                          <span>
                            {row.achievedLevel} / {row.requiredLevel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            — / {row.requiredLevel}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_COLOR[row.certStatus] ??
                            STATUS_COLOR.NOT_CERTIFIED
                          }
                        >
                          {STATUS_LABEL[row.certStatus] ?? row.certStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.expiresAt
                          ? format(new Date(row.expiresAt), "dd/MM/yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
