import { useGetMe, useGetSettings, getGetMeQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowRight, CheckCircle2, ShieldCheck, Banknote, Star, Send } from "lucide-react";
import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
  const { data: user, isLoading: authLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const { data: settings } = useGetSettings();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    if (!authLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, authLoading, setLocation]);

  const steps = [
    {
      icon: ShieldCheck,
      title: t("home_step1_title"),
      desc: t("home_step1_desc"),
    },
    {
      icon: CheckCircle2,
      title: t("home_step2_title"),
      desc: t("home_step2_desc"),
    },
    {
      icon: Banknote,
      title: t("home_step3_title"),
      desc: t("home_step3_desc"),
    },
  ];

  return (
    <Layout>
      <div className="flex-1 flex flex-col">
        {/* ── Hero ── */}
        <section
          className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 relative overflow-hidden"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, hsl(57,100%,39%) 0%, hsl(57,100%,32%) 70%)",
          }}
        >
          {/* Decorative gold orb */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10 max-w-4xl mx-auto">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-8 uppercase tracking-widest"
              style={{
                background: "hsl(57,90%,39%)",
                border: "1px solid hsl(43,40%,30%,0.5)",
                color: "hsl(43,85%,28%)",
              }}
            >
              <Star className="w-3 h-3 fill-current" />
              {t("home_hero_highlight")} · {t("home_hero_badge")}
            </div>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight"
              style={{
                background: "linear-gradient(170deg, #FFD700 10%, #D4AF37 50%, #F1E5AC 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t("home_hero_title")}{" "}
              <br className="hidden sm:block" />
              {t("home_hero_highlight")}.
            </h1>

            <p
              className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
              style={{ color: "hsl(57,90%,12%)" }}
            >
              {t("home_hero_subtitle")}
            </p>

            {settings && (
              <div
                className="inline-flex items-center justify-center rounded-full px-6 py-3 mb-10 text-lg font-semibold"
                style={{
                  background: "hsl(57,90%,39%)",
                  border: "1px solid hsl(43,40%,30%,0.5)",
                  color: "hsl(57,95%,8%)",
                  boxShadow: "0 4px 20px rgba(212,175,55,0.15)",
                }}
              >
                {t("home_rate_label")}{" "}
                <span
                  className="font-extrabold ml-2 mr-1"
                  style={{ color: "#FFD700" }}
                >
                  {settings.pricePerEmail} ETB
                </span>{" "}
                {t("home_rate_suffix")}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="gold-btn inline-flex items-center justify-center gap-2 rounded-xl text-base font-bold h-13 px-8 w-full sm:w-auto"
                style={{ height: "3.25rem" }}
              >
                {t("home_cta_earn")}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl text-base font-semibold h-13 px-8 w-full sm:w-auto transition-all duration-200"
                style={{
                  height: "3.25rem",
                  background: "transparent",
                  border: "1.5px solid hsl(43,40%,38%)",
                  color: "hsl(43,60%,68%)",
                }}
              >
                {t("home_cta_signin")}
              </Link>
              {settings?.telegramBotUsername && (
                <a
                  href={`https://t.me/${settings.telegramBotUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl text-base font-semibold w-full sm:w-auto transition-all duration-200 hover:brightness-110"
                  style={{
                    height: "3.25rem",
                    paddingLeft: "2rem",
                    paddingRight: "2rem",
                    background: "hsl(200,80%,14%)",
                    border: "1.5px solid hsl(200,60%,30%,0.6)",
                    color: "#29B6F6",
                  }}
                >
                  <Send className="h-4 w-4" />
                  Open in Telegram
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section
          className="py-16 px-4"
          style={{ background: "hsl(57,100%,32%)", borderTop: "1px solid hsl(43,30%,22%,0.3)" }}
        >
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <h2
                className="text-2xl sm:text-3xl font-bold tracking-tight mb-3"
                style={{ color: "hsl(43,85%,28%)" }}
              >
                {t("home_how_title")}
              </h2>
              <p style={{ color: "hsl(57,85%,18%)" }} className="text-base max-w-xl mx-auto">
                {t("home_how_subtitle")}
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {steps.map((step, i) => (
                <div key={i} className="luxury-card rounded-2xl p-6 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{
                      background: "linear-gradient(145deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))",
                      border: "1px solid rgba(212,175,55,0.3)",
                      boxShadow: "0 0 20px rgba(212,175,55,0.1)",
                    }}
                  >
                    <step.icon className="h-7 w-7" style={{ color: "hsl(43,85%,28%)" }} />
                  </div>
                  <div
                    className="text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: "hsl(43,40%,50%)" }}
                  >
                    {t("home_step_label")} {i + 1}
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: "hsl(43,85%,28%)" }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "hsl(57,85%,18%)" }}>{step.desc}</p>
                </div>
              ))}
            </div>

            {/* closing note */}
            <p className="text-center mt-10 text-base font-semibold" style={{ color: "hsl(43,85%,28%)" }}>
              {t("home_how_closing")}
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
