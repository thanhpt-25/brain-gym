import { useLocation, useNavigate } from 'react-router-dom';
import { useOrgStore } from '@/stores/org.store';
import {
  LayoutDashboard, Users, Settings, Shield, BookOpen,
  GraduationCap, Library, BookMarked,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrgRole } from '@/types/org-types';

const canManage = (role: OrgRole | undefined) =>
  role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';

const OrgSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const slug = currentOrg?.slug;
  const role = currentOrg?.myRole;

  if (!slug) return null;

  const links = [
    { label: 'Dashboard', href: `/org/${slug}`, icon: LayoutDashboard, exact: true },
    { label: 'Members', href: `/org/${slug}/members`, icon: Users },
    { label: 'Groups', href: `/org/${slug}/groups`, icon: Shield },
    { label: 'Questions', href: `/org/${slug}/questions`, icon: BookOpen },
    { label: 'Exam Catalog', href: `/org/${slug}/catalog`, icon: GraduationCap },
    { label: 'Manage Catalog', href: `/org/${slug}/catalog/manage`, icon: Library, roles: ['OWNER', 'ADMIN', 'MANAGER'] as OrgRole[] },
    { label: 'Tracks', href: `/org/${slug}/tracks`, icon: BookMarked, roles: ['OWNER', 'ADMIN', 'MANAGER'] as OrgRole[] },
    { label: 'Settings', href: `/org/${slug}/settings`, icon: Settings, roles: ['OWNER', 'ADMIN'] as OrgRole[] },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? location.pathname === href : location.pathname.startsWith(href);

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border py-4 pr-4 space-y-1">
      {links
        .filter((link) => !link.roles || (role && link.roles.includes(role)))
        .map((link) => (
          <Button
            key={link.href}
            variant="ghost"
            size="sm"
            className={`justify-start gap-2 font-mono text-xs ${
              isActive(link.href, link.exact)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
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
