import api from './api';
import type { JobRole } from '@/types/assessment-types';

const base = (slug: string) => `/organizations/${slug}/job-roles`;

export const getJobRoles = async (slug: string): Promise<JobRole[]> => {
  const res = await api.get<JobRole[]>(base(slug));
  return res.data;
};

export interface CreateJobRolePayload {
  title: string;
  department?: string;
  description?: string;
}

export interface UpdateJobRolePayload {
  title?: string;
  department?: string;
  description?: string;
  isActive?: boolean;
}

export const createJobRole = async (
  slug: string,
  data: CreateJobRolePayload,
): Promise<JobRole> => {
  const res = await api.post<JobRole>(base(slug), data);
  return res.data;
};

export const updateJobRole = async (
  slug: string,
  roleId: string,
  data: UpdateJobRolePayload,
): Promise<JobRole> => {
  const res = await api.patch<JobRole>(`${base(slug)}/${roleId}`, data);
  return res.data;
};

export const deleteJobRole = async (
  slug: string,
  roleId: string,
): Promise<void> => {
  await api.delete(`${base(slug)}/${roleId}`);
};
