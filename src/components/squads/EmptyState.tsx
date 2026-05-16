import { ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
}

/**
 * Reusable empty state component for squads
 * Displays when there are no members or data to show
 */
export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-message">{message}</p>
    </div>
  );
}
