import { useGetMe, useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { Loader2, User, Users } from "lucide-react";
import { tgHaptic, tgSuccess, tgError } from "@/lib/telegram";

const registerSchema = z.object({
  name: z.string().min(2, "Display name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  referralCode: z.string().optional(),
});

export default function Register() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { t } = useLanguage();

  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const refFromUrl = urlParams.get("ref") ?? "";

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", password: "", referralCode: refFromUrl },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    tgHaptic("medium");
    registerMutation.mutate(
      {
        data: {
          name: data.name.trim(),
          password: data.password,
          referralCode: data.referralCode?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          tgSuccess();
          toast({ title: t("register_success_title"), description: t("register_success_desc") });
          setLocation("/dashboard");
        },
        onError: (error) => {
          tgError();
          toast({
            title: t("register_error_title"),
            description: (error as any)?.data?.error ?? (error as any)?.message ?? "An error occurred during registration.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const GOLD = "#D4AF37";
  const LABEL_COLOR = "hsl(46,55%,72%)";
  const SOFT = "hsl(43,35%,55%)";

  return (
    <Layout>
      <div
        className="flex flex-1 items-center justify-center p-4"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, hsl(344,80%,16%) 0%, hsl(344,90%,11%) 60%)",
        }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{
            background: "linear-gradient(145deg, hsl(348,85%,18%), hsl(344,80%,14%))",
            border: "1px solid hsl(43,40%,30%,0.4)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.08) inset",
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-extrabold"
              style={{
                background: "linear-gradient(145deg, #FFD700, #D4AF37)",
                color: "hsl(344 90% 10%)",
                boxShadow: "0 6px 20px rgba(212,175,55,0.4)",
              }}
            >
              M
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: GOLD }}>
              {t("register_title")}
            </h1>
            <p className="text-sm" style={{ color: SOFT }}>{t("register_subtitle")}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)" }}>
              <Users className="h-3.5 w-3.5" style={{ color: GOLD }} />
              <span className="text-xs font-bold" style={{ color: GOLD }}>10,426+ ተጠቃሚዎች ተቀላቅለዋል</span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* ── Name field ── */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {t("register_name")}
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("register_name_placeholder")}
                        type="text"
                        autoComplete="username"
                        className="luxury-input h-11 rounded-lg"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Password ── */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                      {t("register_password")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        autoComplete="new-password"
                        className="luxury-input h-11 rounded-lg"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Referral code ── */}
              <FormField
                control={form.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: LABEL_COLOR, fontSize: "0.8rem", fontWeight: 600 }}>
                      {t("register_ref_label")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("register_ref_placeholder")}
                        className="luxury-input h-11 rounded-lg uppercase"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                className="gold-btn w-full h-11 rounded-lg font-bold text-sm mt-2"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("register_creating")}
                  </span>
                ) : (
                  t("register_submit")
                )}
              </button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm" style={{ color: SOFT }}>
            {t("register_have_account")}{" "}
            <Link href="/login" className="font-semibold" style={{ color: GOLD }}>
              {t("register_signin")}
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
