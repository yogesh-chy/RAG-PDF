"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import Modal from "@/components/ui/Modal";
import LoginForm from "@/components/auth/LoginForm";
import SignupForm from "@/components/auth/SignupForm";

export default function LandingPage() {
  const [auth, setAuth] = useState(false);
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  useEffect(() => {
    setAuth(isAuthenticated());
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-primary/20 rounded-full blur-[100px] opacity-40" />
      </div>

      <main className="max-w-5xl w-full text-center relative z-10 flex flex-col items-center justify-between h-[90vh] pt-4 pb-12">
        <div className="flex flex-col items-center flex-1 justify-center">
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent leading-[1.05]">
            Your all-in-one <br className="hidden md:block" /> AI productivity suite.
          </h1>
          
          <p className="text-sm md:text-base text-muted-foreground/80 mb-8 max-w-xl mx-auto leading-relaxed">
            Chat with PDFs using advanced vector search, or humanize AI text to <br className="hidden md:block" /> 
            bypass detection—all powered by the lightning-fast Groq engine.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {auth ? (
              <Link
                href="/dashboard"
                className="px-8 py-3 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary/90 transition-all shadow-xl shadow-primary/30"
              >
                Explore Our Library
              </Link>
            ) : (
              <button
                onClick={() => setAuthModal("login")}
                className="px-8 py-3 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 cursor-pointer"
              >
                Get Started For Free
              </button>
            )}
            
            {!auth && (
              <button
                onClick={() => setAuthModal("signup")}
                className="px-8 py-3 rounded-xl bg-white/5 border border-blue-500 text-white font-bold text-base hover:bg-white/10 transition-all cursor-pointer"
              >
                Sign Up
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left w-full mt-12">
          {[
            { title: "Chat with PDFs", desc: "Semantic search via LanceDB finds the exact context instantly." },
            { title: "AI Text Humanizer", desc: "Advanced linguistic engine to rewrite text and bypass detection." },
            { title: "Lightning Fast", desc: "Powered by Groq's LLaMA-3 for near-instant responses." }
          ].map((item, i) => (
            <div key={i} className="p-5 rounded-xl bg-card/40 border border-white/10 backdrop-blur-sm transition-all flex flex-col justify-center min-h-[100px]">
              <h3 className="font-bold text-sm mb-1 text-primary tracking-tight">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground/30 text-[10px] font-bold tracking-[0.2em] uppercase whitespace-nowrap">
        &copy; 2026 NexusAI // Built with Groq & LanceDB
      </div>

      {/* Auth Modals */}
      <Modal isOpen={!!authModal} onClose={() => setAuthModal(null)}>
        {authModal === "login" && (
          <LoginForm 
            isModal={true}
            onSwitchToSignup={() => setAuthModal("signup")} 
            onSuccess={() => window.location.href = "/dashboard"}
          />
        )}
        {authModal === "signup" && (
          <SignupForm 
            isModal={true}
            onSwitchToLogin={() => setAuthModal("login")}
            onSuccess={() => setAuthModal("login")} 
          />
        )}
      </Modal>
    </div>
  );
}
