import api from "./api";

export interface Competency {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  scaleMin: number;
  scaleMax: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompetencyPayload {
  name: string;
  description?: string;
  scaleMin?: number;
  scaleMax?: number;
}

export interface UpdateCompetencyPayload {
  name?: string;
  description?: string;
  scaleMin?: number;
  scaleMax?: number;
  isActive?: boolean;
}

const base = (orgId: string) => `/organizations/${orgId}/competencies`;

export const getCompetencies = async (orgId: string): Promise<Competency[]> => {
  const res = await api.get<Competency[]>(base(orgId));
  return res.data;
};

export const createCompetency = async (
  orgId: string,
  data: CreateCompetencyPayload,
): Promise<Competency> => {
  const res = await api.post<Competency>(base(orgId), data);
  return res.data;
};

export const updateCompetency = async (
  orgId: string,
  competencyId: string,
  data: UpdateCompetencyPayload,
): Promise<Competency> => {
  const res = await api.patch<Competency>(
    `${base(orgId)}/${competencyId}`,
    data,
  );
  return res.data;
};

export const deleteCompetency = async (
  orgId: string,
  competencyId: string,
): Promise<void> => {
  await api.delete(`${base(orgId)}/${competencyId}`);
};
