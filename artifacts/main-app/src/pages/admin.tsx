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
  useAdminSendBroadcast,
  useListBroadcasts,
  getAdminListSubmissionsQueryKey,
  getAdminListWithdrawalsQueryKey,
  getAdminListUsersQueryKey,
  getAdminGetStatsQueryKey,
  getGetSettingsQueryKey,
  getListBroadcastsQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
  FileDown,
  Megaphone,
  Send,
} from "lucide-react";

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

const GOLD = "#D4AF37";
const GOLD_BRIGHT = "#FFD700";
const BURGUNDY_CARD = "hsl(348,82%,16%)";
const BURGUNDY_ROW_BORDER = "hsl(344,55%,22%)";
const TEXT_SOFT = "hsl(43,30%,52%)";
const TEXT_BODY = "hsl(46,68%,82%)";

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "approved" || status === "completed"
      ? "badge-approved"
      : status === "rejected"
      ? "badge-rejected"
      : "badge-pending";
  return (
    <span className={`${cls} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border`}>
      {status}
    </span>
  );
}

function SubmissionsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: submissions, isLoading } = useAdminListSubmissions();
  const updateSubmission = useAdminUpdateSubmission();

  const handleExport = () => {
    if (!submissions?.length) return;
    downloadCSV(
      `submissions-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Seller", "Email Account", "Password", "Price (ETB)", "Date", "Status"],
      submissions.map((s) => [
        s.id,
        s.userEmail,
        s.email,
        s.password,
        s.pricePaid,
        format(new Date(s.createdAt), "yyyy-MM-dd HH:mm"),
        s.status,
      ]),
    );
  };

  const handleUpdate = (id: number, status: "approved" | "rejected") => {
    updateSubmission.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListSubmissionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
          toast({ title: status === "approved" ? "Approved" : "Rejected", description: `Submission has been ${status}.` });
        },
        onError: () => toast({ title: "Error", description: "Failed to update submission.", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return (
    <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" style={{ background: "hsl(344,65%,18%)" }} />)}</div>
  );

  if (!submissions || submissions.length === 0) return (
    <div className="text-center py-16 flex flex-col items-center">
      <Mail className="h-12 w-12 mb-4" style={{ color: "hsl(43,30%,30%)" }} />
      <p className="text-base font-semibold" style={{ color: "hsl(46,50%,70%)" }}>No submissions yet</p>
      <p className="text-sm mt-1" style={{ color: TEXT_SOFT }}>Email accounts submitted by users will appear here.</p>
    </div>
  );

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all"
          style={{ background: "hsl(344,70%,18%)", border: "1px solid hsl(43,40%,30%)", color: GOLD }}
        >
          <FileDown className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid hsl(43,30%,24%,0.4)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
    >
      <Table>
        <TableHeader>
          <TableRow style={{ background: "hsl(344,80%,14%)", borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
            {["Seller","Email Account","Password","Price","Date","Status","Actions"].map(h => (
              <TableHead key={h} className="text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <TableRow key={sub.id} className="luxury-row transition-colors" style={{ borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}`, background: BURGUNDY_CARD }}>
              <TableCell className="text-xs" style={{ color: TEXT_SOFT }}>{sub.userEmail}</TableCell>
              <TableCell className="font-semibold text-sm" style={{ color: TEXT_BODY }}>{sub.email}</TableCell>
              <TableCell className="font-mono text-xs" style={{ color: TEXT_SOFT }}>{sub.password}</TableCell>
              <TableCell className="font-bold text-sm" style={{ color: GOLD_BRIGHT }}>{sub.pricePaid} ETB</TableCell>
              <TableCell className="text-xs whitespace-nowrap" style={{ color: TEXT_SOFT }}>
                {format(new Date(sub.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell><StatusPill status={sub.status} /></TableCell>
              <TableCell className="text-right">
                {sub.status === "pending" ? (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="inline-flex items-center gap-1 rounded-lg px-3 h-7 text-xs font-bold transition-all"
                      style={{ background: "hsl(136,48%,20%)", border: "1px solid hsl(136,48%,32%,0.5)", color: "hsl(136,60%,65%)" }}
                      onClick={() => handleUpdate(sub.id, "approved")}
                      disabled={updateSubmission.isPending}
                      data-testid={`button-approve-${sub.id}`}
                    >
                      {updateSubmission.isPending && updateSubmission.variables?.id === sub.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : <CheckCircle className="h-3 w-3" />}
                      Approve
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg px-3 h-7 text-xs font-bold transition-all"
                      style={{ background: "hsl(5,55%,18%)", border: "1px solid hsl(5,55%,30%,0.5)", color: "hsl(5,75%,65%)" }}
                      onClick={() => handleUpdate(sub.id, "rejected")}
                      disabled={updateSubmission.isPending}
                      data-testid={`button-reject-${sub.id}`}
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs italic" style={{ color: TEXT_SOFT }}>Done</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}

function WithdrawalsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const { data: withdrawals, isLoading } = useAdminListWithdrawals();
  const updateWithdrawal = useAdminUpdateWithdrawal();

  const handleExport = () => {
    if (!withdrawals?.length) return;
    downloadCSV(
      `withdrawals-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "User", "Method", "Telebirr/Account Number", "Name", "Bank", "Amount (ETB)", "Date", "Status", "Note"],
      withdrawals.map((w) => [
        w.id,
        w.userEmail,
        w.paymentMethod,
        w.paymentMethod === "bank" ? (w.bankAccountNumber ?? "") : w.telebirrNumber,
        w.paymentMethod === "bank" ? (w.bankAccountName ?? "") : w.telebirrName,
        w.bankName ?? "",
        w.amount,
        format(new Date(w.createdAt), "yyyy-MM-dd HH:mm"),
        w.status,
        w.adminNote ?? "",
      ]),
    );
  };

  const handleUpdate = (id: number, status: "completed" | "rejected") => {
    updateWithdrawal.mutate(
      { id, data: { status, adminNote: noteMap[id] ?? "" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
          toast({ title: status === "completed" ? "Paid" : "Rejected", description: `Withdrawal has been ${status}.` });
        },
        onError: () => toast({ title: "Error", description: "Failed to update withdrawal.", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" style={{ background: "hsl(344,65%,18%)" }} />)}</div>
  );

  if (!withdrawals || withdrawals.length === 0) return (
    <div className="text-center py-16 flex flex-col items-center">
      <Wallet className="h-12 w-12 mb-4" style={{ color: "hsl(43,30%,30%)" }} />
      <p className="text-base font-semibold" style={{ color: "hsl(46,50%,70%)" }}>No withdrawal requests</p>
      <p className="text-sm mt-1" style={{ color: TEXT_SOFT }}>When users request withdrawals, they will appear here.</p>
    </div>
  );

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all"
          style={{ background: "hsl(344,70%,18%)", border: "1px solid hsl(43,40%,30%)", color: GOLD }}
        >
          <FileDown className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid hsl(43,30%,24%,0.4)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
    >
      <Table>
        <TableHeader>
          <TableRow style={{ background: "hsl(344,80%,14%)", borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
            {["User","Method","Payment Info","Amount","Date","Status","Note","Actions"].map(h => (
              <TableHead key={h} className="text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals.map((wd) => (
            <TableRow key={wd.id} className="luxury-row transition-colors" style={{ borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}`, background: BURGUNDY_CARD }}>
              <TableCell className="text-xs" style={{ color: TEXT_SOFT }}>{wd.userEmail}</TableCell>
              <TableCell>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border"
                  style={
                    wd.paymentMethod === "bank"
                      ? { background: "hsl(220,50%,18%)", border: "1px solid hsl(220,50%,32%,0.5)", color: "hsl(220,80%,75%)" }
                      : { background: "hsl(136,40%,14%)", border: "1px solid hsl(136,48%,28%,0.5)", color: "hsl(136,60%,65%)" }
                  }
                >
                  {wd.paymentMethod === "bank" ? "🏦 ባንክ" : "📱 ቴሌብር"}
                </span>
              </TableCell>
              <TableCell className="text-xs" style={{ color: TEXT_BODY }}>
                {wd.paymentMethod === "bank" ? (
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs" style={{ color: "hsl(220,80%,75%)" }}>{wd.bankName}</div>
                    <div className="font-mono">{wd.bankAccountNumber}</div>
                    <div style={{ color: TEXT_SOFT }}>{wd.bankAccountName}</div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="font-mono font-semibold">{wd.telebirrNumber}</div>
                    <div style={{ color: TEXT_SOFT }}>{wd.telebirrName}</div>
                  </div>
                )}
              </TableCell>
              <TableCell className="font-extrabold text-sm" style={{ color: GOLD_BRIGHT }}>{wd.amount} ETB</TableCell>
              <TableCell className="text-xs whitespace-nowrap" style={{ color: TEXT_SOFT }}>
                {format(new Date(wd.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell><StatusPill status={wd.status} /></TableCell>
              <TableCell>
                {wd.status === "pending" ? (
                  <Input
                    className="luxury-input h-7 text-xs w-32 rounded-lg"
                    placeholder="Optional note"
                    value={noteMap[wd.id] ?? ""}
                    onChange={(e) => setNoteMap((m) => ({ ...m, [wd.id]: e.target.value }))}
                  />
                ) : (
                  <span className="text-xs italic" style={{ color: TEXT_SOFT }}>{wd.adminNote ?? "—"}</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {wd.status === "pending" ? (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="inline-flex items-center gap-1 rounded-lg px-3 h-7 text-xs font-bold transition-all"
                      style={{ background: "hsl(136,48%,20%)", border: "1px solid hsl(136,48%,32%,0.5)", color: "hsl(136,60%,65%)" }}
                      onClick={() => handleUpdate(wd.id, "completed")}
                      disabled={updateWithdrawal.isPending}
                      data-testid={`button-pay-${wd.id}`}
                    >
                      {updateWithdrawal.isPending && updateWithdrawal.variables?.id === wd.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : <CheckCircle className="h-3 w-3" />}
                      Mark Paid
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg px-3 h-7 text-xs font-bold transition-all"
                      style={{ background: "hsl(5,55%,18%)", border: "1px solid hsl(5,55%,30%,0.5)", color: "hsl(5,75%,65%)" }}
                      onClick={() => handleUpdate(wd.id, "rejected")}
                      disabled={updateWithdrawal.isPending}
                      data-testid={`button-reject-wd-${wd.id}`}
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs italic" style={{ color: TEXT_SOFT }}>Done</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}

function UsersTab() {
  const { data: users, isLoading } = useAdminListUsers();

  const handleExport = () => {
    if (!users?.length) return;
    downloadCSV(
      `users-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Email", "Wallet Balance (ETB)", "Total Submitted", "Approved", "Joined"],
      users.map((u) => [
        u.id,
        u.email,
        u.walletBalance,
        u.totalSubmissions,
        u.approvedSubmissions,
        format(new Date(u.createdAt), "yyyy-MM-dd HH:mm"),
      ]),
    );
  };

  if (isLoading) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" style={{ background: "hsl(344,65%,18%)" }} />)}</div>
  );

  if (!users || users.length === 0) return (
    <div className="text-center py-16 flex flex-col items-center">
      <Users className="h-12 w-12 mb-4" style={{ color: "hsl(43,30%,30%)" }} />
      <p className="text-base font-semibold" style={{ color: "hsl(46,50%,70%)" }}>No users yet</p>
    </div>
  );

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all"
          style={{ background: "hsl(344,70%,18%)", border: "1px solid hsl(43,40%,30%)", color: GOLD }}
        >
          <FileDown className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid hsl(43,30%,24%,0.4)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
      >
        <Table>
          <TableHeader>
            <TableRow style={{ background: "hsl(344,80%,14%)", borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
              {["Email","Wallet Balance","Total Submitted","Approved","Joined"].map(h => (
                <TableHead key={h} className="text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="luxury-row transition-colors" style={{ borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}`, background: BURGUNDY_CARD }}>
                <TableCell className="font-semibold text-sm" style={{ color: TEXT_BODY }}>{user.email ?? user.id}</TableCell>
                <TableCell className="font-extrabold text-sm" style={{ color: GOLD_BRIGHT }}>{user.walletBalance} ETB</TableCell>
                <TableCell className="text-sm" style={{ color: TEXT_BODY }}>{user.totalSubmissions}</TableCell>
                <TableCell className="text-sm" style={{ color: TEXT_BODY }}>{user.approvedSubmissions}</TableCell>
                <TableCell className="text-xs" style={{ color: TEXT_SOFT }}>
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const broadcastSchema = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
});

function BroadcastTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sendBroadcast = useAdminSendBroadcast();
  const { data: broadcasts, isLoading: historyLoading } = useListBroadcasts();

  const form = useForm<z.infer<typeof broadcastSchema>>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: { title: "", message: "" },
  });

  const onSubmit = (values: z.infer<typeof broadcastSchema>) => {
    sendBroadcast.mutate(
      { data: values },
      {
        onSuccess: () => {
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListBroadcastsQueryKey() });
          toast({ title: "Broadcast sent!", description: "Message delivered to all users." });
        },
        onError: () => toast({ title: "Error", description: "Failed to send broadcast.", variant: "destructive" }),
      }
    );
  };

  const cardStyle = {
    background: BURGUNDY_CARD,
    border: "1px solid hsl(43,30%,24%,0.4)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="h-4 w-4" style={{ color: GOLD }} />
          <h3 className="text-sm font-bold" style={{ color: GOLD }}>Send Announcement</h3>
        </div>
        <p className="text-xs mb-5" style={{ color: TEXT_SOFT }}>
          Sends to all users in-app + via Telegram bot for those who have connected.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ color: "hsl(46,55%,72%)", fontSize: "0.8rem", fontWeight: 600 }}>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. New feature available"
                      className="luxury-input h-10 rounded-lg"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ color: "hsl(46,55%,72%)", fontSize: "0.8rem", fontWeight: 600 }}>Message</FormLabel>
                  <FormControl>
                    <textarea
                      rows={4}
                      placeholder="Write your announcement here..."
                      className="luxury-input w-full rounded-lg px-3 py-2.5 text-sm resize-none"
                      style={{
                        background: "hsl(344,70%,13%)",
                        border: "1px solid hsl(43,30%,28%,0.5)",
                        color: "hsl(46,68%,82%)",
                        outline: "none",
                      }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button
              type="submit"
              className="gold-btn inline-flex items-center gap-2 rounded-lg px-5 h-10 text-sm font-bold"
              disabled={sendBroadcast.isPending}
            >
              {sendBroadcast.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Send to All Users</>
              )}
            </button>
          </form>
        </Form>
      </div>

      {/* History */}
      <div className="rounded-2xl p-6" style={cardStyle}>
        <h3 className="text-sm font-bold mb-4" style={{ color: GOLD }}>Past Announcements</h3>
        {historyLoading ? (
          <div className="space-y-3">
            {[0,1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" style={{ background: "hsl(344,65%,18%)" }} />)}
          </div>
        ) : !broadcasts || broadcasts.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: TEXT_SOFT }}>No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="rounded-xl px-4 py-3"
                style={{ background: "hsl(344,75%,13%)", border: "1px solid hsl(43,30%,22%,0.4)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm" style={{ color: TEXT_BODY }}>{b.title}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: TEXT_SOFT }}>{b.message}</p>
                  </div>
                  <span className="text-xs shrink-0 mt-0.5" style={{ color: TEXT_SOFT }}>
                    {format(new Date(b.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
        onError: () => toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
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

  const cardStyle = {
    background: BURGUNDY_CARD,
    border: "1px solid hsl(43,30%,24%,0.4)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  };

  return (
    <div className="space-y-6 max-w-md">
      <div className="rounded-2xl p-6" style={cardStyle}>
        <h3 className="text-sm font-bold mb-0.5" style={{ color: GOLD }}>Price Per Email</h3>
        <p className="text-xs mb-5" style={{ color: TEXT_SOFT }}>
          Set how much users earn per approved email account submission (in ETB).
        </p>
        <Form {...priceForm}>
          <form onSubmit={priceForm.handleSubmit(onPriceSubmit)} className="space-y-4">
            <FormField
              control={priceForm.control}
              name="pricePerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ color: "hsl(46,55%,72%)", fontSize: "0.8rem", fontWeight: 600 }}>Price (ETB)</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="20"
                        className="luxury-input h-10 rounded-lg"
                        {...field}
                        data-testid="input-price-per-email"
                      />
                      <span
                        className="flex items-center text-xs font-bold px-3 rounded-lg"
                        style={{ background: "hsl(344,70%,18%)", border: "1px solid hsl(43,30%,28%,0.4)", color: GOLD }}
                      >
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
                  <FormLabel style={{ color: "hsl(46,55%,72%)", fontSize: "0.8rem", fontWeight: 600 }}>Referral Commission (%)</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="10"
                        className="luxury-input h-10 rounded-lg"
                        {...field}
                      />
                      <span
                        className="flex items-center text-xs font-bold px-3 rounded-lg"
                        style={{ background: "hsl(344,70%,18%)", border: "1px solid hsl(43,30%,28%,0.4)", color: GOLD }}
                      >
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button
              type="submit"
              className="gold-btn rounded-lg px-5 h-9 text-sm font-bold"
              disabled={updateSettings.isPending}
              data-testid="button-save-settings"
            >
              {updateSettings.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</span>
              ) : "Save Settings"}
            </button>
          </form>
        </Form>
      </div>

      <div className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex items-center gap-2 mb-0.5">
          <KeyRound className="h-4 w-4" style={{ color: GOLD }} />
          <h3 className="text-sm font-bold" style={{ color: GOLD }}>Change Admin Password</h3>
        </div>
        <p className="text-xs mb-5" style={{ color: TEXT_SOFT }}>
          Update the secret password used to access this admin panel.
        </p>
        <Form {...pwForm}>
          <form onSubmit={pwForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            {(["currentPassword", "newPassword", "confirmPassword"] as const).map((name) => (
              <FormField
                key={name}
                control={pwForm.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: "hsl(46,55%,72%)", fontSize: "0.8rem", fontWeight: 600 }}>
                      {name === "currentPassword" ? "Current Password" : name === "newPassword" ? "New Password" : "Confirm New Password"}
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="luxury-input h-10 rounded-lg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg px-5 h-9 text-sm font-semibold transition-all"
              style={{
                background: "hsl(344,70%,18%)",
                border: "1.5px solid hsl(43,40%,35%)",
                color: "hsl(43,60%,65%)",
              }}
              disabled={changePassword.isPending}
            >
              {changePassword.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Changing...</>
              ) : "Change Password"}
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default function Admin() {
  const { data: stats, isLoading: statsLoading } = useAdminGetStats();

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers, icon: Users, color: GOLD },
    { label: "Emails Bought", value: stats?.totalEmailsBought, icon: Mail, color: "hsl(136,60%,58%)" },
    { label: "Pending Review", value: stats?.pendingSubmissions, icon: Clock, color: GOLD },
    { label: "Total Paid (ETB)", value: stats?.totalPayoutsBirr, icon: TrendingUp, color: GOLD_BRIGHT },
    { label: "Pending Payouts", value: stats?.pendingWithdrawals, icon: AlertCircle, color: "hsl(5,75%,62%)" },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ background: "hsl(344,90%,10%)" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "linear-gradient(180deg, hsl(344,90%,9%) 0%, hsl(344,88%,12%) 100%)",
          borderBottom: "1px solid hsl(43,40%,28%,0.3)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
      >
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: GOLD }} />
            <span className="font-extrabold text-lg" style={{ color: GOLD }}>Admin Panel</span>
          </div>
          <a
            href="/"
            className="text-sm font-medium transition-colors"
            style={{ color: "hsl(43,40%,58%)" }}
          >
            View Site
          </a>
        </div>
      </header>

      <main className="container mx-auto px-4 py-7 max-w-7xl">
        <div className="mb-7">
          <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: GOLD }}>Dashboard</h1>
          <p className="text-sm" style={{ color: "hsl(43,30%,50%)" }}>
            Manage email submissions, withdrawals, and platform settings.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-7">
          {statCards.map((stat) => (
            <div key={stat.label} className="stat-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(43,30%,50%)" }}>{stat.label}</p>
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 rounded-lg" style={{ background: "hsl(344,65%,20%)" }} />
              ) : (
                <p className="text-2xl font-extrabold" style={{ color: stat.color }}>{stat.value ?? 0}</p>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="submissions" className="space-y-5">
          <TabsList
            className="rounded-xl p-1 h-auto flex-wrap"
            style={{
              background: "hsl(344,80%,14%)",
              border: "1px solid hsl(43,30%,24%,0.4)",
            }}
          >
            {[
              { value: "submissions", icon: Mail, label: "Submissions" },
              { value: "withdrawals", icon: Wallet, label: "Withdrawals" },
              { value: "users", icon: Users, label: "Users" },
              { value: "broadcast", icon: Megaphone, label: "Broadcast" },
              { value: "settings", icon: ShieldCheck, label: "Settings" },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 rounded-lg text-sm font-semibold px-4 py-2 data-[state=active]:text-[hsl(344_90%_10%)]"
                style={{ color: "hsl(43,40%,58%)" }}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="submissions"><SubmissionsTab /></TabsContent>
          <TabsContent value="withdrawals"><WithdrawalsTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
