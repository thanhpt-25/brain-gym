import { Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import type { NodeDrillDownDto } from "../../services/knowledgeGraph";

interface NodeDrillDownProps {
  data: NodeDrillDownDto | undefined;
  isLoading: boolean;
  onClose: () => void;
}

/**
 * Slide-in panel showing skip vs must-learn topics for a selected graph node.
 */
export function NodeDrillDown({
  data,
  isLoading,
  onClose,
}: NodeDrillDownProps) {
  return (
    <aside className="kg-drill-down" aria-label="Domain drill-down">
      <div className="kg-drill-down-header">
        <h2 className="kg-drill-down-title">Domain Detail</h2>
        <button
          className="kg-drill-down-close"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <X size={18} />
        </button>
      </div>

      {isLoading && (
        <div className="kg-drill-down-loading">
          <Loader2 className="kg-spinner" size={20} />
          <span>Loading…</span>
        </div>
      )}

      {!isLoading && data && (
        <div className="kg-drill-down-body">
          {data.skipTopics.length > 0 && (
            <section className="kg-drill-section kg-drill-section--skip">
              <h3 className="kg-drill-section-title">
                <CheckCircle2 size={15} />
                Can Skim ({data.skipTopics.length})
              </h3>
              <ul className="kg-drill-list">
                {data.skipTopics.map((t) => (
                  <li key={t} className="kg-drill-item kg-drill-item--skip">
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.mustLearnTopics.length > 0 && (
            <section className="kg-drill-section kg-drill-section--must">
              <h3 className="kg-drill-section-title">
                <AlertCircle size={15} />
                Must Learn ({data.mustLearnTopics.length})
              </h3>
              <ul className="kg-drill-list">
                {data.mustLearnTopics.map((t) => (
                  <li key={t} className="kg-drill-item kg-drill-item--must">
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.skipTopics.length === 0 &&
            data.mustLearnTopics.length === 0 && (
              <p className="kg-drill-empty">
                No overlap data available for this domain yet.
              </p>
            )}
        </div>
      )}
    </aside>
  );
}
