import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "en" | "am";

const translations = {
  en: {
    // Navbar
    nav_dashboard: "Dashboard",
    nav_sell: "Sell Account",
    nav_withdraw: "Withdraw",
    nav_signin: "Sign In",
    nav_get_started: "Get Started",
    nav_profile: "Profile & History",
    nav_logout: "Log out",
    nav_wallet: "Wallet",
    nav_admin_title: "Admin Access",
    nav_admin_desc: "Enter the admin password to continue.",
    nav_admin_placeholder: "Admin password",
    nav_admin_checking: "Checking...",
    nav_admin_enter: "Enter Admin Panel",

    // Home
    home_hero_title: "Turn your unused email accounts into",
    home_hero_highlight: "real cash",
    home_hero_subtitle:
      "The trusted digital marketplace where Ethiopian users earn money by securely selling email accounts. Instant payouts via Telebirr.",
    home_rate_label: "Current rate:",
    home_rate_suffix: "per approved email",
    home_cta_earn: "Start Earning Now",
    home_cta_signin: "Sign In to Dashboard",
    home_how_title: "How it works",
    home_how_subtitle:
      "A simple, secure process to monetize your accounts in three easy steps.",
    home_hero_badge: "Ethiopia's #1 Email Marketplace",
    home_step_label: "Step",
    home_step1_title: "1. Submit Securely",
    home_step1_desc:
      "Create an account and submit your valid email credentials through our secure encrypted platform.",
    home_step2_title: "2. Fast Verification",
    home_step2_desc:
      "Our team reviews your submission quickly. Once approved, the funds are instantly added to your wallet.",
    home_step3_title: "3. Withdraw Cash",
    home_step3_desc:
      "Request a withdrawal to your Telebirr account and get your cash within hours.",

    // Login
    login_title: "Welcome back",
    login_subtitle: "Sign in to your ሜል ማርት account",
    login_email: "Email",
    login_password: "Password",
    login_signing: "Signing in...",
    login_submit: "Sign in",
    login_no_account: "Don't have an account?",
    login_create: "Create one",
    login_success_title: "Welcome back!",
    login_success_desc: "You have successfully logged in.",
    login_error_title: "Login failed",
    login_error_desc: "Please check your credentials and try again.",

    // Register
    register_title: "Create an account",
    register_subtitle: "Join ሜል ማርት to start earning today",
    register_email: "Email",
    register_password: "Password",
    register_creating: "Creating account...",
    register_submit: "Sign up",
    register_have_account: "Already have an account?",
    register_signin: "Sign in",
    register_success_title: "Account created!",
    register_success_desc: "You have successfully registered.",
    register_error_title: "Registration failed",

    // Dashboard
    dash_welcome: "Welcome back!",
    dash_subtitle: "Here's an overview of your earnings and submissions.",
    dash_withdraw_btn: "Withdraw Funds",
    dash_sell_btn: "Sell Account",
    dash_balance: "Available Balance",
    dash_approved: "Approved Accounts",
    dash_pending: "Pending Verification",
    dash_recent_subs: "Recent Submissions",
    dash_view_all: "View all",
    dash_no_subs: "No submissions yet.",
    dash_first_sub: "Submit your first account",
    dash_recent_wd: "Recent Withdrawals",
    dash_no_wd: "No withdrawal requests yet.",

    // Submit
    submit_back: "Back to Dashboard",
    submit_title: "Sell an Email Account",
    submit_subtitle_pre: "Submit an email account and earn",
    submit_subtitle_post: "when approved.",
    submit_success_title: "Submission received!",
    submit_success_desc:
      "Your account is under review. You will be credited once approved.",
    submit_card_title: "Account Details",
    submit_card_desc:
      "Enter the email and password of the account you are selling.",
    submit_email_label: "Email Address",
    submit_email_placeholder: "example@gmail.com",
    submit_password_label: "Password",
    submit_password_placeholder: "Account password",
    submit_submitting: "Submitting...",
    submit_btn: "Submit for Review",
    submit_error_title: "Error",

    // Withdraw
    wd_back: "Back to Dashboard",
    wd_title: "Withdraw Funds",
    wd_balance_label: "Available balance:",
    wd_success_desc:
      "Withdrawal request submitted! Admin will send payment to your Telebirr account.",
    wd_card_title: "Telebirr Payment Info",
    wd_card_desc:
      "Enter the Telebirr account you want to receive payment on.",
    wd_amount_label: "Amount (ETB)",
    wd_amount_placeholder: "Enter amount",
    wd_telebirr_label: "Telebirr Number",
    wd_telebirr_placeholder: "09XXXXXXXX",
    wd_name_label: "Account Holder Name",
    wd_name_placeholder: "Full name on Telebirr",
    wd_submitting: "Submitting...",
    wd_btn: "Request Withdrawal",
    wd_no_balance: "You need an approved submission before withdrawing.",
    wd_error_exceed: "Cannot exceed your balance of",
    wd_toast_title: "Request submitted!",
    wd_toast_desc: "Admin will process your Telebirr payment.",

    // Profile
    profile_title: "My Profile",
    profile_balance: "Balance",
    profile_approved: "Approved",
    profile_pending: "Pending",
    profile_tab_subs: "Submissions",
    profile_tab_wd: "Withdrawals",
    profile_all_subs: "All Submitted Accounts",
    profile_no_subs: "No submissions yet.",
    profile_first_sub: "Submit your first account",
    profile_wd_history: "Withdrawal History",
    profile_no_wd: "No withdrawals yet.",
    profile_request_wd: "Request a withdrawal",

    // Not found
    notfound_title: "404 Page Not Found",
    notfound_desc: "Did you forget to add the page to the router?",

    // Status
    status_approved: "Approved",
    status_rejected: "Rejected",
    status_pending: "Pending",
    status_completed: "Completed",

    // Referral
    referral_card_title: "Earn Commission by Referring Friends",
    referral_card_desc: "Share your referral link. Every time a friend's submission gets approved, you earn a commission.",
    referral_code_label: "Your Referral Code",
    referral_link_label: "Your Referral Link",
    referral_copy: "Copy Link",
    referral_copied: "Copied!",
    referral_friends: "Friends Referred",
    referral_earned: "Total Commission Earned",
    referral_how: "How it works: your friend registers with your link → submits a Gmail account → gets approved → you earn commission automatically.",
    referral_share_tg: "Share on Telegram",
    referral_share_tg_msg: "Join ሜል ማርት and earn money by selling unused email accounts! Register with my link:",

    // Register referral
    register_ref_label: "Referral Code (optional)",
    register_ref_placeholder: "e.g. ABC12345",
  },

  am: {
    // Navbar
    nav_dashboard: "ዳሽቦርድ",
    nav_sell: "አካውንት ሸጥ",
    nav_withdraw: "አውጣ",
    nav_signin: "ግባ",
    nav_get_started: "ጀምር",
    nav_profile: "ፕሮፋይልና ታሪክ",
    nav_logout: "ውጣ",
    nav_wallet: "ቦርሳ",
    nav_admin_title: "የአስተዳዳሪ ማስገቢያ",
    nav_admin_desc: "ለመቀጠል የአስተዳዳሪ ፓስዎርድ አስገባ።",
    nav_admin_placeholder: "የአስተዳዳሪ ፓስዎርድ",
    nav_admin_checking: "እየፈተነ ነው...",
    nav_admin_enter: "ወደ አስተዳዳሪ ፓናል ግባ",

    // Home
    home_hero_title: "ያልተጠቀሙባቸው ኢሜይል አካውንቶችዎን ወደ",
    home_hero_highlight: "ጥሬ ገንዘብ",
    home_hero_subtitle:
      "የኢትዮጵያ ተጠቃሚዎች ኢሜይል አካውንቶቻቸውን በደህንነት ሸጠው ገንዘብ የሚያገኙበት ታመኝ ዲጂታል ገበያ። ወዲያው ክፍያ በቴሌብር።",
    home_rate_label: "አሁናዊ ዋጋ:",
    home_rate_suffix: "ለእያንዳንዱ ጸድቆ ኢሜይል",
    home_cta_earn: "አሁን ማግኘት ጀምር",
    home_cta_signin: "ወደ ዳሽቦርድ ግባ",
    home_how_title: "እንዴት ይሰራል",
    home_how_subtitle:
      "አካውንቶችዎን ለማትረፍ ቀላልና ደህንነቱ የተጠበቀ ሂደት በሦስት ቀላል ደረጃዎች።",
    home_hero_badge: "የኢትዮጵያ ቁጥር 1 ኢሜይል ገበያ",
    home_step_label: "ደረጃ",
    home_step1_title: "1. በደህንነት አቅርብ",
    home_step1_desc:
      "አካውንት ፍጠርና ትክክለኛ የኢሜይል ምስክር ወረቀቶቸን ባማኝ ምስጠራ ፕሌትፎርም አቅርብ።",
    home_step2_title: "2. ፈጣን ማረጋገጫ",
    home_step2_desc:
      "ቡድናችን ያቀረብከውን ፈጥኖ ያጣራል። ሲጸድቅ ገንዘቡ ወዲያው ወደ ቦርሳህ ይገባል።",
    home_step3_title: "3. ጥሬ ገንዘብ አውጣ",
    home_step3_desc:
      "ወደ ቴሌብር አካውንትህ የወጪ ጥያቄ ጠይቅና ገንዘቡን ከጥቂት ሰዓታት ውስጥ ተቀበል።",

    // Login
    login_title: "እንኳን ደህና ተመለሱ",
    login_subtitle: "ወደ ሜል ማርት አካውንትህ ግባ",
    login_email: "ኢሜይል",
    login_password: "ፓስዎርድ",
    login_signing: "እየገባ ነው...",
    login_submit: "ግባ",
    login_no_account: "አካውንት የለህም?",
    login_create: "ፍጠር",
    login_success_title: "እንኳን ደህና ተመለሱ!",
    login_success_desc: "በትክክል ገብተዋል።",
    login_error_title: "መግቢያ አልተሳካም",
    login_error_desc: "ምስክር ወረቀቶቸን ያረጋግጡና ዳግም ይሞክሩ።",

    // Register
    register_title: "አካውንት ፍጠር",
    register_subtitle: "ዛሬ ትርፍ ለማግኘት ሜል ማርት ተቀላቀል",
    register_email: "ኢሜይል",
    register_password: "ፓስዎርድ",
    register_creating: "አካውንት እየተፈጠረ ነው...",
    register_submit: "ተመዝገብ",
    register_have_account: "አካውንት አለህ?",
    register_signin: "ግባ",
    register_success_title: "አካውንት ተፈጥሯል!",
    register_success_desc: "በትክክል ተመዝግበዋል።",
    register_error_title: "ምዝገባ አልተሳካም",

    // Dashboard
    dash_welcome: "እንኳን ደህና ተመለሱ!",
    dash_subtitle: "የገቢዎና ያቅርቦቶ አጭር ሪፖርት እዚህ አለ።",
    dash_withdraw_btn: "ገንዘብ አውጣ",
    dash_sell_btn: "አካውንት ሸጥ",
    dash_balance: "ያለ ቀሪ",
    dash_approved: "የጸደቁ አካውንቶች",
    dash_pending: "ማረጋገጫ በጥበቃ ላይ",
    dash_recent_subs: "ቅርብ ጊዜ ያቀረቡት",
    dash_view_all: "ሁሉ ይመልከቱ",
    dash_no_subs: "እስካሁን ምንም ማቅረቢያ የለም።",
    dash_first_sub: "የመጀመሪያ አካውንትህን አቅርብ",
    dash_recent_wd: "ቅርብ ጊዜ ያወጡት",
    dash_no_wd: "እስካሁን የወጪ ጥያቄ የለም።",

    // Submit
    submit_back: "ወደ ዳሽቦርድ ተመለስ",
    submit_title: "ኢሜይል አካውንት ሸጥ",
    submit_subtitle_pre: "ኢሜይል አካውንት አቅርብና ትርፍ አግኝ",
    submit_subtitle_post: "ሲጸድቅ።",
    submit_success_title: "ማቅረቢያ ተቀብሏል!",
    submit_success_desc:
      "አካውንትህ እየታጠረ ነው። ሲጸድቅ ይከፈልሃል።",
    submit_card_title: "የአካውንት ዝርዝር",
    submit_card_desc:
      "የምትሸጠውን አካውንት ኢሜይልና ፓስዎርድ አስገባ።",
    submit_email_label: "የኢሜይል አድራሻ",
    submit_email_placeholder: "example@gmail.com",
    submit_password_label: "ፓስዎርድ",
    submit_password_placeholder: "የአካውንት ፓስዎርድ",
    submit_submitting: "እያቀረበ ነው...",
    submit_btn: "ለማጣራት አቅርብ",
    submit_error_title: "ስህተት",

    // Withdraw
    wd_back: "ወደ ዳሽቦርድ ተመለስ",
    wd_title: "ገንዘብ አውጣ",
    wd_balance_label: "ያለ ቀሪ:",
    wd_success_desc:
      "የወጪ ጥያቄ ቀርቧል! አስተዳዳሪ ክፍያ ወደ ቴሌብር አካውንትህ ይልካል።",
    wd_card_title: "የቴሌብር ክፍያ መረጃ",
    wd_card_desc:
      "ክፍያ ለመቀበል የምትፈልጉትን ቴሌብር አካውንት አስገቡ።",
    wd_amount_label: "መጠን (ብር)",
    wd_amount_placeholder: "መጠን አስገባ",
    wd_telebirr_label: "የቴሌብር ቁጥር",
    wd_telebirr_placeholder: "09XXXXXXXX",
    wd_name_label: "የአካውንት ባለቤት ስም",
    wd_name_placeholder: "በቴሌብር ላይ ሙሉ ስም",
    wd_submitting: "እያቀረበ ነው...",
    wd_btn: "የወጪ ጥያቄ አቅርብ",
    wd_no_balance: "ከማውጣትዎ በፊት ጸድቆ ማቅረቢያ ያስፈልግዎታል።",
    wd_error_exceed: "ቀሪዎን ሊያልፍ አይችልም",
    wd_toast_title: "ጥያቄ ቀርቧል!",
    wd_toast_desc: "አስተዳዳሪ የቴሌብር ክፍያዎን ያስኬዳል።",

    // Profile
    profile_title: "የእኔ ፕሮፋይል",
    profile_balance: "ቀሪ",
    profile_approved: "ጸድቋል",
    profile_pending: "በጥበቃ ላይ",
    profile_tab_subs: "ማቅረቢያዎች",
    profile_tab_wd: "ወጪዎች",
    profile_all_subs: "ሁሉም ያቀረቡ አካውንቶች",
    profile_no_subs: "እስካሁን ምንም ማቅረቢያ የለም።",
    profile_first_sub: "የመጀመሪያ አካውንትህን አቅርብ",
    profile_wd_history: "የወጪ ታሪክ",
    profile_no_wd: "እስካሁን ወጪ የለም።",
    profile_request_wd: "የወጪ ጥያቄ አቅርብ",

    // Not found
    notfound_title: "404 ፔጅ አልተገኘም",
    notfound_desc: "ፔጁን ወደ ራውተር ማከልዎ ረሱ?",

    // Status
    status_approved: "ጸድቋል",
    status_rejected: "ተቀባይነት አላገኘም",
    status_pending: "በጥበቃ ላይ",
    status_completed: "ተጠናቋል",

    // Referral
    referral_card_title: "ጓደኞቸን ጋብዘህ ኮሚሽን ተቀበል",
    referral_card_desc: "ሊንክህን አጋራ። ጓደኛህ ያቀረበ Gmail ሲጸድቅ ኮሚሽን ታገኛለህ።",
    referral_code_label: "የምልክት ኮድህ",
    referral_link_label: "የጋብዘ ሊንክህ",
    referral_copy: "ሊንክ ቅዳ",
    referral_copied: "ተቀድቷል!",
    referral_friends: "የጋበዟቸው ሰዎች",
    referral_earned: "ጠቅላላ ኮሚሽን",
    referral_how: "እንዴት ይሰራል: ጓደኛህ ሊንክህ ተጠቅሞ ይመዘገባል → Gmail ያቀርባል → ሲጸድቅ → ኮሚሽን ወዲያው ወደ ቦርሳህ ይገባል።",
    referral_share_tg: "ቴሌግራም ላይ አጋራ",
    referral_share_tg_msg: "ሜል ማርት ተቀላቀልና ያልተጠቀሙ ኢሜይሎቸን ሸጠህ ገንዘብ አግኝ! የእኔ ሊንክ ተጠቀም:",

    // Register referral
    register_ref_label: "የምልክት ኮድ (አስፈላጊ ካልሆነ ይተው)",
    register_ref_placeholder: "ምሳሌ ABC12345",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem("lang");
      return stored === "am" || stored === "en" ? stored : "am";
    } catch {
      return "am";
    }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  };

  const t = (key: TranslationKey): string => translations[lang][key];

  useEffect(() => {
    document.documentElement.lang = lang === "am" ? "am" : "en";
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
