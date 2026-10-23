import { useEffect, useState, type FormEvent } from "react";
import { api, tokenStore } from "../api/client";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ErrorBanner } from "../components/ui";
import { useI18n, type Language } from "../i18n";
import { date } from "../lib/format";

interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  language: Language;
  author: { id: string; phone: string | null; city: string | null; joinedDate: string } | null;
}

export function ProfilePage() {
  const { user, updateSession } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [chosen, setChosen] = useState<Language>(language);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<ProfileResponse>("/auth/me")
      .then((me) => {
        setProfile(me);
        setName(me.name);
        setPhone(me.author?.phone ?? "");
        setCity(me.author?.city ?? "");
        setChosen(me.language);
        setLanguage(me.language);
      })
      .catch(setError);
  }, [setLanguage]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const saved = await api.patch<{ token: string; profile: ProfileResponse }>("/auth/me", {
        name,
        phone,
        city,
        language: chosen,
      });
      tokenStore.set(saved.token);
      setProfile(saved.profile);
      setLanguage(saved.profile.language);
      if (user) updateSession({ ...user, name: saved.profile.name });
      setNotice(t("profileSaved"));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Could not save profile"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="narrow">
      <h1>{t("profileTitle")}</h1>
      <p className="muted">{t("profileLead")}</p>
      <form className="card form" onSubmit={onSubmit}>
        <label>
          {t("name")}
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
        </label>
        <label>
          {t("email")}
          <input value={profile?.email ?? user?.email ?? ""} disabled />
          <span className="hint">{t("emailFixed")}</span>
        </label>
        {user?.role === "AUTHOR" && (
          <>
            <label>
              {t("phone")}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
            </label>
            <label>
              {t("city")}
              <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
            </label>
          </>
        )}
        <fieldset className="language-choice">
          <legend>{t("language")}</legend>
          <label>
            <input type="radio" name="language" checked={chosen === "en"} onChange={() => { setChosen("en"); setLanguage("en"); }} />
            {t("english")}
          </label>
          <label>
            <input type="radio" name="language" checked={chosen === "hi"} onChange={() => { setChosen("hi"); setLanguage("hi"); }} />
            {t("hindi")}
          </label>
        </fieldset>
        {profile?.author?.joinedDate && (
          <p className="muted small">
            {t("joined")} {date(profile.author.joinedDate)}
            {profile.author.city ? ` · ${profile.author.city}` : ""}
          </p>
        )}
        {notice && <div className="banner banner-success">{notice}</div>}
        <ErrorBanner error={error} />
        <div className="form-actions">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? t("saving") : t("saveProfile")}
          </button>
        </div>
      </form>
    </div>
  );
}
