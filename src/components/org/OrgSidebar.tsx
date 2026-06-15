import { useLocation, useNavigate } from "react-router-dom";
import { useOrgStore } from "@/stores/org.store";
import {
  LayoutDashboard,
  Users,
  Settings,
  Shield,
  BookOpen,
  GraduationCap,
  Library,
  BookMarked,
  ClipboardList,
  BarChart3,
  Briefcase,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgRole } from "@/types/org-types";

const OrgSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug;
  const role = currentOrg?.myRole;

  if (!slug) return null;

  // RECRUITER: only assessments + job-roles visible; no question bank / settings / catalog
  const links = [
    {
      label: "Dashboard",
      href: `/org/${slug}`,
      icon: LayoutDashboard,
      exact: true,
      hidden: role === "RECRUITER",
    },
    {
      label: "Members",
      href: `/org/${slug}/members`,
      icon: Users,
      hidden: role === "RECRUITER",
    },
    {
      label: "Groups",
      href: `/org/${slug}/groups`,
      icon: Shield,
      hidden: role === "RECRUITER",
    },
    {
      label: "Questions",
      href: `/org/${slug}/questions`,
      icon: BookOpen,
      hidden: role === "RECRUITER",
    },
    {
      label: "Exam Catalog",
      href: `/org/${slug}/catalog`,
      icon: GraduationCap,
      hidden: role === "RECRUITER",
    },
    {
      label: "Manage Catalog",
      href: `/org/${slug}/catalog/manage`,
      icon: Library,
      roles: ["OWNER", "ADMIN", "MANAGER"] as OrgRole[],
      hidden: role === "RECRUITER",
    },
    {
      label: "Tracks",
      href: `/org/${slug}/tracks`,
      icon: BookMarked,
      roles: ["OWNER", "ADMIN", "MANAGER"] as OrgRole[],
      hidden: role === "RECRUITER",
    },
    // P1: Recruiting — visible to OWNER/ADMIN/MANAGER/RECRUITER
    {
      label: "Assessments",
      href: `/org/${slug}/assessments`,
      icon: ClipboardList,
      roles: ["OWNER", "ADMIN", "MANAGER", "RECRUITER"] as OrgRole[],
    },
    {
      label: "Job Roles",
      href: `/org/${slug}/job-roles`,
      icon: Briefcase,
      roles: ["OWNER", "ADMIN", "MANAGER", "RECRUITER"] as OrgRole[],
    },
    {
      label: "Competencies",
      href: `/org/${slug}/competencies`,
      icon: Award,
      roles: ["OWNER", "ADMIN", "MANAGER"] as OrgRole[],
    },
    {
      label: "Analytics",
      href: `/org/${slug}/analytics`,
      icon: BarChart3,
      roles: ["OWNER", "ADMIN", "MANAGER"] as OrgRole[],
    },
    {
      label: "Settings",
      href: `/org/${slug}/settings`,
      icon: Settings,
      roles: ["OWNER", "ADMIN"] as OrgRole[],
    },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? location.pathname === href : location.pathname.startsWith(href);

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border py-4 pr-4 space-y-1">
      {/* Org identity */}
      <div className="flex items-center gap-2 px-2 pb-3 mb-1 border-b border-border">
        {currentOrg?.logoUrl ? (
          <img
            src={currentOrg.logoUrl}
            alt={currentOrg.name}
            className="h-7 w-7 rounded-lg object-cover shrink-0 border border-border"
          />
        ) : (
          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-mono font-bold text-primary">
              {currentOrg?.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-xs font-mono font-medium truncate">
          {currentOrg?.name}
        </span>
      </div>
      {links
        .filter((link) => !link.hidden)
        .filter((link) => !link.roles || (role && link.roles.includes(role)))
        .map((link) => (
          <Button
            key={link.href}
            variant="ghost"
            size="sm"
            className={`justify-start gap-2 font-mono text-xs ${
              isActive(link.href, link.exact)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => navigate(link.href)}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Button>
        ))}
    </aside>
  );
};

export default OrgSidebar;
