import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Brain, ArrowRight, Loader2 } from "lucide-react";
import { authService } from "../services/auth.service";
import { useAuthStore } from "../stores/auth.store";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Default redirect path
  const from = location.state?.from?.pathname || "/";

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
        setAuth(user, accessToken, refreshToken);
        toast.success("Welcome back to CertGym!");
      } else {
        const { user, accessToken, refreshToken } = await authService.register({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
        });
        setAuth(user, accessToken, refreshToken);
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
        </div>
      </div>
    </main>
  );
}
