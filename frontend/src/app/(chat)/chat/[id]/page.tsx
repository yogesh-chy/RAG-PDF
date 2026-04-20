"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getAuthHeader } from "@/lib/auth";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DocumentInfo {
  id: number;
  filename: string;
  page_count: number;
  status: string;
}


export default function ChatPage() {
  const { id } = useParams();
  const router = useRouter();
  const { loading: authLoading } = useAuth(true);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch document details
  const fetchFullHistory = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:8000/chat/doc-history/${id}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
        
        // Use the last message's session ID to continue that thread if available
        if (data.length > 0) {
          setActiveSessionId(data[data.length - 1].session_id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading) {
      fetch(`http://localhost:8000/documents/${id}`, {
        headers: getAuthHeader(),
      })
        .then((res) => res.json())
        .then(setDocInfo)
        .catch(() => router.push("/dashboard"));

      fetchFullHistory();
    }
  }, [id, authLoading, router, fetchFullHistory]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsTyping(true);

    let assistantContent = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("http://localhost:8000/chat/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          doc_id: Number(id),
          question: userMessage,
          session_id: activeSessionId,
        }),
      });

      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

              while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "token") {
                assistantContent += data.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = assistantContent;
                  return newMessages;
                });
              } else if (data.type === "session") {
                setActiveSessionId(data.session_id);
              }
            } catch (err) {
              // Ignore partial JSON
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error processing your request." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (authLoading || !docInfo) return null;

  return (
    <div className="flex h-[100vh] bg-background overflow-hidden font-sans flex-col relative">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-white/10 bg-card/30 backdrop-blur-md flex items-center px-6 justify-between z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all text-sm group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-xs font-medium">Back to Library</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-sm font-semibold truncate max-w-[300px]">{docInfo.filename}</span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold opacity-40">Powered by Groq · LLaMA 3</div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar"
      >
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-32 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center pt-24">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold mb-1">Start a conversation</h2>
              <p className="text-sm text-muted-foreground max-w-xs">Ask anything about <span className="font-medium text-foreground">{docInfo.filename}</span>. I'll answer using the document content.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary mr-3 mt-1 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-white shadow-lg shadow-primary/20 rounded-br-sm"
                  : "bg-card/80 backdrop-blur-md border border-white/10 text-foreground rounded-bl-sm"
              }`}>
                <div className={`whitespace-pre-wrap ${msg.role === "assistant" ? "max-h-[240px] overflow-y-auto custom-scrollbar pr-2" : ""}`}>
                  {msg.content}
                </div>
                {msg.role === "assistant" && !msg.content && isTyping && (
                  <div className="flex gap-1 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none z-20">
        <div className="max-w-3xl mx-auto px-4 pointer-events-auto">
          <div className="bg-card/80 backdrop-blur-xl border border-white/10 rounded-2xl py-2 px-3 shadow-2xl">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${docInfo.filename}...`}
                className="flex-1 bg-transparent py-2.5 px-3 outline-none text-sm placeholder:text-muted-foreground/60 text-white"
                disabled={isTyping}
              />
              
              {/* Arrow Send Button */}
              <button
                type="submit"
                disabled={isTyping || !input.trim()}
                className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all duration-200 disabled:opacity-40 shrink-0 shadow-lg shadow-primary/20"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
          <p className="text-center text-[10px] text-muted-foreground font-medium opacity-40 mt-3">AI can make mistakes. Always verify important information.</p>
        </div>
      </div>
    </div>
  );
}
