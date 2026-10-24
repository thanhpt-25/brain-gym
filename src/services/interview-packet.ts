import api from "./api";

export interface PacketCompetency {
  competencyId: string;
  competencyName: string;
  competencyDescription: string | null;
  rating: number | null;
  ratingLabel: string | null;
  note: string | null;
  scoredBy: string | null;
  scoredAt: string | null;
}

export interface InterviewPacket {
  candidate: {
    name: string | null;
    email: string;
    score: number | null;
    percentile: number | null;
    submittedAt: string | null;
    timeSpent: number | null;
  };
  assessment: {
    title: string;
    jobRole: { title: string; department: string | null } | null;
  };
  competencies: PacketCompetency[];
}

export const getInterviewPacket = async (
  token: string,
): Promise<InterviewPacket> => {
  const res = await api.get<InterviewPacket>(`/packet/${token}`);
  return res.data;
};
