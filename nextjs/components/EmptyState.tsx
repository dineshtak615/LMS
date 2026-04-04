interface Props { icon?:string; title:string; desc?:string; actionLabel?:string; onAction?:()=>void; }
export default function EmptyState({ icon="📭", title, desc, actionLabel, onAction }:Props) {
  return (
    <div style={{textAlign:"center",padding:"64px 20px"}}>
      <div style={{fontSize:60,marginBottom:16}}>{icon}</div>
      <h3 style={{fontSize:18,fontWeight:700,color:"#334155",marginBottom:8}}>{title}</h3>
      {desc && <p style={{fontSize:14,color:"#94a3b8",maxWidth:320,margin:"0 auto 24px",lineHeight:1.6}}>{desc}</p>}
      {actionLabel && onAction && <button onClick={onAction} style={{padding:"10px 24px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,fontWeight:600,fontSize:14,cursor:"pointer"}}>{actionLabel}</button>}
    </div>
  );
}