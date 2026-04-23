"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, removeToken, isAuthenticated as checkAuth, getAuthHeader } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";

interface UserInfo {
  id: number;
  email: string;
  username: string;
}

export function useAuth(requireAuth: boolean = true) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const isAuth = checkAuth();
      if (requireAuth && !isAuth) {
        router.push("/login");
        setLoading(false);
        return;
      } else if (!requireAuth && isAuth) {
        router.push("/dashboard");
        setLoading(false);
        return;
      }

      // Fetch user info if authenticated
      if (isAuth) {
        try {
          const res = await fetch(getApiUrl("/auth/me"), {
            headers: getAuthHeader(),
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data);
          } else if (res.status === 401) {
            // Token is invalid/expired
            removeToken();
            router.push("/login");
          }
        } catch (err) {
          console.error("Failed to fetch user info", err);
        }
      }

      setLoading(false);
    };

    check();
  }, [requireAuth, router]);

  const logout = () => {
    removeToken();
    router.push("/login");
  };

  return { user, loading, logout };
}
