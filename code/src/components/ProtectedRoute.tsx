
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { logger } from "@/utils/logger";

interface ProtectedRouteProps {
  requireLevel?: number;
}

export function ProtectedRoute({ requireLevel }: ProtectedRouteProps) {
  const auth = useAuth();
  const location = useLocation();
  
  // Track if we've already checked auth to avoid repeated redirects
  const authCheckedRef = useRef(false);
  // Track if user was previously authenticated
  const wasAuthenticatedRef = useRef(false);
  
  // Add null check for safety
  if (!auth) {
    console.error("Auth context is null");
    return <Navigate to="/login" replace />;
  }
  
  const { user, isLoading } = auth;
  
  // Log visibility-related navigation attempts for auditing
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.log(`[ProtectedRoute] Visibility restored at ${location.pathname} - NO REDIRECT triggered`);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [location.pathname]);
  
  useEffect(() => {
    if (user && user.status !== 'active' && !authCheckedRef.current) {
      toast.warning("Please confirm your registered email account");
      authCheckedRef.current = true;
    }
    
    // Track authentication state
    if (user) {
      wasAuthenticatedRef.current = true;
    }
  }, [user]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-3">Loading...</span>
      </div>
    );
  }
  
  // Not authenticated - only redirect if we're sure user is not authenticated
  // and not just in a transitional state
  if (!user) {
    // Log the redirect reason for auditing
    logger.log(`[ProtectedRoute] No user found, redirecting to login from ${location.pathname}`);
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  
  // User is not active
  if (user.status !== 'active') {
    return <Navigate to="/login" replace />;
  }
  
  // Check required level
  if (requireLevel !== undefined && user.level_id < requireLevel) {
    // Redirect to appropriate dashboard based on user level
    return <Navigate to={user.level_id === 1 ? "/app" : "/admin"} replace />;
  }
  
  return <Outlet />;
}
