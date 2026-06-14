import { useState, useEffect, useMemo } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function getToken() {
  try { return localStorage.getItem("token") || ""; }
  catch { return ""; }
}

function setToken(token) {
  try {
    localStorage.setItem("token", token);
    return true;
  } catch { return false; }
}

function removeToken() {
  try { localStorage.removeItem("token"); } catch {}
}

let authToken = getToken();

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    authToken = "";
    removeToken();
    window.location.reload();
  }
  return res;
}

async function downloadFile(path, filename) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) { alert("Download failed. Try again."); return; }
  const blob = await res.blob();
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

const STATUS_CFG = {
  paid:    { bg:"#dcfce7", text:"#15803d", border:"#86efac", label:"Paid",    icon:"✓" },
  pending: { bg:"#fef9c3", text:"#854d0e", border:"#fde047", label:"Pending", icon:"◷" },
  overdue: { bg:"#fee2e2", text:"#991b1b", border:"#fca5a5", label:"Overdue", icon:"!" },
};
function getStatus(b){ return b===0?"paid":b>3000?"overdue":"pending"; }

function Pill({ label, active, onClick, activeColor="#1a56db" }){
  return(
    <button onClick={onClick} style={{
      padding:"4px 14px", borderRadius:99, border:`1.5px solid ${active?activeColor:"#cbd5e1"}`,
      background:active?activeColor:"#fff", color:active?"#fff":"#64748b",
      fontWeight:600, fontSize:12, cursor:"pointer", transition:"all .15s", fontFamily:"inherit"
    }}>{label}</button>
  );
}

// ── LOGIN SCREEN ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        authToken = data.access;
        setToken(data.access);
        console.log("Token saved:", getToken() ? "YES" : "NO");
        onLogin(data.user);
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Cannot connect to backend. Make sure Django is running on port 8000.");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0c1f3f 0%,#1a56db 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"36px 28px", width:"100%", maxWidth:380, boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:44 }}>🏢</div>
          <div style={{ fontWeight:800, fontSize:20, color:"#0c1f3f", marginTop:8 }}>Radhika Apartment</div>
          <div style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Maintenance Portal</div>
        </div>
        {error && (
          <div style={{ background:"#fee2e2", color:"#991b1b", padding:"10px 14px", borderRadius:9, fontSize:13, marginBottom:16 }}>
            ⚠️ {error}
          </div>
        )}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase" }}>Username</label>
          <input value={username} onChange={e=>setUsername(e.target.value)}
            style={{ width:"100%", padding:"11px 14px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit", marginTop:6, boxSizing:"border-box" }}/>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase" }}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            style={{ width:"100%", padding:"11px 14px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit", marginTop:6, boxSizing:"border-box" }}/>
        </div>
        <button onClick={handleLogin} disabled={loading} style={{ width:"100%", padding:"13px", borderRadius:11, background:"linear-gradient(135deg,#0c1f3f,#1a56db)", border:"none", color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"inherit", opacity:loading?0.7:1 }}>
          {loading?"Signing in...":"Sign In →"}
        </button>
        <div style={{ textAlign:"center", marginTop:14, color:"#94a3b8", fontSize:12 }}>Default: admin / admin123</div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────
export default function App() {
  const [user,      setUser]      = useState(null);
  const [flats,     setFlats]     = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [wingF,     setWingF]     = useState("All");
  const [floorF,    setFloorF]    = useState("All");
  const [statusF,   setStatusF]   = useState("All");
  const [search,    setSearch]    = useState("");
  const [viewMode,  setViewMode]  = useState("grid");
  const [sel,       setSel]       = useState(null);
  const [payOpen,   setPayOpen]   = useState(false);
  const [payAmt,    setPayAmt]    = useState("");
  const [payMode,   setPayMode]   = useState("cash");
  const [payMsg,    setPayMsg]    = useState("");
  const [paying,    setPaying]    = useState(false);
  const [dlLoading, setDlLoading] = useState("");
  const [reportMonth, setReportMonth] = useState("");
  const [reportYear,  setReportYear]  = useState("");
  const [receiptMonth, setReceiptMonth] = useState("");
  const [receiptYear,  setReceiptYear]  = useState("");
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderMsg,     setReminderMsg]     = useState("");

  useEffect(() => {
    if (authToken) {
      apiFetch("/auth/me/").then(r=>r.ok?r.json():null).then(u=>{
        if(u) setUser(u);
        else { authToken=""; removeItem("token"); }
      });
    }
  }, []);

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [fr, dr] = await Promise.all([apiFetch("/flats/"), apiFetch("/dashboard/")]);
      const fd = await fr.json();
      const dd = await dr.json();
      setFlats(fd.map(f=>({
        id:            f.flat_number,
        wing:          f.wing_name,
        floor:         f.floor_name?.replace(" Floor",""),
        floorN:        f.floor_number,
        room:          f.room_number,
        owner:         f.owner?.name  || "N/A",
        phone:         f.owner?.phone || "N/A",
        email:         f.owner?.email || "N/A",
        balance:       parseFloat(f.total_balance)||0,
        pendingMonths: Math.ceil((parseFloat(f.total_balance)||0)/400),
        monthly:       parseFloat(f.monthly_maintenance)||400,
        status:        f.payment_status||getStatus(parseFloat(f.total_balance)||0),
        dbId:          f.id,
      })));
      setDashboard(dd);
    } catch(e){ console.error(e); }
    setLoading(false);
  }

  async function confirmPay() {
    const amt = parseFloat(payAmt);
    if (!amt||amt<=0||!sel) return;
    setPaying(true); setPayMsg("");
    try {
      const res = await apiFetch("/payments/", {
        method:"POST",
        body: JSON.stringify({ flat:sel.dbId, amount:amt, payment_date:new Date().toISOString().split("T")[0], payment_mode:payMode }),
      });
      if (res.ok) {
        setPayMsg("✅ Payment saved to database!");
        await loadData();
        setTimeout(()=>{ setPayOpen(false); setPayAmt(""); setPayMsg(""); setSel(null); }, 1500);
      } else {
        const err = await res.json();
        setPayMsg("❌ " + (err.detail||JSON.stringify(err)));
      }
    } catch { setPayMsg("❌ Network error. Check backend."); }
    setPaying(false);
  }

  async function testEmail() {
    const toEmail = prompt("Enter YOUR email address to receive a test email:");
    if (!toEmail) return;
    setReminderSending(true);
    setReminderMsg("⏳ Sending test email...");
    try {
      const res = await apiFetch("/reminders/test-email/", {
        method: "POST",
        body: JSON.stringify({ to_email: toEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReminderMsg(`✅ Test email sent to ${toEmail}! Check your inbox (and spam folder). Gmail is working!`);
      } else {
        setReminderMsg(`❌ Failed: ${data.error || JSON.stringify(data)}`);
      }
    } catch(e) {
      setReminderMsg("❌ Network error: " + e.message);
    }
    setReminderSending(false);
    setTimeout(()=>setReminderMsg(""), 15000);
  }

  async function sendOverdueReminders() {
    if (!confirm("Send email reminders to ALL overdue flat owners with their receipt attached? This may take 1-2 minutes for many flats.")) return;
    setReminderSending(true);
    setReminderMsg("⏳ Sending emails... this can take 1-2 minutes, please wait and don't close the page.");
    try {
      const res = await apiFetch("/reminders/send-overdue/", {
        method: "POST",
        body: JSON.stringify({ status: "overdue" }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }

      if (res.ok && data) {
        setReminderMsg(`✅ Sent to ${data.sent_count} member(s). Skipped: ${data.skipped_count}. Failed: ${data.failed_count}.`);
      } else if (data) {
        setReminderMsg("❌ " + (data.error || JSON.stringify(data)));
      } else {
        setReminderMsg("❌ Server timeout or error (no JSON response). The backend may have taken too long — try again with fewer flats, or check Render logs.");
      }
    } catch (e) {
      setReminderMsg("❌ Network/timeout error: " + e.message + ". The server may still be processing — wait a minute then refresh to check if emails went through.");
    }
    setReminderSending(false);
    setTimeout(()=>setReminderMsg(""), 15000);
  }

  async function sendSingleReminder(flatId) {
    setReminderSending(true);
    setReminderMsg("⏳ Sending email... please wait.");
    try {
      const res = await apiFetch(`/reminders/send/${flatId}/`, { method: "POST" });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }

      if (res.ok && data?.success) {
        setReminderMsg(`✅ Email sent to ${data.message?.replace('Email sent successfully to ','') || 'owner'}! Check their inbox.`);
      } else if (res.status === 400) {
        setReminderMsg(`⚠️ ${data?.error || 'Owner has no email on file. Please update email in Admin panel first.'}`);
      } else if (res.status === 503) {
        setReminderMsg(`⚠️ Email not configured: ${data?.error || 'Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in Render environment variables.'}`);
      } else if (data?.error) {
        setReminderMsg(`❌ ${data.error}`);
      } else {
        setReminderMsg("❌ Unknown error. Check Render logs for details.");
      }
    } catch(e) {
      setReminderMsg("❌ Network/timeout error: " + e.message + ". The server may still be processing.");
    }
    setReminderSending(false);
    setTimeout(()=>setReminderMsg(""), 10000);
  }


  async function handleDownload(type, flatId=null) {
    setDlLoading(type);
    let path, name;
    if (type==="pdf") {
      path="/reports/pdf/";
      name=`maintenance_report_${new Date().toISOString().slice(0,10)}.pdf`;
    } else if (type==="excel") {
      const params = [];
      if (reportMonth) params.push(`month=${reportMonth}`);
      if (reportYear)  params.push(`year=${reportYear}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      path=`/reports/excel/${qs}`;
      const suffix = (reportMonth||reportYear)
        ? `${reportYear||new Date().getFullYear()}-${reportMonth?String(reportMonth).padStart(2,"0"):"all"}`
        : new Date().toISOString().slice(0,10);
      name=`maintenance_${suffix}.xlsx`;
    } else if (type==="receipt") {
      const params = [];
      if (receiptMonth) params.push(`month=${receiptMonth}`);
      if (receiptYear)  params.push(`year=${receiptYear}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      path=`/reports/receipt/${flatId}/${qs}`;
      const suffix = (receiptMonth||receiptYear)
        ? `${receiptYear||new Date().getFullYear()}-${receiptMonth?String(receiptMonth).padStart(2,"0"):"all"}`
        : new Date().toISOString().slice(0,10);
      name=`receipt_${flatId}_${suffix}.pdf`;
    }
    await downloadFile(path, name);
    setDlLoading("");
  }

  function handleLogout() { authToken=""; localStorage.removeItem("token"); setUser(null); setFlats([]); setDashboard(null); }

  if (!user) return <LoginScreen onLogin={setUser}/>;

  const filtered = flats.filter(f=>{
    if (wingF !=="All"&&f.wing !==wingF)  return false;
    if (floorF!=="All"&&f.floor!==floorF) return false;
    if (statusF!=="All"&&f.status!==statusF) return false;
    if (search&&!f.id.toLowerCase().includes(search.toLowerCase())&&!f.owner.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = dashboard||{ total_outstanding:flats.reduce((s,f)=>s+f.balance,0), total_flats:flats.length, paid_count:0, pending_count:0, overdue_count:0, wing_a_balance:0, wing_b_balance:0 };

  return (
    <div style={{ minHeight:"100vh", background:"#f0f4f8", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap');
        *{box-sizing:border-box;}
        html, body { overflow-x: hidden; }
        .card{transition:transform .18s,box-shadow .18s;cursor:pointer;}
        .card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(0,0,0,.13)!important;}
        .trow:hover td{background:#eff6ff!important;}

        /* ── Layout helpers ── */
        .stat-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:12px; margin-bottom:22px; }
        .filters-bar{ display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
        .filter-group{ display:flex; gap:4px; align-items:center; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:2px; }
        .filter-group::-webkit-scrollbar{ display:none; }
        .view-toggle{ display:flex; gap:6px; }
        .header-row{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .header-info{ flex:1; min-width:180px; }
        .header-actions{ display:flex; align-items:center; gap:16px; }
        .table-scroll{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .table-scroll table{ min-width:760px; }
        .flat-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(215px,1fr)); gap:14px; }
        .download-row{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; }
        .download-row button{ flex:1; min-width:160px; }
        .modal-box{ width:100%; max-height:90vh; overflow-y:auto; }
        .info-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }

        /* ── Tablet & Mobile ── */
        @media (max-width: 900px){
          .stat-grid{ grid-template-columns:repeat(3,1fr); }
          .header-address{ display:none; }
        }
        @media (max-width: 640px){
          .stat-grid{ grid-template-columns:repeat(2,1fr); gap:8px; }
          .header-row{ gap:10px; }
          .header-title{ font-size:15px!important; }
          .header-actions{ width:100%; justify-content:space-between; gap:10px; }
          .header-outstanding{ text-align:left!important; }
          .filters-bar input[type="text"], .filters-bar > div:first-child{ min-width:100%!important; flex:1 1 100%!important; }
          .filter-group{ width:100%; }
          .filter-group span{ flex-shrink:0; }
          .view-toggle{ width:100%; }
          .view-toggle button{ flex:1; }
          .download-row{ flex-direction:column; }
          .download-row button{ width:100%; }
          .flat-grid{ grid-template-columns:repeat(2,1fr); gap:10px; }
          .info-grid{ grid-template-columns:1fr 1fr; }
          main{ padding:14px 10px!important; }
          .modal-box{ max-width:100%!important; border-radius:14px!important; margin:0; }
        }
        @media (max-width: 420px){
          .flat-grid{ grid-template-columns:1fr; }
          .stat-grid{ grid-template-columns:repeat(2,1fr); }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ background:"linear-gradient(135deg,#0c1f3f 0%,#1a56db 100%)", padding:"14px 16px", boxShadow:"0 4px 24px rgba(12,31,63,.5)", position:"sticky", top:0, zIndex:50 }}>
        <div className="header-row" style={{ maxWidth:1280, margin:"0 auto" }}>
          <div style={{ width:42, height:42, borderRadius:13, background:"rgba(255,255,255,.13)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🏢</div>
          <div className="header-info">
            <div className="header-title" style={{ color:"#fff", fontFamily:"'DM Serif Display',serif", fontSize:18, lineHeight:1.2 }}>Radhika Apartment Co-op Housing Society</div>
            <div className="header-address" style={{ color:"rgba(255,255,255,.5)", fontSize:11, marginTop:2 }}>New Ganesh Nagar · Hazimalang Road · Adiwali · Kalyan (East) 421306</div>
          </div>
          <div className="header-actions">
            <div className="header-outstanding" style={{ textAlign:"right" }}>
              <div style={{ color:"rgba(255,255,255,.5)", fontSize:10, textTransform:"uppercase", letterSpacing:".1em" }}>Outstanding</div>
              <div style={{ color:"#fbbf24", fontWeight:800, fontSize:21 }}>₹{parseFloat(stats.total_outstanding||0).toLocaleString()}</div>
            </div>
            <div style={{ borderLeft:"1px solid rgba(255,255,255,.2)", paddingLeft:14, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ color:"rgba(255,255,255,.6)", fontSize:12 }}>👤 {user.username}</div>
              <button onClick={handleLogout} style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", padding:"6px 12px", borderRadius:7, fontSize:11, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>Logout</button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:1280, margin:"0 auto", padding:"22px 20px" }}>
        {loading&&<div style={{ textAlign:"center", padding:"60px", color:"#64748b", fontSize:16 }}>⏳ Loading data from database...</div>}

        {!loading&&<>
          {/* STAT CARDS */}
          <div className="stat-grid">
            {[
              {label:"Total Flats",  val:stats.total_flats||flats.length,                                 icon:"🏠",bg:"#e0f2fe",col:"#0369a1"},
              {label:"Paid",         val:stats.paid_count,                                                 icon:"✅",bg:"#dcfce7",col:"#15803d"},
              {label:"Pending",      val:stats.pending_count,                                              icon:"🟡",bg:"#fef9c3",col:"#854d0e"},
              {label:"Overdue",      val:stats.overdue_count,                                              icon:"🔴",bg:"#fee2e2",col:"#991b1b"},
              {label:"Due – Wing A", val:`₹${parseFloat(stats.wing_a_balance||0).toLocaleString()}`,      icon:"🅰️",bg:"#ede9fe",col:"#6d28d9"},
              {label:"Due – Wing B", val:`₹${parseFloat(stats.wing_b_balance||0).toLocaleString()}`,      icon:"🅱️",bg:"#fce7f3",col:"#9d174d"},
              {label:"Monthly/Flat", val:"₹400",                                                           icon:"💳",bg:"#f0fdf4",col:"#166534"},
            ].map(s=>(
              <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:"14px", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize:20 }}>{s.icon}</div>
                <div style={{ color:s.col, fontWeight:800, fontSize:19, marginTop:5, lineHeight:1 }}>{s.val}</div>
                <div style={{ color:"#64748b", fontSize:11, fontWeight:500, marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* FILTERS */}
          <div className="filters-bar" style={{ background:"#fff", borderRadius:14, padding:"14px 18px", marginBottom:16, boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
            <div style={{ position:"relative", flex:1, minWidth:200 }}>
              <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#94a3b8" }}>🔍</span>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search flat no. or owner name..."
                style={{ width:"100%", padding:"8px 12px 8px 32px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit" }}/>
            </div>
            <div className="filter-group">
              <span style={{ color:"#94a3b8", fontSize:11, fontWeight:700, marginRight:2 }}>WING</span>
              {["All","A","B"].map(w=><Pill key={w} label={w==="All"?"All Wings":w==="A"?"Wing A":"Wing B"} active={wingF===w} onClick={()=>setWingF(w)} activeColor={w==="A"?"#7c3aed":w==="B"?"#be185d":"#1a56db"}/>)}
            </div>
            <div className="filter-group">
              <span style={{ color:"#94a3b8", fontSize:11, fontWeight:700, marginRight:2 }}>FLOOR</span>
              {["All","Ground","First","Second","Third"].map(f=><Pill key={f} label={f==="All"?"All":f} active={floorF===f} onClick={()=>setFloorF(f)}/>)}
            </div>
            <div className="filter-group">
              <span style={{ color:"#94a3b8", fontSize:11, fontWeight:700, marginRight:2 }}>STATUS</span>
              {[["All","All","#1a56db"],["paid","Paid","#15803d"],["pending","Pending","#854d0e"],["overdue","Overdue","#991b1b"]].map(([v,l,c])=>
                <Pill key={v} label={l} active={statusF===v} onClick={()=>setStatusF(v)} activeColor={c}/>
              )}
            </div>
            <div className="view-toggle" style={{ marginLeft:"auto" }}>
              <button onClick={loadData} style={{ padding:"7px 14px", borderRadius:9, border:"1.5px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>🔄 Refresh</button>
              {[["grid","⊞ Grid"],["table","≡ Table"]].map(([v,l])=>(
                <button key={v} onClick={()=>setViewMode(v)} style={{ padding:"7px 16px", borderRadius:9, border:"1.5px solid", borderColor:viewMode===v?"#1a56db":"#e2e8f0", background:viewMode===v?"#eff6ff":"#fff", color:viewMode===v?"#1a56db":"#64748b", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{l}</button>
              ))}
            </div>
          </div>

          {/* DOWNLOAD BUTTONS */}
          <div className="download-row">
            <button onClick={()=>handleDownload("pdf")} disabled={dlLoading==="pdf"}
              style={{ padding:"9px 18px", borderRadius:9, background:"#fee2e2", color:"#991b1b", fontWeight:700, fontSize:13, border:"1.5px solid #fca5a5", cursor:"pointer", fontFamily:"inherit", opacity:dlLoading==="pdf"?0.6:1 }}>
              {dlLoading==="pdf"?"⏳ Downloading...":"📄 Download PDF Report"}
            </button>
            <button onClick={()=>handleDownload("excel")} disabled={dlLoading==="excel"}
              style={{ padding:"9px 18px", borderRadius:9, background:"#dcfce7", color:"#15803d", fontWeight:700, fontSize:13, border:"1.5px solid #86efac", cursor:"pointer", fontFamily:"inherit", opacity:dlLoading==="excel"?0.6:1 }}>
              {dlLoading==="excel"?"⏳ Downloading...":"📊 Download Excel Report"}
            </button>
            {user.is_staff && (
              <button onClick={sendOverdueReminders} disabled={reminderSending}
                style={{ padding:"9px 18px", borderRadius:9, background:"#fef3c7", color:"#92400e", fontWeight:700, fontSize:13, border:"1.5px solid #fcd34d", cursor:"pointer", fontFamily:"inherit", opacity:reminderSending?0.6:1 }}>
                {reminderSending?"⏳ Sending...":"📧 Send Reminders to Overdue"}
              </button>
            )}
            {user.is_staff && (
              <button onClick={testEmail} disabled={reminderSending}
                style={{ padding:"9px 18px", borderRadius:9, background:"#eff6ff", color:"#1a56db", fontWeight:700, fontSize:13, border:"1.5px solid #93c5fd", cursor:"pointer", fontFamily:"inherit", opacity:reminderSending?0.6:1 }}>
                🧪 Test Email
              </button>
            )}
          </div>
          {reminderMsg && (
            <div style={{ padding:"10px 14px", borderRadius:9, background:reminderMsg.startsWith("✅")?"#dcfce7":"#fee2e2", color:reminderMsg.startsWith("✅")?"#15803d":"#991b1b", fontSize:13, marginBottom:14 }}>
              {reminderMsg}
            </div>
          )}

          {/* MONTH-WISE REPORT SELECTOR */}
          <div style={{ background:"#fff", borderRadius:14, padding:"12px 18px", marginBottom:16, boxShadow:"0 1px 6px rgba(0,0,0,.06)", display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
            <span style={{ color:"#64748b", fontSize:12, fontWeight:700, whiteSpace:"nowrap" }}>📅 Month-wise Report:</span>
            <select value={reportMonth} onChange={e=>setReportMonth(e.target.value)}
              style={{ padding:"7px 10px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", color:"#334155", background:"#fff" }}>
              <option value="">All Months</option>
              {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m,i)=>(
                <option key={m} value={i+1}>{m}</option>
              ))}
            </select>
            <select value={reportYear} onChange={e=>setReportYear(e.target.value)}
              style={{ padding:"7px 10px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", color:"#334155", background:"#fff" }}>
              <option value="">All Years</option>
              {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={()=>handleDownload("excel")} disabled={dlLoading==="excel"}
              style={{ padding:"7px 16px", borderRadius:8, background:"#eff6ff", color:"#1a56db", fontWeight:700, fontSize:12, border:"1.5px solid #93c5fd", cursor:"pointer", fontFamily:"inherit", opacity:dlLoading==="excel"?0.6:1 }}>
              {dlLoading==="excel"?"⏳ Downloading...":"⬇️ Download Selected Period"}
            </button>
            {(reportMonth||reportYear) && (
              <button onClick={()=>{setReportMonth("");setReportYear("");}}
                style={{ padding:"7px 12px", borderRadius:8, background:"#f1f5f9", color:"#64748b", fontWeight:600, fontSize:12, border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                Clear
              </button>
            )}
          </div>

          <div style={{ color:"#94a3b8", fontSize:12, marginBottom:14, paddingLeft:2 }}>
            Showing <b style={{color:"#0c1f3f"}}>{filtered.length}</b> of <b style={{color:"#0c1f3f"}}>{flats.length}</b> flats
          </div>

          {/* GRID */}
          {viewMode==="grid"&&(
            <div className="flat-grid">
              {filtered.map(flat=>{
                const sc=STATUS_CFG[flat.status];
                return(
                  <div key={flat.id} className="card" onClick={()=>setSel(flat)}
                    style={{ background:"#fff", borderRadius:14, padding:"16px", border:`1.5px solid ${sc.border}`, boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:17, color:"#0c1f3f" }}>{flat.id}</div>
                        <div style={{ color:"#94a3b8", fontSize:11, marginTop:1 }}>{flat.floor} · Wing {flat.wing}</div>
                      </div>
                      <span style={{ background:sc.bg, color:sc.text, fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:99, border:`1px solid ${sc.border}` }}>{sc.icon} {sc.label}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"#f8fafc", borderRadius:9, marginBottom:10 }}>
                      <div style={{ width:28, height:28, borderRadius:50, background:flat.wing==="A"?"#ede9fe":"#fce7f3", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                        {flat.wing==="A"?"🅰️":"🅱️"}
                      </div>
                      <div style={{ fontWeight:600, fontSize:13, color:"#1e293b" }}>{flat.owner}</div>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ color:"#94a3b8", fontSize:10, fontWeight:600, textTransform:"uppercase" }}>Balance</div>
                        <div style={{ color:sc.text, fontWeight:800, fontSize:20 }}>₹{flat.balance.toLocaleString()}</div>
                      </div>
                      {flat.pendingMonths>0&&(
                        <div style={{ textAlign:"right" }}>
                          <div style={{ color:"#94a3b8", fontSize:10, fontWeight:600, textTransform:"uppercase" }}>Months</div>
                          <div style={{ color:sc.text, fontWeight:800, fontSize:18 }}>{flat.pendingMonths}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length===0&&<div style={{ gridColumn:"1/-1", textAlign:"center", padding:"60px", color:"#94a3b8" }}>No flats found.</div>}
            </div>
          )}

          {/* TABLE */}
          {viewMode==="table"&&(
            <div style={{ background:"#fff", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
              <div className="table-scroll">
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#0c1f3f" }}>
                    {["#","Flat No.","Owner","Wing","Floor","Monthly","Months Due","Balance","Status",""].map(h=>(
                      <th key={h} style={{ padding:"12px 14px", textAlign:"left", color:"rgba(255,255,255,.65)", fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:".07em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((flat,i)=>{
                    const sc=STATUS_CFG[flat.status];
                    return(
                      <tr key={flat.id} className="trow" style={{ borderBottom:"1px solid #f1f5f9" }}>
                        <td style={{ padding:"10px 14px", color:"#94a3b8", fontSize:12 }}>{i+1}</td>
                        <td style={{ padding:"10px 14px", fontWeight:800, color:"#0c1f3f" }}>{flat.id}</td>
                        <td style={{ padding:"10px 14px", color:"#334155" }}>{flat.owner}</td>
                        <td style={{ padding:"10px 14px" }}>
                          <span style={{ background:flat.wing==="A"?"#ede9fe":"#fce7f3", color:flat.wing==="A"?"#6d28d9":"#9d174d", fontWeight:700, fontSize:11, padding:"2px 10px", borderRadius:99 }}>Wing {flat.wing}</span>
                        </td>
                        <td style={{ padding:"10px 14px", color:"#64748b" }}>{flat.floor}</td>
                        <td style={{ padding:"10px 14px", fontWeight:600 }}>₹{flat.monthly}</td>
                        <td style={{ padding:"10px 14px", fontWeight:700, color:flat.pendingMonths>0?sc.text:"#15803d", textAlign:"center" }}>{flat.pendingMonths||"—"}</td>
                        <td style={{ padding:"10px 14px", fontWeight:800, color:sc.text, fontSize:15 }}>₹{flat.balance.toLocaleString()}</td>
                        <td style={{ padding:"10px 14px" }}>
                          <span style={{ background:sc.bg, color:sc.text, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:99, border:`1px solid ${sc.border}` }}>{sc.icon} {sc.label}</span>
                        </td>
                        <td style={{ padding:"10px 14px" }}>
                          <button onClick={()=>setSel(flat)} style={{ padding:"5px 14px", borderRadius:7, border:"1.5px solid #1a56db", background:"#eff6ff", color:"#1a56db", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>View</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filtered.length>0&&(
                  <tfoot>
                    <tr style={{ background:"#f8fafc", borderTop:"2px solid #e2e8f0" }}>
                      <td colSpan={7} style={{ padding:"10px 14px", fontWeight:700, color:"#0c1f3f", fontSize:13 }}>TOTAL ({filtered.length} flats)</td>
                      <td style={{ padding:"10px 14px", fontWeight:800, color:"#991b1b", fontSize:15 }}>₹{filtered.reduce((s,f)=>s+f.balance,0).toLocaleString()}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
              {filtered.length===0&&<div style={{ textAlign:"center", padding:"50px", color:"#94a3b8" }}>No flats found.</div>}
            </div>
          )}
        </>}
      </main>

      {/* DETAIL MODAL */}
      {sel&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(12,31,63,.6)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}
          onClick={e=>{if(e.target===e.currentTarget)setSel(null);}}>
          <div className="modal-box" style={{ background:"#fff", borderRadius:18, maxWidth:460, boxShadow:"0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background:"linear-gradient(135deg,#0c1f3f,#1a56db)", padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", borderRadius:"18px 18px 0 0" }}>
              <div>
                <div style={{ color:"rgba(255,255,255,.5)", fontSize:10, fontWeight:700, letterSpacing:".12em", textTransform:"uppercase" }}>Flat Details</div>
                <div style={{ color:"#fff", fontFamily:"'DM Serif Display',serif", fontSize:26, marginTop:2 }}>{sel.id}</div>
                <div style={{ color:"rgba(255,255,255,.6)", fontSize:12, marginTop:2 }}>{sel.floor} Floor · Wing {sel.wing}</div>
              </div>
              <button onClick={()=>setSel(null)} style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", width:32, height:32, borderRadius:9, cursor:"pointer", fontSize:16, fontWeight:700, flexShrink:0 }}>✕</button>
            </div>
            <div style={{ padding:"18px 20px" }}>
              <div style={{ display:"flex", gap:14, alignItems:"center", padding:"14px", background:"#f8fafc", borderRadius:12, marginBottom:16 }}>
                <div style={{ width:48, height:48, borderRadius:50, background:sel.wing==="A"?"#ede9fe":"#fce7f3", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                  {sel.wing==="A"?"🅰️":"🅱️"}
                </div>
                <div style={{ overflow:"hidden" }}>
                  <div style={{ fontWeight:800, fontSize:16, color:"#0c1f3f" }}>{sel.owner}</div>
                  <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>📞 {sel.phone}</div>
                  <div style={{ color:"#64748b", fontSize:12, wordBreak:"break-all" }}>✉️ {sel.email}</div>
                </div>
              </div>
              <div style={{ background:STATUS_CFG[sel.status].bg, border:`1.5px solid ${STATUS_CFG[sel.status].border}`, borderRadius:12, padding:"16px 18px", marginBottom:16 }}>
                {/* Status badge row */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, gap:8 }}>
                  <div style={{ color:"#64748b", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em" }}>Outstanding Balance</div>
                  <span style={{ background:"#fff", color:STATUS_CFG[sel.status].text, fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:99, border:`1px solid ${STATUS_CFG[sel.status].border}`, flexShrink:0, whiteSpace:"nowrap" }}>
                    {STATUS_CFG[sel.status].icon} {STATUS_CFG[sel.status].label}
                  </span>
                </div>
                {/* Balance amount on its own row — no overlap */}
                <div style={{ color:STATUS_CFG[sel.status].text, fontWeight:800, fontSize:30, lineHeight:1 }}>
                  ₹{sel.balance.toLocaleString()}
                </div>
                {sel.pendingMonths>0&&(
                  <div style={{ color:STATUS_CFG[sel.status].text, fontSize:12, fontWeight:600, marginTop:6 }}>
                    {sel.pendingMonths} month{sel.pendingMonths>1?"s":""} due · ₹400/month
                  </div>
                )}
              </div>
              <div className="info-grid">
                {[["Monthly Charge",`₹${sel.monthly}`],["Pending Months",sel.pendingMonths||"None"],["Wing",`Wing ${sel.wing}`],["Floor",`${sel.floor} Floor`]].map(([l,v])=>(
                  <div key={l} style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px" }}>
                    <div style={{ color:"#94a3b8", fontSize:10, fontWeight:700, textTransform:"uppercase" }}>{l}</div>
                    <div style={{ color:"#0c1f3f", fontWeight:700, fontSize:15, marginTop:3 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Receipt Month/Year Filter */}
              <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                <select value={receiptMonth} onChange={e=>setReceiptMonth(e.target.value)}
                  style={{ flex:"1 1 110px", padding:"8px 10px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:12, outline:"none", fontFamily:"inherit", color:"#334155", background:"#fff" }}>
                  <option value="">All Months</option>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m,i)=>(
                    <option key={m} value={i+1}>{m}</option>
                  ))}
                </select>
                <select value={receiptYear} onChange={e=>setReceiptYear(e.target.value)}
                  style={{ flex:"1 1 90px", padding:"8px 10px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:12, outline:"none", fontFamily:"inherit", color:"#334155", background:"#fff" }}>
                  <option value="">All Years</option>
                  {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
                {(receiptMonth||receiptYear) && (
                  <button onClick={()=>{setReceiptMonth("");setReceiptYear("");}}
                    style={{ padding:"8px 12px", borderRadius:8, background:"#f1f5f9", color:"#64748b", fontWeight:600, fontSize:12, border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                    Clear
                  </button>
                )}
              </div>

              {/* Receipt Download Button */}
              <button onClick={()=>handleDownload("receipt", sel.id)} disabled={dlLoading==="receipt"}
                style={{ width:"100%", padding:"11px", borderRadius:10, background:"#f0fdf4", border:"1.5px solid #86efac", color:"#15803d", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", marginBottom:10, opacity:dlLoading==="receipt"?0.6:1 }}>
                {dlLoading==="receipt"
                  ?"⏳ Generating Receipt..."
                  :(receiptMonth||receiptYear)
                    ?`🧾 Download Receipt (${receiptMonth?["","January","February","March","April","May","June","July","August","September","October","November","December"][receiptMonth]:""}${receiptYear?" "+receiptYear:""})`
                    :"🧾 Download Individual Receipt (PDF)"}
              </button>

              {/* Email Reminder Button - Admin only */}
              {user.is_staff && (
                <button onClick={()=>sendSingleReminder(sel.id)} disabled={reminderSending}
                  style={{ width:"100%", padding:"11px", borderRadius:10, background: (!sel.email || sel.email==="N/A") ? "#f1f5f9" : "#fef3c7", border:`1.5px solid ${(!sel.email||sel.email==="N/A")?"#e2e8f0":"#fcd34d"}`, color:(!sel.email||sel.email==="N/A")?"#94a3b8":"#92400e", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", marginBottom:10, opacity:reminderSending?0.6:1 }}>
                  {reminderSending
                    ? "⏳ Sending..."
                    : (!sel.email || sel.email==="N/A")
                      ? "📧 Email Receipt (No email on file — update in Admin)"
                      : `📧 Email Receipt to ${sel.email}`}
                </button>
              )}
              {reminderMsg && (
                <div style={{ padding:"10px 14px", borderRadius:9, background:reminderMsg.startsWith("✅")?"#dcfce7":reminderMsg.startsWith("⚠️")?"#fef9c3":"#fee2e2", color:reminderMsg.startsWith("✅")?"#15803d":reminderMsg.startsWith("⚠️")?"#854d0e":"#991b1b", fontSize:12, marginBottom:10 }}>
                  {reminderMsg}
                </div>
              )}

              <div style={{ display:"flex", gap:10 }}>
                {sel.balance>0 && user.is_staff && (
                  <button onClick={()=>setPayOpen(true)} style={{ flex:1, padding:"13px", borderRadius:11, background:"linear-gradient(135deg,#0c1f3f,#1a56db)", border:"none", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                    💳 Record Payment
                  </button>
                )}
                {sel.balance>0 && !user.is_staff && (
                  <div style={{ flex:1, padding:"13px", borderRadius:11, background:"#f1f5f9", border:"1.5px solid #e2e8f0", color:"#94a3b8", fontWeight:600, fontSize:13, textAlign:"center" }}>
                    🔒 Payment recording is admin only
                  </div>
                )}
                <button onClick={()=>setSel(null)} style={{ flex:sel.balance>0?"0 0 90px":1, padding:"13px", borderRadius:11, background:"#f1f5f9", border:"none", color:"#64748b", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {payOpen&&sel&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(12,31,63,.65)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
          <div className="modal-box" style={{ background:"#fff", borderRadius:16, maxWidth:380, padding:"24px 22px", boxShadow:"0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:22, color:"#0c1f3f", marginBottom:6 }}>Record Payment</div>
            <div style={{ color:"#64748b", fontSize:13, marginBottom:18, lineHeight:1.6 }}>
              Flat <b style={{color:"#0c1f3f"}}>{sel.id}</b> · <b style={{color:"#0c1f3f"}}>{sel.owner}</b><br/>
              Outstanding: <b style={{color:"#991b1b"}}>₹{sel.balance.toLocaleString()}</b>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {[400,800,1200,sel.balance].filter((v,i,a)=>a.indexOf(v)===i&&v>0&&v<=sel.balance).slice(0,4).map(amt=>(
                <button key={amt} onClick={()=>setPayAmt(String(amt))} style={{ flex:"1 1 70px", padding:"7px 4px", borderRadius:8, border:`1.5px solid ${payAmt===String(amt)?"#1a56db":"#e2e8f0"}`, background:payAmt===String(amt)?"#eff6ff":"#f8fafc", color:payAmt===String(amt)?"#1a56db":"#64748b", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>₹{amt.toLocaleString()}</button>
              ))}
            </div>
            <input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder="Or enter custom amount (₹)"
              style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:"1.5px solid #e2e8f0", fontSize:15, outline:"none", fontFamily:"inherit", marginBottom:12 }}/>
            <div style={{ marginBottom:14 }}>
              <div style={{ color:"#64748b", fontSize:12, fontWeight:700, marginBottom:8, textTransform:"uppercase" }}>Payment Mode</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {["cash","upi","cheque","bank_transfer"].map(m=>(
                  <button key={m} onClick={()=>setPayMode(m)} style={{ flex:"1 1 70px", padding:"7px 4px", borderRadius:8, border:`1.5px solid ${payMode===m?"#1a56db":"#e2e8f0"}`, background:payMode===m?"#eff6ff":"#f8fafc", color:payMode===m?"#1a56db":"#64748b", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                    {m==="bank_transfer"?"Bank":m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {payMsg&&<div style={{ padding:"10px 14px", borderRadius:9, background:payMsg.startsWith("✅")?"#dcfce7":"#fee2e2", color:payMsg.startsWith("✅")?"#15803d":"#991b1b", fontSize:13, marginBottom:14 }}>{payMsg}</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={confirmPay} disabled={paying} style={{ flex:1, padding:"12px", borderRadius:10, background:"linear-gradient(135deg,#166534,#22c55e)", border:"none", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", opacity:paying?0.7:1 }}>
                {paying?"Processing...":"✓ Confirm Payment"}
              </button>
              <button onClick={()=>{setPayOpen(false);setPayAmt("");setPayMsg("");}} style={{ flex:"0 0 90px", padding:"12px", borderRadius:10, background:"#f1f5f9", border:"none", color:"#64748b", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
