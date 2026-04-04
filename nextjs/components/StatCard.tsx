interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
  subtitle?: string;
}

export default function StatCard({ title, value, icon, color = "#3b82f6", subtitle }: StatCardProps) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      padding: 24,
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      borderLeft: `4px solid ${color}`,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
    }}>
      <div>
        <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</p>
        {subtitle && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{subtitle}</p>}
      </div>
      <div style={{ fontSize: 32, opacity: 0.8 }}>{icon}</div>
    </div>
  );
}