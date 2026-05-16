import { OrgMember } from "../../types/org-types";
import { SquadMemberCard } from "./SquadMemberCard";
import "./squad-dashboard.css";

interface SquadMemberListProps {
  members: OrgMember[];
  targetExamDate?: string;
}

/**
 * Renders a list of squad members with inactive detection
 * Marks members inactive if joinedAt > 7 days from now
 */
export function SquadMemberList({
  members,
  targetExamDate,
}: SquadMemberListProps) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="member-list">
      {members.map((member) => (
        <SquadMemberCard
          key={member.id}
          member={member}
          isInactive={new Date(member.joinedAt) < sevenDaysAgo}
          targetExamDate={targetExamDate}
        />
      ))}
    </div>
  );
}
