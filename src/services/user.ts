import api from "./api";
import { useAuthStore } from "@/stores/auth.store";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  plan: string;
  points: number;
  createdAt: string;
}

export const getMyProfile = async (): Promise<UserProfile> => {
  const res = await api.get("/users/me");
  return res.data;
};

export const updateProfile = async (data: {
  displayName?: string;
  avatarUrl?: string;
}): Promise<UserProfile> => {
  const res = await api.put("/users/me", data);
  return res.data;
};

export const uploadAvatar = async (
  file: File,
): Promise<{ avatarUrl: string }> => {
  // Step 1: get upload destination from the backend
  const presignRes = await api.post("/users/me/avatar/presign", {
    contentType: file.type,
  });
  const presign = presignRes.data as
    | { mode: "s3"; uploadUrl: string; key: string; publicUrl: string }
    | { mode: "local"; uploadUrl: string };

  if (presign.mode === "s3") {
    // Step 2a: PUT directly to S3 (no auth header — URL is already signed)
    await fetch(presign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    // Step 2b: tell the backend which key was uploaded so it updates the DB
    const confirmRes = await api.post("/users/me/avatar/confirm", {
      key: presign.key,
    });
    return confirmRes.data;
  }

  // Local-dev path: multipart POST to backend disk endpoint
  const form = new FormData();
  form.append("file", file);
  const token = useAuthStore.getState().accessToken;
  const localRes = await fetch(presign.uploadUrl, {
    method: "POST",
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return localRes.json();
};

export const changePassword = async (data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ message: string }> => {
  const res = await api.put("/users/me/password", data);
  return res.data;
};
