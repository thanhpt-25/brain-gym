import api from "./api";

export interface GraphNode {
  certId: string;
  certCode: string;
  certName: string;
  domainId: string | null;
  domainName: string | null;
}

export interface GraphEdge {
  nodeA: GraphNode;
  nodeB: GraphNode;
  overlapPct: number;
  sharedTopics: string[];
}

export interface KnowledgeGraphDto {
  nodes: GraphNode[];
  edges: GraphEdge[];
  computedAt: string | null;
}

export interface NodeDrillDownDto {
  certId: string;
  domainId: string | null;
  skipTopics: string[];
  mustLearnTopics: string[];
}

export interface StudyPlanDto {
  id?: string;
  targetCertId: string;
  sourceCertIds: string[];
  skipTopics: string[];
  mustLearnTopics: string[];
  effortReductionPct: number;
  totalTopics: number;
  skippableCount: number;
  createdAt?: string;
}

export async function getKnowledgeGraph(
  certId: string,
): Promise<KnowledgeGraphDto> {
  const res = await api.get<KnowledgeGraphDto>("/knowledge-graph/overlap", {
    params: { certId },
  });
  return res.data;
}

export async function triggerOverlapCompute(
  certId: string,
): Promise<{ message: string; certId: string; jobId: string }> {
  const res = await api.post<{
    message: string;
    certId: string;
    jobId: string;
  }>(`/knowledge-graph/overlap/${certId}/compute`);
  return res.data;
}

export async function getDrillDown(
  certId: string,
  domainId?: string,
): Promise<NodeDrillDownDto> {
  const res = await api.get<NodeDrillDownDto>("/knowledge-graph/drill-down", {
    params: { certId, domainId },
  });
  return res.data;
}

export async function createStudyPlan(
  targetCertId: string,
): Promise<StudyPlanDto> {
  const res = await api.post<StudyPlanDto>(
    "/knowledge-graph/study-plan",
    null,
    {
      params: { targetCertId },
    },
  );
  return res.data;
}

export async function listStudyPlans(): Promise<StudyPlanDto[]> {
  const res = await api.get<StudyPlanDto[]>("/knowledge-graph/study-plans");
  return res.data;
}

export async function scheduleFromPlan(
  planId: string,
): Promise<{ scheduled: number; alreadyExisted: number }> {
  const res = await api.post<{
    scheduled: number;
    alreadyExisted: number;
  }>(`/knowledge-graph/study-plans/${planId}/schedule`);
  return res.data;
}
