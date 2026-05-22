import { useState, useEffect, useRef } from "react";
import { useGetMe, useListMessages, useCreateMessage, useMarkMessageRead, getListMessagesQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";

const GOLD = "#D4AF37";
const BURGUNDY_CARD = "hsl(74,100%,39%)";

export default function Inbox() {
  const { data: user, isLoading: authLoading, isError } = useGetMe({ query: { retry: false } });
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && (isError || !user)) setLocation("/login");
  }, [user, authLoading, isError, setLocation]);

  const { data: messages, isLoading: msgsLoading } = useListMessages({ query: { enabled: !!user } });
  const createMessage = useCreateMessage();
  const markRead = useMarkMessageRead();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!messages) return;
    messages.filter((m) => m.fromAdmin && !m.isRead).forEach((m) => {
      markRead.mutate({ id: m.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() }),
      });
    });
  }, [messages]);

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed || createMessage.isPending) return;
    createMessage.mutate({ data: { body: trimmed } }, {
      onSuccess: () => {
        setBody("");
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-2xl space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-2xl flex flex-col" style={{ height: "calc(100vh - 130px)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "hsl(74,90%,39%)", border: `1px solid ${GOLD}40` }}>
            <MessageSquare className="w-4 h-4" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: GOLD }}>Support Inbox</h1>
            <p className="text-xs" style={{ color: "#1a2d00" }}>Messages from MailMart support</p>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto rounded-2xl p-4 space-y-3 mb-4"
          style={{ background: "hsl(74,100%,33%)", border: "1px solid hsl(43,30%,20%,0.4)" }}
        >
          {msgsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-3/4 rounded-xl" style={{ background: "hsl(74,85%,40%)" }} />)}
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="w-12 h-12 mb-3" style={{ color: "#1a2d00" }} />
              <p className="text-sm font-semibold" style={{ color: "#1a2d00" }}>No messages yet</p>
              <p className="text-xs mt-1" style={{ color: "#1a2d00" }}>Send a message to contact support.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.fromAdmin ? "justify-start" : "justify-end"}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-2.5"
                  style={
                    msg.fromAdmin
                      ? { background: BURGUNDY_CARD, border: "1px solid hsl(43,30%,24%,0.4)" }
                      : { background: "linear-gradient(135deg, hsl(43,70%,35%), hsl(43,60%,28%))", border: `1px solid ${GOLD}40` }
                  }
                >
                  {msg.fromAdmin && (
                    <p className="text-[10px] font-bold mb-1" style={{ color: GOLD }}>MailMart Support</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap" style={{ color: msg.fromAdmin ? "hsl(46,68%,82%)" : "#fff" }}>{msg.body}</p>
                  <p className="text-[10px] mt-1 text-right" style={{ color: msg.fromAdmin ? "hsl(43,30%,45%)" : "rgba(255,255,255,0.55)" }}>
                    {format(new Date(msg.createdAt), "MMM d, HH:mm")}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="flex items-end gap-2 rounded-2xl p-2"
          style={{ background: "hsl(74,100%,35%)", border: "1px solid hsl(43,30%,22%,0.5)" }}
        >
          <textarea
            className="flex-1 resize-none bg-transparent outline-none text-sm px-2 py-1.5 max-h-28"
            rows={1}
            placeholder="Type a message…"
            style={{ color: "#0d1a00", caretColor: GOLD }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || createMessage.isPending}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${GOLD}, hsl(43,50%,45%))` }}
          >
            {createMessage.isPending
              ? <Loader2 className="w-4 h-4 animate-spin text-black" />
              : <Send className="w-4 h-4 text-black" />}
          </button>
        </div>
      </div>
    </Layout>
  );
}
