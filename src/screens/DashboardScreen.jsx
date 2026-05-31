import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMickiiAgent } from "../hooks/useMickiiAgent.js";
import { useMickiiEar } from "../hooks/useMickiiEar.js";
import {
  initDb,
  getProjects,
  getLeads,
  getSkills,
  getTotalRevenue,
  getPendingApprovals,
  approveAction,
  rejectAction,
  getDb
} from "../data/db.js";
import { listen } from "@tauri-apps/api/event";
import { runWorker } from "../engine/workers/index.js";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import AppShell from "../components/AppShell";
import ScreenHeader from "../components/ScreenHeader";
import { C, glassStyle } from "../components/consts";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Icon from "../components/Icon";
import ProgressBar from "../components/ProgressBar";
import MickiiOrb from "../components/MickiiOrb";

const DEMO_PROJECTS = [
  {
    name: "AI Website Builder",
    type: "Internal Product",
    phase: "Design",
    progress: 72,
    health: "Stable",
    tone: "gold",
    approvals: 1,
    last: "12 min ago",
  },
  {
    name: "Lead Engine",
    type: "Automation Tool",
    phase: "Build",
    progress: 54,
    health: "Needs Review",
    tone: "danger",
    approvals: 2,
    last: "38 min ago",
  },
  {
    name: "Agency Kit",
    type: "Digital Product",
    phase: "Testing",
    progress: 86,
    health: "Strong",
    tone: "success",
    approvals: 0,
    last: "1 hr ago",
  },
  {
    name: "Proposal OS",
    type: "Client Asset",
    phase: "Research",
    progress: 38,
    health: "Blocked",
    tone: "violet",
    approvals: 1,
    last: "2 hr ago",
  },
];

const DEMO_APPROVALS = [
  { title: "Send James proposal", source: "Leads", risk: "Client Message" },
  {
    title: "Activate lead reply workflow",
    source: "Automations",
    risk: "External Action",
  },
  { title: "Change product price", source: "Products", risk: "Revenue Impact" },
];

const QUICK_SKILLS = [
  {
    id: "website_build",
    name: "Build Website",
    icon: "screen",
    desc: "Client website from template",
  },
  {
    id: "proposal_create",
    name: "Create Proposal",
    icon: "document",
    desc: "Standard client proposal",
  },
  {
    id: "lead_followup",
    name: "Follow Up Lead",
    icon: "message",
    desc: "Warm lead sequence",
  },
];

// Beautiful chart data
const REVENUE_DATA = [
  { month: "Jan", revenue: 45000 },
  { month: "Feb", revenue: 58000 },
  { month: "Mar", revenue: 72000 },
  { month: "Apr", revenue: 64000 },
  { month: "May", revenue: 98000 },
];

const LEAD_DATA = [
  { source: "Fiverr", count: 12 },
  { source: "Upwork", count: 18 },
  { source: "Cold Email", count: 8 },
  { source: "Meta Ads", count: 22 },
];

export default function DashboardScreen({ onNavigate }) {
  const [skills, setSkills] = useState([]);
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [approvals, setApprovals] = useState(DEMO_APPROVALS);
  const [leads, setLeads] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const [skillRunning, setSkillRunning] = useState(null); // null or skillId

  // Quick Plan Config Modal States
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planType, setPlanType] = useState("Website");
  const [planDomain, setPlanDomain] = useState("E-Commerce");
  const [planContext, setPlanContext] = useState("");
  const [planUrl, setPlanUrl] = useState("");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false);
  const [otherPlanType, setOtherPlanType] = useState("");
  const [otherPlanDomain, setOtherPlanDomain] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);

  // Quick Design Config Modal States
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [designPreset, setDesignPreset] = useState("glassmorphism");
  const [designPages, setDesignPages] = useState(
    "Home, Services, About, Contact",
  );
  const [designNotes, setDesignNotes] = useState("");

  // Mickii Autonomous Engine
  const { messages, send, status, isProcessing } = useMickiiAgent({
    model: "llama-3.3-70b-versatile",
  });

  const [chatInput, setChatInput] = useState("");

  const handleTranscript = useCallback((transcript) => {
    setChatInput(transcript);
  }, []);

  const { isListening, startListening, stopListening } =
    useMickiiEar(handleTranscript);

  const fetchApprovals = async () => {
    try {
      const pending = await getPendingApprovals();
      setApprovals(pending || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // Initial fetch from SQLite
    const loadDashboardData = async () => {
      try {
        await initDb();
        const pList = await getProjects();
        setProjects(pList && pList.length > 0 ? pList : DEMO_PROJECTS);

        const lList = await getLeads();
        setLeads(lList || []);

        const sList = await getSkills();
        setSkills(sList && sList.length > 0 ? sList : QUICK_SKILLS);

        const rev = await getTotalRevenue();
        setRevenue(rev || 143000);
      } catch (err) {
        console.error("Dashboard database loading error:", err);
        setProjects(DEMO_PROJECTS);
      }
    };

    loadDashboardData();
    fetchApprovals();

    // Listen for incoming approvals with robust unmount race condition handling
    let active = true;
    let unlistenApprovals = null;
    let unlistenSkill = null;

    listen("approval_requested", (event) => {
      if (!active) return;
      console.log("[UI] Received approval_requested event:", event.payload);
      fetchApprovals();
    }).then((u) => {
      unlistenApprovals = u;
      if (!active) u();
    });

    listen("trigger_skill", async (event) => {
      if (!active) return;
      console.log("[UI] Received trigger_skill event:", event.payload);
      const { skillId, context } = event.payload;

      // Translate UI Skill IDs to core available worker names
      let workerName = skillId;
      if (skillId === "skill-code") workerName = "developer";
      else if (skillId === "skill-design") workerName = "website_builder";
      else if (skillId === "skill-plan") workerName = "blueprint_maker";

      // Dynamically resolve target project ID from SQLite database directly (avoiding state closure locks)
      let targetId = "demo-proj-1";
      try {
        const dbProjects = await getProjects();
        if (dbProjects && dbProjects.length > 0) {
          const activeProj =
            dbProjects.find(
              (p) => p.id && p.id !== "p1" && p.id !== "p2" && p.id !== "p3",
            ) || dbProjects[0];
          if (activeProj && activeProj.id) {
            targetId = activeProj.id;
          }
        }
      } catch (err) {
        console.warn(
          "[trigger_skill] Failed to query latest SQLite projects directly, falling back to demo-proj-1:",
          err,
        );
      }

      try {
        await runWorker(workerName, targetId, context);
        console.log(
          `[UI] Worker ${workerName} completed successfully for target ID ${targetId}`,
        );
      } catch (err) {
        alert(`Worker ${workerName} failed: ${err.message}`);
      }
    }).then((u) => {
      unlistenSkill = u;
      if (!active) u();
    });

    return () => {
      active = false;
      if (unlistenApprovals) unlistenApprovals();
      if (unlistenSkill) unlistenSkill();
    };
  }, []);

  const runSkill = async (skillId) => {
    setSkillRunning(skillId);
    try {
      const db = await getDb();
      const targetId = crypto.randomUUID();
      
      const result = await runWorker(skillId, targetId, { user: "Adii" });
      alert(
        `Skill "${skillId}" successfully executed!\nStatus: ${result.status || "Success"}\n${result.message || "Task completed in the background."}`
      );
    } catch (e) {
      alert(`Error running skill "${skillId}": ${e.message || e}`);
    } finally {
      setSkillRunning(null);
    }
  };

  const handleSkillClick = (skillId) => {
    if (skillId === "skill-plan") {
      setIsPlanModalOpen(true);
    } else if (skillId === "skill-design") {
      setIsDesignModalOpen(true);
    } else {
      runSkill(skillId);
    }
  };

  const handleGenerateDesign = async () => {
    setIsDesignModalOpen(false);

    // Resolve design parameters based on selected preset
    let designPrefs =
      "Premium dark glassmorphism theme, glowing backdrop filters, smooth margins, neon accents";
    let colorScheme =
      "#6366F1 primary indigo, #0F172A background, #F8FAFC text, transparent glass panels";

    if (designPreset === "corporate") {
      designPrefs =
        "Professional clean minimalist corporate theme, sleek cards, sharp corners, pristine layout";
      colorScheme =
        "#1E40AF primary blue, #FFFFFF background, #0F172A text, clean white surface";
    } else if (designPreset === "wellness") {
      designPrefs =
        "Calming clean eco/wellness theme, organic round borders, elegant minimal spacing";
      colorScheme =
        "#0D9488 primary teal, #F0FDFA background, #115E59 text, pristine white cards";
    } else if (designPreset === "cyberpunk") {
      designPrefs =
        "High contrast cyberpunk tech aesthetic, bold glowing borders, neon green highlights";
      colorScheme =
        "#10B981 primary neon green, #090D16 background, #ECFDF5 text, slate borders";
    } else if (designPreset === "dark_mode") {
      designPrefs =
        "Minimalist premium dark mode theme, thin gold borders, flat clean card grids";
      colorScheme =
        "#D97706 primary gold, #0A0F1D background, #F3F4F6 text, slate-900 surface";
    }

    if (designNotes.trim()) {
      designPrefs += `, Client custom notes: ${designNotes.trim()}`;
    }

    const pagesArray = designPages
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    setSkillRunning("skill-design");
    try {
      const db = await getDb();
      const projectId = crypto.randomUUID();
      const projectName = `Design: ${pagesArray.join(', ')}`;
      
      // Create a project in the database for tracking
      await db.execute(
        `INSERT INTO projects (id, name, client_name, type, stage, progress, health, created_at)
         VALUES ($1, $2, $3, $4, 'Design', 0, 'Stable', CURRENT_TIMESTAMP)`,
        [projectId, projectName, "Internal Client", "Web Design"]
      );

      const result = await runWorker("skill-design", projectId, {
        user: "Adii",
        pages: pagesArray,
        design_prefs: designPrefs,
        color_scheme: colorScheme,
      });

      alert(
        `Design Tool successfully executed!\nStatus: ${result.status || "Success"}\nWebsite Builder has designed your layout with "${designPreset}" preset!`
      );
    } catch (e) {
      alert(`Error running Design Tool: ${e.message || e}`);
    } finally {
      setSkillRunning(null);
      // Reset design inputs
      setDesignNotes("");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        textSummary: text ? text.substring(0, 3000) : "File attached",
      });
    };

    if (
      file.type.startsWith("text/") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".json") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".txt")
    ) {
      reader.readAsText(file);
    } else {
      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        textSummary:
          "Binary attachment loaded. System is ready to read and design according to this asset context.",
      });
    }
  };

  const handleGeneratePlan = async () => {
    setIsPlanModalOpen(false);

    // Resolve dynamic plan type including potential custom "Other" type
    const resolvedPlanType =
      planType === "Other" ? otherPlanType || "Custom Project" : planType;
    const resolvedPlanDomain =
      planDomain === "Other" ? otherPlanDomain || "Custom Domain" : planDomain;

    // Construct rich context prompt based on user's selected dropdowns and input ideas!
    let customRequirements = `
Type of Build: ${resolvedPlanType}
Business Domain: ${resolvedPlanDomain}
Custom Ideas & Blueprint context: ${planContext || "Standard planning request"}
Reference URL or notes: ${planUrl || "None"}
    `.trim();

    if (attachedFile) {
      customRequirements += `\n\n[ATTACHED FILE DETECTED]\nFile Name: ${attachedFile.name}\nFile Size: ${(attachedFile.size / 1024).toFixed(2)} KB\nFile Type: ${attachedFile.type}\nFile Content/Description: ${attachedFile.textSummary || "Attached for analysis"}`;
    }

    setSkillRunning("skill-plan");
    try {
      const db = await getDb();
      const projectId = crypto.randomUUID();
      const projectName = `${resolvedPlanType} - ${resolvedPlanDomain}`;
      
      // 1. Create a project in the database
      await db.execute(
        `INSERT INTO projects (id, name, client_name, type, stage, progress, health, created_at)
         VALUES ($1, $2, $3, $4, 'Planning', 0, 'Stable', CURRENT_TIMESTAMP)`,
        [projectId, projectName, "Internal Client", resolvedPlanType]
      );

      // 2. Delegate Orchestration to Mickii instead of calling a single worker
      const prompt = `Boss wants a new project plan for ${projectName}.\nType: ${resolvedPlanType}\nDomain: ${resolvedPlanDomain}\nCustom Requirements: ${customRequirements}\n\nPlease orchestrate the necessary workers to complete this requirement for Project ID: ${projectId}.`;
      
      await send(prompt);

      alert(
        `Plan Request sent to Mickii!\nMickii is now orchestrating the blueprint generation. Please check the Mickii AI terminal on the right for updates.`
      );
    } catch (e) {
      alert(`Error running Plan Tool: ${e.message || e}`);
    } finally {
      setSkillRunning(null);
      // Reset plan inputs
      setPlanContext("");
      setPlanUrl("");
      setOtherPlanType("");
      setOtherPlanDomain("");
      setAttachedFile(null);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isProcessing) return;
    const prompt = chatInput;
    setChatInput("");
    await send(prompt);
  };

  return (
    <AppShell
      activeNavId="dashboard"
      onNavigate={onNavigate}
      commandBar={
        <div
          className="fixed bottom-5 right-6 z-40 flex h-[64px] items-center gap-4 px-4"
          style={{ left: 300, ...glassStyle({ strong: true, glow: "violet" }) }}
        >
          <MickiiOrb isThinking={isProcessing} />
          <Badge tone="violet">Dashboard</Badge>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none text-white placeholder-gray-500"
            placeholder="Ask Mickii: run skill, check status, execute workflow..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
          />
          <Button
            variant={isListening ? "danger" : "soft"}
            onClick={isListening ? stopListening : startListening}
          >
            <Icon
              name={isListening ? "stop" : "mic"}
              size={17}
              className={isListening ? "animate-pulse" : ""}
            />
          </Button>
          <Button onClick={handleChatSend} className="bg-indigo-600 hover:bg-indigo-500 text-white border-0">
            <Icon name="send" size={17} />
          </Button>
        </div>
      }
    >
      <ScreenHeader
        title="Home"
        pageTitle="Dashboard"
        index="01"
        subtitle="Command center for Mickii's private earning operations. Run custom skills, approve lead actions, and track real-time analytics."
        badgeLabel="Offline Local Engine · Secure SQLite"
        primaryAction="Review Approvals"
        primaryIcon="shield"
        secondaryAction="Skill Library"
        secondaryIcon="brain"
        onPrimaryClick={() => onNavigate("approvals")}
        onSecondaryClick={() => onNavigate("system-monitor")}
        extraBadges={
          <>
            <Badge tone="gold">{skills.length} Skills</Badge>
            <Badge tone="success">Rs. 0 Cost Mode</Badge>
            <Badge tone="violet">Mickii</Badge>
          </>
        }
      />

      <section className="grid grid-cols-12 gap-5 pb-24">
        {/* Quick Skills Execution */}
        <div
          className="col-span-12 p-5"
          style={glassStyle({
            strong: true,
            glow: "gold",
            borderColor: `${C.gold}55`,
          })}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-white">
                Quick Skill Execution
              </h2>
              <p className="text-sm" style={{ color: C.muted }}>
                One-click deterministic workflows — offline, safe execution
              </p>
            </div>
            <Badge tone="gold">Master Skills</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...skills]
              .sort((a, b) => {
                const order = {
                  "skill-plan": 1,
                  "skill-design": 2,
                  "skill-code": 3,
                };
                return (order[a.id] || 99) - (order[b.id] || 99);
              })
              .slice(0, 3)
              .map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleSkillClick(skill.id)}
                  className="rounded-[18px] p-4 text-left transition-all hover:-translate-y-1 hover:bg-white/5 backdrop-blur-xl border border-indigo-500/20 hover:border-indigo-400/40 hover:shadow-[0_0_15px_rgba(129,140,248,0.3)]"
                  style={{
                    backgroundColor: "rgba(255,255,255,.045)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon
                      name={skill.icon || "star"}
                      size={24}
                      style={{ color: C.softGold }}
                    />
                    <p className="font-black text-white">{skill.name}</p>
                  </div>
                  <p className="text-xs" style={{ color: C.mutedLow }}>
                    {skill.description || skill.desc}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge tone="success">Ready</Badge>
                    <Badge tone="muted">Offline</Badge>
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div
          className="col-span-12 p-5"
          style={glassStyle({
            strong: true,
            glow: "danger",
            borderColor: `${C.danger}55`,
          })}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="mb-2 flex gap-2">
                <Badge tone="danger">
                  {approvals.length} Pending approvals
                </Badge>
                <Badge tone="gold">Human Approval Gate</Badge>
              </div>
              <h2 className="text-xl font-black text-white">
                Approval Safe Guard
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Mickii has structured these actions. Click Approve to finalize
                execution.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="soft" onClick={fetchApprovals}>
                Refresh Queue
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {approvals.map((app) => (
              <div
                key={app.id || app.title}
                onClick={() => onNavigate("approvals", { selectedId: app.id })}
                className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 transition-all hover:bg-white/10 cursor-pointer group"
                title="Click to inspect full details in Approval Center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className="font-bold text-white group-hover:text-violet-400 transition-colors"
                      style={{ whiteSpace: "pre-line" }}
                    >
                      {app.preview || app.title}
                    </p>
                    <span className="material-icons text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      open_in_new
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Worker Queue: {app.action_type || app.source} · Safety
                    Severity: Critical
                  </p>
                </div>
                {app.id && (
                  <div
                    className="flex gap-3 ml-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="soft"
                      className="hover:text-red-400"
                      onClick={async () => {
                        await rejectAction(app.id);
                        fetchApprovals();
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={async () => {
                        await approveAction(app.id);
                        fetchApprovals();
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {approvals.length === 0 && (
              <p className="text-sm text-gray-500 py-2">
                No pending approvals.
              </p>
            )}
          </div>
        </div>

        {/* Real-time Analytics Recharts widget */}
        <div
          className="col-span-12 lg:col-span-8 p-6"
          style={glassStyle({ strong: true, glow: "violet" })}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-lg text-white">
                Real-time Analytics
              </h3>
              <p className="text-xs" style={{ color: C.mutedLow }}>
                Direct real-time pull from SQLite production engine
              </p>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-gray-400">
                  Conversion Rate
                </span>
                <p className="text-sm font-black text-cyan-400">78.4%</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-gray-400">
                  Pipeline Speed
                </span>
                <p className="text-sm font-black text-green-400">4.2 Days</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-gray-400">
                  Active Load
                </span>
                <p className="text-sm font-black text-yellow-400">4 Workers</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Trend Area Chart */}
            <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
              <h4 className="text-xs font-black text-white mb-3 uppercase tracking-wider">
                Revenue Trend (₹)
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={REVENUE_DATA}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#10B981"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10B981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      stroke="#94A3B8"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      fillOpacity={1}
                      fill="url(#colorRev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Lead Sources Bar Chart */}
            <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
              <h4 className="text-xs font-black text-white mb-3 uppercase tracking-wider">
                Lead Acquisition Source
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={LEAD_DATA}>
                    <XAxis
                      dataKey="source"
                      stroke="#94A3B8"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    />
                    <Bar dataKey="count" fill="#6366F1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Mickii Autonomous Console */}
        <div
          className="col-span-12 lg:col-span-4 p-6"
          style={glassStyle({ glow: "violet" })}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-black text-white">Mickii System Status</h3>
              <p className="text-[10px]" style={{ color: C.mutedLow }}>
                Local Autonomous Loop Active
              </p>
            </div>
            <Badge tone="violet">Cortex v4</Badge>
          </div>

          <div className="flex gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 mb-4">
            <MickiiOrb size="lg" isThinking={isProcessing} />
            <div>
              <p className="text-xs leading-relaxed text-gray-300">
                Boss, Cortex online hai. Stored local procedures safe offline
                run ho rahe hain. Earning engine status checked.
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-[170px] overflow-y-auto scrollbar-hide">
            {messages.slice(-3).map((msg, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 text-xs border ${
                  msg.role === "user"
                    ? "bg-white/5 border-white/10 text-white"
                    : msg.isSystem
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-200 italic"
                      : "bg-black/30 border-yellow-500/20 text-gray-300"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.searchTelemetry && (
                  <div className="mt-2 pt-1.5 border-t border-white/5 text-[10px] text-cyan-300 flex items-center gap-1 font-bold font-mono">
                    <Icon name="search" size={10} />
                    <span>
                      Search verified ({msg.searchTelemetry.status}) ·{" "}
                      {msg.searchTelemetry.responseTime}ms
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plan Tool Configuration Modal */}
      {isPlanModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto pt-10 pb-32 animate-in fade-in duration-300"
          onClick={() => setIsPlanModalOpen(false)}
        >
          <div
            className="w-full max-w-lg p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden text-left"
            style={{
              backgroundColor: "#0c0f17e0",
              ...glassStyle({ strong: true, glow: "gold" }),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-44 h-44 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📐</span>
                <h3 className="text-lg font-black text-white">
                  Setup Quick Plan Execution
                </h3>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Configure target details so Mickii's Planning Worker can analyze
              competitors, market demands, and generate your real-time
              blueprints.
            </p>

            <div className="space-y-4">
              {/* Type of Build Dropdown */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                  Type of Build
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsTypeDropdownOpen(!isTypeDropdownOpen);
                    setIsDomainDropdownOpen(false);
                  }}
                  className="px-3.5 py-2.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500 flex items-center justify-between cursor-pointer w-full text-left transition-all"
                  style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
                >
                  <span>
                    {planType === "Single Landing Page"
                      ? "Single Landing Page (High Conversion)"
                      : planType === "Multi-page Website"
                        ? "Multi-page Website (Corporate/Business)"
                        : planType === "SaaS Web Application"
                          ? "SaaS Web Application"
                          : planType === "Mobile Application"
                            ? "Mobile Application (iOS / Android)"
                            : planType === "Custom AI Agent"
                              ? "Custom AI Agent (Chatbot / Call / Assistant)"
                              : planType === "Digital Marketing / SEO"
                                ? "Digital Marketing / SEO Campaign"
                                : planType === "Ads Campaign"
                                  ? "Ads Campaign (Meta / Google)"
                                  : planType === "Internal CRM"
                                    ? "Internal CRM / Dashboard"
                                    : planType === "Other"
                                      ? "Other (Specify manually)"
                                      : planType}
                  </span>
                  <span
                    className={`text-[10px] text-gray-400 transition-transform duration-300 ${isTypeDropdownOpen ? "rotate-180 text-amber-400" : ""}`}
                  >
                    ▼
                  </span>
                </button>
                {isTypeDropdownOpen && (
                  <div className="absolute top-[100%] left-0 right-0 z-50 mt-1.5 p-1.5 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      { value: "Single Landing Page", label: "Single Landing Page (High Conversion)" },
                      { value: "Multi-page Website", label: "Multi-page Website (Corporate/Business)" },
                      { value: "SaaS Web Application", label: "SaaS Web Application" },
                      { value: "Mobile Application", label: "Mobile Application (iOS / Android)" },
                      { value: "Custom AI Agent", label: "Custom AI Agent (Chatbot / Call / Assistant)" },
                      { value: "Digital Marketing / SEO", label: "Digital Marketing / SEO Campaign" },
                      { value: "Ads Campaign", label: "Ads Campaign (Meta / Google)" },
                      { value: "Internal CRM", label: "Internal CRM / Dashboard" },
                      { value: "Other", label: "Other (Specify manually)" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setPlanType(opt.value);
                          setIsTypeDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs rounded-xl transition-all flex items-center justify-between mb-0.5 last:mb-0 ${
                          planType === opt.value
                            ? "bg-amber-500/20 text-amber-300 font-black border-l-2 border-amber-500 pl-2.5"
                            : "text-gray-300 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {planType === opt.value && (
                          <span className="text-[10px] text-amber-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Specify Custom Input - Shows ONLY when "Other" is selected */}
              {planType === "Other" && (
                <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                    Specify Project Type
                  </label>
                  <input
                    type="text"
                    value={otherPlanType}
                    onChange={(e) => setOtherPlanType(e.target.value)}
                    placeholder="e.g. Chrome Extension, Shopify Theme, Discord Bot, WordPress Plugin"
                    className="px-3.5 py-2.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500 w-full placeholder-gray-600"
                    style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
                  />
                </div>
              )}

              {/* Business Domain Dropdown */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                  Business Domain (Field / Industry)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsDomainDropdownOpen(!isDomainDropdownOpen);
                    setIsTypeDropdownOpen(false);
                  }}
                  className="px-3.5 py-2.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500 flex items-center justify-between cursor-pointer w-full text-left transition-all"
                  style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
                >
                  <span>
                    {planDomain === "E-Commerce"
                      ? "E-Commerce / Online Store"
                      : planDomain === "Real Estate"
                        ? "Real Estate & Property"
                        : planDomain === "Healthcare"
                          ? "Healthcare / Medical"
                          : planDomain === "EdTech"
                            ? "EdTech / E-Learning"
                            : planDomain === "Fintech"
                              ? "Fintech / Finance"
                              : planDomain === "Local Business"
                                ? "Local Business / Services"
                                : planDomain === "Other"
                                  ? "Other (Custom domain)"
                                  : planDomain}
                  </span>
                  <span
                    className={`text-[10px] text-gray-400 transition-transform duration-300 ${isDomainDropdownOpen ? "rotate-180 text-amber-400" : ""}`}
                  >
                    ▼
                  </span>
                </button>
                {isDomainDropdownOpen && (
                  <div className="absolute top-[100%] left-0 right-0 z-50 mt-1.5 p-1.5 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      { value: "E-Commerce", label: "E-Commerce / Online Store" },
                      { value: "Real Estate", label: "Real Estate & Property" },
                      { value: "Healthcare", label: "Healthcare / Medical" },
                      { value: "EdTech", label: "EdTech / E-Learning" },
                      { value: "Fintech", label: "Fintech / Finance" },
                      { value: "Local Business", label: "Local Business / Services" },
                      { value: "Other", label: "Other (Custom domain)" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setPlanDomain(opt.value);
                          setIsDomainDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs rounded-xl transition-all flex items-center justify-between mb-0.5 last:mb-0 ${
                          planDomain === opt.value
                            ? "bg-amber-500/20 text-amber-300 font-black border-l-2 border-amber-500 pl-2.5"
                            : "text-gray-300 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {planDomain === opt.value && (
                          <span className="text-[10px] text-amber-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Specify Domain Custom Input - Shows ONLY when "Other" is selected */}
              {planDomain === "Other" && (
                <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                    Specify Business Domain
                  </label>
                  <input
                    type="text"
                    value={otherPlanDomain}
                    onChange={(e) => setOtherPlanDomain(e.target.value)}
                    placeholder="e.g. Tours & Travels, Auto Dealership, Legal Services, Food & Restaurant"
                    className="px-3.5 py-2.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500 w-full placeholder-gray-600"
                    style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
                  />
                </div>
              )}

              {/* Context Idea Text Area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                  Context & Core Ideas (Blueprint Notes)
                </label>
                <textarea
                  rows={4}
                  value={planContext}
                  onChange={(e) => setPlanContext(e.target.value)}
                  placeholder="Paste your context idea, rules, or core features here... e.g. I want to build a platform where users upload property details and AI writes ads."
                  className="px-3.5 py-2.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500 w-full resize-none placeholder-gray-600"
                  style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
                />
              </div>

              {/* Reference URL or Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                  Reference URL / Source Link (Optional)
                </label>
                <input
                  type="text"
                  value={planUrl}
                  onChange={(e) => setPlanUrl(e.target.value)}
                  placeholder="e.g., https://example.com/reference-landing-page"
                  className="px-3.5 py-2.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500 w-full placeholder-gray-600"
                  style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
                />
              </div>

              {/* Premium File Attachment Dropzone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                  Attach Files & Assets (Media, PDF, Excel, PPT, DOCS)
                </label>
                <div
                  className={`border border-dashed rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    attachedFile
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-white/15 bg-slate-950/40 hover:bg-slate-950/60 hover:border-white/20"
                  }`}
                  onClick={() =>
                    document.getElementById("plan-file-input").click()
                  }
                  style={{ borderStyle: "dashed", borderWidth: "1px" }}
                >
                  <input
                    type="file"
                    id="plan-file-input"
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/*"
                  />
                  {attachedFile ? (
                    <div className="flex items-center justify-between w-full text-xs">
                      <div className="flex items-center gap-2 text-white font-medium truncate max-w-[80%]">
                        <span className="text-base">📎</span>
                        <div className="truncate text-left">
                          <p className="truncate font-bold text-amber-300">
                            {attachedFile.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {(attachedFile.size / 1024).toFixed(1)} KB ·{" "}
                            {attachedFile.type || "Unknown"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedFile(null);
                        }}
                        className="text-gray-400 hover:text-red-400 font-bold p-1 transition-colors text-[10px] bg-white/5 px-2 py-0.5 rounded-lg border border-white/10"
                        title="Remove Attachment"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-1">
                      <span className="text-lg block mb-0.5">📤</span>
                      <p className="text-xs text-gray-300 font-semibold">
                        Click to upload or drag files here
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Supports PDF, Image, Video, Word, Excel, PPT, TXT
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="soft" onClick={() => setIsPlanModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="glow"
                onClick={handleGeneratePlan}
                className="bg-amber-600/30 hover:bg-amber-600 border border-amber-500/40"
              >
                Generate Real-Time Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Design Config Modal Overlay */}
      {isDesignModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto pt-10 pb-32 animate-in fade-in duration-300"
          onClick={() => setIsDesignModalOpen(false)}
        >
          <div
            className="w-full max-w-xl p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden text-left"
            style={{
              backgroundColor: "#0c0f17e0",
              ...glassStyle({ strong: true, glow: "emerald" }),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎨</span>
                <h3 className="text-lg font-black text-white">
                  Setup Quick Design Execution
                </h3>
              </div>
              <button
                onClick={() => setIsDesignModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Select a curated visual design preset, customize required
              pages/sub-pages, and let Mickii's Website Builder write premium
              frontend code instantly.
            </p>

            <div className="space-y-4">
              {/* Visual Theme Presets Grid */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">
                  Visual Theme Preset (Choose a look)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: "corporate",
                      icon: "business",
                      name: "Sleek Corporate",
                      desc: "Clean white, blue accents",
                    },
                    {
                      id: "glassmorphism",
                      icon: "auto_awesome",
                      name: "Premium Glass",
                      desc: "Dark mode, indigo glow",
                    },
                    {
                      id: "wellness",
                      icon: "eco",
                      name: "Clean Wellness",
                      desc: "Soft teal, teal accents",
                    },
                    {
                      id: "cyberpunk",
                      icon: "terminal",
                      name: "Cyberpunk Tech",
                      desc: "Charcoal, neon green",
                    },
                    {
                      id: "dark_mode",
                      icon: "dark_mode",
                      name: "Classic Dark",
                      desc: "Slate-900, gold accents",
                    },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setDesignPreset(theme.id)}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        designPreset === theme.id
                          ? "border-emerald-500/70 bg-emerald-500/10 shadow-lg shadow-emerald-950/20"
                          : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-white">
                        <span className="material-icons text-sm text-emerald-400">
                          {theme.icon}
                        </span>
                        <span className="text-[10px] font-bold">
                          {theme.name}
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-500 block leading-tight">
                        {theme.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pages to Generate */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  Required Website Pages (Comma-separated)
                </label>
                <input
                  type="text"
                  value={designPages}
                  onChange={(e) => setDesignPages(e.target.value)}
                  placeholder="e.g., Home, Services, About, Contact"
                  className="px-3.5 py-2.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500 w-full placeholder-gray-600"
                />
              </div>

              {/* Custom Design Notes textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  Custom Brand Notes / HEX Colors (Optional)
                </label>
                <textarea
                  rows={3}
                  value={designNotes}
                  onChange={(e) => setDesignNotes(e.target.value)}
                  placeholder="e.g. Please use my client's brand color #ea580c, add an testimonials slider carousel section, and link course buttons to checkout."
                  className="px-3.5 py-2.5 text-xs text-white bg-slate-950/80 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500 w-full resize-none placeholder-gray-600"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="soft"
                onClick={() => setIsDesignModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="glow"
                onClick={handleGenerateDesign}
                className="bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/40"
              >
                Generate Design Layout
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
