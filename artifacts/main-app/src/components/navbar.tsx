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

  const navLinkClass = (path: string) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
      location === path
        ? "gold-gradient text-[hsl(344_90%_10%)] shadow-sm"
        : "text-[hsl(46_68%_70%)] hover:text-[hsl(43_80%_68%)] hover:bg-[hsl(344_65%_20%)]"
    }`;

  return (
    <>
      <nav
        className="sticky top-0 z-50"
        style={{
          background: "linear-gradient(180deg, hsl(344,90%,10%) 0%, hsl(344,88%,13%) 100%)",
          borderBottom: "1px solid hsl(43,40%,30%,0.35)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(212,175,55,0.1)",
        }}
      >
        <div className="container mx-auto px-4 h-15 flex items-center justify-between" style={{ height: "3.75rem" }}>
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer select-none text-sm font-bold"
                style={{
                  background: "linear-gradient(145deg, #FFD700, #D4AF37, #B8962E)",
                  color: "hsl(344 90% 10%)",
                  boxShadow: "0 3px 12px rgba(212,175,55,0.45)",
                }}
                onClick={handleLogoTap}
              >
                M
              </div>
              <span
                className="font-bold text-xl tracking-tight"
                style={{
                  background: "linear-gradient(145deg, #FFD700, #D4AF37)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                MailMart
              </span>
            </Link>

            {!isLoading && !isError && user && (
              <div className="hidden md:flex items-center gap-1">
                <Link href="/dashboard" className={navLinkClass("/dashboard")}>{t("nav_dashboard")}</Link>
                <Link href="/submit" className={navLinkClass("/submit")}>{t("nav_sell")}</Link>
                <Link href="/withdraw" className={navLinkClass("/withdraw")}>{t("nav_withdraw")}</Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "am" : "en")}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md transition-all duration-200"
              style={{
                border: "1px solid hsl(43,40%,30%,0.5)",
                background: "hsl(344,65%,18%)",
                color: "hsl(43,60%,65%)",
              }}
              title={lang === "en" ? "Switch to Amharic" : "Switch to English"}
            >
              {lang === "en" ? "አማ" : "EN"}
            </button>

            {isLoading ? (
              <Skeleton className="h-9 w-24 rounded-full" style={{ background: "hsl(344,65%,22%)" }} />
            ) : !isError && user ? (
              <div className="flex items-center gap-2.5">
                <div
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{
                    background: "hsl(344,70%,18%)",
                    border: "1px solid hsl(43,40%,30%,0.4)",
                    color: "hsl(43,80%,68%)",
                  }}
                >
                  <Wallet className="w-3.5 h-3.5" style={{ color: "#D4AF37" }} />
                  {user.walletBalance} ETB
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-transparent">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback
                          className="uppercase text-sm font-bold"
                          style={{
                            background: "linear-gradient(145deg, #D4AF37, #B8962E)",
                            color: "hsl(344 90% 10%)",
                          }}
                        >
                          {(user.name ?? user.email ?? "?").substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56"
                    style={{
                      background: "hsl(348,88%,15%)",
                      border: "1px solid hsl(43,40%,28%,0.4)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    }}
                  >
                    <div className="flex items-center justify-start gap-2 p-2 border-b border-[hsl(344,55%,26%)]">
                      <div className="flex flex-col space-y-0.5 leading-none">
                        <p className="font-semibold text-sm truncate" style={{ color: "#D4AF37" }}>{user.name ?? user.email ?? ""}</p>
                        <p className="text-xs" style={{ color: "hsl(43,35%,55%)" }}>{t("nav_wallet")}: {user.walletBalance} ETB</p>
                      </div>
                    </div>
                    <DropdownMenuItem asChild className="cursor-pointer mt-1">
                      <Link href="/profile" className="flex items-center w-full" style={{ color: "hsl(46,68%,78%)" }}>
                        <User className="mr-2 h-4 w-4" style={{ color: "#D4AF37" }} />
                        <span>{t("nav_profile")}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="cursor-pointer"
                      style={{ color: "hsl(5,75%,62%)" }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t("nav_logout")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm font-medium px-3 py-2 transition-colors"
                  style={{ color: "hsl(43,60%,65%)" }}
                >
                  {t("nav_signin")}
                </Link>
                <Link
                  href="/register"
                  className="gold-btn inline-flex items-center justify-center rounded-lg text-sm font-bold h-9 px-4"
                >
                  {t("nav_get_started")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <Dialog open={showAdminDialog} onOpenChange={(open) => { setShowAdminDialog(open); setAdminPassword(""); }}>
        <DialogContent
          className="sm:max-w-sm"
          style={{
            background: "hsl(348,88%,14%)",
            border: "1px solid hsl(43,40%,30%,0.4)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#D4AF37" }}>{t("nav_admin_title")}</DialogTitle>
            <DialogDescription style={{ color: "hsl(43,35%,58%)" }}>{t("nav_admin_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="password"
              placeholder={t("nav_admin_placeholder")}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdminLogin(); }}
              autoFocus
              className="luxury-input"
            />
            <button
              className="gold-btn w-full h-10 rounded-lg font-bold text-sm"
              onClick={handleAdminLogin}
              disabled={verifyPassword.isPending || !adminPassword}
            >
              {verifyPassword.isPending ? t("nav_admin_checking") : t("nav_admin_enter")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
