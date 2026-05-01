"use client";

import React, { useState, useMemo } from "react";
import ticketsData from "../data/tickets.json";
import slaRulesData from "../data/sla_rules.json";
import agentsData from "../data/agents.json";

// ─── Helpers 

function safeParseDate(date) {
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeTicket(ticket) {
  return {
    id: ticket.id?.toString().trim() || "N/A",
    title: ticket.title?.trim() || "No Title",
    status: ticket.status?.trim().toUpperCase() || "OPEN",
    customerName: ticket.customerName?.trim() || "Unknown",
    customerTier: ticket.customerTier?.trim().toLowerCase() || "basic",
    priority: ticket.priority?.trim().toLowerCase() || "low",
    issueType: ticket.issueType?.trim().toLowerCase() || "general",
    assignedTo: ticket.assignedTo?.trim() || "Unassigned",
    channel: ticket.channel?.trim().toLowerCase() || "email",
    createdAt: safeParseDate(ticket.createdAt),
  };
}

function normalizeSLA(rule) {
  return {
    customerTier: rule.customerTier?.trim().toLowerCase(),
    priority: rule.priority?.trim().toLowerCase(),
    hours: Number(rule.hours) || 0,
  };
}

// Data 

const tickets = ticketsData.map(normalizeTicket);
const slaRules = slaRulesData.map(normalizeSLA);

// SLA Logic 

function getSLARule(ticket) {
  return slaRules.find(
    (r) =>
      r.customerTier === ticket.customerTier &&
      r.priority === ticket.priority
  ) || null;
}

function getSLAState(ticket, sla) {
  if (ticket.status === "RESOLVED") return "n/a";
  if (!sla) return "n/a";
  const elapsedHours =
    (Date.now() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
  if (elapsedHours > sla.hours) return "breached";
  if (elapsedHours >= 0.8 * sla.hours) return "at_risk";
  return "safe";
}

// SLA urgency rank: higher = more urgent
const SLA_URGENCY_RANK = { breached: 3, at_risk: 2, safe: 1, "n/a": 0 };

// ─── Escalation Score

function getEscalationScore(ticket, sla, slaState) {
  let score = 0;

  if (ticket.priority === "high") score += 30;
  else if (ticket.priority === "medium") score += 20;
  else score += 10;

  if (ticket.customerTier === "enterprise") score += 25;
  else if (ticket.customerTier === "premium") score += 15;
  else score += 5;

  if (ticket.assignedTo === "Unassigned") score += 20;

  const hours =
    (Date.now() - ticket.createdAt.getTime()) / (1000 * 60 * 60);

  if (sla) {
    if (hours > sla.hours) score += 15;
    else if (hours > 0.8 * sla.hours) score += 10;
  }

  if (slaState === "breached") score += 35;
  else if (slaState === "at_risk") score += 20;

  if (ticket.channel === "call") score += 10;

  return Math.min(score, 100);
}

// ─── Processed Tickets 

const processedTickets = tickets.map((ticket) => {
  const sla = getSLARule(ticket);
  const slaState = getSLAState(ticket, sla);
  const score = getEscalationScore(ticket, sla, slaState);
  return { ...ticket, slaState, score };
});

// ─── Derived filter options 

const ALL_STATUSES = ["ALL", ...new Set(processedTickets.map((t) => t.status))];
const ALL_TIERS = ["ALL", ...new Set(processedTickets.map((t) => t.customerTier))];
const ALL_ISSUE_TYPES = ["ALL", ...new Set(processedTickets.map((t) => t.issueType))];
const ALL_SLA_STATES = ["ALL", "safe", "at_risk", "breached", "n/a"];
const ALL_ASSIGNMENT = ["ALL", "assigned", "unassigned"];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "score_desc", label: "Escalation Score (High → Low)" },
  { value: "sla_urgency", label: "SLA Urgency (High → Low)" },
];

// ─── Styles 

const styles = {
  page: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: "#0f1117",
    minHeight: "100vh",
    padding: "32px 24px",
    color: "#e2e8f0",
  },
  header: {
    fontSize: "24px",
    fontWeight: "700",
    marginBottom: "24px",
    color: "#f8fafc",
    letterSpacing: "-0.5px",
  },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "12px",
    color: "#cbd5e1",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  agentGridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  },
  agentCard: (isSelected, overloadStatus) => ({
    padding: "12px",
    borderRadius: "8px",
    border: `2px solid ${isSelected ? "#3b82f6" : overloadStatus === "overload" ? "#ef4444" : overloadStatus === "at_capacity" ? "#f97316" : "#2d3748"}`,
    background: isSelected ? "#1e3a5f" : "#1e2433",
    cursor: "pointer",
    transition: "all 0.15s",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }),
  agentName: {
    fontWeight: "700",
    color: "#f8fafc",
    fontSize: "13px",
  },
  agentTeam: {
    fontSize: "11px",
    color: "#94a3b8",
  },
  agentTickets: {
    fontSize: "12px",
    color: "#cbd5e1",
  },
  overloadBadge: (status) => ({
    display: "inline-block",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: "600",
    background: status === "overload" ? "#7f1d1d" : status === "at_capacity" ? "#78350f" : "#1e293b",
    color: status === "overload" ? "#fca5a5" : status === "at_capacity" ? "#fcd34d" : "#94a3b8",
  }),
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#1e2433",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "700px",
    width: "90%",
    maxHeight: "80vh",
    overflowY: "auto",
    border: "1px solid #2d3748",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    marginBottom: "16px",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#f8fafc",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: "24px",
    cursor: "pointer",
    padding: "0",
  },
  modalField: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: "12px",
    marginBottom: "12px",
    alignItems: "start",
  },
  modalLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  modalValue: {
    fontSize: "13px",
    color: "#e2e8f0",
  },
  reassignSection: {
    marginTop: "20px",
    padding: "16px",
    background: "#151b2e",
    borderRadius: "8px",
    border: "1px solid #2d3748",
  },
  reassignSelect: {
    background: "#0f1117",
    border: "1px solid #2d3748",
    borderRadius: "6px",
    color: "#e2e8f0",
    padding: "8px 10px",
    fontSize: "13px",
    cursor: "pointer",
    marginBottom: "8px",
    width: "100%",
  },
  reassignBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    marginRight: "8px",
    transition: "all 0.15s",
  },
  cancelBtn: {
    background: "#1e2433",
    border: "1px solid #4a5568",
    borderRadius: "6px",
    color: "#94a3b8",
    padding: "8px 14px",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  actionBadge: (action) => {
    const map = {
      "ESCALATE_IMMEDIATELY": ["#7f1d1d", "#fca5a5"],
      "PRIORITIZE": ["#78350f", "#fcd34d"],
      "ASSIGN_AGENT": ["#312e81", "#c7d2fe"],
      "START_RESOLUTION": ["#1e3a8a", "#bfdbfe"],
      "MONITOR": ["#1e293b", "#94a3b8"],
    };
    const [bg, color] = map[action] || ["#1e293b", "#94a3b8"];
    return {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "600",
      background: bg,
      color,
    };
  },
  controlsBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "24px",
    alignItems: "flex-end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    fontSize: "11px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#94a3b8",
  },
  select: {
    background: "#1e2433",
    border: "1px solid #2d3748",
    borderRadius: "6px",
    color: "#e2e8f0",
    padding: "6px 10px",
    fontSize: "13px",
    cursor: "pointer",
    minWidth: "140px",
    outline: "none",
  },
  resetBtn: {
    background: "#1e2433",
    border: "1px solid #4a5568",
    borderRadius: "6px",
    color: "#94a3b8",
    padding: "6px 14px",
    fontSize: "13px",
    cursor: "pointer",
    marginTop: "auto",
    transition: "all 0.15s",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "10px",
    border: "1px solid #1e2d3d",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  thead: {
    background: "#151b2e",
  },
  th: {
    padding: "12px 16px",
    textAlign: "left",
    color: "#64748b",
    fontWeight: "600",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: "1px solid #1e2d3d",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "11px 16px",
    borderBottom: "1px solid #1a2236",
    verticalAlign: "middle",
  },
  trEven: { background: "#111827" },
  trOdd: { background: "#0f1117" },
  trClickable: {
    cursor: "pointer",
    transition: "background 0.15s",
  },
  badge: (bg, color = "#fff") => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: "600",
    background: bg,
    color,
    letterSpacing: "0.03em",
  }),
  scoreBar: (score) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  }),
  scoreBarFill: (score) => ({
    height: "6px",
    width: `${score}px`,
    maxWidth: "80px",
    background:
      score >= 70
        ? "#ef4444"
        : score >= 40
        ? "#f97316"
        : "#22c55e",
    borderRadius: "9999px",
  }),
  emptyRow: {
    textAlign: "center",
    padding: "32px",
    color: "#4a5568",
  },
  resultCount: {
    fontSize: "12px",
    color: "#4a5568",
    marginBottom: "10px",
  },
};

// ─── Badge helpers 

function StatusBadge({ status }) {
  const map = {
    OPEN: ["#1d4ed8", "#bfdbfe"],
    RESOLVED: ["#166534", "#bbf7d0"],
    PENDING: ["#92400e", "#fde68a"],
    "IN PROGRESS": ["#5b21b6", "#ddd6fe"],
  };
  const [bg, color] = map[status] || ["#374151", "#d1d5db"];
  return <span style={styles.badge(bg, color)}>{status}</span>;
}

function SLABadge({ state }) {
  const map = {
    breached: ["#7f1d1d", "#fca5a5"],
    at_risk: ["#78350f", "#fcd34d"],
    safe: ["#14532d", "#86efac"],
    "n/a": ["#1e293b", "#475569"],
  };
  const [bg, color] = map[state] || ["#1e293b", "#475569"];
  return <span style={styles.badge(bg, color)}>{state}</span>;
}

function PriorityBadge({ priority }) {
  const map = {
    high: ["#450a0a", "#fca5a5"],
    medium: ["#431407", "#fdba74"],
    low: ["#1e293b", "#94a3b8"],
  };
  const [bg, color] = map[priority] || ["#1e293b", "#94a3b8"];
  return <span style={styles.badge(bg, color)}>{priority}</span>;
}

function TierBadge({ tier }) {
  const map = {
    enterprise: ["#312e81", "#c7d2fe"],
    premium: ["#4a1d96", "#ddd6fe"],
    basic: ["#1e293b", "#94a3b8"],
  };
  const [bg, color] = map[tier] || ["#1e293b", "#94a3b8"];
  return <span style={styles.badge(bg, color)}>{tier}</span>;
}

function ScoreCell({ score }) {
  return (
    <div style={styles.scoreBar(score)}>
      <span style={{ minWidth: "28px", fontWeight: "600", color: score >= 70 ? "#ef4444" : score >= 40 ? "#f97316" : "#22c55e" }}>
        {score}
      </span>
      <div style={{ background: "#1e2433", borderRadius: "9999px", width: "80px", height: "6px" }}>
        <div style={styles.scoreBarFill(score)} />
      </div>
    </div>
  );
}

// ─── Helper: Get Recommended Action ───────────────────────────────────────────

function getRecommendedAction(ticket, slaState) {
  if (slaState === "breached") return "ESCALATE_IMMEDIATELY";
  if (slaState === "at_risk") return "PRIORITIZE";
  if (ticket.assignedTo === "Unassigned") return "ASSIGN_AGENT";
  if (ticket.priority === "high" && ticket.status !== "IN PROGRESS") return "START_RESOLUTION";
  return "MONITOR";
}

// ─── Helper: Calculate Agent Workload ───────────────────────────────────────────

function getAgentWorkload(agentName, ticketsList) {
  const activeTickets = ticketsList.filter((t) => t.assignedTo === agentName && t.status !== "RESOLVED");
  return activeTickets.length;
}

function getAgentOverloadStatus(activeCount, allAgents) {
  const avgWorkload = allAgents.reduce((sum, a) => sum + getAgentWorkload(a.name, processedTickets), 0) / allAgents.length;
  if (activeCount > avgWorkload * 1.3) return "overload";
  if (activeCount > avgWorkload) return "at_capacity";
  return "normal";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Page() {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterTier, setFilterTier] = useState("ALL");
  const [filterIssueType, setFilterIssueType] = useState("ALL");
  const [filterAssignment, setFilterAssignment] = useState("ALL");
  const [filterSLAState, setFilterSLAState] = useState("ALL");
  const [filterAgent, setFilterAgent] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reassignTo, setReassignTo] = useState(null);

  const resetFilters = () => {
    setFilterStatus("ALL");
    setFilterTier("ALL");
    setFilterIssueType("ALL");
    setFilterAssignment("ALL");
    setFilterSLAState("ALL");
    setFilterAgent("ALL");
    setSortBy("newest");
  };

  const result = useMemo(() => {
    // ── Filter ──
    let filtered = processedTickets.filter((t) => {
      if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
      if (filterTier !== "ALL" && t.customerTier !== filterTier) return false;
      if (filterIssueType !== "ALL" && t.issueType !== filterIssueType) return false;
      if (filterAgent !== "ALL" && t.assignedTo !== filterAgent) return false;
      if (filterAssignment !== "ALL") {
        const isUnassigned = t.assignedTo === "Unassigned";
        if (filterAssignment === "unassigned" && !isUnassigned) return false;
        if (filterAssignment === "assigned" && isUnassigned) return false;
      }
      if (filterSLAState !== "ALL" && t.slaState !== filterSLAState) return false;
      return true;
    });

    // ── Sort ──
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "newest") return b.createdAt - a.createdAt;
      if (sortBy === "oldest") return a.createdAt - b.createdAt;
      if (sortBy === "score_desc") return b.score - a.score;
      if (sortBy === "sla_urgency")
        return SLA_URGENCY_RANK[b.slaState] - SLA_URGENCY_RANK[a.slaState];
      return 0;
    });

    return sorted;
  }, [filterStatus, filterTier, filterIssueType, filterAssignment, filterSLAState, filterAgent, sortBy]);

  // Handle reassignment
  const handleReassign = () => {
    if (!selectedTicket || !reassignTo) return;
    
    const ticketIdx = processedTickets.findIndex((t) => t.id === selectedTicket.id);
    if (ticketIdx !== -1) {
      processedTickets[ticketIdx].assignedTo = reassignTo;
      setSelectedTicket({ ...processedTickets[ticketIdx] });
      setReassignTo(null);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.header}>🎫 Ticket Dashboard</h1>

      {/* ── Agent Workload Panel ── */}
      <div style={{ marginBottom: "32px" }}>
        <div style={styles.sectionTitle}>Agent Workload</div>
        <div style={styles.agentGridContainer}>
          {agentsData.map((agent) => {
            const workload = getAgentWorkload(agent.name, processedTickets);
            const overloadStatus = getAgentOverloadStatus(workload, agentsData);
            const isSelected = filterAgent === agent.name;
            
            return (
              <div
                key={agent.name}
                style={styles.agentCard(isSelected, overloadStatus)}
                onClick={() => {
                  if (filterAgent === agent.name) {
                    setFilterAgent("ALL");
                  } else {
                    setFilterAgent(agent.name);
                  }
                }}
              >
                <div style={styles.agentName}>{agent.name}</div>
                <div style={styles.agentTeam}>{agent.team}</div>
                <div style={styles.agentTickets}>
                  Active: {workload} ticket{workload !== 1 ? "s" : ""}
                </div>
                <div style={styles.overloadBadge(overloadStatus)}>
                  {overloadStatus === "overload" ? "⚠️ Overload" : overloadStatus === "at_capacity" ? "⚠️ At Capacity" : "✓ Normal"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Controls Bar ── */}
      <div style={styles.controlsBar}>
        <div style={styles.filterGroup}>
          <span style={styles.label}>Status</span>
          <select style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <span style={styles.label}>Customer Tier</span>
          <select style={styles.select} value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
            {ALL_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <span style={styles.label}>Issue Type</span>
          <select style={styles.select} value={filterIssueType} onChange={(e) => setFilterIssueType(e.target.value)}>
            {ALL_ISSUE_TYPES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <span style={styles.label}>Assignment</span>
          <select style={styles.select} value={filterAssignment} onChange={(e) => setFilterAssignment(e.target.value)}>
            {ALL_ASSIGNMENT.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <span style={styles.label}>SLA State</span>
          <select style={styles.select} value={filterSLAState} onChange={(e) => setFilterSLAState(e.target.value)}>
            {ALL_SLA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <span style={styles.label}>Sort By</span>
          <select style={styles.select} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <button style={styles.resetBtn} onClick={resetFilters}>
          ↺ Reset
        </button>
      </div>

      {/* ── Result Count ── */}
      <div style={styles.resultCount}>
        Showing {result.length} of {processedTickets.length} tickets
      </div>

      {/* ── Table ── */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              {["ID", "Title", "Status", "Priority", "Issue Type", "SLA State", "Escalation Score", "Customer", "Tier", "Agent", "Created"].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.length === 0 ? (
              <tr>
                <td colSpan={11} style={styles.emptyRow}>
                  No tickets match the selected filters.
                </td>
              </tr>
            ) : (
              result.map((ticket, idx) => (
                <tr 
                  key={ticket.id} 
                  style={{ 
                    ...(idx % 2 === 0 ? styles.trEven : styles.trOdd),
                    ...styles.trClickable,
                  }}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <td style={{ ...styles.td, color: "#64748b", fontFamily: "monospace" }}>{ticket.id}</td>
                  <td style={{ ...styles.td, maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.title}</td>
                  <td style={styles.td}><StatusBadge status={ticket.status} /></td>
                  <td style={styles.td}><PriorityBadge priority={ticket.priority} /></td>
                  <td style={{ ...styles.td, color: "#94a3b8" }}>{ticket.issueType}</td>
                  <td style={styles.td}><SLABadge state={ticket.slaState} /></td>
                  <td style={styles.td}><ScoreCell score={ticket.score} /></td>
                  <td style={{ ...styles.td, color: "#e2e8f0" }}>{ticket.customerName}</td>
                  <td style={styles.td}><TierBadge tier={ticket.customerTier} /></td>
                  <td style={{ ...styles.td, color: ticket.assignedTo === "Unassigned" ? "#ef4444" : "#94a3b8" }}>
                    {ticket.assignedTo}
                  </td>
                  <td style={{ ...styles.td, color: "#64748b", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {ticket.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Ticket Detail Modal ── */}
      {selectedTicket && (
        <div style={styles.modalOverlay} onClick={() => {
          setSelectedTicket(null);
          setReassignTo(null);
        }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Ticket Details</div>
              <button 
                style={styles.closeBtn}
                onClick={() => {
                  setSelectedTicket(null);
                  setReassignTo(null);
                }}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>ID</div>
              <div style={styles.modalValue}>{selectedTicket.id}</div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Title</div>
              <div style={styles.modalValue}>{selectedTicket.title}</div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Description</div>
              <div style={styles.modalValue}>{selectedTicket.description || "N/A"}</div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Status</div>
              <div style={styles.modalValue}><StatusBadge status={selectedTicket.status} /></div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Priority</div>
              <div style={styles.modalValue}><PriorityBadge priority={selectedTicket.priority} /></div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Customer</div>
              <div style={styles.modalValue}>{selectedTicket.customerName}</div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Tier</div>
              <div style={styles.modalValue}><TierBadge tier={selectedTicket.customerTier} /></div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Issue Type</div>
              <div style={styles.modalValue}>{selectedTicket.issueType}</div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Channel</div>
              <div style={styles.modalValue}>{selectedTicket.channel}</div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Current Agent</div>
              <div style={{ ...styles.modalValue, color: selectedTicket.assignedTo === "Unassigned" ? "#ef4444" : "#94a3b8" }}>
                {selectedTicket.assignedTo}
              </div>
            </div>

            <div style={styles.modalField}>
              <div style={styles.modalLabel}>Created</div>
              <div style={styles.modalValue}>{selectedTicket.createdAt.toLocaleString()}</div>
            </div>

            {/* SLA Details */}
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #2d3748" }}>
              <div style={{...styles.sectionTitle, marginBottom: "8px"}}>SLA Details</div>
              <div style={styles.modalField}>
                <div style={styles.modalLabel}>SLA State</div>
                <div style={styles.modalValue}><SLABadge state={selectedTicket.slaState} /></div>
              </div>

              {(() => {
                const sla = getSLARule(selectedTicket);
                return (
                  <>
                    <div style={styles.modalField}>
                      <div style={styles.modalLabel}>SLA Hours</div>
                      <div style={styles.modalValue}>{sla ? `${sla.hours} hours` : "N/A"}</div>
                    </div>
                    <div style={styles.modalField}>
                      <div style={styles.modalLabel}>Elapsed</div>
                      <div style={styles.modalValue}>
                        {((Date.now() - selectedTicket.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Escalation Score */}
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #2d3748" }}>
              <div style={{...styles.sectionTitle, marginBottom: "8px"}}>Escalation & Action</div>
              <div style={styles.modalField}>
                <div style={styles.modalLabel}>Escalation Score</div>
                <div style={styles.modalValue}>
                  <ScoreCell score={selectedTicket.score} />
                </div>
              </div>
              <div style={styles.modalField}>
                <div style={styles.modalLabel}>Recommended Action</div>
                <div style={styles.modalValue}>
                  <span style={styles.actionBadge(getRecommendedAction(selectedTicket, selectedTicket.slaState))}>
                    {getRecommendedAction(selectedTicket, selectedTicket.slaState).replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Reassignment Section */}
            <div style={styles.reassignSection}>
              <div style={{...styles.sectionTitle, marginBottom: "10px"}}>Reassign Ticket</div>
              <select 
                style={styles.reassignSelect}
                value={reassignTo || ""}
                onChange={(e) => setReassignTo(e.target.value || null)}
              >
                <option value="">Select an agent...</option>
                {agentsData.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name} ({a.team})
                  </option>
                ))}
              </select>
              <div>
                <button 
                  style={styles.reassignBtn}
                  onClick={handleReassign}
                  disabled={!reassignTo || reassignTo === selectedTicket.assignedTo}
                >
                  Reassign
                </button>
                <button 
                  style={styles.cancelBtn}
                  onClick={() => {
                    setSelectedTicket(null);
                    setReassignTo(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}