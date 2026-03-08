import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth.store";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const location = useLocation();

    if (!isAuthenticated) {
        // Redirect them to the /auth page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience.
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
