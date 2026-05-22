import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function CoachLockState() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
      <div className="text-center px-6">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-200">
          <Lock className="h-8 w-8 text-slate-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          AI Coach for Premium Members
        </h3>
        <p className="text-slate-600 mb-6 max-w-sm">
          Get personalized feedback and one-on-one guidance with our AI-powered coaching feature.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Upgrade to Premium
        </button>
        <p className="text-sm text-slate-500 mt-4">
          Premium members unlock AI coaching + weekly insights.
        </p>
      </div>
    </div>
  );
}
