import { useRef, useCallback } from "react";
import type { GraphNode, GraphEdge } from "../../services/knowledgeGraph";

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (certId: string, domainId: string | null) => void;
}

interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  certId: string;
  domainId: string | null;
  color: string;
}

const CERT_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function getCertColor(certId: string, certIds: string[]): string {
  const idx = certIds.indexOf(certId);
  return CERT_COLORS[idx % CERT_COLORS.length];
}

function buildLayout(nodes: GraphNode[]): LayoutNode[] {
  const certIds = [...new Set(nodes.map((n) => n.certId))];
  const W = 800;
  const H = 600;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.38;

  return nodes.map((node) => {
    const certIdx = certIds.indexOf(node.certId);
    const nodesInCert = nodes.filter((n) => n.certId === node.certId);
    const totalInCert = nodesInCert.length;
    const idxInCert = nodesInCert.indexOf(node);

    const sectorAngle = (2 * Math.PI) / certIds.length;
    const baseAngle = certIdx * sectorAngle - Math.PI / 2;
    const spreadAngle =
      totalInCert > 1
        ? sectorAngle * 0.6 * (idxInCert / (totalInCert - 1) - 0.5)
        : 0;
    const angle = baseAngle + spreadAngle;
    const r = totalInCert === 1 ? R : R * 0.85;

    return {
      id: `${node.certId}:${node.domainId ?? ""}`,
      label: node.domainName ?? node.certCode,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      certId: node.certId,
      domainId: node.domainId,
      color: getCertColor(node.certId, certIds),
    };
  });
}

/**
 * SVG graph canvas for the cross-cert knowledge graph.
 * Nodes = cert/domain pairs; edges = cosine overlap between domain pairs.
 * Edge opacity and width encode overlap percentage.
 */
export function GraphCanvas({ nodes, edges, onNodeClick }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const layout = buildLayout(nodes);
  const nodeMap = new Map(layout.map((n) => [n.id, n]));

  const handleNodeClick = useCallback(
    (n: LayoutNode) => {
      onNodeClick(n.certId, n.domainId);
    },
    [onNodeClick],
  );

  if (nodes.length === 0) {
    return (
      <div className="kg-canvas-empty">
        <p>No overlap data yet. Click ↺ to compute overlaps.</p>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 800 600"
      className="kg-canvas"
      aria-label="Knowledge graph showing certification domain overlaps"
      role="img"
    >
      <g className="kg-edges">
        {edges.map((edge, i) => {
          const keyA = `${edge.nodeA.certId}:${edge.nodeA.domainId ?? ""}`;
          const keyB = `${edge.nodeB.certId}:${edge.nodeB.domainId ?? ""}`;
          const nA = nodeMap.get(keyA);
          const nB = nodeMap.get(keyB);
          if (!nA || !nB) return null;

          const opacity = 0.2 + edge.overlapPct * 0.7;
          const strokeWidth = 1 + edge.overlapPct * 4;

          return (
            <line
              key={i}
              x1={nA.x}
              y1={nA.y}
              x2={nB.x}
              y2={nB.y}
              stroke="#94a3b8"
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeLinecap="round"
            >
              <title>
                {edge.nodeA.domainName ?? edge.nodeA.certCode} ↔{" "}
                {edge.nodeB.domainName ?? edge.nodeB.certCode}:{" "}
                {Math.round(edge.overlapPct * 100)}% overlap
                {edge.sharedTopics.length > 0
                  ? ` (${edge.sharedTopics.slice(0, 3).join(", ")})`
                  : ""}
              </title>
            </line>
          );
        })}
      </g>

      <g className="kg-nodes">
        {layout.map((n) => (
          <g
            key={n.id}
            className="kg-node"
            transform={`translate(${n.x},${n.y})`}
            onClick={() => handleNodeClick(n)}
            role="button"
            aria-label={`${n.label} — click to drill down`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleNodeClick(n);
            }}
          >
            <circle r={22} fill={n.color} opacity={0.9} />
            <text
              textAnchor="middle"
              dy="0.35em"
              fontSize={9}
              fill="white"
              fontWeight="600"
            >
              {n.label.length > 10 ? n.label.slice(0, 9) + "…" : n.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
