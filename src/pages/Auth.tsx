import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, ArrowRight, Loader2 } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { authService } from "../services/auth.service";
import { useAuthStore } from "../stores/auth.store";
import { toast } from "sonner";

// Add new providers here — UI updates automatically
const OAUTH_PROVIDERS = [
  {
    key: "google",
    label: "Continue with Google",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
  },
];

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Default redirect path
  const from = location.state?.from?.pathname || "/";

  const handleOAuthSuccess = async (provider: string, token: string) => {
    setOauthLoading(provider);
    try {
      const { user, accessToken, refreshToken } = await authService.socialLogin(provider, token);
      setAuth(user as any, accessToken, refreshToken);
      toast.success("Welcome to CertGym!");
      navigate(from, { replace: true });
    } catch (error: any) {
      const message = error.response?.data?.message || "OAuth login failed. Please try again.";
      toast.error(message);
    } finally {
      setOauthLoading(null);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: (response) => handleOAuthSuccess("google", response.access_token),
    onError: () => toast.error("Google login failed. Please try again."),
    flow: "implicit",
  });

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { user, accessToken, refreshToken } = await authService.login({
          email: formData.email,
          password: formData.password,
        });
        setAuth(user as any, accessToken, refreshToken);
        toast.success("Welcome back to CertGym!");
      } else {
        const { user, accessToken, refreshToken } = await authService.register({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
        });
        setAuth(user as any, accessToken, refreshToken);
        toast.success("Account created successfully!");
      }

      navigate(from, { replace: true });
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        "Authentication failed. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <main
      id="main-content"
      className="min-h-screen bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Brain size={28} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          {isLogin ? "Sign in to CertGym" : "Create your account"}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          {isLogin
            ? "Ready to crush your next certification?"
            : "Start your IT mastery journey today."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="glass-card py-8 px-4 sm:rounded-2xl sm:px-10 border border-gray-800 bg-gray-900/50 backdrop-blur-xl">
          <div className="flex mb-8 bg-gray-950/50 p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isLogin ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-gray-300"}`}
              onClick={() => setIsLogin(true)}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isLogin ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-gray-300"}`}
              onClick={() => setIsLogin(false)}
            >
              Register
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Display Name
                </label>
                <div className="mt-1">
                  <input
                    name="displayName"
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2.5 border border-gray-700 bg-gray-900/80 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent sm:text-sm transition-all"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Email address
              </label>
              <div className="mt-1">
                <input
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-700 bg-gray-900/80 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent sm:text-sm transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2.5 border border-gray-700 bg-gray-900/80 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent sm:text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-cyan-700 hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {isLogin ? "Sign In" : "Create Account"}
                    <ArrowRight
                      className="ml-2 group-hover:translate-x-1 transition-transform"
                      size={18}
                    />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* OAuth providers */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900/50 text-gray-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {OAUTH_PROVIDERS.map((p) => {
                const isProviderLoading = oauthLoading === p.key;
                const handleClick =
                  p.key === "google" ? () => googleLogin() : undefined;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={handleClick}
                    disabled={!!oauthLoading || isLoading}
                    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-700 rounded-lg bg-gray-900/60 text-gray-200 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProviderLoading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      p.icon
                    )}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
