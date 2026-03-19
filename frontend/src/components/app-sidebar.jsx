"use client";

import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  CreditCard,
  Package,
  FileText,
  MessageSquare,
  BarChart3,
  Sparkles,
  Settings,
  Crown,
  ChevronRight,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, color: "text-blue-400" },
  { name: "Owner Panel", href: "/owner", icon: Crown, premium: true, color: "text-amber-400" },
  { name: "Hastalar", href: "/patients", icon: Users, color: "text-emerald-400" },
  { name: "Randevular", href: "/appointments", icon: Calendar, color: "text-purple-400" },
  { name: "Tedavi Planları", href: "/treatments", icon: ClipboardList, color: "text-cyan-400" },
  { name: "Finans", href: "/finance", icon: CreditCard, color: "text-green-400" },
  { name: "Stok / Laboratuvar", href: "/inventory", icon: Package, color: "text-orange-400" },
  { name: "Dokümanlar", href: "/documents", icon: FileText, color: "text-pink-400" },
  { name: "İletişim", href: "/communications", icon: MessageSquare, color: "text-indigo-400" },
  { name: "Raporlar", href: "/reports", icon: BarChart3, color: "text-teal-400" },
  { name: "AI Center", href: "/ai", icon: Sparkles, color: "text-violet-400" },
  { name: "Ayarlar", href: "/settings", icon: Settings, color: "text-gray-400" },
];

export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="flex h-full w-64 flex-col bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 text-white shadow-2xl">
      {/* Logo Header with Animation */}
      <div className="flex h-16 items-center justify-center border-b border-gray-800 dark:border-gray-700 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 shadow-lg shadow-blue-500/50 animate-pulse">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            DentAI
          </h1>
        </div>
      </div>

      {/* Navigation with Modern Design */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const isPremium = item.premium;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "group relative flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ease-out",
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/40 scale-[1.02]"
                  : "text-gray-300 hover:bg-gray-800/50 hover:text-white hover:scale-[1.02] hover:shadow-lg"
              )}
            >
              {/* Active Indicator Line */}
              {isActive && (
                <div className="absolute -left-3 h-8 w-1 rounded-r-full bg-gradient-to-b from-blue-400 to-indigo-600" />
              )}
              
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0 transition-all duration-300",
                  isActive ? "text-white scale-110" : `${item.color} group-hover:scale-110`
                )}
              />
              
              <span className="flex-1">{item.name}</span>
              
              {isPremium && (
                <span className="ml-auto text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2 py-1 rounded-md shadow-md animate-pulse">
                  PRO
                </span>
              )}
              
              {isActive && (
                <ChevronRight className="h-4 w-4 text-white animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Modern Footer */}
      <div className="border-t border-gray-800 dark:border-gray-700 p-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 dark:from-blue-500/10 dark:to-purple-500/10 p-3 text-center backdrop-blur-sm border border-blue-500/20 dark:border-blue-400/20">
          <div className="text-xs font-semibold text-blue-300 dark:text-blue-400 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3" />
            Powered by AI
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">© 2024 DentAI</div>
        </div>
      </div>
    </div>
  );
}

