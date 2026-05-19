import { useGetMe, useCreateSubmission, useGetSettings, getListSubmissionsQueryKey, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, CheckCircle2, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const submitSchema = z.object({
  email: z.string().email("Enter a valid email address"),
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
    setSuccess(false);
    createSubmission.mutate(
      { data: values },
      {
        onSuccess: () => {
          setSuccess(true);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: t("submit_success_title"), description: t("submit_success_desc") });
        },
        onError: (err) => {
          const message = (err as any)?.data?.error ?? (err as any)?.message ?? "Failed to submit. Try again.";
          toast({ title: t("submit_error_title"), description: message, variant: "destructive" });
        },
      }
    );
  };

  if (authLoading) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("submit_back")}
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("submit_title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("submit_subtitle_pre")}{" "}
            <span className="font-semibold text-blue-600">{settings?.pricePerEmail ?? 20} ETB</span>{" "}
            {t("submit_subtitle_post")}
          </p>
        </div>

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>{t("submit_success_desc")}</AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-base">{t("submit_card_title")}</CardTitle>
            <CardDescription>{t("submit_card_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("submit_email_label")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" placeholder={t("submit_email_placeholder")} data-testid="input-email" {...field} />
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
                      <FormLabel>{t("submit_password_label")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9 pr-9"
                            type={showPassword ? "text" : "password"}
                            placeholder={t("submit_password_placeholder")}
                            data-testid="input-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createSubmission.isPending}
                  data-testid="button-submit"
                >
                  {createSubmission.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("submit_submitting")}</>
                  ) : (
                    t("submit_btn")
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
