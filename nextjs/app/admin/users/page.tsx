"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmModal from "@/components/ConfirmModal";
import EmptyState from "@/components/EmptyState";
import API from "@/services/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{open:boolean;id:string;name:string;isActive:boolean}>({open:false,id:"",name:"",isActive:true});
  const router = useRouter();

  const fetchUsers = () => {
    setLoading(true);
    API.get("/organizations/users")
      .then(res=>{
        const d = res.data.data;
        setUsers(Array.isArray(d?.users)?d.users:Array.isArray(d)?d:[]);
      })
      .catch(()=>setError("Failed to load users."))
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{fetchUsers();},[]);

  const handleToggle = async () => {
    try {
      await API.patch(`/organizations/users/${modal.id}/toggle`);
      fetchUsers();
    } catch { setError("Failed to update user."); }
    setModal({open:false,id:"",name:"",isActive:true});
  };

  const roleColors: Record<string,string> = { admin:"badge-blue", trainer:"badge-green", finance:"badge-yellow", student:"badge-gray" };

  return (
    <ProtectedRoute role="admin"><DashboardLayout>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h1 className="page-title" style={{marginBottom:0}}>Manage Users</h1>
        <button className="btn btn-primary" onClick={()=>router.push("/admin/users/create")}>+ Create User</button>
      </div>

      {error&&<div className="error-msg">{error}</div>}

      <div className="table-wrapper">
        {loading ? <div className="spinner"/> : users.length===0 ? (
          <EmptyState icon="👤" title="No users yet" desc="Create trainer, finance, or student accounts." actionLabel="+ Create User" onAction={()=>router.push("/admin/users/create")}/>
        ) : (
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Profile Link</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>
              {users.map((u,i)=>(
                <tr key={u._id}>
                  <td>{i+1}</td>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13,flexShrink:0}}>
                        {u?.name?.charAt(0)?.toUpperCase()??"U"}
                      </div>
                      <strong>{u?.name??""}</strong>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td><span className={`badge ${roleColors[u.role]||"badge-gray"}`}>{u.role}</span></td>
                  <td>
                    {u.profileLinked === null ? (
                      <span className="badge badge-gray">N/A</span>
                    ) : u.profileLinked ? (
                      <span className="badge badge-green">Linked</span>
                    ) : (
                      <span className="badge badge-red">Not Linked</span>
                    )}
                  </td>
                  <td><span className={`badge ${u.isActive?"badge-green":"badge-red"}`}>{u.isActive?"Active":"Inactive"}</span></td>
                  <td style={{fontSize:13,color:"#64748b"}}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className={`btn ${u.isActive?"btn-danger":"btn-success"}`}
                      style={{fontSize:12,padding:"5px 12px"}}
                      onClick={()=>setModal({open:true,id:u._id,name:u.name,isActive:u.isActive})}
                    >
                      {u.isActive?"Deactivate":"Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={modal.open}
        title={modal.isActive?`Deactivate ${modal.name}?`:`Activate ${modal.name}?`}
        message={modal.isActive?"This user will lose access to the system.":"This user will regain access to the system."}
        confirmLabel={modal.isActive?"Deactivate":"Activate"}
        danger={modal.isActive}
        onConfirm={handleToggle}
        onCancel={()=>setModal({open:false,id:"",name:"",isActive:true})}
      />
    </DashboardLayout></ProtectedRoute>
  );
}
