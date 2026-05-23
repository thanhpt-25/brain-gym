import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getKnowledgeGraph,
  getDrillDown,
  triggerOverlapCompute,
} from "../services/knowledgeGraph";
import { GraphCanvas } from "../components/knowledge-graph/GraphCanvas";
import { NodeDrillDown } from "../components/knowledge-graph/NodeDrillDown";
import { StudyPlanPanel } from "../components/knowledge-graph/StudyPlan";
import PageTransition from "../components/PageTransition";
import { Loader2, RefreshCw, BookOpen, BarChart2 } from "lucide-react";
import "./KnowledgeGraph.css";

export default function KnowledgeGraph() {
  const [searchParams] = useSearchParams();
  const certId = searchParams.get("certId") ?? "";

  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"graph" | "study-plan">("graph");

  const graph = useQuery({
    queryKey: ["knowledge-graph", certId],
    queryFn: () => getKnowledgeGraph(certId),
    enabled: !!certId,
  });

  const drillDown = useQuery({
    queryKey: ["kg-drill-down", selectedCertId, selectedDomainId],
    queryFn: () => getDrillDown(selectedCertId!, selectedDomainId ?? undefined),
    enabled: !!selectedCertId,
  });

  const recompute = useMutation({
    mutationFn: () => triggerOverlapCompute(certId),
  });

  if (!certId) {
    return (
      <PageTransition>
        <div className="kg-empty">
          <p>Select a certification to explore its knowledge graph.</p>
        </div>
      </PageTransition>
    );
  }

  if (graph.isLoading) {
    return (
      <PageTransition>
        <div className="kg-loading">
          <Loader2 className="kg-spinner" />
          <span>Loading knowledge graph…</span>
        </div>
      </PageTransition>
    );
  }

  const data = graph.data;

  return (
    <PageTransition>
      <div className="kg-page">
        <header className="kg-header">
          <h1 className="kg-title">Cross-Cert Knowledge Graph</h1>
          {data?.computedAt && (
            <span className="kg-computed-at">
              Last computed: {new Date(data.computedAt).toLocaleDateString()}
            </span>
          )}
          <button
            className="kg-recompute-btn"
            onClick={() => recompute.mutate()}
            disabled={recompute.isPending}
            title="Recompute overlaps"
          >
            <RefreshCw
              size={16}
              className={recompute.isPending ? "kg-spin" : ""}
            />
          </button>
        </header>

        <nav className="kg-tabs">
          <button
            className={`kg-tab ${activeTab === "graph" ? "kg-tab--active" : ""}`}
            onClick={() => setActiveTab("graph")}
          >
            <BarChart2 size={16} />
            Graph View
          </button>
          <button
            className={`kg-tab ${activeTab === "study-plan" ? "kg-tab--active" : ""}`}
            onClick={() => setActiveTab("study-plan")}
          >
            <BookOpen size={16} />
            Study Plan
          </button>
        </nav>

        {activeTab === "graph" && data && (
          <div className="kg-graph-layout">
            <GraphCanvas
              nodes={data.nodes}
              edges={data.edges}
              onNodeClick={(certId, domainId) => {
                setSelectedCertId(certId);
                setSelectedDomainId(domainId);
              }}
            />
            {selectedCertId && (
              <NodeDrillDown
                data={drillDown.data}
                isLoading={drillDown.isLoading}
                onClose={() => {
                  setSelectedCertId(null);
                  setSelectedDomainId(null);
                }}
              />
            )}
          </div>
        )}

        {activeTab === "study-plan" && (
          <div className="kg-study-plan">
            <StudyPlanPanel targetCertId={certId} />
          </div>
        )}
      </div>
    </PageTransition>
  );
}
