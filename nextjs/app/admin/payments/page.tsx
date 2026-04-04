"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import EmptyState from "@/components/EmptyState";
import API from "@/services/api";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const router = useRouter();

  const fetchPayments = (q="",m="",from="",to="",p=1) => {
    setLoading(true);
    const params = new URLSearchParams({ page:String(p), limit:"15" });
    if(q) params.set("search",q);
    if(m) params.set("method",m);
    if(from) params.set("dateFrom",from);
    if(to) params.set("dateTo",to);
    API.get(`/payments?${params.toString()}`)
      .then(res=>{
        const d=res.data.data;
        setPayments(Array.isArray(d?.payments)?d.payments:[]);
        setSummary(d?.summary||null);
        setPagination(d?.pagination||null);
      })
      .catch(()=>setError("Failed to load payments."))
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{fetchPayments();},[]);

  const handleFilter = (q=search,m=method,from=dateFrom,to=dateTo,p=1) => {
    setPage(p); fetchPayments(q,m,from,to,p);
  };

  const clearFilters = () => {
    setSearch(""); setMethod(""); setDateFrom(""); setDateTo(""); setPage(1);
    fetchPayments("","","","",1);
  };

  const hasFilters = search||method||dateFrom||dateTo;
  const methodColors: Record<string,string> = { cash:"badge-green", card:"badge-blue", bank_transfer:"badge-blue", upi:"badge-yellow", cheque:"badge-gray", other:"badge-gray" };

  return (
    <ProtectedRoute role={["admin","finance"]}><DashboardLayout>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <h1 className="page-title" style={{marginBottom:0}}>Payments</h1>
        <button className="btn btn-primary" onClick={()=>router.push("/admin/payments/create")}>+ Record Payment</button>
      </div>

      {/* Summary cards */}
      {summary&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginBottom:24}}>
          {[
            {label:"Total Revenue",value:`₹${(summary.totalRevenue||0).toLocaleString()}`,color:"#22c55e"},
            {label:"Total Payments",value:summary.totalPayments||0,color:"#3b82f6"},
          ].map(s=>(
            <div key={s.label} style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",borderLeft:`4px solid ${s.color}`}}>
              <p style={{fontSize:12,color:"#64748b",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>{s.label}</p>
              <p style={{fontSize:28,fontWeight:800,color:"#0f172a"}}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:12,alignItems:"end"}}>
          <div>
            <label className="label">Search Student</label>
            <input className="input" placeholder="Name or email..." value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleFilter(search)}/>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={method} onChange={e=>{setMethod(e.target.value);handleFilter(search,e.target.value);}}>
              <option value="">All Methods</option>
              <option value="cash">Cash</option><option value="card">Card</option>
              <option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="label">From Date</label>
            <input className="input" type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);handleFilter(search,method,e.target.value,dateTo);}}/>
          </div>
          <div>
            <label className="label">To Date</label>
            <input className="input" type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);handleFilter(search,method,dateFrom,e.target.value);}}/>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button className="btn btn-primary" onClick={()=>handleFilter()} style={{padding:"10px 18px"}}>🔍 Search</button>
            {hasFilters&&<button className="btn btn-ghost" onClick={clearFilters} style={{padding:"10px 14px"}}>✕ Clear</button>}
          </div>
        </div>
      </div>

      {error&&<div className="error-msg">{error}</div>}

      <div className="table-wrapper">
        {loading ? <div className="spinner"/> : payments.length===0 ? (
          <EmptyState icon="💰" title="No payments found" desc={hasFilters?"Try adjusting your filters.":"No payments recorded yet."} actionLabel={hasFilters?"Clear Filters":undefined} onAction={hasFilters?clearFilters:undefined}/>
        ) : (
          <table>
            <thead><tr><th>#</th><th>Student</th><th>Amount</th><th>Method</th><th>Course</th><th>Status</th><th>Date</th><th>Receipt</th></tr></thead>
            <tbody>
              {payments.map((p,i)=>(
                <tr key={p._id}>
                  <td>{((page-1)*15)+i+1}</td>
                  <td>
                    <div style={{fontWeight:600,fontSize:14}}>{p.studentId?.name||"—"}</div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{p.studentId?.email}</div>
                  </td>
                  <td style={{fontWeight:700,color:"#16a34a",fontSize:16}}>₹{(p.amount||0).toLocaleString()}</td>
                  <td><span className={`badge ${methodColors[p.method]||"badge-gray"}`}>{p.method?.replace("_"," ")}</span></td>
                  <td style={{fontSize:13}}>{p.courseId?.title||"—"}</td>
                  <td><span className={`badge ${p.status==="completed"?"badge-green":p.status==="pending"?"badge-yellow":"badge-red"}`}>{p.status}</span></td>
                  <td style={{fontSize:13,color:"#64748b"}}>{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td style={{fontSize:13,color:"#94a3b8"}}>{p.receiptNumber||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination&&pagination.totalPages>1&&(
        <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:20}}>
          <button className="btn btn-ghost" disabled={page===1} onClick={()=>{setPage(page-1);handleFilter(search,method,dateFrom,dateTo,page-1);}} style={{padding:"6px 14px"}}>← Prev</button>
          <span style={{padding:"8px 14px",fontSize:14,color:"#64748b"}}>Page {page} of {pagination.totalPages}</span>
          <button className="btn btn-ghost" disabled={page===pagination.totalPages} onClick={()=>{setPage(page+1);handleFilter(search,method,dateFrom,dateTo,page+1);}} style={{padding:"6px 14px"}}>Next →</button>
        </div>
      )}
    </DashboardLayout></ProtectedRoute>
  );
}