import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import AppLayout from "@/components/app-layout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Upload from "./pages/Upload";
import Schemas from "./pages/Schemas";
import Jobs from "./pages/Jobs";
import Settings from "./pages/Settings";
import Activity from "./pages/Activity";
import NotFound from "./pages/NotFound";
import ExtractionResult from "./pages/ExtractionResult";
import { useEffect } from "react";

// ─── JWT helpers ──────────────────────────────────────────────────────────────

/**
 * Decode the JWT payload (without verifying signature — verification is on the server).
 * Returns null if the token is malformed.
 */
function decodeTokenPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const base64 = token.split(".")[1];
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Returns true only when a token exists AND its `exp` claim is still in the future.
 * A 60-second buffer means we pre-expire tokens slightly early to avoid edge cases.
 */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  if (!payload || !payload.exp) return false;
  return Date.now() < payload.exp * 1000 - 60_000;
}

/** Remove token and redirect to /auth. Call this from anywhere. */
export function clearSessionAndRedirect() {
  localStorage.removeItem("access_token");
  window.location.replace("/auth");
}

// ─── Global 401 interceptor ───────────────────────────────────────────────────
// Monkey-patch fetch so any 401 from the API clears the session immediately.
const _originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await _originalFetch(...args);
  if (response.status === 401) {
    const token = localStorage.getItem("access_token");
    // Only redirect when we actually had a token (avoids redirect loop on /auth itself)
    if (token) {
      localStorage.removeItem("access_token");
      window.location.replace("/auth");
    }
  }
  return response;
};

// ─── Protected route ──────────────────────────────────────────────────────────
const ProtectedRoute = () => {
  const token = localStorage.getItem("access_token");

  // Immediately redirect if no token or token is expired
  if (!isTokenValid(token)) {
    if (token) localStorage.removeItem("access_token"); // clean up stale token
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
};

// ─── Token expiry watcher ─────────────────────────────────────────────────────
/**
 * Sits inside the BrowserRouter so it can navigate when the token expires
 * while the user is actively on the page (tab left open overnight, etc.)
 */
function TokenExpiryWatcher() {
  const navigate = useNavigate();

  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem("access_token");
      if (token && !isTokenValid(token)) {
        localStorage.removeItem("access_token");
        navigate("/auth", { replace: true });
      }
    };

    // Check immediately, then every 60 seconds
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [navigate]);

  return null;
}

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401 — we've already redirected
        if (error?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

// ─── App ──────────────────────────────────────────────────────────────────────
const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <TokenExpiryWatcher />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ClientDetail />} />
                <Route path="/clients/:id/upload" element={<Upload />} />
                <Route path="/schemas" element={<Schemas />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/documents/:documentId" element={<ExtractionResult />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
