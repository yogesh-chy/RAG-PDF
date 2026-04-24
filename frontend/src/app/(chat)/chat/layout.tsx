"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthHeader } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/ui/Logo";

interface Document {
  id: number;
  filename: string;
  status: string;
  created_at: string;
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth(true);
  const pathname = usePathname();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notification, setNotification] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/documents/"), {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  }, []);

  const deleteDocument = async (e: React.MouseEvent, docId: number) => {
    e.preventDefault(); // prevent navigation
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const res = await fetch(getApiUrl(`/documents/${docId}`), {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setNotification("Document deleted successfully");
        setTimeout(() => setNotification(""), 3000);
        if (pathname === `/chat/${docId}`) {
          window.location.href = "/chat";
        }
      } else {
        alert("Failed to delete document");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting document");
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDocuments();
      const interval = setInterval(fetchDocuments, 5000); // Poll for status updates
      return () => clearInterval(interval);
    }
  }, [authLoading, fetchDocuments]);

  if (authLoading) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 flex flex-col bg-card/40 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0 shrink-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="h-14 flex items-center px-4 border-b border-white/10 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-semibold">Back to Library</span>
          </Link>
        </div>
        
        <div className="p-4 shrink-0">
          <Link
            href="/chat"
            onClick={() => setIsSidebarOpen(false)}
            className="w-full py-2.5 px-4 rounded-xl bg-primary text-white flex items-center gap-2 hover:bg-primary/90 transition-all font-semibold text-sm shadow-lg shadow-primary/20 justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat / Upload PDF
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2 mt-2">
            Your Documents
          </div>
          <div className="space-y-1">
            {documents.map((doc) => {
              const isActive = pathname === `/chat/${doc.id}`;
              return (
                <Link
                  key={doc.id}
                  href={`/chat/${doc.id}`}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm group ${
                    isActive
                      ? "bg-primary/20 text-primary font-semibold"
                      : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <svg className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate flex-1 text-left leading-tight">{doc.filename}</span>
                  
                  {doc.status !== 'ready' && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${doc.status === 'failed' ? 'bg-red-500' : 'bg-primary animate-pulse'}`} />
                  )}

                  <button
                    onClick={(e) => deleteDocument(e, doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-all shrink-0 z-10"
                    title="Delete PDF"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </Link>
              );
            })}
            {documents.length === 0 && (
              <div className="text-xs text-muted-foreground italic px-2 text-center py-4">
                No documents uploaded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative z-0 h-full">
        {/* Mobile Header Toggle */}
        <div className="lg:hidden h-14 flex items-center px-4 border-b border-white/10 shrink-0 bg-card/20 backdrop-blur-md">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-3">
            <Logo />
          </div>
        </div>

        {notification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold shadow-lg shadow-green-500/10 animate-in fade-in slide-in-from-top-2 duration-300">
            {notification}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
