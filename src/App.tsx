import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "./components/PageTransition";
import Index from "./pages/Index";
import ExamPage from "./pages/ExamPage";
import StudyMode from "./pages/StudyMode";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import QuestionsBrowser from "./pages/QuestionsBrowser";
import QuestionForm from "./pages/QuestionForm";
import QuestionDetail from "./pages/QuestionDetail";
import Dashboard from "./pages/Dashboard";
import ExamResults from "./pages/ExamResults";
import Leaderboard from "./pages/Leaderboard";
import AdminPage from "./pages/Admin";
import ExamLibrary from "./pages/ExamLibrary";
import ExamBuilder from "./pages/ExamBuilder";
import ExamShare from "./pages/ExamShare";
import TrainingHub from "./pages/TrainingHub";
import FlashcardPage from "./pages/Flashcards";
import { ProtectedRoute } from "./components/ProtectedRoute";
import BottomTabBar from "./components/BottomTabBar";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
        <Route path="/questions" element={<PageTransition><QuestionsBrowser /></PageTransition>} />
        <Route path="/questions/new" element={<PageTransition><QuestionForm /></PageTransition>} />
        <Route path="/questions/:id" element={<PageTransition><QuestionDetail /></PageTransition>} />
        <Route path="/exams" element={<PageTransition><ExamLibrary /></PageTransition>} />
        <Route path="/exams/create" element={<PageTransition><ProtectedRoute><ExamBuilder /></ProtectedRoute></PageTransition>} />
        <Route path="/exams/share/:shareCode" element={<PageTransition><ExamShare /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/training" element={<PageTransition><TrainingHub /></PageTransition>} />
        <Route path="/exam-results" element={<PageTransition><ExamResults /></PageTransition>} />
        <Route path="/leaderboard" element={<PageTransition><Leaderboard /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><ProtectedRoute><AdminPage /></ProtectedRoute></PageTransition>} />
        <Route path="/study/:certId" element={<PageTransition><StudyMode /></PageTransition>} />
        <Route path="/exam/:certId" element={<PageTransition><ProtectedRoute><ExamPage /></ProtectedRoute></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedRoutes />
        <BottomTabBar />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
