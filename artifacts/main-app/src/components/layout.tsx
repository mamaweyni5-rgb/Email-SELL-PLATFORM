import { ReactNode, useState, useRef } from "react";
import { Navbar } from "./navbar";
import { useTelegramContext } from "@/App";
import { TelegramBottomNav } from "./telegram-bottom-nav";
import { useGetMe, useAdminVerifyPassword } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ADMIN_TAP_COUNT = 5;

export function Layout({ children }: { children: ReactNode }) {
  const { isInTelegram } = useTelegramContext();
  const { data: user } = useGetMe({ query: { retry: false } });
  const [location] = useLocation();

  const authPages = ["/", "/login", "/register"];
  const showBottomNav = isInTelegram && !!user && !authPages.includes(location);

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-background text-foreground"
      style={isInTelegram ? { paddingTop: "env(safe-area-inset-top, 0px)" } : {}}
    >
      {!isInTelegram && <Navbar />}
      {isInTelegram && <TelegramHeader />}
      <main
        className="flex-1 flex flex-col"
        style={showBottomNav ? { paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px))" } : {}}
      >
        {children}
      </main>
      <TelegramBottomNav show={showBottomNav} />
    </div>
  );
}

function TelegramHeader() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const verifyPassword = useAdminVerifyPassword();

  const [tapCount, setTapCount] = useState(0);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = () => {
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

  return (
    <>
      <div
        className="flex items-center justify-center py-3 px-4"
        style={{
          background: "linear-gradient(180deg, hsl(344,90%,10%) 0%, hsl(344,88%,13%) 100%)",
          borderBottom: "1px solid hsl(43,40%,30%,0.35)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer select-none"
            style={{
              background: "linear-gradient(145deg, #FFD700, #D4AF37, #B8962E)",
              color: "hsl(344 90% 10%)",
              boxShadow: "0 2px 8px rgba(212,175,55,0.4)",
            }}
            onClick={handleLogoTap}
          >
            M
          </div>
          <span
            className="font-bold text-lg tracking-tight"
            style={{
              background: "linear-gradient(145deg, #FFD700, #D4AF37)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            MailMart
          </span>
        </div>
      </div>

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
            <DialogTitle style={{ color: "#D4AF37" }}>Admin Access</DialogTitle>
            <DialogDescription style={{ color: "hsl(43,35%,58%)" }}>Enter admin password to continue</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="password"
              placeholder="Password"
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
              {verifyPassword.isPending ? "Checking..." : "Enter"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
