import { useGetMe, useGetProfile, useListSubmissions, useListWithdrawals } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Wallet, CheckCircle, Clock } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

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
    <span className={`${cls} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border`}>
      {label}
    </span>
  );
}

export default function Profile() {
  const { data: user, isLoading: authLoading } = useGetMe();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  const { data: profile, isLoading: profileLoading } = useGetProfile({ query: { enabled: !!user } });
  const { data: submissions, isLoading: subsLoading } = useListSubmissions({ query: { enabled: !!user } });
  const { data: withdrawals, isLoading: wdLoading } = useListWithdrawals({ query: { enabled: !!user } });

  if (authLoading || profileLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
          <Skeleton className="h-9 w-48 rounded-xl" style={{ background: "hsl(78,65%,20%)" }} />
          <Skeleton className="h-28 w-full rounded-2xl" style={{ background: "hsl(78,65%,18%)" }} />
          <Skeleton className="h-56 w-full rounded-2xl" style={{ background: "hsl(78,65%,18%)" }} />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-7">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#D4AF37" }}>
            {t("profile_title")}
          </h1>
          <p className="text-sm mt-1" style={{ color: "hsl(43,35%,55%)" }}>{user.name ?? user.email ?? ""}</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-7">
          <div
            className="stat-card rounded-2xl p-4"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Wallet className="h-3.5 w-3.5" style={{ color: "#D4AF37" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(43,35%,55%)" }}>
                {t("profile_balance")}
              </span>
            </div>
            <p
              className="text-2xl font-extrabold"
              style={{
                background: "linear-gradient(145deg, #FFD700, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {profile?.walletBalance ?? 0} ETB
            </p>
          </div>
          <div className="stat-card rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="h-3.5 w-3.5" style={{ color: "hsl(136,48%,50%)" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(43,35%,55%)" }}>
                {t("profile_approved")}
              </span>
            </div>
            <p className="text-2xl font-extrabold" style={{ color: "hsl(46,68%,82%)" }}>
              {profile?.approvedSubmissions ?? 0}
            </p>
          </div>
          <div className="stat-card rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5" style={{ color: "#D4AF37" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(43,35%,55%)" }}>
                {t("profile_pending")}
              </span>
            </div>
            <p className="text-2xl font-extrabold" style={{ color: "hsl(46,68%,82%)" }}>
              {profile?.pendingSubmissions ?? 0}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="submissions">
          <TabsList
            className="rounded-xl p-1 h-auto"
            style={{
              background: "hsl(78,80%,15%)",
              border: "1px solid hsl(43,30%,24%,0.4)",
            }}
          >
            <TabsTrigger
              value="submissions"
              className="rounded-lg text-sm font-semibold data-[state=active]:text-[hsl(78_90%_10%)] px-5 py-2"
              style={{ color: "hsl(43,40%,60%)" }}
            >
              {t("profile_tab_subs")}
            </TabsTrigger>
            <TabsTrigger
              value="withdrawals"
              className="rounded-lg text-sm font-semibold data-[state=active]:text-[hsl(78_90%_10%)] px-5 py-2"
              style={{ color: "hsl(43,40%,60%)" }}
            >
              {t("profile_tab_wd")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="mt-5">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "hsl(78,82%,16%)",
                border: "1px solid hsl(43,30%,24%,0.4)",
                boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div className="px-5 py-4 border-b" style={{ borderColor: "hsl(78,55%,22%)" }}>
                <h3 className="text-sm font-bold" style={{ color: "hsl(46,68%,78%)" }}>{t("profile_all_subs")}</h3>
              </div>
              <div className="p-4">
                {subsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-xl" style={{ background: "hsl(78,65%,20%)" }} />
                    ))}
                  </div>
                ) : !submissions || submissions.length === 0 ? (
                  <div className="text-center py-10 flex flex-col items-center">
                    <Mail className="h-10 w-10 mb-3" style={{ color: "hsl(43,30%,32%)" }} />
                    <p className="text-sm mb-2" style={{ color: "hsl(43,30%,50%)" }}>{t("profile_no_subs")}</p>
                    <Link href="/submit" className="text-xs font-semibold" style={{ color: "#D4AF37" }}>
                      {t("profile_first_sub")}
                    </Link>
                  </div>
                ) : (
                  <div>
                    {submissions.map((sub, idx) => (
                      <div
                        key={sub.id}
                        className="py-3 flex items-center justify-between luxury-row transition-colors"
                        style={{ borderTop: idx > 0 ? "1px solid hsl(78,55%,22%)" : "none" }}
                      >
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "hsl(46,68%,82%)" }}>{sub.email}</p>
                          <p className="text-xs mt-0.5" style={{ color: "hsl(43,30%,50%)" }}>
                            {format(new Date(sub.createdAt), "MMM d, yyyy")}
                          </p>
                          {sub.status === "rejected" && sub.rejectionNote && (
                            <p className="text-xs mt-1" style={{ color: "hsl(5,75%,65%)" }}>⚠ {sub.rejectionNote}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm" style={{ color: "#D4AF37" }}>{sub.pricePaid} ETB</span>
                          <StatusPill status={sub.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-5">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "hsl(78,82%,16%)",
                border: "1px solid hsl(43,30%,24%,0.4)",
                boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div className="px-5 py-4 border-b" style={{ borderColor: "hsl(78,55%,22%)" }}>
                <h3 className="text-sm font-bold" style={{ color: "hsl(46,68%,78%)" }}>{t("profile_wd_history")}</h3>
              </div>
              <div className="p-4">
                {wdLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-xl" style={{ background: "hsl(78,65%,20%)" }} />
                    ))}
                  </div>
                ) : !withdrawals || withdrawals.length === 0 ? (
                  <div className="text-center py-10 flex flex-col items-center">
                    <Wallet className="h-10 w-10 mb-3" style={{ color: "hsl(43,30%,32%)" }} />
                    <p className="text-sm mb-2" style={{ color: "hsl(43,30%,50%)" }}>{t("profile_no_wd")}</p>
                    <Link href="/withdraw" className="text-xs font-semibold" style={{ color: "#D4AF37" }}>
                      {t("profile_request_wd")}
                    </Link>
                  </div>
                ) : (
                  <div>
                    {withdrawals.map((wd, idx) => (
                      <div
                        key={wd.id}
                        className="py-3 flex items-center justify-between luxury-row transition-colors"
                        style={{ borderTop: idx > 0 ? "1px solid hsl(78,55%,22%)" : "none" }}
                      >
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "hsl(46,68%,82%)" }}>
                            {wd.paymentMethod === "bank"
                              ? `🏦 ${wd.bankName ?? ""} — ${wd.bankAccountNumber ?? ""}`
                              : `📱 ${wd.telebirrNumber} — ${wd.telebirrName}`}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "hsl(43,30%,50%)" }}>
                            {format(new Date(wd.createdAt), "MMM d, yyyy")}
                          </p>
                          {wd.adminNote && (
                            <p className="text-xs italic mt-0.5" style={{ color: "hsl(43,30%,48%)" }}>{wd.adminNote}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm" style={{ color: "#D4AF37" }}>{wd.amount} ETB</span>
                          <StatusPill status={wd.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
