import { useGetMe, getListSubmissionsQueryKey, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Lock, Copy, Check, ArrowLeft, Loader2, CheckCircle2,
  RefreshCw, Sparkles, ListChecks, LogIn, Send,
} from "lucide-react";
import { tgHaptic, tgSuccess, tgError } from "@/lib/telegram";
import { useLanguage } from "@/lib/i18n";

type ClaimedEmail = {
  id: number;
  name: string | null;
  email: string;
  password: string;
  status: string;
  claimed_at: string;
} | null;

type AvailableCount = { count: number };

function useClaimedEmail() {
  return useQuery<ClaimedEmail>({
    queryKey: ["generated-emails", "my-claim"],
    queryFn: async () => {
      const r = await fetch("/api/generated-emails/my-claim", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    retry: false,
  });
}

function useAvailableCount() {
  return useQuery<AvailableCount>({
    queryKey: ["generated-emails", "available-count"],
    queryFn: async () => {
      const r = await fetch("/api/generated-emails/available-count");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
}

function useClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/generated-emails/claim", {
        method: "POST",
        credentials: "include",
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Failed to claim");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generated-emails"] });
    },
  });
}

function useUnclaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/generated-emails/claim", {
        method: "DELETE",
        credentials: "include",
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Failed");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generated-emails"] });
    },
  });
}

function useSubmitGenerated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/generated-emails/${id}/submit`, {
        method: "POST",
        credentials: "include",
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Failed to submit");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generated-emails"] });
      qc.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    },
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      tgHaptic("light");
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
      style={{
        background: copied ? "rgba(74,200,120,0.18)" : "rgba(13,58,0,0.15)",
        border: `1px solid ${copied ? "rgba(74,200,120,0.4)" : "rgba(13,58,0,0.3)"}`,
        color: copied ? "hsl(136,60%,60%)" : "#0d1a00",
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? t("get_email_copied") : t("get_email_copy")}
    </button>
  );
}

const STEP_ICONS = [Mail, LogIn, Send];

export default function GetEmail() {
  const { data: user, isLoading: authLoading } = useGetMe();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);

  const { data: claimed, isLoading: claimLoading } = useClaimedEmail();
  const { data: availableData } = useAvailableCount();
  const claim = useClaim();
  const unclaim = useUnclaim();
  const submitGen = useSubmitGenerated();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  const handleClaim = () => {
    tgHaptic("medium");
    claim.mutate(undefined, {
      onError: (err) => {
        tgError();
        toast({ title: t("get_email_error_title"), description: (err as Error).message, variant: "destructive" });
      },
    });
  };

  const handleUnclaim = () => {
    tgHaptic("medium");
    setConfirmReturn(false);
    unclaim.mutate(undefined, {
      onError: (err) => {
        toast({ title: t("get_email_error_title"), description: (err as Error).message, variant: "destructive" });
      },
    });
  };

  const handleSubmit = () => {
    if (!claimed) return;
    tgHaptic("medium");
    submitGen.mutate(claimed.id, {
      onSuccess: () => {
        tgSuccess();
        setSubmitted(true);
        toast({ title: t("get_email_success_title"), description: t("get_email_success_desc") });
      },
      onError: (err) => {
        tgError();
        toast({ title: t("get_email_error_title"), description: (err as Error).message, variant: "destructive" });
      },
    });
  };

  if (authLoading || claimLoading) return null;

  const steps = [
    { title: t("get_email_step1_title"), desc: t("get_email_step1_desc") },
    { title: t("get_email_step2_title"), desc: t("get_email_step2_desc") },
    { title: t("get_email_step3_title"), desc: t("get_email_step3_desc") },
  ];

  return (
    <Layout>
      <div
        className="flex flex-1 flex-col p-4 min-h-full"
        style={{ background: "transparent" }}
      >
        <div className="w-full max-w-md mx-auto py-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors"
            style={{ color: "#0d1a00" }}
          >
            <ArrowLeft className="h-4 w-4" /> {t("get_email_back")}
          </Link>

          <div className="mb-7">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.4)" }}
              >
                <Sparkles className="h-4 w-4" style={{ color: "#0d1a00" }} />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#0d1a00" }}>
                {t("get_email_title")}
              </h1>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#1a2d00" }}>
              {t("get_email_subtitle")}
            </p>
          </div>

          {submitted && (
            <div
              className="flex items-center gap-3 rounded-xl p-4 mb-5"
              style={{ background: "hsl(136,40%,12%)", border: "1px solid hsl(136,48%,28%,0.5)", color: "hsl(136,60%,65%)" }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{t("get_email_success_desc")}</p>
            </div>
          )}

          {claimed && !submitted ? (
            <>
              <div
                className="rounded-2xl p-6 mb-4"
                style={{
                  background: "rgba(255,255,255,0.3)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.5)" }}
                  >
                    <Mail className="h-3.5 w-3.5" style={{ color: "#0d1a00" }} />
                  </div>
                  <span className="text-sm font-bold" style={{ color: "#0d1a00" }}>
                    {t("get_email_your_email")}
                  </span>
                </div>

                <div className="space-y-4">
                  {claimed.name && (
                    <div>
                      <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#2d4000" }}>
                        ስም / Name
                      </p>
                      <div
                        className="flex items-center justify-between gap-2 rounded-xl px-4 py-3"
                        style={{ background: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.5)" }}
                      >
                        <span className="text-sm font-semibold truncate" style={{ color: "#0d1a00" }}>
                          {claimed.name}
                        </span>
                        <CopyButton text={claimed.name} />
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#2d4000" }}>
                      {t("get_email_email_label")}
                    </p>
                    <div
                      className="flex items-center justify-between gap-2 rounded-xl px-4 py-3"
                      style={{ background: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.5)" }}
                    >
                      <span className="font-mono text-sm font-semibold truncate" style={{ color: "#0d1a00" }}>
                        {claimed.email}
                      </span>
                      <CopyButton text={claimed.email} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#2d4000" }}>
                      {t("get_email_pass_label")}
                    </p>
                    <div
                      className="flex items-center justify-between gap-2 rounded-xl px-4 py-3"
                      style={{ background: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.5)" }}
                    >
                      <span className="font-mono text-sm font-semibold truncate" style={{ color: "#0d1a00" }}>
                        {claimed.password}
                      </span>
                      <CopyButton text={claimed.password} />
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl p-5 mb-5"
                style={{
                  background: "rgba(255,255,255,0.28)",
                  border: "1px solid rgba(255,255,255,0.45)",
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#0d1a00" }}>
                  <ListChecks className="h-3.5 w-3.5 inline mr-1.5" />
                  {t("get_email_steps_title")}
                </p>
                <ol className="space-y-2.5">
                  {steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold mt-0.5"
                        style={{ background: "rgba(13,58,0,0.2)", border: "1px solid rgba(13,58,0,0.35)", color: "#0d1a00" }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#0d1a00" }}>{s.title}</p>
                        <p className="text-xs leading-relaxed" style={{ color: "#1a2d00" }}>{s.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitGen.isPending}
                  className="gold-btn w-full h-12 rounded-xl font-bold text-sm"
                >
                  {submitGen.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("get_email_submitting")}
                    </span>
                  ) : (
                    t("get_email_submit_btn")
                  )}
                </button>

                {!confirmReturn ? (
                  <button
                    onClick={() => setConfirmReturn(true)}
                    className="w-full h-10 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.2)", color: "#0d1a00" }}
                  >
                    {t("get_email_return_btn")}
                  </button>
                ) : (
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "rgba(255,255,255,0.28)", border: "1px solid rgba(255,255,255,0.45)" }}
                  >
                    <p className="text-sm text-center mb-3 font-medium" style={{ color: "#0d1a00" }}>
                      {t("get_email_return_confirm")}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUnclaim}
                        disabled={unclaim.isPending}
                        className="flex-1 h-9 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.5)", color: "#0d1a00" }}
                      >
                        {unclaim.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : t("get_email_return_yes")}
                      </button>
                      <button
                        onClick={() => setConfirmReturn(false)}
                        className="flex-1 h-9 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: "rgba(13,58,0,0.12)", border: "1px solid rgba(13,58,0,0.25)", color: "#0d1a00" }}
                      >
                        {t("get_email_return_cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : !submitted ? (
            <>
              <div
                className="rounded-2xl p-6 mb-5 text-center"
                style={{
                  background: "rgba(255,255,255,0.3)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.5)" }}
                >
                  <Sparkles className="h-7 w-7" style={{ color: "#0d1a00" }} />
                </div>

                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold mb-3"
                  style={{ background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.5)", color: "#0d1a00" }}
                >
                  <Mail className="h-3 w-3" />
                  {availableData?.count ?? 0} {t("get_email_available")}
                </div>

                <h2 className="text-lg font-extrabold mb-2" style={{ color: "#0d1a00" }}>
                  {t("get_email_claim_heading")}
                </h2>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#1a2d00" }}>
                  {t("get_email_claim_desc")}
                </p>

                <button
                  onClick={handleClaim}
                  disabled={claim.isPending || (availableData?.count ?? 0) === 0}
                  className="gold-btn w-full h-12 rounded-xl font-bold text-sm"
                >
                  {claim.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("get_email_claiming")}
                    </span>
                  ) : (availableData?.count ?? 0) === 0 ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      {t("get_email_none_available")}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {t("get_email_claim_btn")}
                    </span>
                  )}
                </button>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{
                  background: "rgba(255,255,255,0.28)",
                  border: "1px solid rgba(255,255,255,0.45)",
                }}
              >
                <p className="text-sm font-bold mb-4" style={{ color: "#0d1a00" }}>
                  {t("get_email_how_title")}
                </p>
                <div className="space-y-4">
                  {steps.map((s, i) => {
                    const Icon = STEP_ICONS[i];
                    return (
                      <div key={i} className="flex items-start gap-4">
                        <div
                          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.5)" }}
                        >
                          <Icon className="h-4 w-4" style={{ color: "#0d1a00" }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#0d1a00" }}>{s.title}</p>
                          <p className="text-xs leading-relaxed mt-0.5" style={{ color: "#1a2d00" }}>{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: "hsl(136,60%,55%)" }} />
              <h2 className="text-xl font-extrabold mb-2" style={{ color: "#0d1a00" }}>{t("get_email_success_title")}</h2>
              <p className="text-sm mb-6" style={{ color: "#1a2d00" }}>{t("get_email_success_desc")}</p>
              <Link href="/dashboard" className="gold-btn inline-flex items-center gap-2 px-6 h-11 rounded-xl font-bold text-sm">
                <ArrowLeft className="h-4 w-4" /> {t("get_email_back")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
