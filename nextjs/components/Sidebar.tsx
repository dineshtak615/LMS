"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const navByRole: Record<string, { label: string; href: string; icon: string }[]> = {
  super_admin: [
    { label: "Dashboard", href: "/super-admin", icon: "D" },
    { label: "Organizations", href: "/organizations", icon: "O" },
    { label: "All Users", href: "/super-admin/users", icon: "U" },
    { label: "Activity Logs", href: "/super-admin/logs", icon: "L" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin", icon: "D" },
    { label: "Students", href: "/admin/students", icon: "S" },
    { label: "Trainers", href: "/admin/trainers", icon: "T" },
    { label: "Courses", href: "/admin/courses", icon: "C" },
    { label: "Assignments", href: "/admin/assignments", icon: "M" },
    { label: "Enrolments", href: "/admin/enrolments", icon: "E" },
    { label: "Payments", href: "/admin/payments", icon: "P" },
    { label: "Library", href: "/admin/library", icon: "B" },
    { label: "Analytics", href: "/admin/analytics", icon: "A" },
    { label: "Users", href: "/admin/users", icon: "U" },
  ],
  trainer: [
    { label: "Dashboard", href: "/trainer", icon: "D" },
    { label: "Course", href: "/trainer?tab=courses", icon: "C" },
    { label: "Assignments", href: "/trainer/assignments", icon: "M" },
    // { label: "Section", href: "/trainer?tab=sections", icon: "M" },
    { label: "Student", href: "/trainer?tab=students", icon: "S" },
  ],
  student: [
    { label: "Dashboard", href: "/student", icon: "D" },
    { label: "My Courses", href: "/admin/courses", icon: "C" },
    { label: "Assignments", href: "/student/assignments", icon: "M" },
    { label: "Library", href: "/student/library", icon: "B" },
  ],
  finance: [
    { label: "Dashboard", href: "/finance/dashboard", icon: "D" },
    { label: "Payments", href: "/admin/payments", icon: "P" },
    { label: "Students", href: "/admin/students", icon: "S" },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!user || !user.role) return null;

  const navItems = navByRole[user.role] || [];
  const avatarLetter = user?.name?.charAt(0)?.toUpperCase() ?? "U";
  const navigate = (href: string) => {
    router.push(href);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "20px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>LMS</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{user.role.replace("_", " ").toUpperCase()}</div>
        </div>
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer" }}
          >
            X
          </button>
        )}
      </div>

      <div
        style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", cursor: "pointer" }}
        onClick={() => navigate("/settings")}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#3b82f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 16,
            marginBottom: 8,
          }}
        >
          {avatarLetter}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{user?.name ?? "User"}</div>
        <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email ?? ""}</div>
        <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 4 }}>Edit Profile</div>
      </div>

      <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
        {navItems.map((item) => {
          const itemUrl = new URL(item.href, "http://localhost");
          const itemPathname = itemUrl.pathname;
          const itemTab = itemUrl.searchParams.get("tab");
          const currentTab = searchParams.get("tab");

          let isActive = false;
          if (itemTab !== null) {
            isActive = pathname === itemPathname && currentTab === itemTab;
          } else if (itemPathname === "/trainer") {
            isActive = pathname === "/trainer" && (currentTab === null || currentTab === "dashboard");
          } else {
            isActive = pathname === itemPathname || pathname.startsWith(`${itemPathname}/`);
          }

          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "11px 20px",
                background: isActive ? "#1e3a5f" : "transparent",
                border: "none",
                cursor: "pointer",
                color: isActive ? "#60a5fa" : "#94a3b8",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                textAlign: "left",
                borderLeft: isActive ? "3px solid #3b82f6" : "3px solid transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "#1e293b";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "16px 20px", borderTop: "1px solid #1e293b", display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => navigate("/settings")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "10px 12px",
            background: "#1e293b",
            border: "none",
            cursor: "pointer",
            color: "#94a3b8",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 8,
          }}
        >
          Settings
        </button>
        <button
          onClick={logout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "10px 12px",
            background: "#1e293b",
            border: "none",
            cursor: "pointer",
            color: "#f87171",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 8,
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 200,
            background: "#0f172a",
            border: "none",
            borderRadius: 8,
            padding: "10px 12px",
            cursor: "pointer",
            color: "#fff",
            fontSize: 18,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          M
        </button>

        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, backdropFilter: "blur(2px)" }}
          />
        )}

        <div
          style={{
            position: "fixed",
            top: 0,
            left: mobileOpen ? 0 : -260,
            bottom: 0,
            width: 240,
            zIndex: 400,
            transition: "left 0.25s ease",
            boxShadow: mobileOpen ? "4px 0 20px rgba(0,0,0,0.4)" : "none",
          }}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100 }}>{sidebarContent}</div>;
}
