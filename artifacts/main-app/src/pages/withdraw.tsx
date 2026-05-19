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
      form.setError("amount", { message: `Cannot exceed your balance of ${balance} ETB` });
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
          toast({ title: "Request submitted!", description: "Admin will process your Telebirr payment." });
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
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Withdraw Funds</h1>
          <p className="text-muted-foreground mt-1">
            Available balance:{" "}
            <span className="font-bold text-blue-600">{profile?.walletBalance ?? 0} ETB</span>
          </p>
        </div>

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              Withdrawal request submitted! Admin will send payment to your Telebirr account.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Telebirr Payment Info</CardTitle>
            <CardDescription>Enter the Telebirr account you want to receive payment on.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (ETB)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Wallet className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" type="number" min={1} placeholder="Enter amount" data-testid="input-amount" {...field} />
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
                      <FormLabel>Telebirr Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" placeholder="09XXXXXXXX" data-testid="input-telebirr-number" {...field} />
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
                      <FormLabel>Account Holder Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" placeholder="Full name on Telebirr" data-testid="input-telebirr-name" {...field} />
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
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                  ) : (
                    "Request Withdrawal"
                  )}
                </Button>
                {(profile?.walletBalance ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground text-center">You need an approved submission before withdrawing.</p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
