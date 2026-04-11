import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useOrgStore } from '@/stores/org.store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, FileText, Search, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/services/api';

interface AuditEvent {
  id: string;
  action: string;
  actorId: string;
  actorName: string | null;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface PaginatedAuditEvents {
  data: AuditEvent[];
  meta: { total: number; page: number; limit: number; lastPage: number };
}

const getAuditLog = async (
  slug: string,
  page: number,
  search?: string,
): Promise<PaginatedAuditEvents> => {
  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (search) params.append('search', search);
  const res = await api.get<PaginatedAuditEvents>(
    `/organizations/${slug}/audit-log?${params.toString()}`,
  );
  return res.data;
};

const actionColors: Record<string, string> = {
  MEMBER_INVITED: 'bg-blue-500/15 text-blue-400',
  MEMBER_JOINED: 'bg-emerald-500/15 text-emerald-400',
  MEMBER_REMOVED: 'bg-red-500/15 text-red-400',
  MEMBER_ROLE_CHANGED: 'bg-amber-500/15 text-amber-400',
  QUESTION_APPROVED: 'bg-emerald-500/15 text-emerald-400',
  QUESTION_REJECTED: 'bg-red-500/15 text-red-400',
  ASSESSMENT_CREATED: 'bg-violet-500/15 text-violet-400',
  ASSESSMENT_ACTIVATED: 'bg-emerald-500/15 text-emerald-400',
  CATALOG_ITEM_CREATED: 'bg-primary/15 text-primary',
};

const formatAction = (action: string): string =>
  action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const OrgAuditLog = () => {
  const navigate = useNavigate();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug || '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['org-audit-log', slug, page, search],
    queryFn: () => getAuditLog(slug, page, search || undefined),
    enabled: !!slug,
    retry: false,
  });

  const events = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${slug}/settings`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Settings
        </Button>
        <div>
          <h1 className="text-2xl font-mono font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Audit Log
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Activity history for {currentOrg?.name}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search actions or actors..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-10 bg-muted border-border"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-mono text-muted-foreground">
              Audit log is not available yet.
            </p>
            <p className="text-xs text-muted-foreground/70 font-mono mt-1">
              This feature requires backend support for the audit-log endpoint.
            </p>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-mono text-muted-foreground">No audit events found</p>
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="divide-y divide-border">
            {events.map((event) => (
              <div key={event.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                <div className="shrink-0 mt-0.5">
                  <Badge className={`text-[10px] whitespace-nowrap ${actionColors[event.action] ?? 'bg-muted text-muted-foreground'}`}>
                    {formatAction(event.action)}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-medium">
                      {event.actorName || event.actorId}
                    </span>
                    {event.targetType && event.targetId && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        → {event.targetType} #{event.targetId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                      {Object.entries(event.metadata)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono text-muted-foreground">{page} / {meta.lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.lastPage} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default OrgAuditLog;
