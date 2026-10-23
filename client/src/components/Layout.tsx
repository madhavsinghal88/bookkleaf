import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { ChatWidget } from "./ChatWidget";

const AUTHOR_LINKS = [
  { to: "/books", label: "My Books" },
  { to: "/tickets", label: "My Tickets" },
  { to: "/tickets/new", label: "New Query" },
];

const ADMIN_LINKS = [
  { to: "/admin/tickets", label: "Ticket Queue" },
  { to: "/admin/insights", label: "Insights" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const links = user?.role === "ADMIN" ? ADMIN_LINKS : AUTHOR_LINKS;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              B
            </span>
            BookLeaf
          </span>
          <nav className="nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={({ isActive }) => (isActive ? "active" : undefined)}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-user">
            <span className="muted">{user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="site-foot">BookLeaf Publishing · {user?.role === "ADMIN" ? "Support Desk" : "Author Portal"}</footer>
      {user?.role === "AUTHOR" && <ChatWidget kind="support" />}
    </div>
  );
}
