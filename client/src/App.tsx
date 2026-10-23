import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LanguageProvider } from "./i18n";
import type { Role } from "./api/types";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { MyBooksPage } from "./pages/author/MyBooksPage";
import { MyTicketsPage } from "./pages/author/MyTicketsPage";
import { NewTicketPage } from "./pages/author/NewTicketPage";
import { AuthorTicketPage } from "./pages/author/AuthorTicketPage";
import { QueuePage } from "./pages/admin/QueuePage";
import { AdminTicketPage } from "./pages/admin/AdminTicketPage";
import { InsightsPage } from "./pages/admin/InsightsPage";
import { ProfilePage } from "./pages/ProfilePage";

// UI-level guard for convenience only; the API enforces access on every request.
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === "ADMIN" ? "/admin/tickets" : "/books"} replace />;
  return children;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin/tickets" : "/books"} replace />;
}

export default function App() {
  return (
    <LanguageProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Home />} />

          <Route
            element={
              <RequireRole role="AUTHOR">
                <Layout />
              </RequireRole>
            }
          >
            <Route path="/books" element={<MyBooksPage />} />
            <Route path="/tickets" element={<MyTicketsPage />} />
            <Route path="/tickets/new" element={<NewTicketPage />} />
            <Route path="/tickets/:id" element={<AuthorTicketPage />} />
          </Route>

          <Route
            element={
              <RequireRole role="ADMIN">
                <Layout />
              </RequireRole>
            }
          >
            <Route path="/admin/tickets" element={<QueuePage />} />
            <Route path="/admin/tickets/:id" element={<AdminTicketPage />} />
            <Route path="/admin/insights" element={<InsightsPage />} />
          </Route>

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
}
