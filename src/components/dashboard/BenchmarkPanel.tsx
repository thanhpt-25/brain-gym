import { useQuery } from "@tanstack/react-query";
import { BarChart2, Loader2, Lock, TrendingUp } from "lucide-react";
import api from "../../services/api";

interface DomainBreakdownEntry {
  domainId: string;
  domainName: string;
  userAccuracy: number | null;
  cohortAccuracy: number | null;
}

interface BenchmarkDto {
  userId: string;
  certificationId: string;
  userScore: number;
  percentile: number | null;
  cohortSize: number | null;
  top10PctScore: number | null;
  averageScore: number | null;
  domainBreakdown: DomainBreakdownEntry[];
  hiddenReason?: string;
}

async function fetchBenchmark(certificationId: string): Promise<BenchmarkDto> {
  const res = await api.get<BenchmarkDto>("/analytics/benchmark", {
    params: { certificationId },
  });
  return res.data;
}

interface Props {
  certificationId: string;
  certificationName?: string;
}

export function BenchmarkPanel({ certificationId, certificationName }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["benchmark", certificationId],
    queryFn: () => fetchBenchmark(certificationId),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="bench-panel bench-panel--loading" aria-busy="true">
        <Loader2 size={18} className="bench-spin" />
        <span>Loading benchmark…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bench-panel bench-panel--error" role="alert">
        Failed to load benchmark data.
      </div>
    );
  }

  const isHidden = data.percentile === null;

  return (
    <section className="bench-panel" aria-label="Benchmark comparison">
      <h3 className="bench-title">
        <BarChart2 size={16} />
        Passers Benchmark
        {certificationName && (
          <span className="bench-cert-name"> — {certificationName}</span>
        )}
      </h3>

      <div className="bench-score-row">
        <div className="bench-stat">
          <span className="bench-stat-label">Your score</span>
          <span className="bench-stat-value">{data.userScore}%</span>
        </div>

        {isHidden ? (
          <div className="bench-hidden" role="note">
            <Lock size={14} />
            <span>{data.hiddenReason}</span>
          </div>
        ) : (
          <>
            <div className="bench-stat">
              <span className="bench-stat-label">Percentile</span>
              <span className="bench-stat-value bench-stat-value--accent">
                {data.percentile}th
              </span>
            </div>
            <div className="bench-stat">
              <span className="bench-stat-label">Cohort avg</span>
              <span className="bench-stat-value">{data.averageScore}%</span>
            </div>
            <div className="bench-stat">
              <span className="bench-stat-label">Top 10%</span>
              <span className="bench-stat-value">{data.top10PctScore}%</span>
            </div>
            <div className="bench-stat bench-stat--small">
              <span className="bench-stat-label">Cohort size</span>
              <span className="bench-stat-value">{data.cohortSize}</span>
            </div>
          </>
        )}
      </div>

      {!isHidden && data.domainBreakdown.length > 0 && (
        <div className="bench-domains">
          <h4 className="bench-domains-title">
            <TrendingUp size={14} />
            Domain breakdown
          </h4>
          <ul className="bench-domain-list">
            {data.domainBreakdown.map((d) => (
              <li key={d.domainId} className="bench-domain-item">
                <span className="bench-domain-name">{d.domainName}</span>
                <div className="bench-domain-bars">
                  <DomainBar
                    label="You"
                    value={d.userAccuracy}
                    className="bench-bar--user"
                  />
                  <DomainBar
                    label="Cohort"
                    value={d.cohortAccuracy}
                    className="bench-bar--cohort"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DomainBar({
  label,
  value,
  className,
}: {
  label: string;
  value: number | null;
  className: string;
}) {
  if (value === null) {
    return (
      <div className="bench-bar-row">
        <span className="bench-bar-label">{label}</span>
        <span className="bench-bar-hidden">
          <Lock size={11} /> hidden
        </span>
      </div>
    );
  }

  return (
    <div className="bench-bar-row" aria-label={`${label}: ${value}%`}>
      <span className="bench-bar-label">{label}</span>
      <div
        className="bench-bar-track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`bench-bar-fill ${className}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="bench-bar-pct">{value}%</span>
    </div>
  );
}
