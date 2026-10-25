import { useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";
import { ChatWidget, OPEN_SALES_THREAD_KEY } from "../components/ChatWidget";

const SALES_SESSION_KEY = "bookleaf.salesSession";
const COUNTRY_CODES = [
  { code: "IN", dial: "+91" },
  { code: "US", dial: "+1" },
  { code: "GB", dial: "+44" },
  { code: "AE", dial: "+971" },
];

function salesSessionId() {
  const existing = localStorage.getItem(SALES_SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(SALES_SESSION_KEY, created);
  return created;
}

// Every author in bookleaf_sample_data.json, in file order, plus the support desk.
const DEMO_ACCOUNTS = [
  { label: "Priya Sharma", email: "priya.sharma@email.com", password: "author123", detail: "Mumbai" },
  { label: "Rohit Kapoor", email: "rohit.kapoor@email.com", password: "author123", detail: "Delhi" },
  { label: "Ananya Reddy", email: "ananya.reddy@email.com", password: "author123", detail: "Hyderabad" },
  { label: "Vikram Joshi", email: "vikram.joshi@email.com", password: "author123", detail: "Pune" },
  { label: "Meera Nair", email: "meera.nair@email.com", password: "author123", detail: "Kochi" },
  { label: "Arjun Malhotra", email: "arjun.malhotra@email.com", password: "author123", detail: "Chandigarh" },
  { label: "Sneha Kulkarni", email: "sneha.kulkarni@email.com", password: "author123", detail: "Bangalore" },
  { label: "Farhan Sheikh", email: "farhan.sheikh@email.com", password: "author123", detail: "Lucknow" },
  { label: "Kavita Deshmukh", email: "kavita.deshmukh@email.com", password: "author123", detail: "Nagpur" },
  { label: "Diya Chatterjee", email: "diya.chatterjee@email.com", password: "author123", detail: "Kolkata" },
  { label: "Admin: Aisha Verma", email: "admin@bookleaf.com", password: "admin123", detail: "Support desk" },
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
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCode, setLeadCode] = useState("IN");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSent, setLeadSent] = useState(false);
  const [leadSending, setLeadSending] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [chatRefresh, setChatRefresh] = useState(0);

  if (user) return <Navigate to={user.role === "ADMIN" ? "/admin/tickets" : "/books"} replace />;

  async function signInAs(nextEmail: string, nextPassword: string) {
    setEmail(nextEmail);
    setPassword(nextPassword);
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await login(nextEmail, nextPassword);
      navigate(signedIn.role === "ADMIN" ? "/admin/tickets" : "/books", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void signInAs(email, password);
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
            <a href="#about">About</a>
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
          <p className="demo-caption">Sample authors from the dataset. Every author password is author123.</p>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="btn btn-ghost btn-sm demo-btn"
              disabled={submitting}
              onClick={() => void signInAs(account.email, account.password)}
            >
              <span>{account.label}</span>
              <small>
                {account.detail} · {account.email}
              </small>
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

      <section className="reach" id="about">
        <h2>Ready To Publish Your Book? Get in touch Now!</h2>
        <form
          className="reach-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setLeadError(null);
            setLeadSent(false);
            setLeadSending(true);
            const dial = COUNTRY_CODES.find((item) => item.code === leadCode)?.dial ?? "";
            try {
              const saved = await api.post<{ threadId: string }>("/chat/sales", {
                sessionId: salesSessionId(),
                message: `I'd like to publish with BookLeaf. Name: ${leadName.trim()}. Email: ${leadEmail.trim()}. Phone: ${dial} ${leadPhone.trim()}.`,
              });
              sessionStorage.setItem(OPEN_SALES_THREAD_KEY, saved.threadId);
              setLeadSent(true);
              setChatRefresh((value) => value + 1);
            } catch (err) {
              setLeadError(err instanceof ApiError ? err.message : "Couldn't send that. Try the publishing advisor.");
            } finally {
              setLeadSending(false);
            }
          }}
        >
          <label>
            <span>Full Name *</span>
            <input value={leadName} onChange={(event) => setLeadName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
          </label>
          <label>
            <span>Email *</span>
            <input type="email" value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} required autoComplete="email" />
          </label>
          <div className="reach-phone">
            <label>
              <span>Code *</span>
              <select value={leadCode} onChange={(event) => setLeadCode(event.target.value)} aria-label="Country code">
                {COUNTRY_CODES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} {item.dial}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Phone *</span>
              <input value={leadPhone} onChange={(event) => setLeadPhone(event.target.value)} required inputMode="tel" autoComplete="tel" maxLength={20} />
            </label>
          </div>
          {leadError && <p className="reach-note">{leadError}</p>}
          {leadSent && <p className="reach-note">Sent. The publishing advisor has your details.</p>}
          <button className="btn btn-ink" disabled={leadSending}>
            {leadSending ? "Sending…" : "Get In Touch"}
          </button>
        </form>
      </section>

      <section className="about-stats" aria-label="About BookLeaf">
        <article>
          <span className="about-icon" aria-hidden="true">
            <PersonIcon />
          </span>
          <strong>150K+</strong>
          <span>Community Members</span>
        </article>
        <article>
          <span className="about-icon" aria-hidden="true">
            <BookIcon />
          </span>
          <strong>22K+</strong>
          <span>Books Published</span>
        </article>
        <article>
          <span className="about-icon" aria-hidden="true">
            <CopyIcon />
          </span>
          <strong>2M+</strong>
          <span>Copies Sold</span>
        </article>
        <article>
          <span className="about-icon" aria-hidden="true">
            <GlobeIcon />
          </span>
          <strong>150+</strong>
          <span>Countries Distributed</span>
        </article>
      </section>

      <section className="featured">
        <h2>Featured On</h2>
        <div className="featured-row">
          <span>Amazon India</span>
          <span>Flipkart</span>
          <span>Amazon US</span>
          <span>Amazon UK</span>
          <span>BookLeaf Store</span>
        </div>
      </section>

      <footer className="site-foot">BookLeaf Publishing · India &amp; US · Author royalties paid quarterly</footer>
      {!advisorOpen && (
        <button type="button" className="talk-fab" aria-label="Talk to BookLeaf" onClick={() => openSales.current()}>
          <ChatIcon />
        </button>
      )}
      <ChatWidget
        kind="sales"
        hideLauncher
        refreshKey={chatRefresh}
        onOpenChange={setAdvisorOpen}
        onReady={(open) => {
          openSales.current = open;
        }}
      />
    </div>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3" />
      <path d="M6 19c1.2-2.5 3.2-3.5 6-3.5s4.8 1 6 3.5" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z" />
      <path d="M5 5.5V21" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="8" y="8" width="11" height="12" rx="1.5" />
      <path d="M6 16H5.5A1.5 1.5 0 0 1 4 14.5v-10A1.5 1.5 0 0 1 5.5 3H15a1.5 1.5 0 0 1 1.5 1.5V6" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.2 2.4 2.2 13.6 0 16M12 4c-2.2 2.4-2.2 13.6 0 16" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.1A9 9 0 1 0 12 3zm-3.2 9.2a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm3.2 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm3.2 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2z" />
    </svg>
  );
}
