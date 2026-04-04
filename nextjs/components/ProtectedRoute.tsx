"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function getDashboardRoute(role: string): string {
  switch (role) {
    case "super_admin": return "/super-admin";
    case "admin":       return "/admin";
    case "trainer":     return "/trainer";
    case "student":     return "/student";
    case "finance":     return "/finance/dashboard";
    default:            return "/login";
  }
}

interface Props {
  children: React.ReactNode;
  role?: string | string[];
}

export default function ProtectedRoute({ children, role }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Not logged in → go to login
    if (!user) {
      router.push("/login");
      return;
    }

    // Role check — if role prop provided, verify user has access
    if (role) {
      const allowed = Array.isArray(role) ? role : [role];
      if (!allowed.includes(user.role)) {
        // Redirect to their own dashboard instead of showing error
        router.push(getDashboardRoute(user.role));
        return;
      }
    }
  }, [user, isLoading, role, router]);

  // Show nothing while loading or redirecting
  if (isLoading || !user) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#f8fafc" }}>
        <div style={{ textAlign:"center" }}>
          <div className="spinner" />
          <p style={{ marginTop:16, color:"#64748b", fontSize:14 }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Role mismatch — show nothing (redirect is happening)
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) return null;
  }

  return <>{children}</>;
}