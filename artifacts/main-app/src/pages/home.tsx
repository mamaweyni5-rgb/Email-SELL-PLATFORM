import { useGetMe, useGetSettings } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, ShieldCheck, Banknote } from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const { data: user, isLoading: authLoading } = useGetMe({ query: { retry: false } });
  const { data: settings } = useGetSettings();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, authLoading, setLocation]);

  return (
    <Layout>
      <div className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/10 to-background py-20 lg:py-32 border-b">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto mb-6">
              Turn your unused email accounts into <span className="text-primary">real cash</span>.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              The trusted digital marketplace where Ethiopian users earn money by securely selling email accounts. Instant payouts via Telebirr.
            </p>
            
            {settings && (
              <div className="mb-10 inline-flex items-center justify-center bg-card shadow-sm border rounded-full px-6 py-3">
                <span className="text-lg font-medium">
                  Current rate: <span className="text-success font-bold">{settings.pricePerEmail} ETB</span> per approved email
                </span>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="text-lg h-14 px-8 w-full sm:w-auto">
                <Link href="/register">
                  Start Earning Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg h-14 px-8 w-full sm:w-auto">
                <Link href="/login">Sign In to Dashboard</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">How it works</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                A simple, secure process to monetize your accounts in three easy steps.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <Card className="border-none shadow-md bg-card">
                <CardContent className="pt-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">1. Submit Securely</h3>
                  <p className="text-muted-foreground">
                    Create an account and submit your valid email credentials through our secure encrypted platform.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md bg-card">
                <CardContent className="pt-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">2. Fast Verification</h3>
                  <p className="text-muted-foreground">
                    Our team reviews your submission quickly. Once approved, the funds are instantly added to your wallet.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md bg-card">
                <CardContent className="pt-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-6">
                    <Banknote className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">3. Withdraw Cash</h3>
                  <p className="text-muted-foreground">
                    Request a withdrawal to your Telebirr account and get your cash within hours.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
