import { useGetMe, useGetProfile, useListSubmissions, useListWithdrawals } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Wallet, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: user, isLoading: authLoading, isError } = useGetMe({ query: { retry: false } });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && (isError || !user)) {
      setLocation("/login");
    }
  }, [user, authLoading, isError, setLocation]);

  const { data: profile, isLoading: profileLoading } = useGetProfile({
    query: { enabled: !!user, retry: false }
  });
  
  const { data: submissions, isLoading: submissionsLoading } = useListSubmissions({
    query: { enabled: !!user, retry: false }
  });

  const { data: withdrawals, isLoading: withdrawalsLoading } = useListWithdrawals({
    query: { enabled: !!user, retry: false }
  });

  if (authLoading || (user && !profile && profileLoading)) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
            <p className="text-muted-foreground mt-1">Here's an overview of your earnings and submissions.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/withdraw">Withdraw Funds</Link>
            </Button>
            <Button asChild>
              <Link href="/submit">Sell Account</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Wallet className="mr-2 h-4 w-4 text-primary" />
                Available Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{profile?.walletBalance || 0} ETB</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <CheckCircle className="mr-2 h-4 w-4 text-success" />
                Approved Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.approvedSubmissions || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Clock className="mr-2 h-4 w-4 text-warning" />
                Pending Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.pendingSubmissions || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Submissions</h2>
              <Button variant="link" asChild size="sm" className="text-primary">
                <Link href="/profile">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
            
            <Card>
              <CardContent className="p-0">
                {submissionsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : submissions && submissions.length > 0 ? (
                  <div className="divide-y">
                    {submissions.slice(0, 5).map((sub) => (
                      <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="bg-secondary p-2 rounded-md shrink-0">
                            <Mail className="h-4 w-4 text-secondary-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{sub.email}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(sub.createdAt), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="font-medium text-sm">{sub.pricePaid} ETB</span>
                          <Badge variant="outline" className={
                            sub.status === 'approved' ? 'bg-success/10 text-success border-success/20' :
                            sub.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            'bg-warning/10 text-warning border-warning/20'
                          }>
                            {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <Mail className="h-8 w-8 mb-3 opacity-20" />
                    <p>No submissions yet.</p>
                    <Button variant="link" asChild className="mt-2">
                      <Link href="/submit">Submit your first account</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Withdrawals</h2>
              <Button variant="link" asChild size="sm" className="text-primary">
                <Link href="/profile">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
            
            <Card>
              <CardContent className="p-0">
                {withdrawalsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : withdrawals && withdrawals.length > 0 ? (
                  <div className="divide-y">
                    {withdrawals.slice(0, 5).map((withdrawal) => (
                      <div key={withdrawal.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="bg-secondary p-2 rounded-md shrink-0">
                            <Wallet className="h-4 w-4 text-secondary-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{withdrawal.telebirrNumber}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(withdrawal.createdAt), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="font-bold text-sm text-primary">{withdrawal.amount} ETB</span>
                          <Badge variant="outline" className={
                            withdrawal.status === 'completed' ? 'bg-success/10 text-success border-success/20' :
                            withdrawal.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            'bg-warning/10 text-warning border-warning/20'
                          }>
                            {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <Wallet className="h-8 w-8 mb-3 opacity-20" />
                    <p>No withdrawal requests yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
