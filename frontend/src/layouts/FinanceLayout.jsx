"use client";

import { Link, useLocation, Outlet } from "react-router-dom";
import { cn } from "../lib/utils";
import {
  LayoutGrid,
  ArrowLeftRight,
  Building2,
  BookOpen,
  FileSpreadsheet,
  DollarSign,
  RotateCcw,
  Users,
  Stethoscope,
  CreditCard,
  Landmark,
  CalendarCheck,
} from "lucide-react";

const financeNav = [
  { name: "Özet", href: "/finance", icon: LayoutGrid, end: true },
  { name: "Cari Takibi", href: "/finance/current-accounts", icon: Building2, end: false },
  { name: "Ön Muhasebe", href: "/finance/pre-accounting", icon: BookOpen, end: false },
  { name: "Muhasebe", href: "/finance/current-accounts", icon: FileSpreadsheet, end: false, hidden: true },
  { name: "Muhasebe Hareketleri", href: "/finance/movements", icon: ArrowLeftRight, end: false },
  { name: "Hasta Gelir", href: "/finance/patient-income", icon: DollarSign, end: false },
  { name: "Hasta İade", href: "/finance/patient-refunds", icon: RotateCcw, end: false },
  { name: "Borçlu Hasta", href: "/finance/debtor-patients", icon: Users, end: false },
  { name: "Borçlu Tedavi", href: "/finance/debtor-treatments", icon: Stethoscope, end: false },
  { name: "Hasta Alacak", href: "/finance/patient-credits", icon: CreditCard, end: false },
  { name: "Banka İşlemleri", href: "/finance/bank-transactions", icon: Landmark, end: false },
  { name: "Gün Sonu", href: "/finance/end-of-day", icon: CalendarCheck, end: false },
];

export default function FinanceLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-4 overflow-x-auto">
        {financeNav.filter(i => !i.hidden).map((item) => {
          const isActive = item.end
            ? pathname === item.href
            : pathname.startsWith(item.href) && pathname !== "/finance";
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all whitespace-nowrap",
                isActive
                  ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.name}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
