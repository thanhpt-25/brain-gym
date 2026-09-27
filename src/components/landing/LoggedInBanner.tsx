import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

/** Short "continue where you left off" strip shown to signed-in visitors who land on `/`. */
export function LoggedInBanner() {
  const { user } = useAuthStore();

  return (
    <div className="border-b border-border bg-primary/5">
      <div className="container py-2.5 flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground truncate">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ""} — pick up
          where you left off.
        </span>
        <Link
          to="/dashboard"
          className="shrink-0 flex items-center gap-1 font-mono text-primary hover:underline"
        >
          Go to Dashboard <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
