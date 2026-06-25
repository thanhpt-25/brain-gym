import api from "./api";

export type EmailTrigger =
  | "INVITE"
  | "SHORTLISTED"
  | "INTERVIEW"
  | "REJECTED"
  | "HIRED";

export interface EmailTemplate {
  trigger: EmailTrigger;
  subject: string;
  bodyHtml: string;
  isCustom: boolean;
  updatedAt: string | null;
}

const base = (orgId: string) => `/organizations/${orgId}/email-templates`;

export const getEmailTemplates = async (
  orgId: string,
): Promise<EmailTemplate[]> => {
  const res = await api.get<EmailTemplate[]>(base(orgId));
  return res.data;
};

export const upsertEmailTemplate = async (
  orgId: string,
  trigger: EmailTrigger,
  data: { subject: string; bodyHtml: string },
): Promise<EmailTemplate> => {
  const res = await api.put<EmailTemplate>(`${base(orgId)}/${trigger}`, data);
  return res.data;
};

export const deleteEmailTemplate = async (
  orgId: string,
  trigger: EmailTrigger,
): Promise<void> => {
  await api.delete(`${base(orgId)}/${trigger}`);
};

export const previewEmailTemplate = async (
  orgId: string,
  subject: string,
  bodyHtml: string,
): Promise<{ subject: string; bodyHtml: string }> => {
  const res = await api.post<{ subject: string; bodyHtml: string }>(
    `${base(orgId)}/preview`,
    { subject, bodyHtml },
  );
  return res.data;
};
