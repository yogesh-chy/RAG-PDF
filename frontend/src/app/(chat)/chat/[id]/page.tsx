"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getAuthHeader } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
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
      const res = await fetch(getApiUrl(`/chat/doc-history/${id}`), {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(
          data.map((m: any) => ({ role: m.role, content: m.content })),
        );

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
      fetch(getApiUrl(`/documents/${id}`), {
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
      const response = await fetch(getApiUrl("/chat/ask"), {
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
                  newMessages[newMessages.length - 1].content =
                    assistantContent;
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
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (authLoading || !docInfo) return null;

  return (
    <div className="flex flex-1 bg-background overflow-hidden font-sans flex-col relative h-full">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-white/10 bg-card/30 backdrop-blur-md flex items-center px-6 justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-sm font-semibold truncate max-w-[150px] sm:max-w-[300px]">
              {docInfo.filename}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold opacity-40 hidden md:block">
          Powered by Groq · LLaMA 3
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-32 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center pt-24">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold mb-1">Start a conversation</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Ask anything about{" "}
                <span className="font-medium text-foreground">
                  {docInfo.filename}
                </span>
                . I'll answer using the document content.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full group/msg`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary mr-3 mt-1 shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col max-w-[75%] gap-0.5">
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed relative group/bubble ${
                      msg.role === "user"
                        ? "bg-primary text-white shadow-lg shadow-primary/20 rounded-br-sm"
                        : "bg-card/80 backdrop-blur-md border border-white/10 text-foreground rounded-bl-sm"
                    }`}
                  >
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                      {msg.content || (msg.role === "assistant" && isTyping && (
                        <div className="flex gap-1 py-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Copy Button - Outside & Below Bubble */}
                  {msg.content && (
                    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          const btn = document.getElementById(`copy-${i}`);
                          if (btn) {
                            btn.innerHTML =
                              '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7" /></svg>';
                            setTimeout(() => {
                              btn.innerHTML =
                                '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>';
                            }, 2000);
                          }
                        }}
                        id={`copy-${i}`}
                        className="p-1.5 rounded-lg text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer"
                        title="Copy message"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none z-20">
        <div className="max-w-3xl mx-auto px-4 pointer-events-auto">
          <div className="bg-card/80 backdrop-blur-xl border border-white/10 rounded-2xl py-2 px-3 shadow-2xl">
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about ${docInfo.filename}...`}
                className="flex-1 bg-transparent py-2.5 px-3 outline-none text-sm placeholder:text-white/50 text-white"
                disabled={isTyping}
              />

              {/* Arrow Send Button */}
              <button
                type="submit"
                disabled={isTyping || !input.trim()}
                className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all duration-200 disabled:opacity-40 shrink-0 shadow-lg shadow-primary/20"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </form>
          </div>
          <p className="text-center text-[10px] text-muted-foreground font-medium opacity-40 mt-3">
            AI can make mistakes. Always verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
