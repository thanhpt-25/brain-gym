import api from "./api";

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  catalogItemId: string;
  catalogItem?: { id: string; title: string };
  dueDate?: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  recurrenceEnabled: boolean;
  recurrenceInterval?: "MONTHLY_3" | "MONTHLY_6" | "MONTHLY_12";
  nextRunAt?: string;
  createdAt: string;
  daysRemaining?: number | null;
  progress?: { total: number; completed: number; pct: number };
  _count?: { assignments: number };
}

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  catalogItemId: string;
  dueDate?: string;
  recurrenceEnabled?: boolean;
  recurrenceInterval?: "MONTHLY_3" | "MONTHLY_6" | "MONTHLY_12";
}

export interface AssignCampaignPayload {
  groupIds?: string[];
  memberIds?: string[];
}

const base = (slug: string) => `/organizations/${slug}/campaigns`;

export const getCampaigns = async (slug: string, filter?: string) => {
  const params = filter ? `?filter=${filter}` : "";
  const res = await api.get<Campaign[]>(`${base(slug)}${params}`);
  return res.data;
};

export const getCampaign = async (slug: string, id: string) => {
  const res = await api.get<Campaign>(`${base(slug)}/${id}`);
  return res.data;
};

export const createCampaign = async (
  slug: string,
  data: CreateCampaignPayload,
) => {
  const res = await api.post<Campaign>(base(slug), data);
  return res.data;
};

export const updateCampaign = async (
  slug: string,
  id: string,
  data: Partial<CreateCampaignPayload & { status: string }>,
) => {
  const res = await api.patch<Campaign>(`${base(slug)}/${id}`, data);
  return res.data;
};

export const deleteCampaign = async (slug: string, id: string) => {
  await api.delete(`${base(slug)}/${id}`);
};

export const activateCampaign = async (slug: string, id: string) => {
  const res = await api.post<Campaign>(`${base(slug)}/${id}/activate`);
  return res.data;
};

export const assignCampaign = async (
  slug: string,
  id: string,
  data: AssignCampaignPayload,
) => {
  const res = await api.post<{ created: number; skipped: number }>(
    `${base(slug)}/${id}/assign`,
    data,
  );
  return res.data;
};

export const getCampaignProgress = async (slug: string, id: string) => {
  const res = await api.get<{ total: number; completed: number; pct: number }>(
    `${base(slug)}/${id}/progress`,
  );
  return res.data;
};
