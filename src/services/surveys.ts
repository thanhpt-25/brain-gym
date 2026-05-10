import api from "./api";

export interface PassLikelihoodStatus {
  submitted: boolean;
  score?: number | null;
}

export interface SubmitPassLikelihoodResponse {
  id: string;
  score: number;
  submittedAt: string;
}

export const getPassLikelihoodStatus = async (
  certificationId: string,
): Promise<PassLikelihoodStatus> => {
  const response = await api.get<PassLikelihoodStatus>(
    `/surveys/pass-likelihood?certificationId=${certificationId}`,
  );
  return response.data;
};

export const submitPassLikelihood = async (
  certificationId: string,
  score: number,
): Promise<SubmitPassLikelihoodResponse> => {
  const response = await api.post<SubmitPassLikelihoodResponse>(
    "/surveys/pass-likelihood",
    { certificationId, score },
  );
  return response.data;
};
