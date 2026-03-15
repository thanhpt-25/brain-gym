import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ExamPage from "./pages/ExamPage";
import StudyMode from "./pages/StudyMode";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import QuestionsBrowser from "./pages/QuestionsBrowser";
import QuestionForm from "./pages/QuestionForm";
import Dashboard from "./pages/Dashboard";
import ExamResults from "./pages/ExamResults";
import Leaderboard from "./pages/Leaderboard";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/questions" element={<QuestionsBrowser />} />
          <Route path="/questions/new" element={<QuestionForm />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/exam-results" element={<ExamResults />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/study/:certId" element={<StudyMode />} />
          <Route
            path="/exam/:certId"
            element={
              <ProtectedRoute>
                <ExamPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
