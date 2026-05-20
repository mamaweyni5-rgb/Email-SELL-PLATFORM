import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { useTelegramContext } from "@/App";
import { TelegramBottomNav } from "./telegram-bottom-nav";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";

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
  return (
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
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{
            background: "linear-gradient(145deg, #FFD700, #D4AF37, #B8962E)",
            color: "hsl(344 90% 10%)",
            boxShadow: "0 2px 8px rgba(212,175,55,0.4)",
          }}
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
  );
}
