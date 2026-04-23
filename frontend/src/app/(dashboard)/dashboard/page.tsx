"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthHeader } from "@/lib/auth";
import Link from "next/link";
import Logo from "@/components/ui/Logo";

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth(true);

  if (authLoading) return null;

  return (
    <div className="min-h-[90vh] bg-background text-foreground flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-card/30 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Logo />
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center h-8 px-3 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-sm text-[11px] text-muted-foreground">
                Welcome,&nbsp;<span className="text-foreground font-semibold tracking-wide">@{user.username}</span>
              </div>
              
              <button
                onClick={logout}
                className="group flex items-center h-8 px-3 gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 hover:border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">Sign Out</span>
                <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Our Library</h1>
          <p className="text-muted-foreground text-sm">Explore our suite of advanced AI tools to accelerate your workflow.</p>
        </div>

        {/* Action Zones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Chat with PDF Zone */}
          <Link href="/chat" className="group relative block outline-none">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-xl" />
            <div className="relative p-8 rounded-3xl border border-white/10 bg-card/40 backdrop-blur-md hover:bg-card/60 transition-all duration-500 hover:-translate-y-1 overflow-hidden flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                    Chat with PDF Knowledge
                  </h3>
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  Upload documents and use advanced vector search to ask questions and instantly extract insights.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <span className="text-[10px] font-bold text-primary/80 uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-full">
                  Unified Workspace
                </span>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors relative z-10">
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Humanize AI Zone */}
          <Link href="/humanize" className="group relative block outline-none">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-xl" />
            <div className="relative p-8 rounded-3xl border border-white/10 bg-card/40 backdrop-blur-md hover:bg-card/60 transition-all duration-500 hover:-translate-y-1 overflow-hidden flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 group-hover:bg-accent group-hover:text-white transition-all duration-500 shadow-inner">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-accent transition-colors">
                    Humanize AI Text
                  </h3>
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  Use our advanced linguistic engine to rewrite AI-generated text so it sounds completely natural and bypasses detection.
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <span className="text-[10px] font-bold text-accent/80 uppercase tracking-widest bg-accent/10 px-3 py-1.5 rounded-full">
                  99% Human Score
                </span>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors relative z-10">
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
