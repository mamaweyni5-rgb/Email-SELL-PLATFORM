import { useGetMe, useGetProfile, useListSubmissions, useListWithdrawals } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Wallet, CheckCircle, Clock } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  if (status === "approved" || status === "completed") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        {status === "completed" ? t("status_completed") : t("status_approved")}
      </Badge>
    );
  }
  if (status === "rejected") {
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">{t("status_rejected")}</Badge>;
  }
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">{t("status_pending")}</Badge>;
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
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{t("profile_title")}</h1>
          <p className="text-muted-foreground mt-1">{user.email}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="border-none shadow-sm bg-blue-50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Wallet className="h-3 w-3" /> {t("profile_balance")}
              </p>
              <p className="text-2xl font-bold text-blue-600">{profile?.walletBalance ?? 0} ETB</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" /> {t("profile_approved")}
              </p>
              <p className="text-2xl font-bold">{profile?.approvedSubmissions ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-600" /> {t("profile_pending")}
              </p>
              <p className="text-2xl font-bold">{profile?.pendingSubmissions ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="submissions">
          <TabsList>
            <TabsTrigger value="submissions">{t("profile_tab_subs")}</TabsTrigger>
            <TabsTrigger value="withdrawals">{t("profile_tab_wd")}</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="mt-4">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">{t("profile_all_subs")}</CardTitle></CardHeader>
              <CardContent>
                {subsLoading ? (
                  <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !submissions || submissions.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>{t("profile_no_subs")}</p>
                    <Link href="/submit" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                      {t("profile_first_sub")}
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y">
                    {submissions.map((sub) => (
                      <div key={sub.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{sub.email}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(sub.createdAt), "MMM d, yyyy")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm text-blue-600">{sub.pricePaid} ETB</span>
                          <StatusBadge status={sub.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-4">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">{t("profile_wd_history")}</CardTitle></CardHeader>
              <CardContent>
                {wdLoading ? (
                  <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !withdrawals || withdrawals.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>{t("profile_no_wd")}</p>
                    <Link href="/withdraw" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                      {t("profile_request_wd")}
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y">
                    {withdrawals.map((wd) => (
                      <div key={wd.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{wd.telebirrNumber} — {wd.telebirrName}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(wd.createdAt), "MMM d, yyyy")}</p>
                          {wd.adminNote && <p className="text-xs text-muted-foreground italic">{wd.adminNote}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm text-blue-600">{wd.amount} ETB</span>
                          <StatusBadge status={wd.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
