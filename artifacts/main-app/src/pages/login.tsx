import { useGetMe, useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
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
import { Loader2 } from "lucide-react";
import { tgHaptic, tgSuccess, tgError } from "@/lib/telegram";

const loginSchema = z.object({
  identifier: z.string().min(1, "Please enter your email or name"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    tgHaptic("medium");
    loginMutation.mutate(
      { data: { identifier: data.identifier, password: data.password } },
      {
        onSuccess: () => {
          tgSuccess();
          toast({ title: t("login_success_title"), description: t("login_success_desc") });
          setLocation("/dashboard");
        },
        onError: (error) => {
          tgError();
          toast({
            title: t("login_error_title"),
            description: (error as any)?.data?.error ?? (error as any)?.message ?? t("login_error_desc"),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Layout>
      <div
        className="flex flex-1 items-center justify-center p-4"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, hsl(74,100%,38%) 0%, hsl(74,100%,32%) 60%)",
        }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{
            background: "linear-gradient(145deg, hsl(74,100%,39%), hsl(74,100%,37%))",
            border: "1px solid hsl(43,40%,30%,0.4)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset",
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-extrabold"
              style={{
                background: "linear-gradient(145deg, #2a6600, #1a4700)",
                color: "#ffffff",
                boxShadow: "0 6px 20px rgba(13,58,0,0.5)",
              }}
            >
              M
            </div>
            <h1
              className="text-2xl font-extrabold tracking-tight mb-1"
              style={{ color: "#0d1a00" }}
            >
              {t("login_title")}
            </h1>
            <p className="text-sm" style={{ color: "#1a2d00" }}>{t("login_subtitle")}</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: "#0d1a00", fontSize: "0.8rem", fontWeight: 600 }}>
                      {t("login_identifier")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("login_identifier_placeholder")}
                        type="text"
                        className="luxury-input h-11 rounded-lg"
                        {...field}
                      />
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
                      {t("login_password")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        className="luxury-input h-11 rounded-lg"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button
                type="submit"
                className="gold-btn w-full h-11 rounded-lg font-bold text-sm mt-2"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("login_signing")}
                  </span>
                ) : (
                  t("login_submit")
                )}
              </button>
            </form>
          </Form>

          <div
            className="mt-6 text-center text-sm"
            style={{ color: "#1a2d00" }}
          >
            {t("login_no_account")}{" "}
            <Link
              href="/register"
              className="font-semibold transition-colors"
              style={{ color: "#0d1a00" }}
            >
              {t("login_create")}
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
