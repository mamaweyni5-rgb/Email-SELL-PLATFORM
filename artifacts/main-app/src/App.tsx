import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import { createContext, useContext, useEffect, useState } from "react";
import { initTelegram, isTelegram, tg } from "@/lib/telegram";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Submit from "@/pages/submit";
import Withdraw from "@/pages/withdraw";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

interface TelegramContextValue {
  isInTelegram: boolean;
  telegramUser: { first_name: string; username?: string } | null;
}
const TelegramContext = createContext<TelegramContextValue>({
  isInTelegram: false,
  telegramUser: null,
});
export const useTelegramContext = () => useContext(TelegramContext);

function TelegramBackButton() {
  const [location, setLocation] = useLocation();
  const isInTelegram = isTelegram();

  useEffect(() => {
    if (!isInTelegram) return;
    const webApp = tg();
    if (!webApp) return;

    const isRoot = location === "/" || location === "/dashboard";
    if (isRoot) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
    }

    const handleBack = () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        setLocation("/dashboard");
      }
    };

    webApp.BackButton.onClick(handleBack);
    return () => {
      webApp.BackButton.offClick(handleBack);
    };
  }, [location, isInTelegram, setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/submit" component={Submit} />
      <Route path="/withdraw" component={Withdraw} />
      <Route path="/profile" component={Profile} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isInTelegram, setIsInTelegram] = useState(false);
  const [telegramUser, setTelegramUser] = useState<{ first_name: string; username?: string } | null>(null);

  useEffect(() => {
    const inTg = isTelegram();
    setIsInTelegram(inTg);
    if (inTg) {
      initTelegram();
      const user = tg()?.initDataUnsafe?.user;
      if (user) setTelegramUser({ first_name: user.first_name, username: user.username });
    }
  }, []);

  return (
    <TelegramContext.Provider value={{ isInTelegram, telegramUser }}>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <TelegramBackButton />
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </TelegramContext.Provider>
  );
}

export default App;
