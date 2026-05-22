import { Link, useLocation } from "wouter";
import { LayoutDashboard, Mail, Wallet, User, MessageSquare } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { tgHaptic } from "@/lib/telegram";

const NAV_ITEMS: { href: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; labelKey?: "nav_dashboard" | "nav_sell" | "nav_withdraw" | "nav_profile"; label?: string }[] = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav_dashboard" },
  { href: "/submit",    icon: Mail,            labelKey: "nav_sell" },
  { href: "/inbox",     icon: MessageSquare,   label: "Inbox" },
  { href: "/withdraw",  icon: Wallet,          labelKey: "nav_withdraw" },
  { href: "/profile",   icon: User,            labelKey: "nav_profile" },
];

export function TelegramBottomNav({ show }: { show: boolean }) {
  const [location] = useLocation();
  const { t } = useLanguage();

  if (!show) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        background: "linear-gradient(0deg, hsl(57,100%,30%) 0%, hsl(57,100%,36%) 100%)",
        borderTop: "1px solid hsl(43,40%,28%,0.4)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        paddingTop: "6px",
        height: "calc(60px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, labelKey, label }) => {
        const active = location === href;
        const displayLabel = labelKey ? t(labelKey) : label;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => tgHaptic("light")}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all duration-150"
          >
            <div
              className="w-10 h-7 flex items-center justify-center rounded-xl transition-all duration-150"
              style={active ? {
                background: "linear-gradient(145deg, rgba(212,175,55,0.25), rgba(212,175,55,0.08))",
                border: "1px solid rgba(212,175,55,0.3)",
              } : {}}
            >
              <Icon
                className="w-5 h-5"
                style={{ color: active ? "#FFD700" : "hsl(43,40%,45%)" }}
              />
            </div>
            <span
              className="text-[10px] font-medium leading-none"
              style={{ color: active ? "#D4AF37" : "hsl(43,35%,45%)" }}
            >
              {displayLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
