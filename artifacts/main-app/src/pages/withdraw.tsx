import { useGetMe, useGetProfile, useCreateWithdrawal, getListWithdrawalsQueryKey, getGetProfileQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Phone, User, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const withdrawSchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be at least 1 ETB"),
  telebirrNumber: z.string().min(10, "Enter a valid Telebirr number"),
  telebirrName: z.string().min(1, "Enter your full name"),
});

export default function Withdraw() {
  const queryClient = useQueryClient();
  const { data: user, isLoading: authLoading } = useGetMe();
  const { data: profile } = useGetProfile({ query: { enabled: !!user } });
  const [, setLocation] = useLocation();
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const createWithdrawal = useCreateWithdrawal();
  const { t } = useLanguage();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 0, telebirrNumber: "", telebirrName: "" },
  });

  const onSubmit = (values: z.infer<typeof withdrawSchema>) => {
    const balance = profile?.walletBalance ?? 0;
    if (values.amount > balance) {
      form.setError("amount", { message: `${t("wd_error_exceed")} ${balance} ETB` });
      return;
    }
    setSuccess(false);
    createWithdrawal.mutate(
      { data: values },
      {
        onSuccess: () => {
          setSuccess(true);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({ title: t("wd_toast_title"), description: t("wd_toast_desc") });
        },
        onError: (err) => {
          const message = (err as any)?.data?.error ?? (err as any)?.message ?? "Failed to request withdrawal.";
          toast({ title: "Error", description: message, variant: "destructive" });
        },
      }
    );
  };

  if (authLoading) return null;

  return (
    <Layout>
      <div
        className="flex flex-1 items-center justify-center p-4"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, hsl(344,80%,15%) 0%, hsl(344,90%,11%) 65%)",
        }}
      >
        <div className="w-full max-w-md">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors"
            style={{ color: "hsl(43,50%,60%)" }}
          >
            <ArrowLeft className="h-4 w-4" /> {t("wd_back")}
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#D4AF37" }}>
              {t("wd_title")}
            </h1>
            <p className="text-sm" style={{ color: "hsl(43,35%,58%)" }}>
              {t("wd_balance_label")}{" "}
              <span className="font-extrabold" style={{ color: "#FFD700" }}>
                {profile?.walletBalance ?? 0} ETB
              </span>
            </p>
          </div>

          {success && (
            <div
              className="flex items-center gap-3 rounded-xl p-4 mb-5"
              style={{
                background: "hsl(136,40%,12%)",
                border: "1px solid hsl(136,48%,28%,0.5)",
                color: "hsl(136,60%,65%)",
              }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{t("wd_success_desc")}</p>
            </div>
          )}

          <div
            className="rounded-2xl p-7"
            style={{
              background: "linear-gradient(145deg, hsl(348,85%,18%), hsl(344,80%,14%))",
              border: "1px solid hsl(43,40%,30%,0.4)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(212,175,55,0.1)",
            }}
          >
            <h2 className="text-sm font-bold mb-1" style={{ color: "hsl(46,68%,78%)" }}>{t("wd_card_title")}</h2>
            <p className="text-xs mb-5" style={{ color: "hsl(43,30%,52%)" }}>{t("wd_card_desc")}</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ color: "hsl(46,55%,72%)", fontSize: "0.8rem", fontWeight: 600 }}>
                        {t("wd_amount_label")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Wallet className="absolute left-3 top-3 h-4 w-4" style={{ color: "#D4AF37" }} />
                          <Input
                            className="luxury-input pl-9 h-11 rounded-lg"
                            type="number"
                            min={1}
                            placeholder={t("wd_amount_placeholder")}
                            data-testid="input-amount"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telebirrNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ color: "hsl(46,55%,72%)", fontSize: "0.8rem", fontWeight: 600 }}>
                        {t("wd_telebirr_label")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4" style={{ color: "#D4AF37" }} />
                          <Input
                            className="luxury-input pl-9 h-11 rounded-lg"
                            placeholder={t("wd_telebirr_placeholder")}
                            data-testid="input-telebirr-number"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telebirrName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ color: "hsl(46,55%,72%)", fontSize: "0.8rem", fontWeight: 600 }}>
                        {t("wd_name_label")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4" style={{ color: "#D4AF37" }} />
                          <Input
                            className="luxury-input pl-9 h-11 rounded-lg"
                            placeholder={t("wd_name_placeholder")}
                            data-testid="input-telebirr-name"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <button
                  type="submit"
                  className="gold-btn w-full h-11 rounded-xl font-bold text-sm"
                  disabled={createWithdrawal.isPending || (profile?.walletBalance ?? 0) === 0}
                  data-testid="button-withdraw"
                >
                  {createWithdrawal.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("wd_submitting")}
                    </span>
                  ) : (
                    t("wd_btn")
                  )}
                </button>
                {(profile?.walletBalance ?? 0) === 0 && (
                  <p className="text-xs text-center" style={{ color: "hsl(43,30%,50%)" }}>{t("wd_no_balance")}</p>
                )}
              </form>
            </Form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
