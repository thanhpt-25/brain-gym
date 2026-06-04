import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth.store";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const location = useLocation();

    // Keep the `state` object identity stable. `<Navigate>` re-runs its internal
    // effect (which calls history.replaceState) every time the `state` prop
    // changes identity. An inline `{{ from: location }}` is a brand-new object on
    // each render, so while AnimatePresence (mode="wait") keeps this redirecting
    // subtree mounted during the page exit animation, every animation frame
    // re-fired replaceState — tripping WebKit's "more than 100 times per 10
    // seconds" SecurityError and crashing into the ErrorBoundary.
    const redirectState = useMemo(() => ({ from: location }), [location]);

    if (!isAuthenticated) {
        // Redirect them to the /auth page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience.
        return <Navigate to="/auth" state={redirectState} replace />;
    }

    return <>{children}</>;
}
