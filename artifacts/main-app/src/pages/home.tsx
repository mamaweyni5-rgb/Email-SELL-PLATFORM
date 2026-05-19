import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateRegistration, getListRegistrationsQueryKey, getGetRegistrationStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldCheck, Mail, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters long." }),
});

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const queryClient = useQueryClient();
  const createRegistration = useCreateRegistration();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setSuccess(false);
    createRegistration.mutate(
      { data: values },
      {
        onSuccess: () => {
          setSuccess(true);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRegistrationStatsQueryKey() });
        },
      }
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif text-foreground">Secure Portal</h1>
          <p className="mt-2 text-muted-foreground">Register your credentials to gain access.</p>
        </div>

        <Card className="border-none shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle>Account Registration</CardTitle>
            <CardDescription>Enter your email and a secure password to register.</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <Alert className="bg-primary/5 border-primary/20 text-primary mb-6">
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  Registration successful. Your account has been created securely.
                </AlertDescription>
              </Alert>
            ) : null}

            {createRegistration.error ? (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>
                  {(createRegistration.error as { error?: string })?.error || "Failed to register. Please try again."}
                </AlertDescription>
              </Alert>
            ) : null}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="name@company.com" className="pl-10" {...field} />
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
                      <FormLabel>Secure Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            className="pl-10 pr-10" 
                            {...field} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full mt-6" 
                  disabled={createRegistration.isPending}
                >
                  {createRegistration.isPending ? "Registering..." : "Complete Registration"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Operator Access &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
