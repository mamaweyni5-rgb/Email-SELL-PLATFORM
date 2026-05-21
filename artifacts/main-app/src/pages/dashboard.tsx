import { useGetMe, useGetProfile, useListSubmissions, useListWithdrawals, useGetReferralInfo, useListBroadcasts } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail, Wallet, Clock, CheckCircle, Users, Gift, Copy, Check, Send, Megaphone, X } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/lib/i18n";
import { tg, tgHaptic, isTelegram } from "@/lib/telegram";

function StatusPill({ status }: { status: string }) {
  const { t } = useLanguage();
  const label =
    status === "approved" ? t("status_approved")
    : status === "rejected" ? t("status_rejected")
    : status === "completed" ? t("status_completed")
    : t("status_pending");

  const cls =
    status === "approved" || status === "completed"
      ? "badge-approved"
      : status === "rejected"
      ? "badge-rejected"
      : "badge-pending";

  return (
    <span
      className={`${cls} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border`}
    >
      {label}
    </span>
  );
}

export default function Dashboard() {
  const { data: user, isLoading: authLoading, isError } = useGetMe({ query: { retry: false } });
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && (isError || !user)) {
      setLocation("/login");
    }
  }, [user, authLoading, isError, setLocation]);

  const { data: profile, isLoading: profileLoading } = useGetProfile({ query: { enabled: !!user, retry: false } });
  const { data: submissions, isLoading: submissionsLoading } = useListSubmissions({ query: { enabled: !!user, retry: false } });
  const { data: withdrawals, isLoading: withdrawalsLoading } = useListWithdrawals({ query: { enabled: !!user, retry: false } });
  const { data: referral } = useGetReferralInfo({ query: { enabled: !!user, retry: false } });
  const { data: broadcasts } = useListBroadcasts({ query: { enabled: !!user, retry: false } });
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const visibleBroadcasts = (broadcasts ?? []).slice(0, 3).filter((b) => !dismissedIds.has(b.id));

  const referralLink = referral?.referralCode
    ? `${window.location.origin}/register?ref=${referral.referralCode}`
    : "";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTelegramShare = () => {
    if (!referralLink) return;
    tgHaptic("medium");
    const msg = t("referral_share_tg_msg");
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(msg)}`;
    const webApp = tg();
    if (webApp && isTelegram()) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  if (authLoading || (user && !profile && profileLoading)) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
          <div className="space-y-3">
            <Skeleton className="h-9 w-48 rounded-xl" style={{ background: "hsl(344,65%,22%)" }} />
            <Skeleton className="h-5 w-72 rounded-lg" style={{ background: "hsl(344,65%,20%)" }} />
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[0,1,2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" style={{ background: "hsl(344,65%,20%)" }} />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-7 max-w-6xl">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-7">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: "#D4AF37" }}
            >
              {t("dash_welcome")}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "hsl(43,35%,58%)" }}>{t("dash_subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/withdraw"
              className="inline-flex items-center justify-center rounded-xl px-4 h-10 text-sm font-semibold transition-all"
              style={{
                border: "1.5px solid hsl(43,40%,35%)",
                color: "hsl(43,60%,65%)",
                background: "hsl(344,70%,16%)",
              }}
            >
              {t("dash_withdraw_btn")}
            </Link>
            <Link href="/submit" className="gold-btn inline-flex items-center justify-center rounded-xl px-5 h-10 text-sm font-bold">
              {t("dash_sell_btn")}
            </Link>
          </div>
        </div>

        {/* ── Announcements ── */}
        {visibleBroadcasts.length > 0 && (
          <div className="mb-7 space-y-2">
            {visibleBroadcasts.map((b) => (
              <div
                key={b.id}
                className="flex items-start gap-3 rounded-2xl px-4 py-3"
                style={{
                  background: "linear-gradient(135deg, hsl(40,70%,14%), hsl(344,80%,16%))",
                  border: "1px solid hsl(43,50%,28%,0.5)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  className="mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(212,175,55,0.18)", border: "1px solid rgba(212,175,55,0.3)" }}
                >
                  <Megaphone className="h-3.5 w-3.5" style={{ color: "#D4AF37" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm leading-snug" style={{ color: "#D4AF37" }}>{b.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "hsl(43,40%,62%)" }}>{b.message}</p>
                  <p className="text-xs mt-1" style={{ color: "hsl(43,30%,45%)" }}>
                    {format(new Date(b.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <button
                  onClick={() => setDismissedIds((s) => new Set([...s, b.id]))}
                  className="shrink-0 mt-0.5 rounded-lg p-1 transition-colors"
                  style={{ color: "hsl(43,30%,45%)" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Stat cards ── */}
        <div className="grid md:grid-cols-3 gap-5 mb-7">
          {/* Wallet */}
          <div className="stat-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.25)" }}
              >
                <Wallet className="h-4 w-4" style={{ color: "#D4AF37" }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(43,35%,58%)" }}>
                {t("dash_balance")}
              </span>
            </div>
            <div
              className="text-3xl font-extrabold"
              style={{
                background: "linear-gradient(145deg, #FFD700, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {profile?.walletBalance || 0} <span className="text-lg font-bold">ETB</span>
            </div>
          </div>

          {/* Approved */}
          <div className="stat-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(52,168,83,0.15)", border: "1px solid rgba(52,168,83,0.25)" }}
              >
                <CheckCircle className="h-4 w-4" style={{ color: "hsl(136,48%,50%)" }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(43,35%,58%)" }}>
                {t("dash_approved")}
              </span>
            </div>
            <div className="text-3xl font-extrabold" style={{ color: "hsl(46,68%,82%)" }}>
              {profile?.approvedSubmissions || 0}
            </div>
          </div>

          {/* Pending */}
          <div className="stat-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.2)" }}
              >
                <Clock className="h-4 w-4" style={{ color: "#D4AF37" }} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(43,35%,58%)" }}>
                {t("dash_pending")}
              </span>
            </div>
            <div className="text-3xl font-extrabold" style={{ color: "hsl(46,68%,82%)" }}>
              {profile?.pendingSubmissions || 0}
            </div>
          </div>
        </div>

        {/* ── Referral card ── */}
        {referral && (
          <div
            className="rounded-2xl p-6 mb-7"
            style={{
              background: "linear-gradient(135deg, hsl(348,85%,18%), hsl(344,80%,14%))",
              border: "1px solid hsl(43,40%,30%,0.4)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(212,175,55,0.1)",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Gift className="h-5 w-5" style={{ color: "#D4AF37" }} />
              <h3 className="font-bold text-base" style={{ color: "#D4AF37" }}>{t("referral_card_title")}</h3>
            </div>
            <p className="text-xs mb-5" style={{ color: "hsl(43,35%,58%)" }}>{t("referral_card_desc")}</p>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: "hsl(344,70%,16%)", border: "1px solid hsl(43,30%,25%,0.4)" }}
              >
                <div className="flex items-center justify-center gap-1 text-xs mb-1" style={{ color: "hsl(43,35%,55%)" }}>
                  <Users className="h-3 w-3" />
                  {t("referral_friends")}
                </div>
                <div className="text-2xl font-extrabold" style={{ color: "#D4AF37" }}>{referral.referralCount ?? 0}</div>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: "hsl(344,70%,16%)", border: "1px solid hsl(43,30%,25%,0.4)" }}
              >
                <div className="flex items-center justify-center gap-1 text-xs mb-1" style={{ color: "hsl(43,35%,55%)" }}>
                  <Wallet className="h-3 w-3" />
                  {t("referral_earned")}
                </div>
                <div className="text-2xl font-extrabold" style={{ color: "#D4AF37" }}>{referral.commissionEarned ?? 0} ETB</div>
              </div>
            </div>

            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(43,35%,55%)" }}>
              {t("referral_link_label")}
            </label>
            <div className="flex gap-2 mt-2">
              <Input
                value={referralLink}
                readOnly
                className="luxury-input text-xs font-mono rounded-lg h-9"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all"
                style={{
                  background: copied ? "hsl(136,40%,20%)" : "hsl(344,70%,20%)",
                  border: "1.5px solid " + (copied ? "hsl(136,48%,35%)" : "hsl(43,40%,32%)"),
                  color: copied ? "hsl(136,60%,65%)" : "hsl(43,60%,65%)",
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t("referral_copied") : t("referral_copy")}
              </button>
            </div>

            {/* ── Telegram Share Button ── */}
            <button
              onClick={handleTelegramShare}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl h-11 font-bold text-sm transition-all duration-200 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #229ED9 0%, #1a85b8 100%)",
                boxShadow: "0 4px 16px rgba(34,158,217,0.35), 0 0 0 1px rgba(34,158,217,0.2) inset",
                color: "#ffffff",
              }}
            >
              <Send className="h-4 w-4" />
              {t("referral_share_tg")}
            </button>

            <p className="text-xs mt-3" style={{ color: "hsl(43,30%,50%)" }}>{t("referral_how")}</p>
          </div>
        )}

        {/* ── Recent activity ── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Submissions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold" style={{ color: "#D4AF37" }}>{t("dash_recent_subs")}</h2>
              <Link href="/profile" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "hsl(43,50%,60%)" }}>
                {t("dash_view_all")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "hsl(348,82%,16%)",
                border: "1px solid hsl(43,30%,24%,0.4)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              {submissionsLoading ? (
                <div className="p-5 space-y-3">
                  {[0,1].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" style={{ background: "hsl(344,65%,20%)" }} />)}
                </div>
              ) : submissions && submissions.length > 0 ? (
                <div>
                  {submissions.slice(0, 5).map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="px-4 py-3 flex items-center justify-between transition-colors luxury-row"
                      style={{ borderTop: idx > 0 ? "1px solid hsl(344,55%,22%)" : "none" }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div
                          className="p-2 rounded-lg shrink-0"
                          style={{ background: "hsl(344,70%,20%)", border: "1px solid hsl(43,30%,24%,0.3)" }}
                        >
                          <Mail className="h-3.5 w-3.5" style={{ color: "#D4AF37" }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: "hsl(46,68%,82%)" }}>{sub.email}</p>
                          <p className="text-xs" style={{ color: "hsl(43,30%,50%)" }}>{format(new Date(sub.createdAt), "MMM d, yyyy")}</p>
                          {sub.status === "rejected" && sub.rejectionNote && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: "hsl(5,75%,65%)" }}>⚠ {sub.rejectionNote}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="font-bold text-sm" style={{ color: "#D4AF37" }}>{sub.pricePaid} ETB</span>
                        <StatusPill status={sub.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center flex flex-col items-center">
                  <Mail className="h-8 w-8 mb-3" style={{ color: "hsl(43,30%,35%)" }} />
                  <p className="text-sm mb-2" style={{ color: "hsl(43,30%,50%)" }}>{t("dash_no_subs")}</p>
                  <Link href="/submit" className="text-xs font-semibold" style={{ color: "#D4AF37" }}>{t("dash_first_sub")}</Link>
                </div>
              )}
            </div>
          </div>

          {/* Withdrawals */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold" style={{ color: "#D4AF37" }}>{t("dash_recent_wd")}</h2>
              <Link href="/profile" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "hsl(43,50%,60%)" }}>
                {t("dash_view_all")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "hsl(348,82%,16%)",
                border: "1px solid hsl(43,30%,24%,0.4)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              {withdrawalsLoading ? (
                <div className="p-5 space-y-3">
                  {[0,1].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" style={{ background: "hsl(344,65%,20%)" }} />)}
                </div>
              ) : withdrawals && withdrawals.length > 0 ? (
                <div>
                  {withdrawals.slice(0, 5).map((wd, idx) => (
                    <div
                      key={wd.id}
                      className="px-4 py-3 flex items-center justify-between transition-colors luxury-row"
                      style={{ borderTop: idx > 0 ? "1px solid hsl(344,55%,22%)" : "none" }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div
                          className="p-2 rounded-lg shrink-0"
                          style={{ background: "hsl(344,70%,20%)", border: "1px solid hsl(43,30%,24%,0.3)" }}
                        >
                          <Wallet className="h-3.5 w-3.5" style={{ color: "#D4AF37" }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: "hsl(46,68%,82%)" }}>{wd.telebirrNumber}</p>
                          <p className="text-xs" style={{ color: "hsl(43,30%,50%)" }}>{format(new Date(wd.createdAt), "MMM d, yyyy")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="font-bold text-sm" style={{ color: "#D4AF37" }}>{wd.amount} ETB</span>
                        <StatusPill status={wd.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center flex flex-col items-center">
                  <Wallet className="h-8 w-8 mb-3" style={{ color: "hsl(43,30%,35%)" }} />
                  <p className="text-sm" style={{ color: "hsl(43,30%,50%)" }}>{t("dash_no_wd")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
