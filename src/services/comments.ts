import api from './api';

export interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  upvotes: number;
  user: { id: string; displayName: string; avatarUrl: string | null };
  replies?: Comment[];
}

export const getComments = async (questionId: string): Promise<Comment[]> => {
  const response = await api.get<Comment[]>(`/questions/${questionId}/comments`);
  return response.data;
};

export const createComment = async (questionId: string, content: string, parentId?: string): Promise<Comment> => {
  const response = await api.post<Comment>(`/questions/${questionId}/comments`, { content, parentId });
  return response.data;
};

export const updateComment = async (commentId: string, content: string): Promise<Comment> => {
  const response = await api.put<Comment>(`/comments/${commentId}`, { content });
  return response.data;
};

export const deleteComment = async (commentId: string): Promise<void> => {
  await api.delete(`/comments/${commentId}`);
};
