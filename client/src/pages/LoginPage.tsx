import { useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { ChatWidget } from "../components/ChatWidget";

// Demo accounts from the seeded dataset, so reviewers can log in in one click.
const DEMO_ACCOUNTS = [
  { label: "Ananya Reddy", email: "ananya.reddy@email.com", password: "author123" },
  { label: "Sneha Kulkarni", email: "sneha.kulkarni@email.com", password: "author123" },
  { label: "Kavita Deshmukh", email: "kavita.deshmukh@email.com", password: "author123" },
  { label: "Admin: Aisha Verma", email: "admin@bookleaf.com", password: "admin123" },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <span className="brand-mark" aria-hidden="true">
        B
      </span>
      {compact ? "BOOKLEAF" : "BookLeaf"}
    </span>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const openSales = useRef<() => void>(() => {});
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
      const signedIn = await login(email, password);
      navigate(signedIn.role === "ADMIN" ? "/admin/tickets" : "/books", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="site">
      <header>
        <div className="site-nav">
          <a href="#login">
            <Brand />
          </a>
          <nav>
            <a className="active" href="#login">
              Home
            </a>
            <a href="#packages">Packages</a>
            <a href="#login">Royalties</a>
            <a href="#login">Support</a>
          </nav>
        </div>
        <div className="site-meta">
          <div className="site-meta-inner">
            <Brand compact />
            <span className="site-meta-item">Delhi workshop · India &amp; US</span>
            <span className="site-meta-item">authors@bookleaf.com</span>
            <button type="button" className="btn btn-pill" onClick={() => openSales.current()}>
              Publish with us
            </button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div>
          <h1>Author Login</h1>
          <p>
            <a href="#login">Home</a> / Author Login
          </p>
        </div>
      </section>

      <section className="login-band" id="login">
        <form className="login-panel" onSubmit={onSubmit}>
          <h2>Use your credentials to login and know your royalties.</h2>
          <div className="form">
            <label>
              <span className="hint">Email</span>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span className="hint">Password</span>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <div className="banner banner-error">{error}</div>}
            <button className="btn btn-pill" disabled={submitting}>
              {submitting ? "Signing in…" : "Submit"}
            </button>
          </div>
        </form>
        <div className="demo-accounts">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="btn btn-ghost btn-sm demo-btn"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
              }}
            >
              {account.label}
            </button>
          ))}
        </div>
      </section>

      <section className="package-band" id="packages">
        <div className="package-band-inner">
          <article className="card">
            <h3>Standard Free</h3>
            <p className="muted">No upfront cost. Cover, typesetting, ISBN, printing, distribution, and royalties. BookLeaf is paid from its 20% of net profit.</p>
          </article>
          <article className="card">
            <h3>Bestseller Breakthrough</h3>
            <p className="muted">The paid package, with marketing and distribution add-ons on the same publishing path. The team quotes the current price.</p>
          </article>
        </div>
      </section>

      <footer className="site-foot">BookLeaf Publishing · India &amp; US · Author royalties paid quarterly</footer>
      <ChatWidget
        kind="sales"
        hideLauncher
        onReady={(open) => {
          openSales.current = open;
        }}
      />
    </div>
  );
}
