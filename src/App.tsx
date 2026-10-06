import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./pages/app/AppLayout.tsx";
import Dashboard from "./pages/app/Dashboard.tsx";
import CoursesPage from "./pages/app/CoursesPage.tsx";
import AdminPage from "./pages/app/AdminPage.tsx";
import QuizBankPage from "./pages/quizzes/page.tsx";
import StudentQuizzesPage from "./pages/app/StudentQuizzesPage.tsx";
import OrgAdminPanel from "./pages/org/OrgAdminPanel.tsx";
import InstitutionsPage from "./pages/institutions/page.tsx";
import ForumPage from "./pages/forum/page.tsx";
import LibraryPage from "./pages/library/page.tsx";
import BillingPage from "./pages/billing/page.tsx";
import BillingVerify from "./pages/billing/verify.tsx";
import SuperadminBillingPage from "./pages/superadmin/billing.tsx";
import LivePage from "./pages/live/page.tsx";
import LiveRoomPage from "./pages/live/room.tsx";
import { useResetOrgChoiceOnSignOut } from "./pages/app/OrgChooser.tsx";
import ThemePage from "./pages/org/ThemePage.tsx";

import ProgramCategoriesPage from "./pages/app/ProgramCategoriesPage.tsx";
import CourseDetailPage from "./pages/app/CourseDetailPage.tsx";

function AuthWatcher() {
  useResetOrgChoiceOnSignOut();
  return null;
}

export default function App() {
  return (
    <DefaultProviders>
      <AuthWatcher />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/institutions" element={<InstitutionsPage />} />
          <Route path="/billing/verify" element={<BillingVerify />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:courseId" element={<CourseDetailPage />} />
            <Route path="/programs" element={<ProgramCategoriesPage />} />
            <Route path="/quizzes" element={<QuizBankPage />} />
            <Route path="/my-quizzes" element={<StudentQuizzesPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/live/:sessionId" element={<LiveRoomPage />} />
            <Route path="/forum" element={<ForumPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/org-admin" element={<OrgAdminPanel />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/superadmin/billing" element={<SuperadminBillingPage />} />
            <Route path="/theme" element={<ThemePage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
