import { useGetMe, useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Register() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: t("register_success_title"), description: t("register_success_desc") });
          setLocation("/dashboard");
        },
        onError: (error) => {
          toast({
            title: t("register_error_title"),
            description: (error as any)?.data?.error ?? (error as any)?.message ?? "An error occurred during registration.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-primary/20">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold tracking-tight text-primary">{t("register_title")}</CardTitle>
            <CardDescription className="text-muted-foreground">{t("register_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("register_email")}</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" type="email" {...field} />
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
                      <FormLabel>{t("register_password")}</FormLabel>
                      <FormControl>
                        <Input placeholder="••••••••" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full mt-4" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? t("register_creating") : t("register_submit")}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">{t("register_have_account")} </span>
              <Link href="/login" className="text-primary hover:underline font-medium">
                {t("register_signin")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
