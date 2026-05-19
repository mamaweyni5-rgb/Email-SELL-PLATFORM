import { useGetMe, useGetProfile, useCreateWithdrawal, getListWithdrawalsQueryKey, getGetProfileQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
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
          const message = (err as { error?: string })?.error ?? "Failed to request withdrawal.";
          toast({ title: "Error", description: message, variant: "destructive" });
        },
      }
    );
  };

  if (authLoading) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("wd_back")}
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t("wd_title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("wd_balance_label")}{" "}
            <span className="font-bold text-blue-600">{profile?.walletBalance ?? 0} ETB</span>
          </p>
        </div>

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>{t("wd_success_desc")}</AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-base">{t("wd_card_title")}</CardTitle>
            <CardDescription>{t("wd_card_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("wd_amount_label")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Wallet className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" type="number" min={1} placeholder={t("wd_amount_placeholder")} data-testid="input-amount" {...field} />
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
                      <FormLabel>{t("wd_telebirr_label")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" placeholder={t("wd_telebirr_placeholder")} data-testid="input-telebirr-number" {...field} />
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
                      <FormLabel>{t("wd_name_label")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" placeholder={t("wd_name_placeholder")} data-testid="input-telebirr-name" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createWithdrawal.isPending || (profile?.walletBalance ?? 0) === 0}
                  data-testid="button-withdraw"
                >
                  {createWithdrawal.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("wd_submitting")}</>
                  ) : (
                    t("wd_btn")
                  )}
                </Button>
                {(profile?.walletBalance ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground text-center">{t("wd_no_balance")}</p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
