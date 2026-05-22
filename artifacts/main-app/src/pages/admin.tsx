import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
  useGetSettings,
  getAdminListSubmissionsQueryKey,
  getAdminListWithdrawalsQueryKey,
  getAdminListUsersQueryKey,
  getAdminGetStatsQueryKey,
  getGetSettingsQueryKey,
  getListBroadcastsQueryKey,
  useAdminListConversations,
  useAdminGetConversation,
  useAdminSendMessage,
  useAdminBanUser,
  getAdminListConversationsQueryKey,
  getAdminGetConversationQueryKey,
  useAdminBulkClearSubmissions,
  useAdminBulkClearWithdrawals,
  useAdminTelegramExport,
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
  MessageSquare,
  Search,
  Ban,
  UserCheck,
  ArrowLeft,
  Sparkles,
  Trash2,
  Plus,
} from "lucide-react";

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.cssText = "position:fixed;top:-100px;left:-100px;opacity:0;";
  document.body.appendChild(a);
  a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
  // Telegram WebApp fallback — open in external browser
  try {
    const tgApp = (window as any)?.Telegram?.WebApp;
    if (tgApp?.openLink) {
      tgApp.openLink(url);
    }
  } catch (_) {}
}

const priceSchema = z.object({
  pricePerEmail: z.coerce.number().min(1, "Price must be at least 1 ETB"),
  referralCommissionPct: z.coerce.number().min(0, "Min 0%").max(100, "Max 100%"),
  telegramBotUsername: z.string().optional(),
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
const BURGUNDY_CARD = "hsl(74,58%,52%)";
const BURGUNDY_ROW_BORDER = "hsl(74,40%,38%)";
const TEXT_SOFT = "#2d4000";
const TEXT_BODY = "#0d1a00";

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
  const bulkClear = useAdminBulkClearSubmissions();
  const tgExport = useAdminTelegramExport();
  const [rejectNoteMap, setRejectNoteMap] = useState<Record<number, string>>({});
  const [confirmClear, setConfirmClear] = useState<"rejected" | "approved" | null>(null);

  const handleExport = () => {
    if (!submissions?.length) {
      toast({ title: "No data", description: "No submissions to export yet." });
      return;
    }
    downloadCSV(
      `submissions-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Seller", "Email Account", "Password", "Price (ETB)", "Date", "Status"],
      submissions.map((s) => [s.id, s.userName || s.userEmail, s.email, s.password, s.pricePaid, format(new Date(s.createdAt), "yyyy-MM-dd HH:mm"), s.status]),
    );
    toast({ title: "Exporting…", description: `${submissions.length} rows — file download started.` });
  };

  const handleExportApproved = () => {
    const approved = submissions?.filter((s) => s.status === "approved") ?? [];
    if (!approved.length) {
      toast({ title: "No approved submissions", description: "Approve some submissions first before exporting." });
      return;
    }
    downloadCSV(
      `approved-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Seller", "Email Account", "Password", "Price (ETB)", "Date"],
      approved.map((s) => [s.id, s.userName || s.userEmail, s.email, s.password, s.pricePaid, format(new Date(s.createdAt), "yyyy-MM-dd HH:mm")]),
    );
    toast({ title: "Exporting…", description: `${approved.length} approved accounts — file download started.` });
  };

  const handleTgExport = (type: "submissions" | "approved-submissions") => {
    tgExport.mutate({ data: { type } }, {
      onSuccess: (r) => toast({ title: "📨 Sent to Telegram", description: r.message }),
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error ?? "Could not send to Telegram", variant: "destructive" }),
    });
  };

  const handleClear = (status: "rejected" | "approved") => {
    bulkClear.mutate({ data: { status } }, {
      onSuccess: (r) => {
        queryClient.invalidateQueries({ queryKey: getAdminListSubmissionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
        toast({ title: "Cleared", description: `${r.deleted} ${status} submissions deleted.` });
        setConfirmClear(null);
      },
      onError: () => toast({ title: "Error", description: "Failed to clear.", variant: "destructive" }),
    });
  };

  const handleUpdate = (id: number, status: "approved" | "rejected") => {
    const rejectionNote = rejectNoteMap[id]?.trim() || undefined;
    updateSubmission.mutate(
      { id, data: { status, ...(status === "rejected" && rejectionNote ? { rejectionNote } : {}) } },
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
    <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}</div>
  );

  if (!submissions || submissions.length === 0) return (
    <div className="text-center py-16 flex flex-col items-center">
      <Mail className="h-12 w-12 mb-4" style={{ color: "#1a2d00" }} />
      <p className="text-base font-semibold" style={{ color: "#0d1a00" }}>No submissions yet</p>
      <p className="text-sm mt-1" style={{ color: TEXT_SOFT }}>Email accounts submitted by users will appear here.</p>
    </div>
  );

  return (
    <div>
      {/* confirm clear dialog */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full space-y-4 text-center" style={{ background: "hsl(74,58%,52%)", border: "1px solid hsl(74,40%,38%)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <Trash2 className="h-10 w-10 mx-auto" style={{ color: "hsl(5,75%,50%)" }} />
            <p className="font-bold text-base" style={{ color: "#0d1a00" }}>
              {confirmClear === "rejected" ? "ሁሉም ሪጄክትድ ሰብሚሽኖች" : "ሁሉም አፕሩቭድ ሰብሚሽኖች"} ይሰረዙ?
            </p>
            <p className="text-sm" style={{ color: "#1a2d00" }}>ይህ ድርጊት ሊቀለበስ አይችልም።</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(null)} className="flex-1 h-10 rounded-xl font-bold text-sm" style={{ background: "hsl(74,50%,44%)", color: "#0d1a00", border: "1px solid hsl(74,40%,36%)" }}>ሰርዝ</button>
              <button
                onClick={() => handleClear(confirmClear)}
                disabled={bulkClear.isPending}
                className="flex-1 h-10 rounded-xl font-bold text-sm"
                style={{ background: "hsl(5,65%,38%)", color: "#fff", border: "none" }}
              >
                {bulkClear.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "አዎ, ሰርዝ"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 mb-3">
        {/* Clear buttons */}
        <div className="flex gap-2">
          <button onClick={() => setConfirmClear("rejected")} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all" style={{ background: "hsl(5,55%,22%)", border: "1px solid hsl(5,55%,36%)", color: "hsl(5,75%,70%)" }}>
            <Trash2 className="h-3.5 w-3.5" />ሪጄክቶቹን ሰርዝ
          </button>
          <button onClick={() => setConfirmClear("approved")} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all" style={{ background: "hsl(136,48%,14%)", border: "1px solid hsl(136,48%,28%)", color: "hsl(136,60%,65%)" }}>
            <Trash2 className="h-3.5 w-3.5" />አፕሩቮቹን ሰርዝ
          </button>
        </div>
        {/* Export buttons */}
        <div className="flex gap-2">
          <button onClick={() => handleTgExport("approved-submissions")} disabled={tgExport.isPending} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all" style={{ background: "hsl(200,70%,18%)", border: "1px solid hsl(200,60%,32%)", color: "#29B6F6" }}>
            {tgExport.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Approved → TG
          </button>
          <button onClick={() => handleTgExport("submissions")} disabled={tgExport.isPending} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all" style={{ background: "hsl(200,70%,18%)", border: "1px solid hsl(200,60%,32%)", color: "#29B6F6" }}>
            {tgExport.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            All → TG
          </button>
          <button onClick={handleExportApproved} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all" style={{ background: "hsl(136,48%,14%)", border: "1px solid hsl(136,48%,28%)", color: "hsl(136,60%,65%)" }}>
            <FileDown className="h-3.5 w-3.5" />CSV
          </button>
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold transition-all" style={{ background: "hsl(74,90%,39%)", border: "1px solid hsl(43,40%,30%)", color: GOLD }}>
            <FileDown className="h-3.5 w-3.5" />All CSV
          </button>
        </div>
      </div>
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid hsl(43,30%,24%,0.4)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
    >
      <Table>
        <TableHeader>
          <TableRow style={{ background: "hsl(74,100%,37%)", borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
            {["Seller","Email Account","Password","Price","Date","Status","Rejection Note","Actions"].map(h => (
              <TableHead key={h} className="text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <TableRow key={sub.id} className="luxury-row transition-colors" style={{ borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}`, background: BURGUNDY_CARD }}>
              <TableCell className="text-xs" style={{ color: TEXT_SOFT }}>{sub.userName || sub.userEmail}</TableCell>
              <TableCell className="font-semibold text-sm" style={{ color: TEXT_BODY }}>{sub.email}</TableCell>
              <TableCell className="font-mono text-xs" style={{ color: TEXT_SOFT }}>{sub.password}</TableCell>
              <TableCell className="font-bold text-sm" style={{ color: GOLD_BRIGHT }}>{sub.pricePaid} ETB</TableCell>
              <TableCell className="text-xs whitespace-nowrap" style={{ color: TEXT_SOFT }}>
                {format(new Date(sub.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell><StatusPill status={sub.status} /></TableCell>
              <TableCell>
                {sub.status === "pending" ? (
                  <Input
                    className="luxury-input h-7 text-xs w-36 rounded-lg"
                    placeholder="ምክንያት (ለሪጄክት)"
                    value={rejectNoteMap[sub.id] ?? ""}
                    onChange={(e) => setRejectNoteMap((m) => ({ ...m, [sub.id]: e.target.value }))}
                  />
                ) : sub.status === "rejected" && sub.rejectionNote ? (
                  <span className="text-xs italic" style={{ color: "hsl(5,75%,65%)" }}>{sub.rejectionNote}</span>
                ) : (
                  <span className="text-xs italic" style={{ color: TEXT_SOFT }}>—</span>
                )}
              </TableCell>
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
  const bulkClear = useAdminBulkClearWithdrawals();
  const tgExport = useAdminTelegramExport();
  const [confirmClear, setConfirmClear] = useState<"rejected" | "completed" | null>(null);

  const handleExport = () => {
    if (!withdrawals?.length) {
      toast({ title: "No data", description: "No withdrawal requests to export yet." });
      return;
    }
    downloadCSV(
      `withdrawals-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "User", "Method", "Telebirr/Account Number", "Name", "Bank", "Amount (ETB)", "Date", "Status", "Note"],
      withdrawals.map((w) => [w.id, w.userEmail, w.paymentMethod, w.paymentMethod === "bank" ? (w.bankAccountNumber ?? "") : w.telebirrNumber, w.paymentMethod === "bank" ? (w.bankAccountName ?? "") : w.telebirrName, w.bankName ?? "", w.amount, format(new Date(w.createdAt), "yyyy-MM-dd HH:mm"), w.status, w.adminNote ?? ""]),
    );
    toast({ title: "Exporting…", description: `${withdrawals.length} rows — file download started.` });
  };

  const handleTgExport = () => {
    tgExport.mutate({ data: { type: "withdrawals" } }, {
      onSuccess: (r) => toast({ title: "📨 Sent to Telegram", description: r.message }),
      onError: (e: any) => toast({ title: "Failed", description: e?.data?.error ?? "Could not send to Telegram", variant: "destructive" }),
    });
  };

  const handleClear = (status: "rejected" | "completed") => {
    bulkClear.mutate({ data: { status } }, {
      onSuccess: (r) => {
        queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
        toast({ title: "Cleared", description: `${r.deleted} ${status} withdrawals deleted.` });
        setConfirmClear(null);
      },
      onError: () => toast({ title: "Error", description: "Failed to clear.", variant: "destructive" }),
    });
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
    <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}</div>
  );

  if (!withdrawals || withdrawals.length === 0) return (
    <div className="text-center py-16 flex flex-col items-center">
      <Wallet className="h-12 w-12 mb-4" style={{ color: "#1a2d00" }} />
      <p className="text-base font-semibold" style={{ color: "#0d1a00" }}>No withdrawal requests</p>
      <p className="text-sm mt-1" style={{ color: TEXT_SOFT }}>When users request withdrawals, they will appear here.</p>
    </div>
  );

  return (
    <div>
      {/* confirm clear dialog */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full space-y-4 text-center" style={{ background: "hsl(74,58%,52%)", border: "1px solid hsl(74,40%,38%)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <Trash2 className="h-10 w-10 mx-auto" style={{ color: "hsl(5,75%,50%)" }} />
            <p className="font-bold text-base" style={{ color: "#0d1a00" }}>
              {confirmClear === "rejected" ? "ሁሉም ሪጄክትድ ዊዝድሮዎች" : "ሁሉም ተከፈሉ ዊዝድሮዎች"} ይሰረዙ?
            </p>
            <p className="text-sm" style={{ color: "#1a2d00" }}>ይህ ድርጊት ሊቀለበስ አይችልም።</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(null)} className="flex-1 h-10 rounded-xl font-bold text-sm" style={{ background: "hsl(74,50%,44%)", color: "#0d1a00", border: "1px solid hsl(74,40%,36%)" }}>ሰርዝ</button>
              <button
                onClick={() => handleClear(confirmClear)}
                disabled={bulkClear.isPending}
                className="flex-1 h-10 rounded-xl font-bold text-sm"
                style={{ background: "hsl(5,65%,38%)", color: "#fff", border: "none" }}
              >
                {bulkClear.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "አዎ, ሰርዝ"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 mb-3">
        {/* Clear buttons */}
        <div className="flex gap-2">
          <button onClick={() => setConfirmClear("rejected")} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold" style={{ background: "hsl(5,55%,22%)", border: "1px solid hsl(5,55%,36%)", color: "hsl(5,75%,70%)" }}>
            <Trash2 className="h-3.5 w-3.5" />ሪጄክቶቹን ሰርዝ
          </button>
          <button onClick={() => setConfirmClear("completed")} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold" style={{ background: "hsl(136,48%,14%)", border: "1px solid hsl(136,48%,28%)", color: "hsl(136,60%,65%)" }}>
            <Trash2 className="h-3.5 w-3.5" />የተከፈሉትን ሰርዝ
          </button>
        </div>
        {/* Export buttons */}
        <div className="flex gap-2">
          <button onClick={handleTgExport} disabled={tgExport.isPending} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold" style={{ background: "hsl(200,70%,18%)", border: "1px solid hsl(200,60%,32%)", color: "#29B6F6" }}>
            {tgExport.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            → TG
          </button>
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-xs font-bold" style={{ background: "hsl(74,90%,39%)", border: "1px solid hsl(43,40%,30%)", color: GOLD }}>
            <FileDown className="h-3.5 w-3.5" />CSV
          </button>
        </div>
      </div>
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid hsl(43,30%,24%,0.4)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
    >
      <Table>
        <TableHeader>
          <TableRow style={{ background: "hsl(74,100%,37%)", borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: users, isLoading } = useAdminListUsers(debouncedSearch ? { search: debouncedSearch } : undefined);
  const banUser = useAdminBanUser();

  const handleBan = (userId: number) => {
    banUser.mutate({ id: userId }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        toast({ title: res.isBanned ? "User banned" : "User unbanned", description: res.isBanned ? "User can no longer log in." : "User access restored." });
      },
      onError: () => toast({ title: "Error", description: "Failed to update ban status.", variant: "destructive" }),
    });
  };

  const handleExport = () => {
    if (!users?.length) return;
    downloadCSV(
      `users-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Name", "Email", "Wallet Balance (ETB)", "Total Submitted", "Approved", "Banned", "Joined"],
      users.map((u) => [
        u.id, u.name ?? "", u.email ?? "", u.walletBalance,
        u.totalSubmissions, u.approvedSubmissions, u.isBanned ? "Yes" : "No",
        format(new Date(u.createdAt), "yyyy-MM-dd HH:mm"),
      ]),
    );
  };

  if (isLoading) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}</div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#1a2d00" }} />
          <input
            className="w-full pl-9 pr-3 h-9 rounded-xl text-sm outline-none"
            style={{ background: "hsl(74,100%,35%)", border: "1px solid hsl(43,30%,22%)", color: "#0d1a00" }}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg px-3 h-9 text-xs font-bold transition-all" style={{ background: "hsl(74,90%,39%)", border: "1px solid hsl(43,40%,30%)", color: GOLD }}>
          <FileDown className="h-3.5 w-3.5" />Export
        </button>
      </div>
      {!users || users.length === 0 ? (
        <div className="text-center py-12 flex flex-col items-center">
          <Users className="h-12 w-12 mb-4" style={{ color: "#1a2d00" }} />
          <p className="text-base font-semibold" style={{ color: "#0d1a00" }}>No users found</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid hsl(43,30%,24%,0.4)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          <Table>
            <TableHeader>
              <TableRow style={{ background: "hsl(74,100%,37%)", borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
                {["Name","Email","Wallet","Submissions","Approved","Status","Actions"].map(h => (
                  <TableHead key={h} className="text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="luxury-row transition-colors" style={{ borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}`, background: BURGUNDY_CARD }}>
                  <TableCell className="font-semibold text-sm" style={{ color: TEXT_BODY }}>{user.name ?? "—"}</TableCell>
                  <TableCell className="text-xs" style={{ color: TEXT_SOFT }}>{user.email ?? "—"}</TableCell>
                  <TableCell className="font-bold text-sm" style={{ color: GOLD_BRIGHT }}>{user.walletBalance} ETB</TableCell>
                  <TableCell className="text-sm text-center" style={{ color: TEXT_BODY }}>{user.totalSubmissions}</TableCell>
                  <TableCell className="text-sm text-center" style={{ color: TEXT_BODY }}>{user.approvedSubmissions}</TableCell>
                  <TableCell>
                    {user.isBanned
                      ? <span className="badge-rejected inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border">Banned</span>
                      : <span className="badge-approved inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border">Active</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => handleBan(user.id)}
                      disabled={banUser.isPending}
                      className="inline-flex items-center gap-1 rounded-lg px-3 h-7 text-xs font-bold transition-all"
                      style={user.isBanned
                        ? { background: "hsl(136,48%,14%)", border: "1px solid hsl(136,48%,28%)", color: "hsl(136,60%,65%)" }
                        : { background: "hsl(5,55%,16%)", border: "1px solid hsl(5,55%,28%)", color: "hsl(5,75%,65%)" }}
                    >
                      {user.isBanned ? <UserCheck className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                      {user.isBanned ? "Unban" : "Ban"}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function MessagesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const { data: conversations, isLoading: convsLoading } = useAdminListConversations();
  const { data: messages, isLoading: msgsLoading } = useAdminGetConversation(selectedUserId ?? 0, {
    query: { enabled: !!selectedUserId }
  });
  const sendMessage = useAdminSendMessage();

  const handleSend = () => {
    if (!selectedUserId || !replyBody.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ userId: selectedUserId, data: { body: replyBody.trim() } }, {
      onSuccess: () => {
        setReplyBody("");
        queryClient.invalidateQueries({ queryKey: getAdminGetConversationQueryKey(selectedUserId) });
        queryClient.invalidateQueries({ queryKey: getAdminListConversationsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to send message.", variant: "destructive" }),
    });
  };

  if (selectedUserId) {
    return (
      <div className="flex flex-col" style={{ height: "60vh" }}>
        <button
          onClick={() => { setSelectedUserId(null); setReplyBody(""); }}
          className="flex items-center gap-2 mb-4 text-sm font-semibold"
          style={{ color: GOLD }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to conversations
        </button>
        <p className="text-sm font-bold mb-3" style={{ color: "#0d1a00" }}>Chat with {selectedUserName}</p>
        <div className="flex-1 overflow-y-auto rounded-2xl p-4 space-y-3 mb-4" style={{ background: "hsl(74,100%,33%)", border: "1px solid hsl(43,30%,20%,0.4)" }}>
          {msgsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-3/4 rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}</div>
          ) : (messages ?? []).map((msg) => (
            <div key={msg.id} className={`flex ${msg.fromAdmin ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%] rounded-2xl px-4 py-2.5" style={msg.fromAdmin ? { background: `linear-gradient(135deg, ${GOLD}55, hsl(43,60%,28%))`, border: `1px solid ${GOLD}40` } : { background: BURGUNDY_CARD, border: "1px solid hsl(43,30%,24%,0.4)" }}>
                <p className="text-[10px] font-bold mb-0.5" style={{ color: msg.fromAdmin ? "#D4AF37" : "hsl(200,80%,65%)" }}>{msg.fromAdmin ? "Admin" : selectedUserName}</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "#0d1a00" }}>{msg.body}</p>
                <p className="text-[10px] mt-1 text-right" style={{ color: "#1a2d00" }}>{format(new Date(msg.createdAt), "MMM d, HH:mm")}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-2xl p-2" style={{ background: "hsl(74,100%,35%)", border: "1px solid hsl(43,30%,22%,0.5)" }}>
          <textarea
            className="flex-1 resize-none bg-transparent outline-none text-sm px-2 py-1.5 max-h-28"
            rows={1}
            placeholder="Reply…"
            style={{ color: "#0d1a00", caretColor: GOLD }}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button onClick={handleSend} disabled={!replyBody.trim() || sendMessage.isPending} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40" style={{ background: `linear-gradient(135deg, ${GOLD}, hsl(43,50%,45%))` }}>
            {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4 text-black" />}
          </button>
        </div>
      </div>
    );
  }

  if (convsLoading) return (
    <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}</div>
  );

  if (!conversations || conversations.length === 0) return (
    <div className="text-center py-16 flex flex-col items-center">
      <MessageSquare className="h-12 w-12 mb-4" style={{ color: "#1a2d00" }} />
      <p className="text-base font-semibold" style={{ color: "#0d1a00" }}>No messages yet</p>
      <p className="text-sm mt-1" style={{ color: TEXT_SOFT }}>When users send messages, they will appear here.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <button
          key={conv.userId}
          className="w-full text-left rounded-2xl p-4 transition-all hover:brightness-110 flex items-center gap-3"
          style={{ background: BURGUNDY_CARD, border: "1px solid hsl(43,30%,24%,0.4)" }}
          onClick={() => { setSelectedUserId(conv.userId); setSelectedUserName(conv.userName || conv.userEmail); }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "hsl(74,90%,39%)", border: `1px solid ${GOLD}30` }}>
            <MessageSquare className="w-4 h-4" style={{ color: GOLD }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "#0d1a00" }}>{conv.userName || conv.userEmail}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: TEXT_SOFT }}>{conv.lastMessage}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs" style={{ color: TEXT_SOFT }}>{format(new Date(conv.lastMessageAt), "MMM d")}</p>
            {conv.unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold mt-1" style={{ background: GOLD, color: "#0d1a00" }}>{conv.unreadCount}</span>
            )}
          </div>
        </button>
      ))}
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
                  <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>Title</FormLabel>
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
                  <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>Message</FormLabel>
                  <FormControl>
                    <textarea
                      rows={4}
                      placeholder="Write your announcement here..."
                      className="luxury-input w-full rounded-lg px-3 py-2.5 text-sm resize-none"
                      style={{
                        background: "hsl(74,90%,36%)",
                        border: "1px solid hsl(43,30%,28%,0.5)",
                        color: "#0d1a00",
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
            {[0,1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}
          </div>
        ) : !broadcasts || broadcasts.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: TEXT_SOFT }}>No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="rounded-xl px-4 py-3"
                style={{ background: "hsl(74,90%,36%)", border: "1px solid hsl(43,30%,22%,0.4)" }}
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
  const { data: currentSettings } = useGetSettings();

  const priceForm = useForm<z.infer<typeof priceSchema>>({
    resolver: zodResolver(priceSchema),
    defaultValues: { pricePerEmail: 20, referralCommissionPct: 10, telegramBotUsername: "" },
  });

  useEffect(() => {
    if (currentSettings) {
      priceForm.reset({
        pricePerEmail: currentSettings.pricePerEmail,
        referralCommissionPct: currentSettings.referralCommissionPct,
        telegramBotUsername: currentSettings.telegramBotUsername ?? "",
      });
    }
  }, [currentSettings]);

  const pwForm = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onPriceSubmit = (values: z.infer<typeof priceSchema>) => {
    updateSettings.mutate(
      { data: { pricePerEmail: values.pricePerEmail, referralCommissionPct: values.referralCommissionPct, telegramBotUsername: values.telegramBotUsername } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          priceForm.setValue("pricePerEmail", data.pricePerEmail);
          priceForm.setValue("referralCommissionPct", data.referralCommissionPct);
          if (data.telegramBotUsername !== undefined) priceForm.setValue("telegramBotUsername", data.telegramBotUsername);
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
                  <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>Price (ETB)</FormLabel>
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
                        style={{ background: "hsl(74,90%,39%)", border: "1px solid hsl(43,30%,28%,0.4)", color: GOLD }}
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
                  <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>Referral Commission (%)</FormLabel>
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
                        style={{ background: "hsl(74,90%,39%)", border: "1px solid hsl(43,30%,28%,0.4)", color: GOLD }}
                      >
                        %
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={priceForm.control}
              name="telegramBotUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>Telegram Bot Username</FormLabel>
                  <FormControl>
                    <div className="flex gap-2 items-center">
                      <span className="text-sm font-semibold" style={{ color: "#2d4000" }}>@</span>
                      <Input
                        placeholder="YourBotUsername"
                        className="luxury-input h-10 rounded-lg"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs mt-1" style={{ color: "#1a2d00" }}>
                    The bot username (without @) shown to users on the dashboard as a link.
                  </p>
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
                    <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>
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
                background: "hsl(74,90%,39%)",
                border: "1.5px solid hsl(43,40%,35%)",
                color: "#0d1a00",
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

type GenEmail = {
  id: number;
  email: string;
  password: string;
  status: string;
  claimed_at: string | null;
  created_at: string;
  claimed_by_name: string | null;
};

function GeneratedEmailsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bulkText, setBulkText] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: emails, isLoading } = useQuery<GenEmail[]>({
    queryKey: ["admin-gen-emails"],
    queryFn: async () => {
      const r = await fetch("/api/admin/generated-emails", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const stats = {
    available: emails?.filter((e) => e.status === "available").length ?? 0,
    claimed: emails?.filter((e) => e.status === "claimed").length ?? 0,
    submitted: emails?.filter((e) => e.status === "submitted").length ?? 0,
  };

  const handleAdd = async () => {
    const lines = bulkText.trim().split("\n").filter(Boolean);
    const parsed = lines.map((line) => {
      const idx = line.indexOf(":");
      if (idx < 0) return null;
      return { email: line.slice(0, idx).trim(), password: line.slice(idx + 1).trim() };
    }).filter(Boolean) as { email: string; password: string }[];

    if (parsed.length === 0) {
      toast({ title: "No valid entries", description: "Use format: email@gmail.com:password", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      const r = await fetch("/api/admin/generated-emails", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: parsed }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Failed");
      toast({ title: `Added ${body.added} emails`, description: body.skipped > 0 ? `${body.skipped} duplicates skipped.` : "All emails added successfully." });
      setBulkText("");
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["admin-gen-emails"] });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const r = await fetch(`/api/admin/generated-emails/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["admin-gen-emails"] });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = () => {
    if (!emails?.length) return;
    downloadCSV(
      `generated-emails-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Email", "Password", "Status", "Claimed By", "Created At"],
      emails.map((e) => [e.id, e.email, e.password, e.status, e.claimed_by_name ?? "", format(new Date(e.created_at), "yyyy-MM-dd HH:mm")])
    );
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Available", value: stats.available, color: "#5BE8FF" },
          { label: "Claimed", value: stats.claimed, color: "#0d1a00" },
          { label: "Submitted", value: stats.submitted, color: "hsl(136,60%,55%)" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: BURGUNDY_CARD, border: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
            <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: TEXT_SOFT }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold" style={{ color: TEXT_BODY }}>
          Email Pool ({emails?.length ?? 0} total)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-xs font-semibold transition-all"
            style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)", color: GOLD }}
          >
            <FileDown className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-xs font-semibold transition-all"
            style={{ background: "rgba(91,232,255,0.15)", border: "1px solid rgba(91,232,255,0.35)", color: "#5BE8FF" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add Emails
          </button>
        </div>
      </div>

      {/* Add panel */}
      {showAdd && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: BURGUNDY_CARD, border: "1px solid hsl(195,60%,28%,0.4)" }}>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: "#5BE8FF" }}>Bulk Add Emails</p>
            <p className="text-xs mb-3" style={{ color: TEXT_SOFT }}>
              One per line in format: <span className="font-mono" style={{ color: GOLD }}>email@gmail.com:password</span>
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={"example@gmail.com:mypassword123\nanother@gmail.com:pass456"}
              className="w-full rounded-xl px-3 py-2 text-sm font-mono resize-none focus:outline-none"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid hsl(195,50%,25%,0.5)",
                color: "#0d1a00",
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={adding || !bulkText.trim()}
              className="flex items-center gap-1.5 rounded-xl px-5 h-10 text-sm font-bold transition-all"
              style={{ background: "linear-gradient(135deg, hsl(195,70%,28%), hsl(195,60%,22%))", color: "#0d1a00", border: "1px solid hsl(195,60%,40%,0.5)" }}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {adding ? "Adding..." : "Add to Pool"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setBulkText(""); }}
              className="rounded-xl px-4 h-10 text-sm font-semibold"
              style={{ background: "transparent", border: `1px solid ${BURGUNDY_ROW_BORDER}`, color: TEXT_SOFT }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}
        </div>
      ) : !emails?.length ? (
        <div className="text-center py-12" style={{ color: TEXT_SOFT }}>
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No generated emails yet. Add some using the button above.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
          <Table>
            <TableHeader>
              <TableRow style={{ borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}`, background: BURGUNDY_CARD }}>
                {["Email", "Password", "Status", "Claimed By", "Added", ""].map((h) => (
                  <TableHead key={h} className="text-xs font-bold uppercase tracking-wide py-3" style={{ color: TEXT_SOFT }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((e) => (
                <TableRow key={e.id} style={{ borderBottom: `1px solid ${BURGUNDY_ROW_BORDER}` }}>
                  <TableCell className="font-mono text-sm max-w-[180px] truncate py-3" style={{ color: GOLD_BRIGHT }}>{e.email}</TableCell>
                  <TableCell className="font-mono text-sm max-w-[140px] truncate py-3" style={{ color: TEXT_BODY }}>{e.password}</TableCell>
                  <TableCell className="py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border"
                      style={
                        e.status === "available"
                          ? { background: "rgba(91,232,255,0.1)", border: "1px solid rgba(91,232,255,0.3)", color: "#5BE8FF" }
                          : e.status === "submitted"
                          ? { background: "rgba(74,200,120,0.1)", border: "1px solid rgba(74,200,120,0.3)", color: "hsl(136,60%,60%)" }
                          : { background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)", color: GOLD }
                      }
                    >
                      {e.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm py-3" style={{ color: TEXT_SOFT }}>
                    {e.claimed_by_name ?? (e.status === "available" ? "—" : "Unknown")}
                  </TableCell>
                  <TableCell className="text-xs py-3" style={{ color: TEXT_SOFT }}>
                    {format(new Date(e.created_at), "MMM d, HH:mm")}
                  </TableCell>
                  <TableCell className="py-3">
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deletingId === e.id}
                      className="rounded-lg p-1.5 transition-all hover:bg-red-900/30"
                      style={{ color: "hsl(74,90%,25%)" }}
                    >
                      {deletingId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
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
      style={{ background: "hsl(74,100%,32%)" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "linear-gradient(180deg, hsl(74,100%,30%) 0%, hsl(74,88%,12%) 100%)",
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
          <p className="text-sm" style={{ color: "#2d4000" }}>
            Manage email submissions, withdrawals, and platform settings.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-7">
          {statCards.map((stat) => (
            <div key={stat.label} className="stat-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#2d4000" }}>{stat.label}</p>
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-16 rounded-lg" style={{ background: "hsl(74,85%,41%)" }} />
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
              background: "hsl(74,100%,37%)",
              border: "1px solid hsl(43,30%,24%,0.4)",
            }}
          >
            {[
              { value: "submissions", icon: Mail, label: "Submissions" },
              { value: "withdrawals", icon: Wallet, label: "Withdrawals" },
              { value: "users", icon: Users, label: "Users" },
              { value: "messages", icon: MessageSquare, label: "Messages" },
              { value: "gen-emails", icon: Sparkles, label: "Gen Emails" },
              { value: "broadcast", icon: Megaphone, label: "Broadcast" },
              { value: "settings", icon: ShieldCheck, label: "Settings" },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 rounded-lg text-sm font-semibold px-4 py-2 data-[state=active]:text-[hsl(74_90%_10%)]"
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
          <TabsContent value="messages"><MessagesTab /></TabsContent>
          <TabsContent value="gen-emails"><GeneratedEmailsTab /></TabsContent>
          <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
