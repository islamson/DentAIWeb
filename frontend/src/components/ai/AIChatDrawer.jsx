"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { X, Send, Sparkles, User } from "lucide-react";
import { SheetClose } from "../ui/sheet";
import { sendAIChatMessage } from "../../lib/ai-api";
import { cn } from "../../lib/utils";

const SUGGESTED_PROMPTS = [
  "Bugünkü randevuları göster",
  "Bu ay toplam ne kadar tahsilat yaptık?",
  "Düşük stoktaki ürünleri listele",
  "Kliniğin bu ayki toplam cirosu ne kadar?",
];

export function AIChatDrawer({ open, onOpenChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content || '' }));
      const res = await sendAIChatMessage(trimmed, history);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          clarification_needed: res.clarification_needed,
        },
      ]);
    } catch (err) {
      let errorMsg = "AI yanıtı alınamadı. Lütfen tekrar deneyin.";
      if (err.status === 403 || err.code === "AI_PERMISSION_DENIED" || err.code === "TOOL_PERMISSION_DENIED") {
        errorMsg = "Bu sorgu için yetkiniz bulunmuyor.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMsg, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (prompt) => {
    handleSend(prompt);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex flex-col p-0 w-full max-w-md sm:max-w-lg"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="flex-shrink-0 px-4 py-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Assistant
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-muted-foreground">
                Sistemdeki verilere yetkiniz dahilinde soru sorabilirsiniz.
              </SheetDescription>
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Merhaba, size nasıl yardımcı olabilirim? Aşağıdaki önerilerden birini seçebilir veya kendi sorunuzu yazabilirsiniz.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSuggestionClick(prompt)}
                      className="text-left px-4 py-3 rounded-xl border border-border bg-muted/50 hover:bg-muted hover:border-primary/30 transition-all duration-200 text-sm text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : msg.isError
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : msg.clarification_needed
                          ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-foreground"
                          : "bg-muted border border-border"
                      )}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-muted border border-border">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="flex-shrink-0 p-4 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Mesajınızı yazın..."
                className="min-h-[44px] max-h-32 resize-none rounded-xl border-border"
                rows={1}
                disabled={loading}
              />
              <Button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="rounded-xl px-4 btn-primary-gradient shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Enter ile gönder, Shift+Enter ile yeni satır
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
