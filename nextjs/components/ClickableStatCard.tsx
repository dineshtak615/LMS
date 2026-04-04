"use client";
import { useRouter } from "next/navigation";
interface Props { title:string; value:string|number; icon:string; color?:string; subtitle?:string; href?:string; }
export default function ClickableStatCard({ title, value, icon, color="#3b82f6", subtitle, href }:Props) {
  const router = useRouter();
  return (
    <div onClick={()=>href&&router.push(href)}
      onMouseEnter={e=>{if(href){(e.currentTarget as HTMLElement).style.transform="translateY(-2px)";(e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(0,0,0,0.12)";}}}
      onMouseLeave={e=>{if(href){(e.currentTarget as HTMLElement).style.transform="translateY(0)";(e.currentTarget as HTMLElement).style.boxShadow="0 1px 3px rgba(0,0,0,0.08)";}}}
      style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",borderLeft:`4px solid ${color}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:href?"pointer":"default",transition:"transform 0.15s,box-shadow 0.15s"}}>
      <div>
        <p style={{fontSize:13,color:"#64748b",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>{title}</p>
        <p style={{fontSize:32,fontWeight:800,color:"#0f172a",lineHeight:1}}>{value}</p>
        {subtitle&&<p style={{fontSize:12,color:"#94a3b8",marginTop:6}}>{subtitle}</p>}
        {href&&<p style={{fontSize:11,color,marginTop:8,fontWeight:600}}>View all →</p>}
      </div>
      <div style={{fontSize:32}}>{icon}</div>
    </div>
  );
}