"use client";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Bell, LogOut, User, ChevronDown, Sparkles, Clock, Sun, Moon } from "lucide-react";
import { getInitials } from "../lib/utils";
import { roleLabels } from "../lib/rbac";

export function AppHeader({ onOpenAIChat }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="glass-effect border-b border-border shadow-lg">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Breadcrumb & Quick Actions */}
        <div className="flex items-center gap-6 flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="font-medium">
              {new Date().toLocaleDateString('tr-TR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long',
                year: 'numeric' 
              })}
            </span>
          </div>
          
          {/* Modern Search */}
          <div className="relative max-w-xl flex-1">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-ring/10 rounded-2xl blur opacity-75"></div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Hasta ara (ad, telefon, TC)..."
                className="pl-12 pr-4 py-3 input-modern"
              />
            </div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 rounded-xl hover:bg-muted transition-all duration-200"
            title={theme === 'light' ? 'Koyu moda geç' : 'Açık moda geç'}
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5 text-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-yellow-500" />
            )}
          </Button>
          
          {/* AI Quick Actions */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onOpenAIChat}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200"
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">AI Assistant</span>
          </Button>
          
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl hover:bg-muted transition-all duration-200">
            <Bell className="h-5 w-5 text-foreground" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-xs font-bold text-white shadow-lg">
              3
            </span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-all duration-200">
                <Avatar className="h-9 w-9 border-2 border-border shadow-md">
                  <AvatarFallback className="gradient-primary text-white font-semibold text-sm">
                    {user?.name ? getInitials(user.name) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-semibold text-foreground">{user?.name || "Kullanıcı"}</div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {user?.role ? roleLabels[user.role] : ""}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl border border-border bg-card backdrop-blur-xl rounded-2xl">
              <DropdownMenuLabel className="px-3 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-border">
                    <AvatarFallback className="gradient-primary text-white font-bold">
                      {user?.name ? getInitials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-foreground">{user?.name || "Kullanıcı"}</div>
                    <div className="text-sm text-muted-foreground">{user?.role ? roleLabels[user.role] : ""}</div>
                  </div>
                </div>
              </DropdownMenuLabel>
              
              <div className="py-2">
                <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">Profil Ayarları</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">AI Tercihlerim</span>
                </DropdownMenuItem>
              </div>
              
              <DropdownMenuSeparator className="mx-2 bg-border" />
              
              <div className="py-2">
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">Güvenli Çıkış</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

