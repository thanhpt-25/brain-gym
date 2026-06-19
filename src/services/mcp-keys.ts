import api from "./api";
import { McpApiKey, McpApiKeyCreated } from "../types/api-types";

export const listMcpKeys = async (): Promise<McpApiKey[]> => {
  const res = await api.get<McpApiKey[]>("/mcp-keys");
  return res.data;
};

export const generateMcpKey = async (name: string): Promise<McpApiKeyCreated> => {
  const res = await api.post<McpApiKeyCreated>("/mcp-keys", { name });
  return res.data;
};

export const revokeMcpKey = async (id: string): Promise<void> => {
  await api.delete(`/mcp-keys/${id}`);
};
