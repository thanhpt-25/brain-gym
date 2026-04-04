import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "./components/PageTransition";
import { ProtectedRoute } from "./components/ProtectedRoute";
import BottomTabBar from "./components/BottomTabBar";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Lazy load all pages
const Index = lazy(() => import("./pages/Index"));
const ExamPage = lazy(() => import("./pages/ExamPage"));
const StudyMode = lazy(() => import("./pages/StudyMode"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthPage = lazy(() => import("./pages/Auth"));
const QuestionsBrowser = lazy(() => import("./pages/QuestionsBrowser"));
const QuestionForm = lazy(() => import("./pages/QuestionForm"));
const QuestionDetail = lazy(() => import("./pages/QuestionDetail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ExamResults = lazy(() => import("./pages/ExamResults"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const AdminPage = lazy(() => import("./pages/admin"));
const ExamLibrary = lazy(() => import("./pages/ExamLibrary"));
const ExamBuilder = lazy(() => import("./pages/ExamBuilder"));
const ExamShare = lazy(() => import("./pages/ExamShare"));
const TrainingHub = lazy(() => import("./pages/TrainingHub"));
const FlashcardDecks = lazy(() => import("./pages/FlashcardDecks"));
const DeckDetail = lazy(() => import("./pages/DeckDetail"));
const FlashcardStudy = lazy(() => import("./pages/FlashcardStudy"));
const TrapQuestionsPage = lazy(() => import("./pages/TrapQuestionsPage"));
const AiQuestionGenerator = lazy(() => import("./pages/AiQuestionGenerator"));

// Organization pages
const OrgSelector = lazy(() => import("./pages/org/OrgSelector"));
const OrgLayout = lazy(() => import("./components/org/OrgLayout"));
const OrgDashboard = lazy(() => import("./pages/org/OrgDashboard"));
const OrgMembers = lazy(() => import("./pages/org/OrgMembers"));
const OrgSettings = lazy(() => import("./pages/org/OrgSettings"));
const CreateOrg = lazy(() => import("./pages/org/CreateOrg"));
const OrgJoin = lazy(() => import("./pages/org/OrgJoin"));
const OrgAcceptInvite = lazy(() => import("./pages/org/OrgAcceptInvite"));
const OrgQuestionBank = lazy(() => import("./pages/org/OrgQuestionBank"));
const OrgQuestionForm = lazy(() => import("./pages/org/OrgQuestionForm"));
const OrgQuestionDetail = lazy(() => import("./pages/org/OrgQuestionDetail"));
const OrgExamCatalog = lazy(() => import("./pages/org/OrgExamCatalog"));
const OrgCatalogManage = lazy(() => import("./pages/org/OrgCatalogManage"));
const OrgCatalogBuilder = lazy(() => import("./pages/org/OrgCatalogBuilder"));
const OrgLearningTracks = lazy(() => import("./pages/org/OrgLearningTracks"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
        <Route path="/questions" element={<PageTransition><QuestionsBrowser /></PageTransition>} />
        <Route path="/trap-questions" element={<PageTransition><TrapQuestionsPage /></PageTransition>} />
        <Route path="/questions/new" element={<PageTransition><QuestionForm /></PageTransition>} />
        <Route path="/questions/:id" element={<PageTransition><QuestionDetail /></PageTransition>} />
        <Route path="/exams" element={<PageTransition><ExamLibrary /></PageTransition>} />
        <Route path="/exams/create" element={<PageTransition><ProtectedRoute><ExamBuilder /></ProtectedRoute></PageTransition>} />
        <Route path="/exams/share/:shareCode" element={<PageTransition><ExamShare /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/training" element={<PageTransition><TrainingHub /></PageTransition>} />
        <Route path="/decks" element={<PageTransition><ProtectedRoute><FlashcardDecks /></ProtectedRoute></PageTransition>} />
        <Route path="/decks/:deckId" element={<PageTransition><ProtectedRoute><DeckDetail /></ProtectedRoute></PageTransition>} />
        <Route path="/decks/:deckId/study" element={<PageTransition><ProtectedRoute><FlashcardStudy /></ProtectedRoute></PageTransition>} />
        <Route path="/exam-results" element={<PageTransition><ExamResults /></PageTransition>} />
        <Route path="/leaderboard" element={<PageTransition><Leaderboard /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><ProtectedRoute><AdminPage /></ProtectedRoute></PageTransition>} />
        <Route path="/ai-generate" element={<PageTransition><ProtectedRoute><AiQuestionGenerator /></ProtectedRoute></PageTransition>} />

        {/* Organization routes */}
        <Route path="/org" element={<PageTransition><ProtectedRoute><OrgSelector /></ProtectedRoute></PageTransition>} />
        <Route path="/org/create" element={<PageTransition><ProtectedRoute><CreateOrg /></ProtectedRoute></PageTransition>} />
        <Route path="/org/join/:code" element={<PageTransition><OrgJoin /></PageTransition>} />
        <Route path="/org/accept-invite/:token" element={<PageTransition><ProtectedRoute><OrgAcceptInvite /></ProtectedRoute></PageTransition>} />
        <Route path="/org/:slug" element={<PageTransition><ProtectedRoute><OrgLayout /></ProtectedRoute></PageTransition>}>
          <Route index element={<OrgDashboard />} />
          <Route path="members" element={<OrgMembers />} />
          <Route path="groups" element={<OrgMembers />} />
          <Route path="questions" element={<OrgQuestionBank />} />
          <Route path="questions/new" element={<OrgQuestionForm />} />
          <Route path="questions/:questionId" element={<OrgQuestionDetail />} />
          <Route path="questions/:questionId/edit" element={<OrgQuestionForm />} />
          <Route path="catalog" element={<OrgExamCatalog />} />
          <Route path="catalog/manage" element={<OrgCatalogManage />} />
          <Route path="catalog/create" element={<OrgCatalogBuilder />} />
          <Route path="catalog/:cid/edit" element={<OrgCatalogBuilder />} />
          <Route path="tracks" element={<OrgLearningTracks />} />
          <Route path="settings" element={<OrgSettings />} />
        </Route>

        <Route path="/study/:certId" element={<PageTransition><StudyMode /></PageTransition>} />
        <Route path="/exam/:certId" element={<PageTransition><ProtectedRoute><ExamPage /></ProtectedRoute></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AnimatedRoutes />
          <BottomTabBar />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
