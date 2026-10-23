import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "hi";

const STORAGE_KEY = "bookleaf.lang";

const en = {
  myBooks: "My Books",
  myTickets: "My Tickets",
  newQuery: "New Query",
  ticketQueue: "Ticket Queue",
  insights: "Insights",
  profile: "Profile",
  language: "Language",
  logout: "Log out",
  english: "English",
  hindi: "हिन्दी",
  askQuestion: "Ask a question",
  copiesSold: "Copies sold",
  royaltyEarned: "Royalty earned",
  royaltyPaid: "Royalty paid",
  royaltyPending: "Royalty pending",
  royaltyPolicy:
    "Royalties are calculated quarterly and paid by bank transfer within 45 days of each quarter ending. Balances under ₹1,000 roll over to the next quarter.",
  published: "Published",
  mrp: "MRP",
  royaltyPerCopy: "Royalty / copy",
  totalEarned: "Total earned",
  paid: "Paid",
  pending: "Pending",
  lastPayout: "Last payout",
  noPayouts: "No payouts yet",
  publishedLive: "Published & Live",
  inProduction: "In production",
  belowThreshold:
    "Your pending royalty of {amount} is below the {threshold} payout threshold, so it will roll over and be paid once it crosses the threshold.",
  noSales: "No sales recorded yet. Royalties will appear here after your first sales.",
  availableOn: "Available on {platforms}",
  noPlatforms: "no platforms yet",
  printedBy: "Printed by {partner}",
  currentlyIn: "Currently in {stage}. Price, sales and royalties will appear once the book is published.",
  noBooks: "No books yet",
  noBooksBody: "Once your manuscript is received, it will appear here.",
  authorPortal: "Author Portal",
  supportDesk: "Support Desk",
  profileTitle: "Profile",
  profileLead: "Update your details and choose the language for this portal.",
  name: "Name",
  email: "Email",
  phone: "Phone",
  city: "City",
  emailFixed: "Email is your sign-in address and stays as it is.",
  saveProfile: "Save profile",
  saving: "Saving…",
  profileSaved: "Profile saved.",
  joined: "Author since",
  loading: "Loading…",
};

const hi: typeof en = {
  myBooks: "मेरी किताबें",
  myTickets: "मेरे टिकट",
  newQuery: "नई पूछताछ",
  ticketQueue: "टिकट कतार",
  insights: "इनसाइट्स",
  profile: "प्रोफ़ाइल",
  language: "भाषा",
  logout: "लॉग आउट",
  english: "English",
  hindi: "हिन्दी",
  askQuestion: "सवाल पूछें",
  copiesSold: "बिकी प्रतियाँ",
  royaltyEarned: "कुल रॉयल्टी",
  royaltyPaid: "रॉयल्टी भुगतान",
  royaltyPending: "बकाया रॉयल्टी",
  royaltyPolicy:
    "रॉयल्टी हर तिमाही जोड़ी जाती है और तिमाही खत्म होने के 45 दिनों के अंदर बैंक ट्रांसफर से दी जाती है। ₹1,000 से कम राशि अगली तिमाही में जुड़ जाती है।",
  published: "प्रकाशन",
  mrp: "एमआरपी",
  royaltyPerCopy: "प्रति प्रति रॉयल्टी",
  totalEarned: "कुल कमाई",
  paid: "भुगतान",
  pending: "बकाया",
  lastPayout: "आखिरी भुगतान",
  noPayouts: "अभी कोई भुगतान नहीं",
  publishedLive: "प्रकाशित और लाइव",
  inProduction: "प्रकाशन में",
  belowThreshold:
    "आपकी बकाया रॉयल्टी {amount} भुगतान सीमा {threshold} से कम है, इसलिए यह अगली तिमाही में जुड़ जाएगी और सीमा पार होने पर दी जाएगी।",
  noSales: "अभी कोई बिक्री दर्ज नहीं है। पहली बिक्री के बाद रॉयल्टी यहाँ दिखेगी।",
  availableOn: "उपलब्ध: {platforms}",
  noPlatforms: "अभी कोई प्लेटफ़ॉर्म नहीं",
  printedBy: "मुद्रण: {partner}",
  currentlyIn: "अभी {stage} पर है। कीमत, बिक्री और रॉयल्टी किताब प्रकाशित होने के बाद दिखेंगी।",
  noBooks: "अभी कोई किताब नहीं",
  noBooksBody: "पांडुलिपि मिलते ही वह यहाँ दिखेगी।",
  authorPortal: "लेखक पोर्टल",
  supportDesk: "सहायता डेस्क",
  profileTitle: "प्रोफ़ाइल",
  profileLead: "अपना विवरण बदलें और इस पोर्टल की भाषा चुनें।",
  name: "नाम",
  email: "ईमेल",
  phone: "फ़ोन",
  city: "शहर",
  emailFixed: "ईमेल आपका साइन-इन पता है और यहीं रहता है।",
  saveProfile: "प्रोफ़ाइल सहेजें",
  saving: "सहेजा जा रहा है…",
  profileSaved: "प्रोफ़ाइल सहेज ली गई।",
  joined: "लेखक बने",
  loading: "लोड हो रहा है…",
};

const STRINGS = { en, hi };
const STAGES: Record<Language, Record<string, string>> = {
  en: {
    "Manuscript Received": "Manuscript Received",
    Editing: "Editing",
    "Cover Design": "Cover Design",
    Typesetting: "Typesetting",
    Proofreading: "Proofreading",
    "ISBN Assignment": "ISBN Assignment",
    Printing: "Printing",
    "Distribution Setup": "Distribution Setup",
    "Published & Live": "Published & Live",
  },
  hi: {
    "Manuscript Received": "पांडुलिपि मिली",
    Editing: "संपादन",
    "Cover Design": "कवर डिज़ाइन",
    Typesetting: "टाइपसेटिंग",
    Proofreading: "प्रूफ़रीडिंग",
    "ISBN Assignment": "आईएसबीएन",
    Printing: "मुद्रण",
    "Distribution Setup": "वितरण सेटअप",
    "Published & Live": "प्रकाशित और लाइव",
  },
};

type Key = keyof typeof en;

function readStoredLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

interface I18nState {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: Key, vars?: Record<string, string>) => string;
  stage: (name: string) => string;
}

const I18nContext = createContext<I18nState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nState>(() => {
    const table = STRINGS[language];
    return {
      language,
      setLanguage,
      t: (key, vars) => {
        let text: string = table[key];
        if (vars) {
          for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, value);
        }
        return text;
      },
      stage: (name) => STAGES[language][name] ?? name,
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
