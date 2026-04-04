"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          marginLeft: isMobile ? 0 : 240,
          flex: 1,
          padding: isMobile ? "72px 16px 16px" : 32,
          minHeight: "100vh",
          background: "#f8fafc",
        }}
      >
        {children}
      </main>
    </div>
  );
}
