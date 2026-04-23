"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getAuthHeader } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  score?: { human_score: number; ai_score: number };
}

export default function HumanizePage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth(true);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [tone, setTone] = useState("natural");
  const [intensity, setIntensity] = useState(1.0);
  const [notification, setNotification] = useState("");
  
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch humanizer history
  const fetchFullHistory = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/chat/humanize-history"), {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: any) => {
          let score = undefined;
          if (m.role === 'assistant' && m.source_chunks && m.source_chunks.length > 0) {
            score = m.source_chunks[0];
          }
          return { role: m.role, content: m.content, score };
        }));
        
        // Use the last message's session ID to continue that thread if available
        if (data.length > 0) {
          setActiveSessionId(data[data.length - 1].session_id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchFullHistory();
    }
  }, [authLoading, fetchFullHistory]);

  const handleDeleteChat = async () => {
    if (!confirm("Are you sure you want to clear your humanizer chat history?")) return;
    try {
      const res = await fetch(getApiUrl("/chat/humanize-history"), {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        setMessages([]);
        setActiveSessionId(null);
        setNotification("Chat history cleared");
        setTimeout(() => setNotification(""), 3000);
      } else {
        alert("Failed to delete chat history");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting chat history");
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = 'inherit';
    }
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsTyping(true);

    let assistantContent = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch(getApiUrl("/chat/humanize"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          text: userMessage,
          session_id: activeSessionId,
          tone,
          intensity
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
              } else if (data.type === "score") {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].score = data.data;
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (authLoading) return null;

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
            <span className="text-sm font-semibold">Back to Library</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
            <span className="text-sm font-semibold truncate max-w-[300px]">AI Humanizer Chat</span>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleDeleteChat}
              className="flex items-center h-8 px-3 ml-2 gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 hover:border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm group"
              title="Delete Chat History"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-wider">Delete Chat</span>
            </button>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold opacity-40">Powered by Groq · LLaMA 3</div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar relative"
      >
        {notification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold shadow-lg shadow-green-500/10 animate-in fade-in slide-in-from-top-2 duration-300">
            {notification}
          </div>
        )}
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-32 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center pt-24">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold mb-1">Start humanizing</h2>
              <p className="text-sm text-muted-foreground max-w-xs">Paste your AI-generated text here, and I'll rewrite it to sound more natural.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full group/msg`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent mr-3 mt-1 shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col max-w-[75%] gap-0.5">
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed relative group/bubble ${
                    msg.role === "user"
                      ? "bg-accent text-white shadow-lg shadow-accent/20 rounded-br-sm"
                      : "bg-card/80 backdrop-blur-md border border-white/10 text-foreground rounded-bl-sm"
                  }`}>
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                      {msg.content || (msg.role === "assistant" && isTyping && (
                        <div className="flex gap-1 py-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
                          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
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
                            btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7" /></svg>';
                            setTimeout(() => {
                              btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>';
                            }, 2000);
                          }
                        }}
                        id={`copy-${i}`}
                        className="p-1.5 rounded-lg text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer"
                        title="Copy message"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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

      {/* Synchronized Floating Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none z-20">        <div className="max-w-3xl mx-auto px-4 pointer-events-auto">
          <div className="bg-card/80 backdrop-blur-xl border border-white/10 rounded-2xl py-2 px-3 shadow-2xl relative">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-0.5"
            >
              <div className="flex items-center gap-1.5">
                {/* File Upload Button - Integrated */}
                <input
                  type="file"
                  id="humanize-file-upload"
                  className="hidden"
                  accept=".txt,.pdf,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    if (file.type === "text/plain") {
                      const text = await file.text();
                      setInput(text);
                    } else if (file.type === "application/pdf") {
                      const formData = new FormData();
                      formData.append("file", file);
                      try {
                        setIsTyping(true);
                        const res = await fetch(getApiUrl("/documents/extract"), {
                          method: "POST",
                          headers: getAuthHeader(),
                          body: formData,
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setInput(data.text);
                        } else {
                          alert("Failed to extract PDF text.");
                        }
                      } catch (err) {
                        alert("Error uploading PDF.");
                      } finally {
                        setIsTyping(false);
                      }
                    } else {
                      alert("Supporting .txt and .pdf files.");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('humanize-file-upload')?.click()}
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 transition-all group shrink-0"
                  title="Upload file to humanize"
                >
                  <svg className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste AI text to humanize (up to 100k words)..."
                  className="flex-1 bg-transparent py-2.5 outline-none text-sm placeholder:text-white/50 text-white resize-none max-h-32 min-h-[40px] custom-scrollbar"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'inherit';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                  disabled={isTyping}
                />
                
                <button
                  type="submit"
                  disabled={isTyping || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-accent text-black flex items-center justify-center hover:bg-accent/90 transition-all duration-200 disabled:opacity-40 shrink-0 shadow-lg shadow-accent/20"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
          <p className="text-center text-[10px] text-muted-foreground font-medium opacity-40 mt-3">AI can make mistakes. Always verify important information.</p>
        </div>
      </div>
    </div>
  );
}
