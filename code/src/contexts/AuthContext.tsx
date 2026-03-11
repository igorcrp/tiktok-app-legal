import { api } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { fireCompleteRegistration } from "@/utils/metaPixel";
import { User } from "@/types";
import { logger } from "@/utils/logger";
import { clearAllPreservedState } from "@/hooks/useStatePreservation";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  markTourAsCompleted: () => Promise<void>;
}

interface AuthResponse {
  data?: {
    user?: Partial<User>;
    session?: {
      access_token?: string;
      token?: string;
    } | string;
  };
  error?: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Only clear auth-specific data, not all localStorage
const cleanupAuthState = () => {
  if (typeof window !== 'undefined') {
    // Only remove auth-specific keys
    localStorage.removeItem("alphaquant-user");
    localStorage.removeItem("alphaquant-token");
    // Clean up only Supabase auth keys, not all localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.startsWith('sb-') && key.includes('-auth-')) {
        localStorage.removeItem(key);
      }
    });
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Track if we're currently processing to avoid duplicate handling
  const isProcessingRef = useRef(false);
  // Track if initial auth check is done - to avoid redirects on visibility change
  const initialAuthDoneRef = useRef(false);
  // Store current user ID to detect actual user changes (not just session refreshes)
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const handleSignedInUser = async (userEmail: string, authUser: any) => {
      console.log("=== HANDLE SIGNED IN USER ===");
      console.log("userEmail:", userEmail);
      console.log("isProcessingRef.current:", isProcessingRef.current);
      
      if (!mounted || isProcessingRef.current) {
        console.log("BLOCKED: mounted=", mounted, "isProcessing=", isProcessingRef.current);
        return;
      }

      // Check if this is the same user - avoid re-processing on token refresh
      if (currentUserIdRef.current === authUser.id && initialAuthDoneRef.current) {
        logger.log("Same user session refresh, skipping re-process");
        return;
      }

      isProcessingRef.current = true;

      try {
        logger.log("Processing user:", userEmail);

        const { data: initialUserData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();

        if (userError) {
          logger.error("Error checking user:", userError);
          isProcessingRef.current = false;
          return;
        }

        if (initialUserData) {
          logger.log("User already exists in database:", initialUserData);

          const userData: User = {
            id: initialUserData.id,
            email: initialUserData.email,
            full_name: initialUserData.name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
            level_id: initialUserData.level_id || 1,
            status: initialUserData.status_users || 'pending',
            email_verified: initialUserData.email_verified || false,
            account_type: initialUserData.subscription_tier || 'free',
            created_at: initialUserData.created_at || new Date().toISOString(),
            last_login: null
          };

          // Update refs before setting state
          currentUserIdRef.current = authUser.id;
          setUser(userData);

          if (authUser.email_confirmed_at && !initialUserData.email_verified) {
            await supabase
              .from('users')
              .update({
                email_verified: true,
                status_users: 'active',
                updated_at: new Date().toISOString()
              })
              .eq('id', authUser.id);

            userData.email_verified = true;
            userData.status = 'active';
            setUser(userData);
          }

          if ((authUser.email_confirmed_at || initialUserData.email_verified) && initialUserData.status_users !== 'active') {
            await supabase
              .from('users')
              .update({
                status_users: 'active',
                updated_at: new Date().toISOString()
              })
              .eq('id', authUser.id);

            userData.status = 'active';
            setUser(userData);
          }

          // REDIRECT AFTER SUCCESSFUL LOGIN
          console.log("=== USER SET, CHECKING REDIRECT ===");
          console.log("userData.status:", userData.status);
          console.log("Current path:", window.location.pathname);
          
          if (userData.status === 'active') {
            const isAuthPage = window.location.pathname === '/login' || 
                               window.location.pathname === '/auth/callback' ||
                               window.location.pathname === '/';
            
            if (isAuthPage) {
              console.log("Redirecting to app...");
              const isNewUser = !initialUserData.has_seen_tour;
              
              // Fire CompleteRegistration ONCE per user, using localStorage to survive refreshes
              const registrationFiredKey = `aq_registration_fired_${authUser.id}`;
              if (isNewUser && !localStorage.getItem(registrationFiredKey)) {
                console.log("Firing CompleteRegistration for new user (first time only)");
                localStorage.setItem(registrationFiredKey, '1');
                // Pass user data for Advanced Matching (email + name are hashed inside the utility)
                fireCompleteRegistration({
                  email: authUser.email,
                  full_name: userData.full_name,
                });
              }
              
              const targetPath = userData.level_id === 2 
                ? '/admin' 
                : '/app';
              navigate(targetPath, { replace: true });
            }
          }

          isProcessingRef.current = false;
          initialAuthDoneRef.current = true;
          return;
        }

        // User doesn't exist yet — create them (new Google OAuth / social login user)
        logger.log("New user via OAuth — creating public.users record for:", userEmail);

        const browserLocale = navigator.language || 'pt-BR';
        const locale = browserLocale.startsWith('pt') ? 'pt-BR' : 'en-US';
        const isGoogleProvider = authUser.app_metadata?.provider === 'google';

        const newUserData = {
          id: authUser.id,
          email: userEmail,
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || userEmail.split('@')[0],
          level_id: 1,
          status_users: 'active',
          email_verified: true,
          subscription_tier: 'Free',
          locale,
          email_subscribed: true,
          has_seen_tour: false,
          lead_source: isGoogleProvider ? 'google_oauth' : 'website',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from('users')
          .upsert(newUserData, { onConflict: 'id' });

        if (insertError) {
          logger.error("Failed to create user record:", insertError);
          isProcessingRef.current = false;
          return;
        }

        logger.log("New user record created successfully:", userEmail);

        const userData: User = {
          id: authUser.id,
          email: userEmail,
          full_name: newUserData.name,
          level_id: 1,
          status: 'active',
          email_verified: true,
          account_type: 'free',
          created_at: newUserData.created_at,
          last_login: null
        };

        currentUserIdRef.current = authUser.id;
        setUser(userData);

        // Fire CompleteRegistration pixel event for new user
        const registrationFiredKey = `aq_registration_fired_${authUser.id}`;
        if (!localStorage.getItem(registrationFiredKey)) {
          localStorage.setItem(registrationFiredKey, '1');
          fireCompleteRegistration({
            email: userEmail,
            full_name: newUserData.name,
          });
        }

        navigate('/app', { replace: true });
        isProcessingRef.current = false;
        initialAuthDoneRef.current = true;
        return;

       } catch (error) {
         logger.error("Error handling signed in user:", error);
       }
       isProcessingRef.current = false;
     };

    const initializeAuth = async () => {
      let unsubscribe: (() => void) | null = null;
      try {
        // STEP 1: Check existing session FIRST, before setting up the listener.
        // This avoids the race condition where onAuthStateChange fires SIGNED_IN
        // concurrently with getSession(), both calling handleSignedInUser and the
        // second one getting blocked by isProcessingRef.
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (initialSession?.user && mounted) {
          await handleSignedInUser(initialSession.user.email!, initialSession.user);
        }

        // STEP 2: Set up the listener AFTER initial session check is done.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log("=== AUTH STATE CHANGE ===");
            console.log("Event:", event);
            console.log("Session exists:", !!session);

            if (!mounted) return;

            logger.log('Auth state changed:', event, session?.user?.email || 'no user');

            // Don't trigger redirects on TOKEN_REFRESHED - just update session
            if (event === 'TOKEN_REFRESHED') {
              logger.log('Token refreshed - NO REDIRECT, preserving state');
              return;
            }

            if (event === 'SIGNED_OUT') {
              cleanupAuthState();
              clearAllPreservedState();
              currentUserIdRef.current = null;
              setUser(null);
              return;
            }

            // SIGNED_IN fires after OAuth callback — handle if not already processed
            if (session?.user && !isProcessingRef.current) {
              handleSignedInUser(session.user.email!, session.user);
            }
          }
        );

        unsubscribe = () => subscription.unsubscribe();

      } catch (error) {
        logger.error("Auth initialization error:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
          initialAuthDoneRef.current = true;
        }
      }

      return () => {
        mounted = false;
        unsubscribe?.();
      };
    };

    initializeAuth();
  }, [navigate]);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      logger.log("Attempting login for:", email);

      // CRITICAL: Clear all previous analysis results and state on new login
      // This ensures users always start fresh without seeing previous session data
      clearAllPreservedState();
      localStorage.removeItem('daytrade-page-state');
      logger.log("Cleared previous session state on login");

      // Use Supabase auth directly for more reliable login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error("Login error:", error);
        throw error;
      }

      if (!data?.user || !data?.session) {
        throw new Error("Invalid login response");
      }

      logger.log("Login successful for:", email);

      // Record login
      try {
        await supabase.rpc('record_user_login');
      } catch (err) {
        logger.error('Failed to record login:', err);
      }

      // The onAuthStateChange will handle the rest

    } catch (error: any) {
      logger.error("Login failed", error);

      // Check if user exists but is pending
      try {
        const { data } = await supabase.rpc('check_user_by_email', {
          p_email: email
        });

        if (data && data.length > 0 && data[0].status_users === 'pending') {
          await api.auth.resendConfirmationEmail(email);
          throw new Error("PENDING_CONFIRMATION");
        }
      } catch (checkError) {
        logger.error("Error checking user status:", checkError);
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async () => {
    try {
      setIsLoading(true);

      // Clear previous analysis state (but NOT auth state - that breaks OAuth!)
      clearAllPreservedState();
      localStorage.removeItem('daytrade-page-state');
      logger.log("Cleared previous session state on Google login");

      logger.log("Attempting Google login");

      // Use Supabase directly for Google OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        logger.error("Google login error:", error);
        throw error;
      }

      logger.log("Google login initiated successfully:", data);

      // The redirect and onAuthStateChange will handle the rest

    } catch (error) {
      logger.error("Google login failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    try {

      const result = await api.auth.register(email, password, fullName);

      if (result && !result.error) {
        logger.log("Registration successful, navigating to login...");
        navigate("/login");
        return { success: true };
      } else {
        logger.error("Registration API call failed:", result);
        throw new Error(result?.error?.message || "Registration failed");
      }
    } catch (error: any) {
      logger.error("Registration failed in AuthContext:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setIsLoading(true);
      logger.log("Attempting to reset password for:", email);
      await api.auth.resetPassword(email);
    } catch (error) {
      logger.error("Password reset failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmationEmail = async (email: string) => {
    try {
      setIsLoading(true);
      logger.log("Attempting to resend confirmation email for:", email);
      await api.auth.resendConfirmationEmail(email);
    } catch (error) {
      logger.error("Resend confirmation email failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const markTourAsCompleted = async () => {
    try {
      if (user?.id) {
        const { error } = await supabase
          .from('users')
          .update({ has_seen_tour: true })
          .eq('id', user.id);

        if (error) {
          logger.error("Error updating tour status:", error);
        }
      }
    } catch (error) {
      logger.error("Failed to mark tour as completed:", error);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      logger.log("Logging out user...");

      // Clean up auth state first
      cleanupAuthState();
      setUser(null);

      // Attempt Supabase logout
      try {
        await supabase.auth.signOut({ scope: 'global' });
        logger.log("Supabase logout successful");
      } catch (error) {
        logger.error("Supabase logout failed:", error);
      }

      // Force a page reload to clear all state and prevent any redirects
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);

    } catch (error) {
      logger.error("Logout failed", error);
      // Force navigation even if logout fails
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      googleLogin,
      logout,
      register,
      resetPassword,
      resendConfirmationEmail,
      markTourAsCompleted
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.error("AuthContext is undefined - AuthProvider not found in component tree");
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};