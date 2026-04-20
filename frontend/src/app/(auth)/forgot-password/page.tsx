"use client";

import { useState } from "react";
import Link from "next/link";

import Logo from "@/components/ui/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [debugLink, setDebugLink] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("http://localhost:8000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to request reset");

      setMessage(data.message);
      if (data.debug_link) {
        setDebugLink(data.debug_link);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-background h-screen relative py-4">
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
            Forgot Password
          </h1>
          <p className="text-base md:text-lg text-muted-foreground/80 font-medium tracking-tight">
            We'll help you get back into your account
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center font-medium">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center font-medium">
            {message}
          </div>
        )}

        {!debugLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground/80 ml-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-background border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base outline-none"
                placeholder="name@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-white font-black text-base hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 shadow-xl shadow-primary/20 mt-1 cursor-pointer"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-sm text-muted-foreground mb-4">Development Magic ✨ Use the link below to reset your password:</p>
            <Link 
              href={debugLink}
              className="inline-block px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20"
            >
              Reset My Password
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-primary font-bold hover:underline"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
