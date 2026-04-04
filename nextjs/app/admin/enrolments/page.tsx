"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmModal from "@/components/ConfirmModal";
import EmptyState from "@/components/EmptyState";
import API from "@/services/api";

export default function EnrolmentsPage() {
  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{open:boolean;id:string;action:string}>({open:false,id:"",action:""});
  const router = useRouter();

  const fetchEnrolments = (q="",s="",p=1) => {
    setLoading(true);
    API.get(`/enrolments?search=${q}&status=${s}&page=${p}&limit=15`)
      .then(res=>{
        const d = res.data.data;
        setEnrolments(Array.isArray(d?.enrolments)?d.enrolments:[]);
        setPagination(d?.pagination||null);
      })
      .catch(()=>setError("Failed to load enrolments."))
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{fetchEnrolments();},[]);

  const handleStatusChange = async () => {
    try {
      await API.put(`/enrolments/${modal.id}`, { status: modal.action });
      fetchEnrolments(search,status,page);
    } catch { setError("Failed to update enrolment."); }
    setModal({open:false,id:"",action:""});
  };

  const statusColors: Record<string,string> = { active:"badge-green", completed:"badge-blue", dropped:"badge-red", suspended:"badge-yellow" };

  return (
    <ProtectedRoute role="admin"><DashboardLayout>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h1 className="page-title" style={{marginBottom:0}}>Enrolments</h1>
        <button className="btn btn-primary" onClick={()=>router.push("/admin/enrolments/create")}>+ New Enrolment</button>
      </div>

      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <input className="input" placeholder="Search student or course..." value={search}
          onChange={e=>{setSearch(e.target.value);setPage(1);fetchEnrolments(e.target.value,status,1);}}
          style={{maxWidth:280}}/>
        <select className="input" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);fetchEnrolments(search,e.target.value,1);}} style={{maxWidth:180}}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="dropped">Dropped</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {error&&<div className="error-msg">{error}</div>}

      <div className="table-wrapper">
        {loading ? <div className="spinner"/> : enrolments.length===0 ? (
          <EmptyState icon="📝" title="No enrolments found" desc="Try adjusting your search or create a new enrolment." actionLabel="+ New Enrolment" onAction={()=>router.push("/admin/enrolments/create")}/>
        ) : (
          <table>
            <thead><tr><th>#</th><th>Student</th><th>Course</th><th>Progress</th><th>Status</th><th>Enrolled On</th><th>Actions</th></tr></thead>
            <tbody>
              {enrolments.map((e,i)=>(
                <tr key={e._id}>
                  <td>{((page-1)*15)+i+1}</td>
                  <td>
                    <div style={{fontWeight:600,fontSize:14}}>{e.studentId?.name||"—"}</div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{e.studentId?.email}</div>
                  </td>
                  <td style={{fontSize:14}}>{e.courseId?.title||"—"}</td>
                  <td>
                    <div style={{background:"#e2e8f0",borderRadius:999,height:8,width:100}}>
                      <div style={{background:"#3b82f6",borderRadius:999,height:8,width:`${e.progress||0}%`}}/>
                    </div>
                    <span style={{fontSize:11,color:"#64748b"}}>{e.progress||0}%</span>
                  </td>
                  <td><span className={`badge ${statusColors[e.status]||"badge-gray"}`}>{e.status}</span></td>
                  <td style={{fontSize:13,color:"#64748b"}}>{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {e.status==="active"&&<button className="btn btn-ghost" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>setModal({open:true,id:e._id,action:"completed"})}>✅ Complete</button>}
                      {e.status==="active"&&<button className="btn btn-danger" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>setModal({open:true,id:e._id,action:"dropped"})}>Drop</button>}
                      {e.status==="dropped"&&<button className="btn btn-success" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>setModal({open:true,id:e._id,action:"active"})}>Reactivate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination&&pagination.totalPages>1&&(
        <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:20}}>
          <button className="btn btn-ghost" disabled={page===1} onClick={()=>{setPage(page-1);fetchEnrolments(search,status,page-1);}} style={{padding:"6px 14px"}}>← Prev</button>
          <span style={{padding:"8px 14px",fontSize:14,color:"#64748b"}}>Page {page} of {pagination.totalPages}</span>
          <button className="btn btn-ghost" disabled={page===pagination.totalPages} onClick={()=>{setPage(page+1);fetchEnrolments(search,status,page+1);}} style={{padding:"6px 14px"}}>Next →</button>
        </div>
      )}

      <ConfirmModal
        isOpen={modal.open}
        title={modal.action==="completed"?"Mark as Completed":modal.action==="dropped"?"Drop Enrolment":"Reactivate Enrolment"}
        message={modal.action==="completed"?"Mark this enrolment as completed?":modal.action==="dropped"?"This will drop the student's enrolment.":"Reactivate this enrolment?"}
        confirmLabel={modal.action==="dropped"?"Yes, Drop":modal.action==="completed"?"Mark Complete":"Reactivate"}
        danger={modal.action==="dropped"}
        onConfirm={handleStatusChange}
        onCancel={()=>setModal({open:false,id:"",action:""})}
      />
    </DashboardLayout></ProtectedRoute>
  );
}
