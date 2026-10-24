// Shared between overlap.processor.ts and knowledge-graph.service.ts. Kept in
// their own file (rather than exported from overlap.processor.ts, as before) to
// avoid a circular import: knowledge-graph.service.ts needs these, and
// overlap.processor.ts needs KnowledgeGraphService from knowledge-graph.service.ts.
export const OVERLAP_QUEUE = 'knowledge-graph-overlap';

export interface OverlapJobData {
  certId: string;
}
