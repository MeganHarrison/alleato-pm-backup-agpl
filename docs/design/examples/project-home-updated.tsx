// @ts-nocheck
import { useState, useRef, useEffect } from "react";

// ============================================================================
// MOCK DATA
// ============================================================================

const PROJECT = {
  code: "24-115", name: "Westfield Collective",
  address: "1200 Westfield Ave, Tampa, FL 33602",
  type: "Restaurant / Bar — Design Build", phase: "Construction",
  startLabel: "Oct 15, 2024", scLabel: "Mar 28, 2025", fcLabel: "Apr 25, 2025",
  daysRemaining: 26, daysTotal: 164, daysElapsed: 138,
  percentComplete: 82, scheduleVariance: -3, healthScore: 73,
  owner: "Westfield Hospitality Group", architect: "Studio Forma Architects", pm: "Brandon Collier",
};

const AI_BRIEF = {
  summary: "Westfield Collective is 82% complete but tracking 3 days behind schedule, primarily due to a late MEP rough-in. The critical path runs through plumbing trim-out → elevator inspection → TCO, with 26 days to substantial completion. Financially, the project is $122.5K over the original contract (1.3%) driven by Finishes (+$70K) and Electrical (+$30K) overruns. Two pending change orders totaling $342K represent unresolved exposure.",
  generatedAt: "2 hours ago",
  confidence: "high",
  sourceMeetings: 4,
};

const AI_RISKS = [
  { id: 1, severity: "critical", title: "TCO timeline at risk if elevator inspection fails", source: "OAC Feb 24", mitigation: "Backup inspection slot reserved for Mar 7", status: "monitoring", category: "Schedule" },
  { id: 2, severity: "high", title: "Finishes budget overrun trending — $70K over committed vs budget", source: "Budget Analysis", mitigation: "Value engineering review scheduled", status: "open", category: "Budget" },
  { id: 3, severity: "high", title: "Pending CO exposure ($342K) not yet approved by owner", source: "OAC Feb 17", mitigation: "Owner meeting scheduled Mar 3", status: "open", category: "Financial" },
  { id: 4, severity: "medium", title: "Beer line routing change may impact bar equipment delivery timeline", source: "Beer Line Discussion Feb 17", mitigation: "Trenching approach approved — monitoring", status: "monitoring", category: "Coordination" },
];

const AI_DECISIONS = [
  { decision: "Approved alternate sprinkler head placement to avoid door conflicts", meeting: "OAC Feb 24", date: "Feb 24", impact: "Clears path to TCO inspection" },
  { decision: "Trenching approach selected over 90° elbow for beer lines", meeting: "Beer Line Discussion", date: "Feb 17", impact: "Prevents cooler interference, adds 2 days" },
  { decision: "Mural budget capped at $12K — pricing from 2 vendors", meeting: "OAC Feb 17", date: "Feb 17", impact: "Finishes scope controlled" },
  { decision: "Signage vendor selected — Jim to begin exterior install", meeting: "OAC Feb 17", date: "Feb 17", impact: "On track for Mar 7 completion" },
];

const MILESTONES = [
  { name: "Foundation Complete", date: "Nov 22, 2024", status: "complete", dv: 0 },
  { name: "Structural Steel", date: "Dec 18, 2024", status: "complete", dv: +2 },
  { name: "Rough-In Inspections", date: "Jan 31, 2025", status: "complete", dv: -1 },
  { name: "MEP Systems Complete", date: "Feb 21, 2025", status: "complete", dv: -3 },
  { name: "Finishes & Fixtures", date: "Mar 7, 2025", status: "in-progress", dv: null, pct: 65 },
  { name: "Final Inspections / TCO", date: "Mar 21, 2025", status: "upcoming", dv: null },
  { name: "Substantial Completion", date: "Mar 28, 2025", status: "upcoming", dv: null },
  { name: "Punch List / Final", date: "Apr 25, 2025", status: "upcoming", dv: null },
];

const LOOKAHEAD = [
  { activity: "2nd floor plumbing trim-out", trade: "Plumbing", start: "Feb 25", end: "Mar 3", critical: true, status: "active" },
  { activity: "Electrical panel terminations", trade: "Electrical", start: "Feb 26", end: "Mar 5", critical: true, status: "active" },
  { activity: "Wood trim & millwork install", trade: "Carpentry", start: "Feb 25", end: "Mar 10", critical: false, status: "active" },
  { activity: "Bar equipment delivery & set", trade: "Kitchen/Bar", start: "Mar 3", end: "Mar 5", critical: true, status: "upcoming" },
  { activity: "Elevator inspection", trade: "Inspections", start: "Mar 4", end: "Mar 4", critical: true, status: "upcoming" },
  { activity: "Exterior signage install", trade: "Signage", start: "Mar 5", end: "Mar 7", critical: false, status: "upcoming" },
  { activity: "Health dept. inspection", trade: "Inspections", start: "Mar 10", end: "Mar 10", critical: true, status: "upcoming" },
  { activity: "Fire alarm final test", trade: "Fire Protection", start: "Mar 12", end: "Mar 12", critical: true, status: "upcoming" },
];

const FINANCIALS = {
  contractValue: 9300000, approvedCOs: 187500, revisedContract: 9487500,
  committed: 7340000, billedToDate: 5890000, paidToDate: 5120000,
  remaining: 2147500, varianceAmount: -122500, variancePercent: -1.3,
  pendingCOExposure: 342000,
};

const ATTENTION_ITEMS = [
  { label: "Overdue action items", count: 4, severity: "error" },
  { label: "Pending change orders", count: 2, amount: "$342K", severity: "warning" },
  { label: "Open RFIs", count: 3, days: "avg 8 days", severity: "warning" },
  { label: "Submittals awaiting review", count: 5, severity: "neutral" },
  { label: "Invoices pending approval", count: 1, amount: "$284K", severity: "neutral" },
  { label: "Open punch list items", count: 18, severity: "neutral" },
];

const BUDGET_LINES = [
  { code: "03-10", desc: "Concrete & Foundations", budget: 680000, committed: 660000, spent: 645000, variance: 20000 },
  { code: "09-00", desc: "Finishes", budget: 1450000, committed: 1520000, spent: 980000, variance: -70000 },
  { code: "16-10", desc: "Electrical", budget: 780000, committed: 810000, spent: 620000, variance: -30000 },
  { code: "15-10", desc: "Mechanical / HVAC", budget: 920000, committed: 895000, spent: 710000, variance: 25000 },
  { code: "22-00", desc: "Plumbing", budget: 480000, committed: 475000, spent: 390000, variance: 5000 },
  { code: "01-10", desc: "General Conditions", budget: 650000, committed: 610000, spent: 520000, variance: 40000 },
];

const MEETINGS = [
  { month: "Feb", day: "24", title: "OAC — Westfield Collective",
    summary: "Construction nearing completion. Plumbing, electrical, and wood trim starting. Inspection raised concerns on door and sprinkler placements — won't block TCO.",
    decisions: ["Approved alternate sprinkler head placement", "TCO target confirmed for Mar 28"],
    actionItems: 3, attendees: 15, avatars: ["BC", "JD"], overflow: 12 },
  { month: "Feb", day: "17", title: "Beer Line Discussion",
    summary: "Rerouting 4.5-inch PVC beer lines under bar to prevent interference with coolers. Agreed on trenching and sleeving approach.",
    decisions: ["Trenching over elbow routing"],
    actionItems: 2, attendees: 6, avatars: ["AL", "DS"], overflow: 3 },
  { month: "Feb", day: "17", title: "OAC — Westfield Collective",
    summary: "Kitchen equipment by Daniel Stewart's team. Inspections next week for TCO. Jim installing exterior signage. Mural designs awaiting pricing.",
    decisions: ["Signage vendor selected", "Mural budget capped at $12K"],
    actionItems: 4, attendees: 18, avatars: ["BC", "JD"], overflow: 15 },
];

const DAILY_LOGS = [
  { date: "Feb 24", weather: "72°F ☀️", workers: 34, note: "Plumbing rough-in 2nd floor complete. Electrical panel installed." },
  { date: "Feb 21", weather: "68°F ☁️", workers: 28, note: "Drywall finishing main dining. HVAC duct inspection passed." },
  { date: "Feb 20", weather: "74°F ☀️", workers: 31, note: "Exterior signage brackets installed. Concrete curing south patio." },
];

const NAV = [
  { label: "Financial", items: [
    { name: "Budget" }, { name: "Prime Contracts", count: 1 }, { name: "Commitments", count: 12 },
    { name: "Direct Costs" }, { name: "Invoices", count: 3 }, { name: "Change Orders", count: 2 }, { name: "Change Events", count: 4 },
  ]},
  { label: "Project", items: [
    { name: "Schedule" }, { name: "RFIs", count: 3 }, { name: "Submittals", count: 5 },
    { name: "Daily Log" }, { name: "Punch List", count: 18 }, { name: "Meetings", count: 57 },
  ]},
  { label: "Files", items: [
    { name: "Drawings", count: 24 }, { name: "Documents", count: 89 }, { name: "Photos", count: 342 }, { name: "Specifications", count: 16 },
  ]},
  { label: "Directory", items: [{ name: "Users" }, { name: "Companies" }, { name: "Contacts" }] },
];

// Smart prompts generated based on project state
const SMART_PROMPTS = [
  PROJECT.scheduleVariance < 0 && "What's driving the schedule delay?",
  FINANCIALS.varianceAmount < 0 && "Break down the cost overruns",
  FINANCIALS.pendingCOExposure > 0 && "What's the CO exposure risk?",
  "Summarize this week's progress",
  "What decisions need my attention?",
  "Compare this project to similar past projects",
].filter(Boolean);

// ============================================================================
// UTILITIES
// ============================================================================
function fmt(n) { if (Math.abs(n)>=1e6) return `$${(n/1e6).toFixed(1)}M`; if (Math.abs(n)>=1e3) return `$${(n/1e3).toFixed(0)}K`; return `$${n.toLocaleString()}`; }
function fmtFull(n) { return `$${n.toLocaleString()}`; }
function pct(n,t) { return Math.round((n/t)*100); }

// ============================================================================
// MICRO COMPONENTS
// ============================================================================
function HealthRing({ score, size=52 }) {
  const r=(size-8)/2, c=2*Math.PI*r, off=c-(score/100)*c;
  const col = score>=75?"#16a34a":score>=50?"#d97706":"#dc2626";
  return (
    <div style={{position:"relative",width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f0f0f0" strokeWidth="4"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{transition:"stroke-dashoffset 1s"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:13,fontWeight:600,color:col}}>{score}</span>
      </div>
    </div>
  );
}

function Bar({value,max,color="#f97316",h=6}) {
  const p=Math.min(100,Math.round((value/max)*100));
  return <div style={{height:h,background:"#ebebef",borderRadius:h,overflow:"hidden",flex:1}}>
    <div style={{width:`${p}%`,height:"100%",background:color,borderRadius:h,transition:"width 0.7s"}}/>
  </div>;
}

// Shared
const EYE={fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:"rgba(0,0,0,0.38)"};
const ST={fontSize:16,fontWeight:600,letterSpacing:"-0.01em",margin:0};
const LNK={fontSize:12,color:"rgba(0,0,0,0.4)",cursor:"pointer",background:"none",border:"none"};
const CARD={background:"#fff",borderRadius:8,border:"1px solid rgba(0,0,0,0.07)",overflow:"hidden"};
const CL=(last)=>({padding:"16px 20px",borderRight:last?"none":"1px solid rgba(0,0,0,0.05)"});

// ============================================================================
// AI CHAT PANEL
// ============================================================================
function AIChatPanel({ isOpen, onToggle, onExpand }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const send = (text) => {
    const q = text || input;
    if (!q.trim()) return;
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setInput("");
    setTyping(true);
    // Simulated AI response
    setTimeout(() => {
      const responses = {
        "What's driving the schedule delay?": "The 3-day schedule variance traces back to the MEP Systems phase, which completed on Feb 21 — 3 days behind the baseline. Root cause: the mechanical subcontractor had a crew shortage during the week of Feb 10-14 (only 4 workers vs. planned 8), which pushed ductwork completion into the plumbing trim-out window.\n\nThis is recoverable. The critical path now runs through plumbing trim-out (ends Mar 3) → elevator inspection (Mar 4) → health dept inspection (Mar 10). If plumbing finishes on schedule, the 3-day buffer before TCO on Mar 21 absorbs the variance.",
        "Break down the cost overruns": "Two cost codes are driving the $122.5K projected overrun:\n\n• Finishes (09-00): $70K over — committed $1.52M against a $1.45M budget. The overage came from the owner's request to upgrade bar countertop materials (discussed in OAC Feb 3). This should be recoverable as a change order but hasn't been submitted yet.\n\n• Electrical (16-10): $30K over — committed $810K against $780K. The additional scope came from the beer line power requirements and added circuits for kitchen equipment. Again, CO-eligible but not yet formalized.\n\nRecommendation: Both overruns are owner-driven scope additions. Formalizing these as change orders would shift $100K of the $122.5K variance back to the owner.",
        "What's the CO exposure risk?": "There are 2 pending change orders totaling $342K:\n\n• CO-007 ($218K): Bar and kitchen scope additions — additional power circuits, beer line modifications, upgraded countertops. Well-documented across 3 meetings. High confidence of approval.\n\n• CO-008 ($124K): Sprinkler head relocations and door hardware changes from the impromptu inspection on Feb 24. This one has moderate approval risk — the owner may argue these should have been caught in design.\n\nNet exposure: If CO-008 is rejected, the project absorbs $124K, pushing the variance to -$246K (2.6% of contract). I'd recommend presenting CO-007 and CO-008 separately to avoid the contested items blocking the straightforward ones.",
      };
      const resp = responses[q] || `Based on the project data for Westfield Collective, here's what I found:\n\nThe project is currently at 82% completion with a health score of 73. There are ${AI_RISKS.length} active risks being tracked, with the TCO timeline being the most critical concern. Would you like me to dive deeper into any specific area?`;
      setMessages(prev => [...prev, { role: "ai", text: resp }]);
      setTyping(false);
    }, 1500);
  };

  if (!isOpen) {
    return (
      <button onClick={onToggle} style={{
        position:"fixed",bottom:24,right:24,width:56,height:56,borderRadius:28,
        background:"linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(249,115,22,0.35)",
        display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,
        transition:"transform 0.2s, box-shadow 0.2s",
      }}
        onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.08)";e.currentTarget.style.boxShadow="0 6px 24px rgba(249,115,22,0.45)"}}
        onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 16px rgba(249,115,22,0.35)"}}>
        <span style={{fontSize:22}}>✦</span>
      </button>
    );
  }

  return (
    <div style={{
      position:"fixed",bottom:24,right:24,width:400,height:540,borderRadius:12,
      background:"#fff",border:"1px solid rgba(0,0,0,0.1)",boxShadow:"0 16px 48px rgba(0,0,0,0.15)",
      display:"flex",flexDirection:"column",zIndex:1000,overflow:"hidden",
    }}>
      {/* Header */}
      <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fafafa"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:28,height:28,borderRadius:14,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>✦</span>
          <div>
            <div style={{fontSize:13,fontWeight:600}}>Alleato Intelligence</div>
            <div style={{fontSize:10,color:"rgba(0,0,0,0.4)"}}>Project context: {PROJECT.name}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={onExpand} style={{width:28,height:28,borderRadius:6,border:"1px solid rgba(0,0,0,0.1)",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}
            title="Expand to full page">⤢</button>
          <button onClick={onToggle} style={{width:28,height:28,borderRadius:6,border:"1px solid rgba(0,0,0,0.1)",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>×</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {messages.length === 0 && (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:13,color:"rgba(0,0,0,0.5)",marginBottom:16}}>Ask anything about {PROJECT.name}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {SMART_PROMPTS.slice(0,4).map((p,i)=>(
                <button key={i} onClick={()=>send(p)} style={{
                  padding:"8px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.08)",background:"#fafafa",
                  cursor:"pointer",fontSize:12,color:"rgba(0,0,0,0.7)",textAlign:"left",transition:"all 0.15s",
                }} onMouseEnter={e=>{e.currentTarget.style.background="#f0f0f0";e.currentTarget.style.borderColor="rgba(0,0,0,0.15)"}}
                   onMouseLeave={e=>{e.currentTarget.style.background="#fafafa";e.currentTarget.style.borderColor="rgba(0,0,0,0.08)"}}>
                  <span style={{marginRight:6,opacity:0.5}}>→</span>{p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m,i) => (
          <div key={i} style={{
            alignSelf:m.role==="user"?"flex-end":"flex-start",
            maxWidth:"85%",padding:"10px 14px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",
            background:m.role==="user"?"#f97316":"#f5f5f7",
            color:m.role==="user"?"#fff":"rgba(0,0,0,0.85)",
            fontSize:13,lineHeight:1.55,whiteSpace:"pre-wrap",
          }}>
            {m.text}
          </div>
        ))}
        {typing && (
          <div style={{alignSelf:"flex-start",padding:"10px 14px",borderRadius:"12px 12px 12px 4px",background:"#f5f5f7",fontSize:13,color:"rgba(0,0,0,0.4)"}}>
            <span style={{animation:"pulse 1.5s infinite"}}>Analyzing project data...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{padding:"12px 16px",borderTop:"1px solid rgba(0,0,0,0.06)",display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Ask about this project..."
          style={{flex:1,padding:"8px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.12)",fontSize:13,outline:"none"}}
        />
        <button onClick={()=>send()} style={{
          padding:"8px 14px",borderRadius:8,border:"none",background:"#f97316",color:"#fff",
          fontSize:13,fontWeight:500,cursor:"pointer",
        }}>Send</button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function ProjectHome() {
  const [expandedBudget, setExpandedBudget] = useState(false);
  const [showAllLookahead, setShowAllLookahead] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showAllRisks, setShowAllRisks] = useState(false);

  const tlPct = Math.round((PROJECT.daysElapsed/PROJECT.daysTotal)*100);
  const scPct = Math.round(((PROJECT.daysTotal-28)/PROJECT.daysTotal)*100);

  return (
    <div style={{fontFamily:"'Inter',system-ui,-apple-system,sans-serif",background:"#f5f5f7",minHeight:"100vh",color:"rgba(0,0,0,0.88)"}}>

      {/* PAGE HEADER */}
      <div style={{background:"#fff",borderBottom:"1px solid rgba(0,0,0,0.08)",padding:"20px 24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"rgba(0,0,0,0.45)",marginBottom:4}}>
          <span style={{cursor:"pointer"}} onMouseEnter={e=>e.target.style.color="rgba(0,0,0,0.7)"} onMouseLeave={e=>e.target.style.color="rgba(0,0,0,0.45)"}>Projects</span>
          <span style={{opacity:0.4}}>›</span>
          <span style={{color:"rgba(0,0,0,0.88)",fontWeight:500}}>{PROJECT.name}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div>
              <span style={{fontSize:11,color:"rgba(0,0,0,0.35)"}}>{PROJECT.code}</span>
              <h1 style={{fontSize:20,fontWeight:600,letterSpacing:"-0.02em",margin:0,lineHeight:1.2}}>{PROJECT.name}</h1>
            </div>
            <HealthRing score={PROJECT.healthScore}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",fontSize:13,fontWeight:500,color:"rgba(0,0,0,0.7)",background:"#fff",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,cursor:"pointer"}}
              onMouseEnter={e=>e.target.style.background="#f9f9f9"} onMouseLeave={e=>e.target.style.background="#fff"}>✏️ Edit Project</button>
            <button style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",fontSize:13,fontWeight:500,color:"#fff",background:"#f97316",border:"none",borderRadius:6,cursor:"pointer",boxShadow:"0 1px 2px rgba(0,0,0,0.1)"}}
              onMouseEnter={e=>e.target.style.background="#ea580c"} onMouseLeave={e=>e.target.style.background="#f97316"}>Setup Checklist →</button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{display:"flex"}}>
        <div style={{flex:1,minWidth:0,padding:"24px 28px",maxWidth:960}}>
          <div style={{display:"flex",flexDirection:"column",gap:36}}>

            {/* ── AI PROJECT BRIEF ── */}
            <div style={{
              padding:"16px 20px",borderRadius:10,
              background:"linear-gradient(135deg, #fffbf5 0%, #fff7ed 50%, #fef3e2 100%)",
              border:"1px solid rgba(249,115,22,0.12)",position:"relative",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{width:20,height:20,borderRadius:10,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff"}}>✦</span>
                <span style={{fontSize:11,fontWeight:600,color:"#9a3412",textTransform:"uppercase",letterSpacing:"0.06em"}}>AI Project Brief</span>
                <span style={{fontSize:10,color:"rgba(0,0,0,0.3)",marginLeft:"auto"}}>Updated {AI_BRIEF.generatedAt} · {AI_BRIEF.sourceMeetings} meetings analyzed</span>
              </div>
              <p style={{fontSize:13,lineHeight:1.65,color:"rgba(0,0,0,0.75)",margin:0}}>{AI_BRIEF.summary}</p>
            </div>

            {/* ── SNAPSHOT ── */}
            <div style={CARD}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr"}}>
                <div style={CL(false)}>
                  <div style={EYE}>Phase</div>
                  <div style={{fontSize:15,fontWeight:600,marginTop:4}}>{PROJECT.phase}</div>
                  <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:2}}>{PROJECT.type}</div>
                </div>
                <div style={CL(false)}>
                  <div style={EYE}>Completion</div>
                  <div style={{fontSize:15,fontWeight:600,marginTop:4}}>{PROJECT.percentComplete}%</div>
                  <div style={{marginTop:6}}><Bar value={PROJECT.percentComplete} max={100}/></div>
                </div>
                <div style={CL(false)}>
                  <div style={EYE}>Substantial Completion</div>
                  <div style={{fontSize:15,fontWeight:600,marginTop:4}}>{PROJECT.scLabel}</div>
                  <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:2}}>{PROJECT.daysRemaining} days remaining</div>
                </div>
                <div style={CL(true)}>
                  <div style={EYE}>Project Manager</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:"#fed7aa",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:"#9a3412"}}>BC</div>
                    <div><div style={{fontSize:13,fontWeight:500}}>{PROJECT.pm}</div><div style={{fontSize:11,color:"rgba(0,0,0,0.35)"}}>Alleato Group</div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SCHEDULE ── */}
            <section>
              <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <h2 style={ST}>Schedule</h2>
                  <span style={{display:"inline-flex",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,
                    background:PROJECT.scheduleVariance>=0?"#dcfce7":PROJECT.scheduleVariance>=-5?"#fef3c7":"#fee2e2",
                    color:PROJECT.scheduleVariance>=0?"#15803d":PROJECT.scheduleVariance>=-5?"#92400e":"#b91c1c",
                  }}>{Math.abs(PROJECT.scheduleVariance)} days {PROJECT.scheduleVariance>=0?"ahead":"behind"}</span>
                </div>
                <span style={LNK}>View full schedule →</span>
              </div>
              {/* Timeline */}
              <div style={{...CARD,padding:"16px 20px",marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:11,color:"rgba(0,0,0,0.4)"}}>
                  <span>{PROJECT.startLabel}</span><span>{PROJECT.fcLabel}</span>
                </div>
                <div style={{position:"relative",height:28,background:"#f0f0f3",borderRadius:6,overflow:"visible",marginTop:18}}>
                  <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${tlPct}%`,background:"linear-gradient(90deg,#f97316,#fb923c)",borderRadius:"6px 0 0 6px",transition:"width 1s"}}/>
                  <div style={{position:"absolute",left:`${scPct}%`,top:0,bottom:0,width:2,background:"rgba(0,0,0,0.15)",zIndex:1}}>
                    <div style={{position:"absolute",top:-16,left:"50%",transform:"translateX(-50%)",fontSize:9,fontWeight:600,color:"rgba(0,0,0,0.35)"}}>SC</div>
                  </div>
                  <div style={{position:"absolute",left:`${tlPct}%`,top:-4,bottom:-4,width:3,background:"#1d4ed8",borderRadius:2,zIndex:2}}>
                    <div style={{position:"absolute",top:-16,left:"50%",transform:"translateX(-50%)",fontSize:9,fontWeight:600,color:"#1d4ed8"}}>Today</div>
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:10,color:"rgba(0,0,0,0.35)"}}>
                  <span>Day {PROJECT.daysElapsed} of {PROJECT.daysTotal}</span>
                  <span>{tlPct}% timeline · {PROJECT.percentComplete}% work</span>
                </div>
                {Math.abs(tlPct-PROJECT.percentComplete)>3 && (
                  <div style={{marginTop:10,padding:"8px 12px",borderRadius:6,fontSize:11,
                    background:tlPct>PROJECT.percentComplete?"#fff7ed":"#f0fdf4",
                    color:tlPct>PROJECT.percentComplete?"#9a3412":"#14532d",
                    border:`1px solid ${tlPct>PROJECT.percentComplete?"rgba(234,88,12,0.12)":"rgba(22,163,74,0.12)"}`,
                  }}>{tlPct>PROJECT.percentComplete
                    ?`⚠️ Work (${PROJECT.percentComplete}%) trailing timeline (${tlPct}%) — may need acceleration`
                    :`✅ Work (${PROJECT.percentComplete}%) outpacing timeline (${tlPct}%)`}</div>
                )}
              </div>
              {/* Milestones + Lookahead */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={CARD}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.05)"}}><span style={{...EYE,fontSize:10}}>Milestones</span></div>
                  <div>{MILESTONES.map((ms,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"start",position:"relative"}}>
                      <div style={{width:36,display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                        {i>0?<div style={{width:1.5,height:8,background:ms.status==="upcoming"?"#e5e7eb":"#16a34a"}}/>:<div style={{height:8}}/>}
                        <div style={{width:10,height:10,borderRadius:"50%",flexShrink:0,zIndex:1,
                          background:ms.status==="complete"?"#16a34a":ms.status==="in-progress"?"#f97316":"#d1d5db",
                          boxShadow:ms.status==="in-progress"?"0 0 0 3px rgba(249,115,22,0.18)":"none",
                          border:ms.status==="upcoming"?"2px solid #e5e7eb":"none"}}/>
                        {i<MILESTONES.length-1&&<div style={{width:1.5,flex:1,minHeight:8,background:ms.status==="complete"?"#16a34a":"#e5e7eb"}}/>}
                      </div>
                      <div style={{flex:1,paddingBottom:6,paddingTop:2,paddingRight:12}}>
                        <div style={{fontSize:12,fontWeight:ms.status==="in-progress"?600:400,color:ms.status==="upcoming"?"rgba(0,0,0,0.4)":"rgba(0,0,0,0.75)"}}>{ms.name}</div>
                        <div style={{fontSize:10,color:"rgba(0,0,0,0.3)",marginTop:1,display:"flex",gap:4}}>
                          {ms.date}
                          {ms.status==="complete"&&ms.dv===0&&<span style={{color:"#15803d",fontWeight:500}}>✓ on time</span>}
                          {ms.status==="complete"&&ms.dv>0&&<span style={{color:"#15803d",fontWeight:500}}>✓ {ms.dv}d early</span>}
                          {ms.status==="complete"&&ms.dv<0&&<span style={{color:"#b91c1c",fontWeight:500}}>{ms.dv}d late</span>}
                          {ms.status==="in-progress"&&ms.pct!=null&&<span style={{color:"#f97316",fontWeight:500}}>{ms.pct}%</span>}
                        </div>
                      </div>
                    </div>
                  ))}</div>
                </div>
                <div style={CARD}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{...EYE,fontSize:10}}>2-Week Look-Ahead</span>
                    <span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:"#fee2e2",color:"#b91c1c",fontWeight:600}}>{LOOKAHEAD.filter(l=>l.critical).length} critical</span>
                  </div>
                  <div>
                    {(showAllLookahead?LOOKAHEAD:LOOKAHEAD.slice(0,5)).map((it,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"start",gap:8,padding:"8px 12px 8px 16px",
                        borderBottom:i<(showAllLookahead?LOOKAHEAD.length:5)-1?"1px solid rgba(0,0,0,0.03)":"none",
                        borderLeft:it.critical?"2.5px solid #dc2626":"2.5px solid transparent"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:it.critical?500:400,color:"rgba(0,0,0,0.75)"}}>{it.activity}</div>
                          <div style={{display:"flex",gap:6,fontSize:10,color:"rgba(0,0,0,0.3)",marginTop:2}}>
                            <span style={{fontWeight:500}}>{it.trade}</span><span>·</span><span>{it.start}{it.end!==it.start?` – ${it.end}`:""}</span>
                          </div>
                        </div>
                        <span style={{fontSize:10,fontWeight:500,padding:"1px 6px",borderRadius:3,flexShrink:0,marginTop:2,
                          background:it.status==="active"?"#dbeafe":"#f3f4f6",color:it.status==="active"?"#1d4ed8":"#6b7280"
                        }}>{it.status==="active"?"Active":"Upcoming"}</span>
                      </div>
                    ))}
                    {!showAllLookahead&&LOOKAHEAD.length>5&&<button onClick={()=>setShowAllLookahead(true)} style={{width:"100%",padding:8,fontSize:11,color:"rgba(0,0,0,0.4)",background:"rgba(0,0,0,0.02)",border:"none",cursor:"pointer",borderTop:"1px solid rgba(0,0,0,0.03)"}}>Show {LOOKAHEAD.length-5} more →</button>}
                  </div>
                </div>
              </div>
            </section>

            {/* ── AI RISKS & DECISIONS ── */}
            <section>
              <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:16}}>
                {/* Risks */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span style={{width:18,height:18,borderRadius:9,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff"}}>✦</span>
                    <h2 style={ST}>AI-Detected Risks</h2>
                    <span style={{fontSize:12,color:"rgba(0,0,0,0.3)"}}>{AI_RISKS.length}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {(showAllRisks?AI_RISKS:AI_RISKS.slice(0,3)).map((r,i)=>(
                      <div key={i} style={{...CARD,padding:"12px 16px",cursor:"pointer",transition:"all 0.15s",borderLeft:`3px solid ${r.severity==="critical"?"#dc2626":r.severity==="high"?"#d97706":"#9ca3af"}`}}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                        <div style={{display:"flex",alignItems:"start",justifyContent:"space-between",gap:8}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:500,lineHeight:1.4,color:"rgba(0,0,0,0.85)"}}>{r.title}</div>
                            <div style={{display:"flex",gap:8,marginTop:6,fontSize:10,color:"rgba(0,0,0,0.35)"}}>
                              <span style={{padding:"1px 6px",borderRadius:3,background:"#f3f4f6",fontWeight:500}}>{r.category}</span>
                              <span>from {r.source}</span>
                            </div>
                          </div>
                          <span style={{fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:4,flexShrink:0,
                            background:r.status==="monitoring"?"#dbeafe":"#fef3c7",
                            color:r.status==="monitoring"?"#1d4ed8":"#92400e",
                          }}>{r.status}</span>
                        </div>
                        {r.mitigation && <div style={{marginTop:6,fontSize:11,color:"rgba(0,0,0,0.45)",paddingLeft:0}}>↳ {r.mitigation}</div>}
                      </div>
                    ))}
                    {!showAllRisks&&AI_RISKS.length>3&&<button onClick={()=>setShowAllRisks(true)} style={{fontSize:12,color:"rgba(0,0,0,0.4)",background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:4}}>Show {AI_RISKS.length-3} more →</button>}
                  </div>
                </div>

                {/* Decisions */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span style={{width:18,height:18,borderRadius:9,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff"}}>✦</span>
                    <h2 style={ST}>Recent Decisions</h2>
                    <span style={{fontSize:12,color:"rgba(0,0,0,0.3)"}}>{AI_DECISIONS.length}</span>
                  </div>
                  <div style={{...CARD}}>
                    {AI_DECISIONS.map((d,i)=>(
                      <div key={i} style={{padding:"12px 16px",borderBottom:i<AI_DECISIONS.length-1?"1px solid rgba(0,0,0,0.04)":"none",cursor:"pointer",transition:"background 0.15s"}}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.015)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{fontSize:12,fontWeight:500,color:"rgba(0,0,0,0.85)",lineHeight:1.4}}>✓ {d.decision}</div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"rgba(0,0,0,0.35)"}}>
                          <span>{d.meeting}</span><span>{d.date}</span>
                        </div>
                        {d.impact&&<div style={{marginTop:4,fontSize:11,color:"rgba(0,0,0,0.4)"}}>↳ {d.impact}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── FINANCIALS ── */}
            <section>
              <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}><h2 style={ST}>Financials</h2><span style={LNK}>View Budget →</span></div>
              <div style={CARD}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)"}}>
                  {[
                    {l:"Contract Value",v:fmt(FINANCIALS.revisedContract),c:`Original ${fmt(FINANCIALS.contractValue)}`,d:FINANCIALS.approvedCOs>0?{v:`+${fmt(FINANCIALS.approvedCOs)} COs`,p:true}:null},
                    {l:"Committed",v:fmt(FINANCIALS.committed),c:`${pct(FINANCIALS.committed,FINANCIALS.revisedContract)}% of contract`},
                    {l:"Billed to Date",v:fmt(FINANCIALS.billedToDate),c:`${fmt(FINANCIALS.paidToDate)} collected`},
                    {l:"Remaining",v:fmt(FINANCIALS.remaining),c:`${pct(FINANCIALS.remaining,FINANCIALS.revisedContract)}% unallocated`},
                    {l:"Projected Variance",v:fmt(Math.abs(FINANCIALS.varianceAmount)),c:`${FINANCIALS.variancePercent}% of contract`,d:{v:`${FINANCIALS.variancePercent}%`,p:FINANCIALS.varianceAmount>=0}},
                  ].map((k,i)=>(
                    <div key={i} style={CL(i===4)}>
                      <div style={{...EYE,marginBottom:6}}>{k.l}</div>
                      <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                        <span style={{fontSize:20,fontWeight:600,letterSpacing:"-0.02em"}}>{k.v}</span>
                        {k.d&&<span style={{display:"inline-flex",padding:"1px 6px",borderRadius:4,fontSize:11,fontWeight:500,background:k.d.p?"#dcfce7":"#fee2e2",color:k.d.p?"#15803d":"#b91c1c"}}>{k.d.p?"↑":"↓"} {k.d.v}</span>}
                      </div>
                      <div style={{fontSize:11,color:"rgba(0,0,0,0.35)",marginTop:2}}>{k.c}</div>
                    </div>
                  ))}
                </div>
                <div style={{padding:"12px 20px",borderTop:"1px solid rgba(0,0,0,0.05)",background:"#fafafa"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:11,color:"rgba(0,0,0,0.45)"}}><span>Billing Progress</span><span>{pct(FINANCIALS.billedToDate,FINANCIALS.revisedContract)}% billed</span></div>
                  <div style={{height:6,background:"#e5e5e5",borderRadius:3,overflow:"hidden",display:"flex"}}>
                    <div style={{width:`${pct(FINANCIALS.paidToDate,FINANCIALS.revisedContract)}%`,background:"#16a34a"}}/>
                    <div style={{width:`${pct(FINANCIALS.billedToDate-FINANCIALS.paidToDate,FINANCIALS.revisedContract)}%`,background:"#f59e0b"}}/>
                  </div>
                  <div style={{display:"flex",gap:16,marginTop:6,fontSize:10,color:"rgba(0,0,0,0.4)"}}>
                    {[["#16a34a","Paid",fmt(FINANCIALS.paidToDate)],["#f59e0b","Unpaid",fmt(FINANCIALS.billedToDate-FINANCIALS.paidToDate)],["#e5e5e5","Unbilled",fmt(FINANCIALS.revisedContract-FINANCIALS.billedToDate)]].map(([bg,lbl,val],i)=>(
                      <span key={i} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:bg}}/>{lbl} ({val})</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── NEEDS ATTENTION ── */}
            <section>
              <h2 style={{...ST,marginBottom:12}}>Needs Attention</h2>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"rgba(0,0,0,0.06)",borderRadius:8,overflow:"hidden"}}>
                {ATTENTION_ITEMS.map((it,i)=>(
                  <div key={i} style={{background:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#fafafa"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:it.severity==="error"?"#dc2626":it.severity==="warning"?"#d97706":"#9ca3af",flexShrink:0}}/>
                      <span style={{fontSize:13,color:"rgba(0,0,0,0.7)"}}>{it.label}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {it.amount&&<span style={{fontSize:12,color:"rgba(0,0,0,0.45)"}}>{it.amount}</span>}
                      {it.days&&<span style={{fontSize:12,color:"rgba(0,0,0,0.45)"}}>{it.days}</span>}
                      <span style={{minWidth:20,height:20,borderRadius:10,fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 6px",
                        background:it.severity==="error"?"#fee2e2":it.severity==="warning"?"#fef3c7":"#f3f4f6",
                        color:it.severity==="error"?"#b91c1c":it.severity==="warning"?"#92400e":"#4b5563"
                      }}>{it.count}</span>
                    </div>
                  </div>
                ))}
              </div>
              {FINANCIALS.pendingCOExposure>0&&<div style={{marginTop:8,padding:"10px 16px",borderRadius:6,background:"#fffbeb",border:"1px solid rgba(217,119,6,0.15)",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>⚠️</span><span style={{fontSize:12,color:"#92400e"}}><strong>{fmt(FINANCIALS.pendingCOExposure)}</strong> pending CO exposure — {pct(FINANCIALS.pendingCOExposure,FINANCIALS.revisedContract)}% of contract</span>
              </div>}
            </section>

            {/* ── BUDGET ── */}
            <section>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <h2 style={ST}>Budget by Cost Code</h2>
                <button onClick={()=>setExpandedBudget(!expandedBudget)} style={LNK}>{expandedBudget?"Collapse":"Show all"} →</button>
              </div>
              <div style={CARD}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr style={{borderBottom:"1px solid rgba(0,0,0,0.08)"}}>
                    {["Code","Description","Budget","Committed","Spent","Variance",""].map((h,i)=>(
                      <th key={i} style={{padding:"10px 16px",textAlign:i>=2?"right":"left",...EYE}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{(expandedBudget?BUDGET_LINES:BUDGET_LINES.slice(0,4)).map((ln,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,0.04)",cursor:"pointer",transition:"background 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.015)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 16px",fontFamily:"monospace",fontSize:12,color:"rgba(0,0,0,0.5)"}}>{ln.code}</td>
                      <td style={{padding:"10px 16px",fontWeight:500}}>{ln.desc}</td>
                      <td style={{padding:"10px 16px",textAlign:"right",fontVariantNumeric:"tabular-nums",color:"rgba(0,0,0,0.55)"}}>{fmtFull(ln.budget)}</td>
                      <td style={{padding:"10px 16px",textAlign:"right",fontVariantNumeric:"tabular-nums",color:"rgba(0,0,0,0.55)"}}>{fmtFull(ln.committed)}</td>
                      <td style={{padding:"10px 16px",textAlign:"right",fontVariantNumeric:"tabular-nums",color:"rgba(0,0,0,0.55)"}}>{fmtFull(ln.spent)}</td>
                      <td style={{padding:"10px 16px",textAlign:"right",fontVariantNumeric:"tabular-nums",fontWeight:500,color:ln.variance>=0?"#15803d":"#b91c1c"}}>{ln.variance>=0?"+":""}{fmtFull(ln.variance)}</td>
                      <td style={{padding:"10px 16px",width:100}}><Bar value={ln.spent} max={ln.budget} color={ln.variance>=0?"#16a34a":"#dc2626"} h={4}/></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>

            {/* ── MEETINGS ── */}
            <section>
              <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"baseline",gap:8}}><h2 style={ST}>Meetings</h2><span style={{fontSize:13,color:"rgba(0,0,0,0.3)"}}>57</span></div>
                <span style={LNK}>View all →</span>
              </div>
              {MEETINGS.map((m,i)=>(
                <div key={i} style={{display:"flex",gap:16,padding:"16px 8px",borderBottom:i<MEETINGS.length-1?"1px solid rgba(0,0,0,0.04)":"none",cursor:"pointer",borderRadius:8,margin:"0 -8px",transition:"background 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:44,flexShrink:0,textAlign:"center",paddingTop:2}}>
                    <div style={{...EYE,fontSize:11}}>{m.month}</div>
                    <div style={{fontSize:20,fontWeight:600,letterSpacing:"-0.02em",lineHeight:1.1}}>{m.day}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12}}>
                      <h3 style={{fontSize:14,fontWeight:500,margin:0,lineHeight:1.3}}>{m.title}</h3>
                      <div style={{display:"flex",flexShrink:0}}>
                        {m.avatars.map((a,j)=><div key={j} style={{width:24,height:24,borderRadius:"50%",background:"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:600,color:"rgba(0,0,0,0.5)",marginLeft:j>0?-6:0,border:"2px solid #fff",position:"relative",zIndex:3-j}}>{a}</div>)}
                        {m.overflow>0&&<div style={{width:24,height:24,borderRadius:"50%",background:"#d1d5db",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:600,color:"rgba(0,0,0,0.5)",marginLeft:-6,border:"2px solid #fff"}}>+{m.overflow}</div>}
                      </div>
                    </div>
                    <p style={{fontSize:13,color:"rgba(0,0,0,0.5)",lineHeight:1.5,margin:"4px 0 0",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{m.summary}</p>
                    {m.decisions?.length>0&&<div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>
                      {m.decisions.map((d,j)=><span key={j} style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#eff6ff",color:"#1d4ed8",fontWeight:500}}>✓ {d}</span>)}
                    </div>}
                    <div style={{marginTop:6,display:"flex",gap:12,fontSize:11,color:"rgba(0,0,0,0.35)"}}>
                      <span>👥 {m.attendees}</span>{m.actionItems>0&&<span style={{color:m.actionItems>2?"#b91c1c":"inherit"}}>📋 {m.actionItems} action items</span>}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* ── DAILY LOG ── */}
            <section>
              <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:12}}><h2 style={ST}>Daily Log</h2><span style={LNK}>View all →</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:"rgba(0,0,0,0.06)",borderRadius:8,overflow:"hidden"}}>
                {DAILY_LOGS.map((lg,i)=>(
                  <div key={i} style={{background:"#fff",padding:"14px 16px",cursor:"pointer",transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#fafafa"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,fontWeight:500}}>{lg.date}</span><span style={{fontSize:11,color:"rgba(0,0,0,0.35)"}}>{lg.weather}</span></div>
                    <p style={{fontSize:12,color:"rgba(0,0,0,0.55)",lineHeight:1.5,margin:0}}>{lg.note}</p>
                    <div style={{marginTop:8,fontSize:11,color:"rgba(0,0,0,0.35)"}}>👷 {lg.workers} workers</div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{width:220,flexShrink:0,borderLeft:"1px solid rgba(0,0,0,0.07)",background:"#fff",position:"sticky",top:0,height:"100vh",overflowY:"auto",padding:"20px 16px"}}>
          <div style={{marginBottom:24,paddingBottom:16,borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
            <div style={{...EYE,marginBottom:8}}>Project Info</div>
            <div style={{fontSize:12,color:"rgba(0,0,0,0.55)",lineHeight:1.6}}>
              <div>{PROJECT.address}</div>
              <div style={{marginTop:4}}><span style={{color:"rgba(0,0,0,0.35)"}}>Owner:</span> {PROJECT.owner}</div>
              <div><span style={{color:"rgba(0,0,0,0.35)"}}>Architect:</span> {PROJECT.architect}</div>
              <div style={{marginTop:4}}><span style={{color:"rgba(0,0,0,0.35)"}}>Start:</span> {PROJECT.startLabel}</div>
            </div>
          </div>
          {NAV.map((s,i)=>(
            <div key={i} style={{marginBottom:20}}>
              <div style={{...EYE,marginBottom:4}}>{s.label}</div>
              {s.items.map((it,j)=>(
                <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",borderRadius:4,fontSize:13,color:"rgba(0,0,0,0.55)",cursor:"pointer",transition:"all 0.1s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,0,0,0.03)";e.currentTarget.style.color="rgba(0,0,0,0.8)"}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(0,0,0,0.55)"}}>
                  <span>{it.name}</span>
                  {it.count!=null&&<span style={{fontSize:11,color:"rgba(0,0,0,0.3)",fontVariantNumeric:"tabular-nums"}}>{it.count}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* AI CHAT PANEL */}
      <AIChatPanel isOpen={chatOpen} onToggle={()=>setChatOpen(!chatOpen)} onExpand={()=>alert("Navigate to /ai-executive")}/>
    </div>
  );
}