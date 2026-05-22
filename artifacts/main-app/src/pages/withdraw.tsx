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
import { Wallet, Phone, User, ArrowLeft, CheckCircle2, Loader2, Building2, Hash } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { tgHaptic, tgSuccess, tgError } from "@/lib/telegram";

const MIN_WITHDRAWAL = 100;

const ETHIOPIAN_BANKS = [
  "ኢትዮጵያ ንግድ ባንክ (CBE)",
  "አዋሽ ባንክ",
  "ዳሽን ባንክ",
  "አቢሲኒያ ባንክ",
  "ዩናይትድ ባንክ",
  "ንብ ኢንተርናሽናል ባንክ",
  "ወጋገን ባንክ",
  "ኦሮሚያ ኮኦፐሬቲቭ ባንክ",
  "ሊዮን ኢንተርናሽናል ባንክ",
  "ዘሜን ባንክ",
  "በርሃን ባንክ",
  "ቡና ኢንተርናሽናል ባንክ",
  "አማራ ባንክ",
  "ሂጅራ ባንክ",
  "ሲንቄ ባንክ",
  "ፀሃይ ባንክ",
  "ሻቤሌ ባንክ",
] as const;

const telebirrSchema = z.object({
  paymentMethod: z.literal("telebirr"),
  amount: z.coerce.number().min(100, "ቢያንስ 100 ብር መሆን አለበት"),
  telebirrNumber: z.string().min(10, "ትክክለኛ የቴሌብር ቁጥር አስገባ"),
  telebirrName: z.string().min(1, "ሙሉ ስምህን አስገባ"),
});

const bankSchema = z.object({
  paymentMethod: z.literal("bank"),
  amount: z.coerce.number().min(100, "ቢያንስ 100 ብር መሆን አለበት"),
  bankName: z.string().min(1, "ባንክ ምረጥ"),
  bankAccountNumber: z.string().min(5, "ትክክለኛ የሂሳብ ቁጥር አስገባ"),
  bankAccountName: z.string().min(1, "የሂሳብ ባለቤት ስም አስገባ"),
});

const withdrawSchema = z.discriminatedUnion("paymentMethod", [telebirrSchema, bankSchema]);

type WithdrawForm = z.infer<typeof withdrawSchema>;

const GOLD = "#D4AF37";
const LABEL_COLOR = "hsl(46,55%,72%)";
const SOFT = "hsl(43,35%,58%)";

export default function Withdraw() {
  const queryClient = useQueryClient();
  const { data: user, isLoading: authLoading } = useGetMe();
  const { data: profile } = useGetProfile({ query: { enabled: !!user } });
  const [, setLocation] = useLocation();
  const [success, setSuccess] = useState(false);
  const [method, setMethod] = useState<"telebirr" | "bank">("telebirr");
  const { toast } = useToast();
  const createWithdrawal = useCreateWithdrawal();
  const { t } = useLanguage();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  const form = useForm<WithdrawForm>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      paymentMethod: "telebirr",
      amount: 0,
      telebirrNumber: "",
      telebirrName: "",
    } as WithdrawForm,
  });

  const switchMethod = (m: "telebirr" | "bank") => {
    setMethod(m);
    if (m === "telebirr") {
      form.reset({ paymentMethod: "telebirr", amount: form.getValues("amount") as number, telebirrNumber: "", telebirrName: "" });
    } else {
      form.reset({ paymentMethod: "bank", amount: form.getValues("amount") as number, bankName: "", bankAccountNumber: "", bankAccountName: "" });
    }
  };

  const onSubmit = (values: WithdrawForm) => {
    const balance = profile?.walletBalance ?? 0;
    if (values.amount > balance) {
      tgError();
      form.setError("amount", { message: `${t("wd_error_exceed")} ${balance} ETB` });
      return;
    }
    tgHaptic("medium");
    setSuccess(false);
    createWithdrawal.mutate(
      { data: values as any },
      {
        onSuccess: () => {
          tgSuccess();
          setSuccess(true);
          switchMethod(method);
          queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({ title: t("wd_toast_title"), description: t("wd_toast_desc") });
        },
        onError: (err) => {
          tgError();
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
          background: "radial-gradient(ellipse at 50% 0%, hsl(74,100%,37%) 0%, hsl(74,100%,32%) 65%)",
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
            <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: GOLD }}>
              {t("wd_title")}
            </h1>
            <p className="text-sm" style={{ color: SOFT }}>
              {t("wd_balance_label")}{" "}
              <span className="font-extrabold" style={{ color: "#FFD700" }}>
                {profile?.walletBalance ?? 0} ETB
              </span>
            </p>
          </div>

          {(profile?.walletBalance ?? 0) < MIN_WITHDRAWAL && (
            <div
              className="rounded-xl p-4 mb-5"
              style={{
                background: "hsl(38,55%,12%)",
                border: "1px solid hsl(38,60%,32%,0.6)",
              }}
            >
              <p className="text-sm font-bold mb-1" style={{ color: "hsl(46,90%,68%)" }}>
                ⚠️ {t("wd_low_balance_title")}
              </p>
              <p className="text-xs mb-3" style={{ color: "hsl(43,40%,56%)" }}>
                {t("wd_low_balance_desc")}
              </p>
              <Link
                href="/submit"
                className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg,#FFD700,#D4AF37)", color: "#0d1a00" }}
              >
                {t("wd_low_balance_cta")} →
              </Link>
            </div>
          )}

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

          {/* Payment Method Selector */}
          <div
            className="flex rounded-xl p-1 mb-5 gap-1"
            style={{ background: "hsl(74,100%,37%)", border: "1px solid hsl(43,30%,24%,0.5)" }}
          >
            <button
              type="button"
              onClick={() => switchMethod("telebirr")}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all"
              style={
                method === "telebirr"
                  ? { background: "linear-gradient(135deg,#FFD700,#D4AF37)", color: "#0d1a00" }
                  : { color: SOFT }
              }
            >
              <Phone className="h-4 w-4" />
              {t("wd_method_telebirr")}
            </button>
            <button
              type="button"
              onClick={() => switchMethod("bank")}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all"
              style={
                method === "bank"
                  ? { background: "linear-gradient(135deg,#FFD700,#D4AF37)", color: "#0d1a00" }
                  : { color: SOFT }
              }
            >
              <Building2 className="h-4 w-4" />
              {t("wd_method_bank")}
            </button>
          </div>

          <div
            className="rounded-2xl p-7"
            style={{
              background: "linear-gradient(145deg, hsl(74,100%,39%), hsl(74,100%,37%))",
              border: "1px solid hsl(43,40%,30%,0.4)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(212,175,55,0.1)",
            }}
          >
            <h2 className="text-sm font-bold mb-1" style={{ color: "hsl(46,68%,78%)" }}>
              {method === "telebirr" ? t("wd_card_title") : t("wd_bank_card_title")}
            </h2>
            <p className="text-xs mb-5" style={{ color: "hsl(74,70%,20%)" }}>
              {method === "telebirr" ? t("wd_card_desc") : t("wd_bank_card_desc")}
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* Amount — always shown */}
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                        {t("wd_amount_label")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Wallet className="absolute left-3 top-3 h-4 w-4" style={{ color: GOLD }} />
                          <Input
                            className="luxury-input pl-9 h-11 rounded-lg"
                            type="number"
                            min={1}
                            placeholder={t("wd_amount_placeholder")}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Telebirr fields */}
                {method === "telebirr" && (
                  <>
                    <FormField
                      control={form.control}
                      name="telebirrNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                            {t("wd_telebirr_label")}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3 h-4 w-4" style={{ color: GOLD }} />
                              <Input
                                className="luxury-input pl-9 h-11 rounded-lg"
                                placeholder={t("wd_telebirr_placeholder")}
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
                          <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                            {t("wd_name_label")}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-4 w-4" style={{ color: GOLD }} />
                              <Input
                                className="luxury-input pl-9 h-11 rounded-lg"
                                placeholder={t("wd_name_placeholder")}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Bank fields */}
                {method === "bank" && (
                  <>
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                            {t("wd_bank_name_label")}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-3 h-4 w-4 z-10" style={{ color: GOLD }} />
                              <select
                                className="luxury-input pl-9 h-11 rounded-lg w-full text-sm appearance-none pr-4"
                                style={{
                                  background: "hsl(74,90%,38%)",
                                  border: "1px solid hsl(43,30%,25%,0.5)",
                                  color: field.value ? "hsl(46,68%,82%)" : "hsl(43,30%,50%)",
                                }}
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value)}
                              >
                                <option value="" disabled style={{ background: "hsl(74,100%,37%)" }}>
                                  {t("wd_bank_select_placeholder")}
                                </option>
                                {ETHIOPIAN_BANKS.map((bank) => (
                                  <option key={bank} value={bank} style={{ background: "hsl(74,100%,37%)" }}>
                                    {bank}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                            {t("wd_bank_account_number_label")}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Hash className="absolute left-3 top-3 h-4 w-4" style={{ color: GOLD }} />
                              <Input
                                className="luxury-input pl-9 h-11 rounded-lg"
                                placeholder={t("wd_bank_account_number_placeholder")}
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
                      name="bankAccountName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                            {t("wd_bank_account_name_label")}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-4 w-4" style={{ color: GOLD }} />
                              <Input
                                className="luxury-input pl-9 h-11 rounded-lg"
                                placeholder={t("wd_bank_account_name_placeholder")}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <button
                  type="submit"
                  className="gold-btn w-full h-11 rounded-xl font-bold text-sm"
                  disabled={createWithdrawal.isPending || (profile?.walletBalance ?? 0) < MIN_WITHDRAWAL}
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
                {(profile?.walletBalance ?? 0) < MIN_WITHDRAWAL && (
                  <p className="text-xs text-center" style={{ color: "#2d4000" }}>{t("wd_no_balance")}</p>
                )}
              </form>
            </Form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
