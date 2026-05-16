import { OrgMember } from "../../types/org-types";
import "./squad-dashboard.css";

interface SquadMemberCardProps {
  member: OrgMember;
  isInactive: boolean;
  targetExamDate?: string;
}

/**
 * Displays a single squad member card with avatar, name, email, and role
 * Shows inactive badge for members with no activity for 7+ days
 */
export function SquadMemberCard({
  member,
  isInactive,
  targetExamDate,
}: SquadMemberCardProps) {
  const getInitials = (displayName?: string): string => {
    if (!displayName) return "?";
    return displayName
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join("");
  };

  const avatarSrc =
    member.user?.avatarUrl ||
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect fill='%23ccc' width='48' height='48'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dominant-baseline='central' font-size='24' font-weight='bold' fill='%23666' font-family='system-ui'%3E${getInitials(member.user?.displayName)}%3C/text%3E%3C/svg%3E`;

  return (
    <div
      className={`member-card ${isInactive ? "inactive" : ""}`}
      data-testid="member-card"
    >
      {/* Avatar */}
      <img
        src={avatarSrc}
        alt={member.user?.displayName || "Member avatar"}
        className="member-avatar"
      />

      {/* Member info */}
      <div className="member-info">
        <h3 className="member-name">{member.user?.displayName || "Unknown"}</h3>
        <p className="member-email">{member.user?.email}</p>

        {/* Inactive badge */}
        {isInactive && (
          <div className="badge badge-warning" data-testid="inactive-badge">
            Inactive (7+ days)
          </div>
        )}
      </div>

      {/* Role badge */}
      <div
        className={`badge badge-${member.role === "OWNER" ? "primary" : "secondary"}`}
      >
        {member.role === "OWNER" ? "Owner" : "Member"}
      </div>
    </div>
  );
}
