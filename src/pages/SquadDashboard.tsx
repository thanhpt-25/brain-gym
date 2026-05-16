import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getSquadBySlug,
  getSquadMembers,
  getSquadReadiness,
} from "../services/squads";
import { SquadMemberList } from "../components/squads/SquadMemberList";
import { ReadinessCard } from "../components/squads/ReadinessCard";
import { EmptyState } from "../components/squads/EmptyState";
import { Loader2 } from "lucide-react";
import PageTransition from "../components/PageTransition";
import "../components/squads/squad-dashboard.css";

/**
 * Squad Dashboard — displays squad readiness and member roster
 * Route: /squads/:slug
 *
 * Features:
 * - Fetches squad data by slug
 * - Displays squad readiness score (composite across all members)
 * - Shows member list with inactive detection (7+ days)
 * - Empty state when no members exist
 */
export default function SquadDashboard() {
  const { slug } = useParams<{ slug: string }>();

  // Fetch squad by slug
  const squad = useQuery({
    queryKey: ["squad", slug],
    queryFn: () => getSquadBySlug(slug!),
    enabled: !!slug,
  });

  // Fetch squad members (only when squad data is available)
  const members = useQuery({
    queryKey: ["squad-members", squad.data?.id],
    queryFn: () => getSquadMembers(squad.data!.id),
    enabled: !!squad.data?.id,
  });

  // Fetch squad readiness (only when certification is available)
  const readiness = useQuery({
    queryKey: ["squad-readiness", squad.data?.certificationId],
    queryFn: () => getSquadReadiness(squad.data!.certificationId),
    enabled: !!squad.data?.certificationId,
  });

  // Loading state
  if (squad.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (squad.isError) {
    return (
      <PageTransition>
        <div className="squad-dashboard error-state">
          <div className="error-container">
            <h1>Something went wrong</h1>
            <p>Failed to load squad. Please try again later.</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  // Not found
  if (!squad.data) {
    return (
      <PageTransition>
        <div className="squad-dashboard not-found-state">
          <div className="error-container">
            <h1>Squad not found</h1>
            <p>The squad you're looking for doesn't exist.</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  // Success state
  return (
    <PageTransition>
      <div className="squad-dashboard">
        {/* Header */}
        <header className="squad-header">
          <h1>{squad.data.name}</h1>
          <p className="text-sm text-muted">
            {squad.data.memberCount} member
            {squad.data.memberCount !== 1 ? "s" : ""}
          </p>
        </header>

        {/* Content Grid */}
        <div className="squad-grid">
          {/* Readiness Card */}
          <ReadinessCard
            score={readiness.data?.readinessScore ?? 0}
            isLoading={readiness.isLoading}
            certificationId={squad.data.certificationId}
          />

          {/* Member List Section */}
          <section className="squad-members">
            <h2>Members</h2>
            {members.data && members.data.length > 0 ? (
              <SquadMemberList
                members={members.data}
                targetExamDate={squad.data.targetExamDate}
              />
            ) : (
              <EmptyState message="Invite members to see their readiness." />
            )}
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
