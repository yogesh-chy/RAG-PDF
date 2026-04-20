"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setToken } from "@/lib/auth";

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
  isModal?: boolean;
}

export default function LoginForm({
  onSuccess,
  onSwitchToSignup,
  isModal = false,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("signup_success")) {
        setSignupSuccess(true);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Login failed");
      }

      const data = await res.json();
      setToken(data.access_token);

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className={isModal ? "mb-4 text-center" : "mb-6 text-center"}>
        <h1
          className={
            isModal
              ? "text-2xl font-bold tracking-tight mb-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
              : "text-3xl md:text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight"
          }
        >
          Welcome Back
        </h1>
        <p
          className={
            isModal
              ? "text-muted-foreground text-xs"
              : "text-base md:text-lg text-muted-foreground/80 font-medium tracking-tight"
          }
        >
          Please sign in to continue
        </p>
      </div>

      {(signupSuccess ||
        (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get(
            "signup_success",
          ))) && (
        <div className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center font-bold">
          Registration successful! Please log in.
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div className="space-y-2">
          <label className="text-sm font-semibold text-muted-foreground/80 ml-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-background border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base outline-none pr-12"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.04m5.882-5.882A10.023 10.023 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21m-2.101-2.101L3 3" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex justify-end px-1 pt-1">
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline font-bold"
            >
              Forget password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-primary text-white font-black text-base hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 shadow-xl shadow-primary/20 mt-1 cursor-pointer"
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground font-medium">
        Don't have an account?{" "}
        {onSwitchToSignup ? (
          <button
            onClick={onSwitchToSignup}
            className="text-primary font-bold hover:underline cursor-pointer"
          >
            Sign Up
          </button>
        ) : (
          <Link
            href="/signup"
            className="text-primary font-bold hover:underline"
          >
            Sign Up
          </Link>
        )}
      </p>
    </div>
  );
}
