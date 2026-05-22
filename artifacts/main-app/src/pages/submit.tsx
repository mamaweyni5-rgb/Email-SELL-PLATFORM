import { useGetMe, useCreateSubmission, useGetSettings, getListSubmissionsQueryKey, getGetProfileQueryKey } from "@workspace/api-client-react";
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
import { Mail, Lock, CheckCircle2, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { tgHaptic, tgSuccess, tgError } from "@/lib/telegram";

const submitSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address")
    .refine((v) => v.toLowerCase().endsWith("@gmail.com"), {
      message: "Only Gmail accounts (@gmail.com) are accepted",
    }),
  password: z.string().min(1, "Password is required"),
});

export default function Submit() {
  const { data: user, isLoading: authLoading } = useGetMe();
  const { data: settings } = useGetSettings();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSubmission = useCreateSubmission();
  const { t } = useLanguage();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading, setLocation]);

  const form = useForm<z.infer<typeof submitSchema>>({
    resolver: zodResolver(submitSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof submitSchema>) => {
    tgHaptic("medium");
    setSuccess(false);
    createSubmission.mutate(
      { data: values },
      {
        onSuccess: () => {
          tgSuccess();
          setSuccess(true);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: t("submit_success_title"), description: t("submit_success_desc") });
        },
        onError: (err) => {
          tgError();
          const message = (err as any)?.data?.error ?? (err as any)?.message ?? "Failed to submit. Try again.";
          toast({ title: t("submit_error_title"), description: message, variant: "destructive" });
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
            <ArrowLeft className="h-4 w-4" /> {t("submit_back")}
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#0d1a00" }}>
              {t("submit_title")}
            </h1>
            <p className="text-sm" style={{ color: "#1a2d00" }}>
              {t("submit_subtitle_pre")}{" "}
              <span className="font-extrabold" style={{ color: "#FFD700" }}>
                {settings?.pricePerEmail ?? 20} ETB
              </span>{" "}
              {t("submit_subtitle_post")}
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
              <p className="text-sm font-medium">{t("submit_success_desc")}</p>
            </div>
          )}

          <div
            className="rounded-2xl p-7"
            style={{
              background: "linear-gradient(145deg, hsl(74,100%,39%), hsl(74,100%,37%))",
              border: "1px solid hsl(43,40%,30%,0.4)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(212,175,55,0.1)",
            }}
          >
            <h2 className="text-sm font-bold mb-1" style={{ color: "hsl(46,68%,78%)" }}>{t("submit_card_title")}</h2>
            <p className="text-xs mb-5" style={{ color: "hsl(74,70%,20%)" }}>{t("submit_card_desc")}</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>
                        {t("submit_email_label")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4" style={{ color: "#0d1a00" }} />
                          <Input
                            className="luxury-input pl-9 h-11 rounded-lg"
                            placeholder={t("submit_email_placeholder")}
                            data-testid="input-email"
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
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>
                        {t("submit_password_label")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4" style={{ color: "#0d1a00" }} />
                          <Input
                            className="luxury-input pl-9 pr-10 h-11 rounded-lg"
                            type={showPassword ? "text" : "password"}
                            placeholder={t("submit_password_placeholder")}
                            data-testid="input-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-3 transition-colors"
                            style={{ color: "hsl(43,40%,55%)" }}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <button
                  type="submit"
                  className="gold-btn w-full h-11 rounded-xl font-bold text-sm"
                  disabled={createSubmission.isPending}
                  data-testid="button-submit"
                >
                  {createSubmission.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("submit_submitting")}
                    </span>
                  ) : (
                    t("submit_btn")
                  )}
                </button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
