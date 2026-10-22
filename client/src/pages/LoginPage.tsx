import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

// Demo accounts from the seeded dataset, so reviewers can log in in one click.
const DEMO_ACCOUNTS = [
  { label: "Author: Ananya Reddy (never paid)", email: "ananya.reddy@email.com", password: "author123" },
  { label: "Author: Sneha Kulkarni (book in production)", email: "sneha.kulkarni@email.com", password: "author123" },
  { label: "Author: Kavita Deshmukh (below payout threshold)", email: "kavita.deshmukh@email.com", password: "author123" },
  { label: "Admin: Aisha Verma", email: "admin@bookleaf.com", password: "admin123" },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={user.role === "ADMIN" ? "/admin/tickets" : "/books"} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(email, password);
      navigate(u.role === "ADMIN" ? "/admin/tickets" : "/books", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1>BookLeaf</h1>
        <p className="muted">Sign in to the Author Portal or Support Desk.</p>
        <form onSubmit={onSubmit} className="form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="banner banner-error">{error}</div>}
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="demo-accounts">
          <p className="muted small">Demo accounts (all authors use password <code>author123</code>):</p>
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              className="btn btn-ghost btn-sm demo-btn"
              onClick={() => {
                setEmail(a.email);
                setPassword(a.password);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
