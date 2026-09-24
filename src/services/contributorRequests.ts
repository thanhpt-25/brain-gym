import api from "./api";
import { useAuthStore } from "@/stores/auth.store";
import { getMyProfile } from "./user";

export type ContributorRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type EligibilityCheckKey =
  | "ROLE"
  | "ACCOUNT_STATUS"
  | "NO_PENDING_REQUEST"
  | "COOLDOWN"
  | "ACCOUNT_AGE"
  | "COMPLETED_ATTEMPTS";

export interface EligibilityCheck {
  key: EligibilityCheckKey;
  passed: boolean;
  current?: number;
  required?: number;
}

export interface Eligibility {
  eligible: boolean;
  checks: EligibilityCheck[];
  retryAfter?: string;
}

export interface ContributorRequest {
  id: string;
  status: ContributorRequestStatus;
  motivation: string;
  expertise: string[];
  sampleUrl?: string | null;
  decisionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  retryAfter?: string | null;
}

export interface MyContributorRequest {
  request: ContributorRequest | null;
  history: ContributorRequest[];
}

export interface CreateContributorRequestInput {
  motivation: string;
  expertise?: string[];
  sampleUrl?: string;
}

export const getContributorEligibility = async (): Promise<Eligibility> => {
  const res = await api.get("/contributor-requests/me/eligibility");
  return res.data;
};

export const getMyContributorRequest =
  async (): Promise<MyContributorRequest> => {
    const res = await api.get("/contributor-requests/me");
    return res.data;
  };

export const createContributorRequest = async (
  data: CreateContributorRequestInput,
): Promise<ContributorRequest> => {
  const res = await api.post("/contributor-requests", data);
  return res.data;
};

export const cancelContributorRequest = async () => {
  const res = await api.delete("/contributor-requests/me");
  return res.data;
};

/**
 * The backend authorises against the DB role on every request, so after an
 * approval only the persisted auth store is stale. Pull the fresh profile and
 * patch the user in place (tokens untouched).
 */
export const syncRoleFromServer = async () => {
  const profile = await getMyProfile();
  const { user } = useAuthStore.getState();
  if (user && profile?.role && profile.role !== user.role) {
    useAuthStore.setState({ user: { ...user, role: profile.role } });
  }
  return profile;
};

// ==================== Admin ====================

export interface AdminContributorRequest extends ContributorRequest {
  userId: string;
  reviewedBy?: { id: string; displayName: string } | null;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
    createdAt: string;
    status: string;
    role: string;
    points: number;
  };
  expertiseCertifications: { id: string; name: string; code: string }[];
  stats: {
    completedAttempts: number;
    avgScore: number | null;
    commentsCount: number;
    reportsFiled: number;
    previousRequests: { rejected: number; cancelled: number };
  };
  history?: Pick<
    ContributorRequest,
    "id" | "status" | "createdAt" | "reviewedAt" | "decisionReason"
  >[];
}

export interface AdminContributorRequestList {
  data: AdminContributorRequest[];
  meta: { total: number; page: number; limit: number; lastPage: number };
}

export const getAdminContributorRequests = async (params: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<AdminContributorRequestList> => {
  const res = await api.get("/admin/contributor-requests", { params });
  return res.data;
};

export const getAdminContributorRequestStats = async (): Promise<{
  pending: number;
}> => {
  const res = await api.get("/admin/contributor-requests/stats");
  return res.data;
};

export const getAdminContributorRequest = async (
  id: string,
): Promise<AdminContributorRequest> => {
  const res = await api.get(`/admin/contributor-requests/${id}`);
  return res.data;
};

export const approveContributorRequest = async (id: string, note?: string) => {
  const res = await api.post(`/admin/contributor-requests/${id}/approve`, {
    note: note || undefined,
  });
  return res.data;
};

export const rejectContributorRequest = async (id: string, reason: string) => {
  const res = await api.post(`/admin/contributor-requests/${id}/reject`, {
    reason,
  });
  return res.data;
};

/** Pull the backend's `code` out of an axios error, if any. */
export const getApiErrorCode = (error: unknown): string | undefined =>
  (error as { response?: { data?: { code?: string } } })?.response?.data
    ?.code;
