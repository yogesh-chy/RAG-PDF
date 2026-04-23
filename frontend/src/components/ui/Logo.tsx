"use client";

import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 group transition-all duration-300">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary transition-all duration-500 border border-primary/20">
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <div className="flex flex-col justify-center">
        <span className="text-xl font-black tracking-tight text-white leading-none flex items-center">
          Nexus<span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent ml-0.5">AI</span>
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/50 mt-1">Intelligence Platform</span>
      </div>
    </Link>
  );
}
