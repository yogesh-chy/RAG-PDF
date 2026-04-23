"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getAuthHeader } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";

export default function ChatUploadPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth(true);
  
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    const MAX_SIZE_MB = 100;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File is too large. Maximum allowed size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a valid PDF file.");
      return;
    }

    setUploading(true);
    setError("");
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(getApiUrl("/documents/upload"), {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      
      const data = await res.json();
      router.push(`/chat/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong during upload.");
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  if (authLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto px-4">

      <div 
        className={`w-full relative rounded-3xl border-2 border-dashed transition-all duration-300 bg-card/20 flex flex-col items-center justify-center p-12 text-center overflow-hidden
          ${dragActive ? "border-primary bg-primary/5" : "border-white/10 hover:border-primary/50 hover:bg-card/40"}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          disabled={uploading}
        />
        
        <div className="flex flex-col items-center gap-4 relative z-0">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${uploading ? 'bg-transparent' : 'bg-primary/20 text-primary'}`}>
            {uploading ? (
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg" />
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          
          <div>
            <p className="text-xl font-bold mb-2 text-foreground">
              {uploading ? "Uploading & Analyzing..." : "Upload a PDF to begin"}
            </p>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto leading-relaxed">
              {uploading ? "This may take a moment depending on file size." : "Securely embed a document into your knowledge base. Our AI will analyze the contents instantly, allowing you to extract insights, summarize data, and chat with your document."}
            </p>
            {!uploading && (
              <p className="text-xs font-bold text-primary/80 uppercase tracking-wider">
                Max 100MB • Secure Processing
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-sm font-medium w-full text-center">
          {error}
        </div>
      )}
    </div>
  );
}
