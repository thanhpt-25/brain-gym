import { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import OrgSidebar from './OrgSidebar';
import { getOrg, getMyOrgs } from '@/services/organizations';
import { useOrgStore } from '@/stores/org.store';
import type { OrganizationWithRole } from '@/types/org-types';

const OrgLayout = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { setCurrentOrg, setMyOrgs } = useOrgStore();

  const { data: myOrgs } = useQuery({
    queryKey: ['my-orgs'],
    queryFn: getMyOrgs,
    staleTime: 60_000,
  });

  const { data: org, isLoading, error } = useQuery({
    queryKey: ['org', slug],
    queryFn: () => getOrg(slug!),
    enabled: !!slug,
  });

  useEffect(() => {
    if (myOrgs) setMyOrgs(myOrgs);
  }, [myOrgs, setMyOrgs]);

  useEffect(() => {
    if (org && myOrgs) {
      const membership = myOrgs.find((o) => o.id === org.id);
      if (membership) {
        setCurrentOrg(membership);
      }
    }
  }, [org, myOrgs, setCurrentOrg]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Organization" />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Organization" />
        <div className="flex flex-col items-center justify-center pt-32 gap-3">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm font-mono text-muted-foreground">Organization not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar title={org.name} />
      <div className="container pt-20 flex gap-6">
        <OrgSidebar />
        <main className="flex-1 min-w-0 py-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default OrgLayout;
