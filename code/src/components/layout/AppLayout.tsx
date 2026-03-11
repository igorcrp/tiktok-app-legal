
import React, { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { OnboardingTour } from "@/components/OnboardingTour";

export function AppLayout() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [showTour, setShowTour] = useState(false);

  // Listen for tour event from sidebar — works on any page
  useEffect(() => {
    const handleShowTour = () => {
      // Navigate to daytrade first if not already there
      if (!location.pathname.includes("/app/daytrade")) {
        navigate("/app/daytrade");
      }
      // Small delay to let the page render before starting tour
      setTimeout(() => setShowTour(true), 400);
    };
    window.addEventListener("showTour", handleShowTour);
    return () => window.removeEventListener("showTour", handleShowTour);
  }, [location.pathname, navigate]);

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen bg-background flex w-full overflow-x-hidden">
        <AppSidebar />
        <SidebarInset className="overflow-x-hidden">
          {/* Header com título e trigger do sidebar - visível em todas as páginas */}
          <div className="flex items-center gap-3 p-4 border-b border-border md:hidden">
            <h1 className="text-xl font-bold">Alpha Quant</h1>
            <SidebarTrigger />
          </div>
          <div className="p-4 md:p-8 overflow-x-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
      <OnboardingTour isOpen={showTour} onClose={() => setShowTour(false)} />
    </SidebarProvider>
  );
}
