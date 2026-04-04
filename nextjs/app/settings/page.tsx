"use client";
import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import API from "@/services/api";

export default function SettingsPage() {
  const { user, login, token } = useAuth();
  const [profileForm, setProfileForm] = useState({ name:user?.name||"", email:user?.email||"" });
  const [pwForm, setPwForm] = useState({ currentPassword:"", newPassword:"", confirmPassword:"" });
  const [profileMsg, setProfileMsg] = useState({type:"",text:""});
  const [pwMsg, setPwMsg] = useState({type:"",text:""});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setProfileMsg({type:"",text:""}); setSavingProfile(true);
    try {
      const res = await API.put("/auth/profile", profileForm);
      const updatedUser = res.data.data?.user || {...user, ...profileForm};
      login(updatedUser, token!);
      setProfileMsg({type:"success",text:"Profile updated successfully!"});
    } catch (err:any) { setProfileMsg({type:"error",text:err.response?.data?.message||"Failed to update profile."}); }
    finally { setSavingProfile(false); }
  };

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg({type:"",text:""});
    if(pwForm.newPassword!==pwForm.confirmPassword) return setPwMsg({type:"error",text:"Passwords do not match."});
    if(pwForm.newPassword.length<6) return setPwMsg({type:"error",text:"Password must be at least 6 characters."});
    setSavingPw(true);
    try {
      await API.put("/auth/change-password", { currentPassword:pwForm.currentPassword, newPassword:pwForm.newPassword });
      setPwMsg({type:"success",text:"Password changed successfully!"});
      setPwForm({currentPassword:"",newPassword:"",confirmPassword:""});
    } catch (err:any) { setPwMsg({type:"error",text:err.response?.data?.message||"Failed to change password."}); }
    finally { setSavingPw(false); }
  };

  const roleColors: Record<string,string> = { super_admin:"#ef4444", admin:"#3b82f6", trainer:"#22c55e", student:"#f59e0b", finance:"#8b5cf6" };

  return (
    <ProtectedRoute><DashboardLayout>
      <h1 className="page-title">Account Settings</h1>

      <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:24,maxWidth:900}}>
        {/* Profile card */}
        <div>
          <div className="card" style={{textAlign:"center"}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:roleColors[user?.role||"admin"]||"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:32,margin:"0 auto 16px"}}>
              {user?.name?.charAt(0)?.toUpperCase()??"U"}
            </div>
            <h2 style={{fontSize:18,fontWeight:700,marginBottom:4}}>{user?.name}</h2>
            <p style={{fontSize:13,color:"#64748b",marginBottom:12}}>{user?.email}</p>
            <span style={{display:"inline-block",padding:"4px 14px",borderRadius:999,background:roleColors[user?.role||"admin"]+"20",color:roleColors[user?.role||"admin"],fontSize:12,fontWeight:700}}>
              {user?.role?.replace("_"," ").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Forms */}
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          {/* Profile form */}
          <div className="card">
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:20}}>👤 Edit Profile</h3>
            <form onSubmit={handleProfileSubmit}>
              <div className="form-group"><label className="label">Full Name *</label>
                <input className="input" value={profileForm.name} onChange={e=>setProfileForm({...profileForm,name:e.target.value})} required/>
              </div>
              <div className="form-group"><label className="label">Email Address *</label>
                <input className="input" type="email" value={profileForm.email} onChange={e=>setProfileForm({...profileForm,email:e.target.value})} required/>
              </div>
              {profileMsg.text&&<div className={profileMsg.type==="success"?"success-msg":"error-msg"}>{profileMsg.text}</div>}
              <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{padding:"10px 24px"}}>
                {savingProfile?"Saving...":"Save Profile"}
              </button>
            </form>
          </div>

          {/* Password form */}
          <div className="card">
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:20}}>🔐 Change Password</h3>
            <form onSubmit={handlePwSubmit}>
              <div className="form-group"><label className="label">Current Password *</label>
                <input className="input" type="password" value={pwForm.currentPassword} onChange={e=>setPwForm({...pwForm,currentPassword:e.target.value})} required placeholder="Enter current password"/>
              </div>
              <div className="form-group"><label className="label">New Password *</label>
                <input className="input" type="password" value={pwForm.newPassword} onChange={e=>setPwForm({...pwForm,newPassword:e.target.value})} required placeholder="Min 6 characters"/>
              </div>
              <div className="form-group"><label className="label">Confirm New Password *</label>
                <input className="input" type="password" value={pwForm.confirmPassword} onChange={e=>setPwForm({...pwForm,confirmPassword:e.target.value})} required placeholder="Repeat new password"/>
              </div>
              {pwMsg.text&&<div className={pwMsg.type==="success"?"success-msg":"error-msg"}>{pwMsg.text}</div>}
              <button type="submit" className="btn btn-primary" disabled={savingPw} style={{padding:"10px 24px"}}>
                {savingPw?"Changing...":"Change Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout></ProtectedRoute>
  );
}
