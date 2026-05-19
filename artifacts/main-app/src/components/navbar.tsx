import { useLocation } from "wouter";
import { useGetMe, useLogout, useAdminVerifyPassword, getGetMeQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, User, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

const ADMIN_TAP_COUNT = 5;

export function Navbar() {
  const { data: user, isLoading, isError } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const verifyPassword = useAdminVerifyPassword();
  const { lang, setLang, t } = useLanguage();

  const [tapCount, setTapCount] = useState(0);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setTapCount(0), 3000);
    if (newCount >= ADMIN_TAP_COUNT) {
      setTapCount(0);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      setAdminPassword("");
      setShowAdminDialog(true);
    }
  };

  const handleAdminLogin = () => {
    if (!adminPassword) return;
    verifyPassword.mutate(
      { data: { password: adminPassword } },
      {
        onSuccess: (result) => {
          if (result.valid) {
            setShowAdminDialog(false);
            setAdminPassword("");
            setLocation("/admin");
          } else {
            toast({ title: "Access denied", description: "Incorrect admin password.", variant: "destructive" });
            setAdminPassword("");
          }
        },
        onError: () => {
          toast({ title: "Error", description: "Could not verify password. Try again.", variant: "destructive" });
          setAdminPassword("");
        },
      }
    );
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/";
      }
    });
  };

  return (
    <>
      <nav className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-xl tracking-tight text-primary flex items-center gap-2">
              <div
                className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground cursor-pointer select-none"
                onClick={handleLogoTap}
              >
                M
              </div>
              MailTrade
            </Link>

            {!isLoading && !isError && user && (
              <div className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground">
                <Link href="/dashboard" className={`px-3 py-2 rounded-md hover:text-foreground transition-colors ${location === '/dashboard' ? 'bg-secondary text-foreground' : ''}`}>{t("nav_dashboard")}</Link>
                <Link href="/submit" className={`px-3 py-2 rounded-md hover:text-foreground transition-colors ${location === '/submit' ? 'bg-secondary text-foreground' : ''}`}>{t("nav_sell")}</Link>
                <Link href="/withdraw" className={`px-3 py-2 rounded-md hover:text-foreground transition-colors ${location === '/withdraw' ? 'bg-secondary text-foreground' : ''}`}>{t("nav_withdraw")}</Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "am" : "en")}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md border bg-secondary/50 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title={lang === "en" ? "Switch to Amharic" : "Switch to English"}
            >
              {lang === "en" ? "አማ" : "EN"}
            </button>

            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : !isError && user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border">
                  <Wallet className="w-4 h-4 text-warning" />
                  <span className="font-semibold text-sm">{user.walletBalance} ETB</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary uppercase">
                          {user.email.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium text-sm truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground">{t("nav_wallet")}: {user.walletBalance} ETB</p>
                      </div>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer flex items-center w-full">
                        <User className="mr-2 h-4 w-4" />
                        <span>{t("nav_profile")}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t("nav_logout")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2">
                  {t("nav_signin")}
                </Link>
                <Link href="/register" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                  {t("nav_get_started")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <Dialog open={showAdminDialog} onOpenChange={(open) => { setShowAdminDialog(open); setAdminPassword(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("nav_admin_title")}</DialogTitle>
            <DialogDescription>{t("nav_admin_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="password"
              placeholder={t("nav_admin_placeholder")}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdminLogin(); }}
              autoFocus
            />
            <Button className="w-full" onClick={handleAdminLogin} disabled={verifyPassword.isPending || !adminPassword}>
              {verifyPassword.isPending ? t("nav_admin_checking") : t("nav_admin_enter")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
