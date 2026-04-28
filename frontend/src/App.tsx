import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
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

const queryClient = new QueryClient();

const ProtectedRoute = () => {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return <Outlet />;
};

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
