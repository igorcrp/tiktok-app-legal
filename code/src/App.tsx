import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGTM } from "@/hooks/useGTM";
import { useMetaPixel } from "@/hooks/useMetaPixel";

// Admin Navigation Component
const AdminNavigator = () => {
  const savedRoute = localStorage.getItem('admin_last_route') || '/admin/dashboard';
  return <Navigate to={savedRoute} replace />;
};

// Admin Pages
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminAssetsPage from "@/pages/admin/AdminAssetsPage";

// App Pages
import AppHomePage from "@/pages/app/AppHomePage";
import DaytradePage from "@/pages/app/DaytradePage";
import ProfilePage from "@/pages/app/ProfilePage";

// Public Pages
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      // CRITICAL: Disable automatic refetch on window focus to preserve state
      refetchOnWindowFocus: false,
      // Prevent refetch when reconnecting
      refetchOnReconnect: false,
      // Keep data when returning to tab
      refetchOnMount: false,
    },
  },
});

const GTMTracker = () => {
  useGTM();
  useMetaPixel();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref === 'br') {
      localStorage.setItem('checkout_currency', 'brl');
    } else if (ref === 'en') {
      localStorage.setItem('checkout_currency', 'usd');
    } else if (!localStorage.getItem('checkout_currency')) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const brTimezones = ['America/Sao_Paulo', 'America/Fortaleza', 'America/Recife', 'America/Bahia', 'America/Belem', 'America/Manaus', 'America/Cuiaba', 'America/Campo_Grande', 'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco', 'America/Maceio', 'America/Araguaina', 'America/Noronha'];
        if (brTimezones.includes(tz)) {
          localStorage.setItem('checkout_currency', 'brl');
        }
      } catch (e) {
        // Ignore timezone detection errors
      }
    }
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <GTMTracker />
      <AuthProvider>
        <SubscriptionProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<LoginPage />} /> {/* ← LINHA NOVA ADICIONADA */}
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                
                {/* Redirect from root to login */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                
                {/* Protected admin routes */}
                <Route element={<ProtectedRoute requireLevel={2} />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminNavigator />} />
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="assets" element={<AdminAssetsPage />} />
                  </Route>
                </Route>
                
                {/* Protected app routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/app" element={<AppLayout />}>
                    <Route index element={<AppHomePage />} />
                    <Route path="daytrade" element={<DaytradePage />} />
                    <Route path="profile" element={<ProfilePage />} />
                  </Route>
                </Route>
                
                {/* 404 route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </ThemeProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;