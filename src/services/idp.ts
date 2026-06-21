import api from "./api";

export interface IdpItem {
  id: string;
  competencyId: string;
  competencyName: string;
  trackId: string;
  trackName: string;
  targetLevel: number;
  scaleMax: number;
  dueDate?: string | null;
  completedAt?: string | null;
  status: "PENDING" | "COMPLETED" | "OVERDUE";
}

export interface CampaignReview {
  memberId: string;
  memberName: string;
  memberEmail: string;
  note: string;
  direction?: string | null;
  reviewedBy: string;
  updatedAt: string;
}

export const getCampaignReviews = (orgId: string, campaignId: string) =>
  api
    .get(`/organizations/${orgId}/campaigns/${campaignId}/reviews`)
    .then((r) => r.data);

export const getCampaignMemberReview = (
  orgId: string,
  campaignId: string,
  memberId: string,
) =>
  api
    .get(`/organizations/${orgId}/campaigns/${campaignId}/reviews/${memberId}`)
    .then((r) => r.data);

export const upsertCampaignMemberReview = (
  orgId: string,
  campaignId: string,
  memberId: string,
  dto: { note: string; direction?: string },
) =>
  api
    .post(
      `/organizations/${orgId}/campaigns/${campaignId}/reviews/${memberId}`,
      dto,
    )
    .then((r) => r.data);

export const getMemberIdps = (orgId: string, memberId: string) =>
  api
    .get(`/organizations/${orgId}/members/${memberId}/idp`)
    .then((r) => r.data);

export const createMemberIdp = (
  orgId: string,
  memberId: string,
  dto: {
    competencyId: string;
    trackId: string;
    targetLevel: number;
    dueDate?: string;
  },
) =>
  api
    .post(`/organizations/${orgId}/members/${memberId}/idp`, dto)
    .then((r) => r.data);

export const completeMemberIdp = (
  orgId: string,
  memberId: string,
  idpId: string,
) =>
  api
    .patch(`/organizations/${orgId}/members/${memberId}/idp/${idpId}/complete`)
    .then((r) => r.data);

export const deleteMemberIdp = (
  orgId: string,
  memberId: string,
  idpId: string,
) =>
  api
    .delete(`/organizations/${orgId}/members/${memberId}/idp/${idpId}`)
    .then((r) => r.data);
