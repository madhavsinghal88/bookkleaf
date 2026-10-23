import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { api, tokenStore } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useI18n, type Language } from "../i18n";
import { ChatWidget } from "./ChatWidget";

export function Layout() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const links =
    user?.role === "ADMIN"
      ? [
          { to: "/admin/tickets", label: t("ticketQueue") },
          { to: "/admin/insights", label: t("insights") },
        ]
      : [
          { to: "/books", label: t("myBooks") },
          { to: "/tickets", label: t("myTickets") },
          { to: "/tickets/new", label: t("newQuery") },
        ];

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [menuOpen]);

  function chooseLanguage(next: Language) {
    setLanguage(next);
    setMenuOpen(false);
    if (!user) return;
    api
      .patch<{ token: string }>("/auth/me", { name: user.name, language: next })
      .then((saved) => tokenStore.set(saved.token))
      .catch(() => {
        // The choice still applies in this browser even if the save doesn't.
      });
  }

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
          <div className="topbar-user" ref={menuRef}>
            <button type="button" className="account-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
              {user?.name}
            </button>
            {menuOpen && (
              <div className="account-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/profile");
                  }}
                >
                  {t("profile")}
                </button>
                <p className="account-label">{t("language")}</p>
                <button type="button" role="menuitem" className={language === "en" ? "active" : undefined} onClick={() => chooseLanguage("en")}>
                  {t("english")}
                </button>
                <button type="button" role="menuitem" className={language === "hi" ? "active" : undefined} onClick={() => chooseLanguage("hi")}>
                  {t("hindi")}
                </button>
                <button type="button" role="menuitem" onClick={logout}>
                  {t("logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="site-foot">BookLeaf Publishing · {user?.role === "ADMIN" ? t("supportDesk") : t("authorPortal")}</footer>
      {user?.role === "AUTHOR" && <ChatWidget kind="support" />}
    </div>
  );
}
