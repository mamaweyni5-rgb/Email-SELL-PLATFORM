import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListSubmissions,
  useAdminUpdateSubmission,
  useAdminListWithdrawals,
  useAdminUpdateWithdrawal,
  useAdminListUsers,
  useAdminGetStats,
  useAdminUpdateSettings,
  useAdminChangePassword,
  getAdminListSubmissionsQueryKey,
  getAdminListWithdrawalsQueryKey,
  getAdminListUsersQueryKey,
  getAdminGetStatsQueryKey,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  Users,
  Mail,
  Wallet,
  Clock,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Loader2,
  KeyRound,
} from "lucide-react";

const priceSchema = z.object({
  pricePerEmail: z.coerce.number().min(1, "Price must be at least 1 ETB"),
  referralCommissionPct: z.coerce.number().min(0, "Min 0%").max(100, "Max 100%"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(6, "At least 6 characters"),
  confirmPassword: z.string().min(1, "Required"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

function StatusBadge({ status }: { status: string }) {
  if (status === "approved" || status === "completed") {
    return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">{status}</Badge>;
  }
  if (status === "rejected") {
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">{status}</Badge>;
  }
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">pending</Badge>;
}

function SubmissionsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: submissions, isLoading } = useAdminListSubmissions();
  const updateSubmission = useAdminUpdateSubmission();

  const handleUpdate = (id: number, status: "approved" | "rejected") => {
    updateSubmission.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListSubmissionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
          toast({
            title: status === "approved" ? "Approved" : "Rejected",
            description: `Submission has been ${status}.`,
          });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update submission.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium">No submissions yet</p>
        <p className="text-sm">Email accounts submitted by users will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Seller</TableHead>
            <TableHead>Email Account</TableHead>
            <TableHead>Password</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <TableRow key={sub.id} className="hover:bg-muted/30">
              <TableCell className="text-sm text-muted-foreground">{sub.userEmail}</TableCell>
              <TableCell className="font-medium">{sub.email}</TableCell>
              <TableCell className="font-mono text-sm">{sub.password}</TableCell>
              <TableCell className="font-semibold text-blue-600">{sub.pricePaid} ETB</TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {format(new Date(sub.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <StatusBadge status={sub.status} />
              </TableCell>
              <TableCell className="text-right">
                {sub.status === "pending" ? (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1"
                      onClick={() => handleUpdate(sub.id, "approved")}
                      disabled={updateSubmission.isPending}
                      data-testid={`button-approve-${sub.id}`}
                    >
                      {updateSubmission.isPending && updateSubmission.variables?.id === sub.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1"
                      onClick={() => handleUpdate(sub.id, "rejected")}
                      disabled={updateSubmission.isPending}
                      data-testid={`button-reject-${sub.id}`}
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Done</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WithdrawalsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const { data: withdrawals, isLoading } = useAdminListWithdrawals();
  const updateWithdrawal = useAdminUpdateWithdrawal();

  const handleUpdate = (id: number, status: "completed" | "rejected") => {
    updateWithdrawal.mutate(
      { id, data: { status, adminNote: noteMap[id] ?? "" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
          toast({ title: status === "completed" ? "Paid" : "Rejected", description: `Withdrawal has been ${status}.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update withdrawal.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (!withdrawals || withdrawals.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Wallet className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium">No withdrawal requests</p>
        <p className="text-sm">When users request withdrawals, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>User</TableHead>
            <TableHead>Telebirr Number</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Note</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals.map((wd) => (
            <TableRow key={wd.id} className="hover:bg-muted/30">
              <TableCell className="text-sm text-muted-foreground">{wd.userEmail}</TableCell>
              <TableCell className="font-mono font-medium">{wd.telebirrNumber}</TableCell>
              <TableCell>{wd.telebirrName}</TableCell>
              <TableCell className="font-bold text-blue-600">{wd.amount} ETB</TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {format(new Date(wd.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <StatusBadge status={wd.status} />
              </TableCell>
              <TableCell>
                {wd.status === "pending" ? (
                  <Input
                    className="h-7 text-xs w-36"
                    placeholder="Optional note"
                    value={noteMap[wd.id] ?? ""}
                    onChange={(e) => setNoteMap((m) => ({ ...m, [wd.id]: e.target.value }))}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{wd.adminNote ?? "—"}</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {wd.status === "pending" ? (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1"
                      onClick={() => handleUpdate(wd.id, "completed")}
                      disabled={updateWithdrawal.isPending}
                      data-testid={`button-pay-${wd.id}`}
                    >
                      {updateWithdrawal.isPending && updateWithdrawal.variables?.id === wd.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      Mark Paid
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 gap-1"
                      onClick={() => handleUpdate(wd.id, "rejected")}
                      disabled={updateWithdrawal.isPending}
                      data-testid={`button-reject-wd-${wd.id}`}
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Done</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UsersTab() {
  const { data: users, isLoading } = useAdminListUsers();

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium">No users yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Email</TableHead>
            <TableHead>Wallet Balance</TableHead>
            <TableHead>Total Submitted</TableHead>
            <TableHead>Approved</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell className="font-bold text-blue-600">{user.walletBalance} ETB</TableCell>
              <TableCell>{user.totalSubmissions}</TableCell>
              <TableCell>{user.approvedSubmissions}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(user.createdAt), "MMM d, yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SettingsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateSettings = useAdminUpdateSettings();
  const changePassword = useAdminChangePassword();

  const priceForm = useForm<z.infer<typeof priceSchema>>({
    resolver: zodResolver(priceSchema),
    defaultValues: { pricePerEmail: 20, referralCommissionPct: 10 },
  });

  const pwForm = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onPriceSubmit = (values: z.infer<typeof priceSchema>) => {
    updateSettings.mutate(
      { data: { pricePerEmail: values.pricePerEmail, referralCommissionPct: values.referralCommissionPct } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          priceForm.setValue("pricePerEmail", data.pricePerEmail);
          priceForm.setValue("referralCommissionPct", data.referralCommissionPct);
          toast({ title: "Settings saved", description: `Price: ${data.pricePerEmail} ETB | Commission: ${data.referralCommissionPct}%` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
        },
      }
    );
  };

  const onPasswordSubmit = (values: z.infer<typeof changePasswordSchema>) => {
    changePassword.mutate(
      { data: { currentPassword: values.currentPassword, newPassword: values.newPassword } },
      {
        onSuccess: () => {
          pwForm.reset();
          toast({ title: "Password changed", description: "Admin password updated successfully." });
        },
        onError: (err) => {
          const msg = (err as { error?: string })?.error ?? "Failed to change password.";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Price Per Email</CardTitle>
          <CardDescription>
            Set how much users earn per approved email account submission (in ETB).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...priceForm}>
            <form onSubmit={priceForm.handleSubmit(onPriceSubmit)} className="space-y-4">
              <FormField
                control={priceForm.control}
                name="pricePerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (ETB)</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          placeholder="20"
                          {...field}
                          data-testid="input-price-per-email"
                        />
                        <span className="flex items-center text-sm text-muted-foreground px-3 border rounded-md bg-muted">
                          ETB
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={priceForm.control}
                name="referralCommissionPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referral Commission (%)</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="10"
                          {...field}
                        />
                        <span className="flex items-center text-sm text-muted-foreground px-3 border rounded-md bg-muted">
                          %
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateSettings.isPending} data-testid="button-save-settings">
                {updateSettings.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Change Admin Password</CardTitle>
          </div>
          <CardDescription>
            Update the secret password used to access this admin panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...pwForm}>
            <form onSubmit={pwForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={pwForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pwForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={pwForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePassword.isPending} variant="outline">
                {changePassword.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Changing...</>
                ) : (
                  "Change Password"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  const { data: stats, isLoading: statsLoading } = useAdminGetStats();

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers, icon: Users, color: "text-blue-600" },
    { label: "Emails Bought", value: stats?.totalEmailsBought, icon: Mail, color: "text-green-600" },
    { label: "Pending Review", value: stats?.pendingSubmissions, icon: Clock, color: "text-yellow-600" },
    { label: "Total Paid (ETB)", value: stats?.totalPayoutsBirr, icon: TrendingUp, color: "text-blue-600" },
    { label: "Pending Payouts", value: stats?.pendingWithdrawals, icon: AlertCircle, color: "text-red-600" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-lg">Admin Panel</span>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            View Site
          </a>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage email submissions, withdrawals, and platform settings.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-white border-none shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value ?? 0}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="submissions" className="space-y-4">
          <TabsList className="bg-white border">
            <TabsTrigger value="submissions" className="gap-2">
              <Mail className="h-4 w-4" />
              Submissions
              {stats?.pendingSubmissions ? (
                <Badge className="ml-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {stats.pendingSubmissions}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2">
              <Wallet className="h-4 w-4" />
              Withdrawals
              {stats?.pendingWithdrawals ? (
                <Badge className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {stats.pendingWithdrawals}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions">
            <Card className="bg-white border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Email Submissions</CardTitle>
                <CardDescription>
                  Review each submitted email account. Approve to credit the seller's wallet, or reject to decline.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubmissionsTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card className="bg-white border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Withdrawal Requests</CardTitle>
                <CardDescription>
                  Pay users via Telebirr and mark requests as completed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WithdrawalsTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="bg-white border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <UsersTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
