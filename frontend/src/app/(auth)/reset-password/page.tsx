"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import Logo from "@/components/ui/Logo";

function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("http://localhost:8000/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to reset password");

      setMessage(data.message);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center p-8 bg-card/40 border border-white/10 rounded-2xl backdrop-blur-sm">
        <h2 className="text-xl font-bold text-red-500 mb-4">Invalid Link</h2>
        <p className="text-muted-foreground mb-6">This password reset link is invalid or has expired.</p>
        <Link href="/forgot-password" title="Request new link" className="text-primary font-bold hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
          Reset Password
        </h1>
        <p className="text-base md:text-lg text-muted-foreground/80 font-medium tracking-tight">
          Choose a new secure password
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center font-medium">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center font-medium animate-pulse">
          {message} Redirecting to login...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-muted-foreground/80 ml-1">
            New Password
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl bg-background border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base outline-none"
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-muted-foreground/80 ml-1">
            Confirm Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl bg-background border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base outline-none"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !!message}
          className="w-full py-3 rounded-xl bg-primary text-white font-black text-base hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 shadow-xl shadow-primary/20 mt-1 cursor-pointer"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-background h-screen relative py-4">
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto">
        <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
