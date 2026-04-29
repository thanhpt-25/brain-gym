import axios from "axios";
import { useAuthStore } from "../stores/auth.store";

// Create an Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach access token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response Interceptor: Handle 401 and Refresh Token
api.interceptors.response.use(
  (response) => {
    // Guard against non-JSON responses (e.g. SPA fallback HTML when backend is down)
    const ct = String(response.headers?.["content-type"] || "");
    if (ct.includes("text/html")) {
      return Promise.reject(new Error("Backend unavailable"));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const authStore = useAuthStore.getState();
        const refreshToken = authStore.refreshToken;

        if (!refreshToken) {
          authStore.logout();
          return Promise.reject(error);
        }

        // Call the refresh endpoint directly to avoid interceptor loop
        const response = await axios.post("/api/v1/auth/refresh", {
          refreshToken,
        });

        const {
          accessToken,
          refreshToken: newRefreshToken,
          user,
        } = response.data;

        // Update the store with new tokens
        authStore.setAuth(user, accessToken, newRefreshToken);

        // Update the failed request's authorization header and retry
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, log the user out
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
