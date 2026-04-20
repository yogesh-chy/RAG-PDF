"use client";

import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-80">
      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-300">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="text-base font-black tracking-tighter text-white leading-none">
          RAG<span className="text-primary">PDF</span>
        </span>
      </div>
    </Link>
  );
}
