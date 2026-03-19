"use client";

import { Link, useLocation, Outlet } from "react-router-dom";
import { cn } from "../lib/utils";
import { Package, ClipboardList, FlaskConical, FileSearch } from "lucide-react";

const stockNav = [
  { name: "Stok Yönetimi", href: "/inventory", icon: Package, end: true },
  { name: "Stok Talepleri", href: "/inventory/requests", icon: ClipboardList },
  { name: "Laboratuvarlar", href: "/inventory/laboratories", icon: FlaskConical },
  { name: "Laboratuvar Detay", href: "/inventory/lab-details", icon: FileSearch },
];

export default function StockLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-4 overflow-x-auto">
        {stockNav.map((item) => {
          const isActive = item.end
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all whitespace-nowrap",
                isActive
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg"
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
