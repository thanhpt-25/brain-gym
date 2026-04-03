import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrganizationWithRole, OrgRole } from '@/types/org-types';

interface OrgState {
  currentOrg: OrganizationWithRole | null;
  myOrgs: OrganizationWithRole[];

  setCurrentOrg: (org: OrganizationWithRole) => void;
  setMyOrgs: (orgs: OrganizationWithRole[]) => void;
  clearOrg: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrg: null,
      myOrgs: [],

      setCurrentOrg: (org) => set({ currentOrg: org }),
      setMyOrgs: (orgs) => set({ myOrgs: orgs }),
      clearOrg: () => set({ currentOrg: null, myOrgs: [] }),
    }),
    {
      name: 'org-storage',
      partialize: (state) => ({
        currentOrg: state.currentOrg,
      }),
    },
  ),
);
