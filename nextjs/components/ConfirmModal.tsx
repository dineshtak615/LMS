"use client";
interface Props { isOpen:boolean; title:string; message:string; confirmLabel?:string; cancelLabel?:string; danger?:boolean; onConfirm:()=>void; onCancel:()=>void; }
export default function ConfirmModal({ isOpen, title, message, confirmLabel="Confirm", cancelLabel="Cancel", danger=false, onConfirm, onCancel }:Props) {
  if (!isOpen) return null;
  return (
    <div onClick={onCancel} style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:32,width:"100%",maxWidth:420,margin:20,boxShadow:"0 20px 60px rgba(0,0,0,0.25)",animation:"modalIn 0.2s ease"}}>
        <div style={{fontSize:48,textAlign:"center",marginBottom:12}}>{danger?"⚠️":"❓"}</div>
        <h3 style={{fontSize:18,fontWeight:700,color:"#0f172a",textAlign:"center",marginBottom:10}}>{title}</h3>
        <p style={{fontSize:14,color:"#64748b",textAlign:"center",lineHeight:1.65,marginBottom:28}}>{message}</p>
        <div style={{display:"flex",gap:12}}>
          <button onClick={onCancel} style={{flex:1,padding:12,borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontWeight:600,fontSize:14,cursor:"pointer"}}>{cancelLabel}</button>
          <button onClick={onConfirm} style={{flex:1,padding:12,borderRadius:8,border:"none",background:danger?"#ef4444":"#3b82f6",color:"#fff",fontWeight:600,fontSize:14,cursor:"pointer"}}>{confirmLabel}</button>
        </div>
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}