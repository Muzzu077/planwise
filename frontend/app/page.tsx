"use client";

import { useState, useRef, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────

interface Room {
  name: string;
  room_type: string;
  x: number;
  y: number;
  width: number;
  length: number;
  area: number;
}

interface Corridor {
  x: number;
  y: number;
  width: number;
  length: number;
}

interface CostBreakdown {
  total_cost: number;
  materials: number;
  labor: number;
  plumbing_electrical: number;
  finishing: number;
  miscellaneous: number;
}

interface PhaseWiseCost {
  foundation: number;
  structure: number;
  brickwork_plastering: number;
  plumbing_electrical: number;
  flooring: number;
  doors_windows: number;
  painting_finishing: number;
  miscellaneous: number;
}

interface BudgetAnalysis {
  budget: number;
  estimated_cost: number;
  within_budget: boolean;
  difference: number;
  suggestion: string;
}

interface Variation {
  variation_name: string;
  variation_description: string;
  success: boolean;
  plot_area: number;
  buildable_area: number;
  built_area: number;
  rooms: Room[];
  corridor: Corridor | null;
  cost: CostBreakdown;
  phase_wise_cost: PhaseWiseCost;
  explanations: string[];
  warnings: string[];
  vastu_notes: string[];
  budget_analysis: BudgetAnalysis | null;
}

interface PlanResult {
  success: boolean;
  plot_area: number;
  buildable_area: number;
  built_area: number;
  rooms: Room[];
  corridor: Corridor | null;
  cost: CostBreakdown;
  phase_wise_cost: PhaseWiseCost;
  explanations: string[];
  warnings: string[];
  vastu_notes: string[];
  budget_analysis: BudgetAnalysis | null;
  variations: Variation[];
}

// ─── Constants ───────────────────────────────────────────

const ROOM_COLORS: Record<string, { fill: string; stroke: string; bg: string }> = {
  living_room:       { fill: "#6366f1", stroke: "#818cf8", bg: "rgba(99,102,241,0.15)" },
  master_bedroom:    { fill: "#8b5cf6", stroke: "#a78bfa", bg: "rgba(139,92,246,0.15)" },
  bedroom:           { fill: "#a855f7", stroke: "#c084fc", bg: "rgba(168,85,247,0.15)" },
  kitchen:           { fill: "#f59e0b", stroke: "#fbbf24", bg: "rgba(245,158,11,0.15)" },
  dining:            { fill: "#10b981", stroke: "#34d399", bg: "rgba(16,185,129,0.15)" },
  bathroom_attached: { fill: "#06b6d4", stroke: "#22d3ee", bg: "rgba(6,182,212,0.15)" },
  bathroom_common:   { fill: "#0ea5e9", stroke: "#38bdf8", bg: "rgba(14,165,233,0.15)" },
  pooja_room:        { fill: "#f97316", stroke: "#fb923c", bg: "rgba(249,115,22,0.15)" },
  staircase:         { fill: "#64748b", stroke: "#94a3b8", bg: "rgba(100,116,139,0.15)" },
  parking:           { fill: "#78716c", stroke: "#a8a29e", bg: "rgba(120,113,108,0.15)" },
};

const ROOM_ICONS: Record<string, string> = {
  living_room: "🛋️",
  master_bedroom: "🛏️",
  bedroom: "🛏️",
  kitchen: "🍳",
  dining: "🍽️",
  bathroom_attached: "🚿",
  bathroom_common: "🚿",
  pooja_room: "🪔",
  staircase: "🪜",
  parking: "🚗",
};

const FEATURES = [
  { icon: "📐", title: "Smart Constraints", desc: "Real building rules, setbacks & ventilation" },
  { icon: "🪷", title: "Vastu Compliant", desc: "Traditional directional placement rules" },
  { icon: "💰", title: "Cost Estimation", desc: "Phase-wise breakdown with material costs" },
  { icon: "📄", title: "PDF Export", desc: "Download your plan as a shareable PDF" },
];

// ─── Helpers ─────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Floor Plan SVG Component ────────────────────────────

function FloorPlanView({
  rooms,
  corridor,
  buildableLength,
  buildableWidth,
  facing,
  hoveredRoom,
  onRoomHover,
}: {
  rooms: Room[];
  corridor: Corridor | null;
  buildableLength: number;
  buildableWidth: number;
  facing: string;
  hoveredRoom: number | null;
  onRoomHover: (index: number | null) => void;
}) {
  const padding = 35;
  const maxViewWidth = 600;
  const maxViewHeight = 440;

  const scaleX = (maxViewWidth - padding * 2) / buildableLength;
  const scaleY = (maxViewHeight - padding * 2) / buildableWidth;
  const scale = Math.min(scaleX, scaleY);

  const svgWidth = buildableLength * scale + padding * 2;
  const svgHeight = buildableWidth * scale + padding * 2;

  const wallThickness = 1.5;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full"
      style={{ maxHeight: "500px" }}
    >
      <defs>
        {rooms.map((room, i) => {
          const colors = ROOM_COLORS[room.room_type] || { fill: "#64748b", stroke: "#94a3b8" };
          return (
            <linearGradient key={`grad-${i}`} id={`roomGrad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.fill} stopOpacity={hoveredRoom === i ? 0.35 : 0.18} />
              <stop offset="100%" stopColor={colors.stroke} stopOpacity={hoveredRoom === i ? 0.25 : 0.1} />
            </linearGradient>
          );
        })}
        <pattern id="corridorPattern" patternUnits="userSpaceOnUse" width="8" height="8">
          <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="rgba(100,116,139,0.15)" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Background */}
      <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#0f172a" rx="8" />

      {/* Outer walls (buildable boundary) */}
      <rect
        x={padding - wallThickness}
        y={padding - wallThickness}
        width={buildableLength * scale + wallThickness * 2}
        height={buildableWidth * scale + wallThickness * 2}
        fill="none"
        stroke="#475569"
        strokeWidth={wallThickness * 2}
        rx="2"
      />

      {/* Plot boundary dashed */}
      <rect
        x={padding}
        y={padding}
        width={buildableLength * scale}
        height={buildableWidth * scale}
        fill="rgba(30,41,59,0.3)"
        stroke="none"
      />

      {/* Corridor */}
      {corridor && (
        <g>
          <rect
            x={padding + corridor.x * scale}
            y={padding + corridor.y * scale}
            width={corridor.width * scale}
            height={corridor.length * scale}
            fill="url(#corridorPattern)"
            stroke="#334155"
            strokeWidth="0.5"
            strokeDasharray="4,3"
          />
          <text
            x={padding + (corridor.x + corridor.width / 2) * scale}
            y={padding + (corridor.y + corridor.length / 2) * scale}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#475569"
            fontSize="8"
            fontFamily="var(--font-sans)"
            fontStyle="italic"
          >
            Corridor ({corridor.length.toFixed(1)}ft)
          </text>
        </g>
      )}

      {/* Rooms */}
      {rooms.map((room, i) => {
        const rx = padding + room.x * scale;
        const ry = padding + room.y * scale;
        const rw = room.width * scale;
        const rh = room.length * scale;
        const colors = ROOM_COLORS[room.room_type] || { fill: "#64748b", stroke: "#94a3b8" };
        const isHovered = hoveredRoom === i;

        return (
          <g
            key={i}
            onMouseEnter={() => onRoomHover(i)}
            onMouseLeave={() => onRoomHover(null)}
            style={{ cursor: "pointer" }}
          >
            {/* Room fill */}
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              fill={`url(#roomGrad-${i})`}
              stroke={isHovered ? colors.stroke : colors.fill}
              strokeWidth={isHovered ? 2.5 : wallThickness}
              rx="2"
              style={{ transition: "all 0.2s" }}
            />

            {/* Door indicator (small gap on the room edge closest to corridor or entrance) */}
            {rw > 20 && rh > 20 && (
              <rect
                x={rx + rw / 2 - 5}
                y={ry + rh - 1.5}
                width={10}
                height={3}
                fill={colors.fill}
                opacity={0.6}
                rx="1"
              />
            )}

            {/* Room name */}
            <text
              x={rx + rw / 2}
              y={ry + rh / 2 - (rh > 40 ? 8 : 2)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isHovered ? "#fff" : colors.stroke}
              fontWeight="600"
              fontSize={Math.min(Math.max(rw / 8, 8), 12)}
              fontFamily="var(--font-sans)"
              style={{ transition: "fill 0.2s" }}
            >
              {room.name}
            </text>

            {/* Dimensions */}
            {rh > 35 && (
              <text
                x={rx + rw / 2}
                y={ry + rh / 2 + 8}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#64748b"
                fontSize={Math.min(Math.max(rw / 10, 7), 10)}
                fontFamily="var(--font-sans)"
              >
                {room.width}&apos;×{room.length}&apos;
              </text>
            )}

            {/* Area */}
            {rh > 50 && (
              <text
                x={rx + rw / 2}
                y={ry + rh / 2 + 20}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#475569"
                fontSize={Math.min(Math.max(rw / 12, 6), 9)}
                fontFamily="var(--font-sans)"
              >
                {room.area} sqft
              </text>
            )}

            {/* Dimension lines on hover */}
            {isHovered && (
              <>
                {/* Width dimension line (top) */}
                <line x1={rx} y1={ry - 6} x2={rx + rw} y2={ry - 6} stroke={colors.stroke} strokeWidth="0.8" />
                <line x1={rx} y1={ry - 9} x2={rx} y2={ry - 3} stroke={colors.stroke} strokeWidth="0.8" />
                <line x1={rx + rw} y1={ry - 9} x2={rx + rw} y2={ry - 3} stroke={colors.stroke} strokeWidth="0.8" />
                <text x={rx + rw / 2} y={ry - 10} textAnchor="middle" fill={colors.stroke} fontSize="7" fontFamily="var(--font-sans)">
                  {room.width}ft
                </text>
                {/* Length dimension line (right) */}
                <line x1={rx + rw + 6} y1={ry} x2={rx + rw + 6} y2={ry + rh} stroke={colors.stroke} strokeWidth="0.8" />
                <line x1={rx + rw + 3} y1={ry} x2={rx + rw + 9} y2={ry} stroke={colors.stroke} strokeWidth="0.8" />
                <line x1={rx + rw + 3} y1={ry + rh} x2={rx + rw + 9} y2={ry + rh} stroke={colors.stroke} strokeWidth="0.8" />
              </>
            )}
          </g>
        );
      })}

      {/* Overall dimension labels */}
      <text
        x={padding + (buildableLength * scale) / 2}
        y={svgHeight - 6}
        textAnchor="middle"
        fill="#64748b"
        fontSize="10"
        fontFamily="var(--font-sans)"
      >
        {buildableLength.toFixed(0)}ft
      </text>
      <text
        x={svgWidth - 6}
        y={padding + (buildableWidth * scale) / 2}
        textAnchor="middle"
        fill="#64748b"
        fontSize="10"
        fontFamily="var(--font-sans)"
        transform={`rotate(90, ${svgWidth - 6}, ${padding + (buildableWidth * scale) / 2})`}
      >
        {buildableWidth.toFixed(0)}ft
      </text>

      {/* Compass Rose */}
      <g transform={`translate(${svgWidth - 30}, 26)`}>
        <circle cx="0" cy="0" r="14" fill="rgba(30,41,59,0.8)" stroke="#334155" strokeWidth="1" />
        <text x="0" y="-4" textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="700" fontFamily="var(--font-sans)">N</text>
        <polygon points="0,-11 -3,-6 3,-6" fill="#6366f1" />
        <text x="0" y="10" textAnchor="middle" fill="#475569" fontSize="5" fontFamily="var(--font-sans)">S</text>
        <text x="-9" y="3" textAnchor="middle" fill="#475569" fontSize="5" fontFamily="var(--font-sans)">W</text>
        <text x="9" y="3" textAnchor="middle" fill="#475569" fontSize="5" fontFamily="var(--font-sans)">E</text>
      </g>

      {/* Road indicator */}
      <g>
        {facing === "north" && (
          <>
            <line x1={padding} y1={padding - 10} x2={padding + buildableLength * scale} y2={padding - 10} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" />
            <text x={padding + (buildableLength * scale) / 2} y={padding - 16} textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="600" fontFamily="var(--font-sans)">ROAD</text>
          </>
        )}
        {facing === "south" && (
          <>
            <line x1={padding} y1={padding + buildableWidth * scale + 10} x2={padding + buildableLength * scale} y2={padding + buildableWidth * scale + 10} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" />
            <text x={padding + (buildableLength * scale) / 2} y={padding + buildableWidth * scale + 20} textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="600" fontFamily="var(--font-sans)">ROAD</text>
          </>
        )}
        {facing === "east" && (
          <>
            <line x1={padding + buildableLength * scale + 10} y1={padding} x2={padding + buildableLength * scale + 10} y2={padding + buildableWidth * scale} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" />
            <text x={padding + buildableLength * scale + 16} y={padding + (buildableWidth * scale) / 2} textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="600" fontFamily="var(--font-sans)" transform={`rotate(90, ${padding + buildableLength * scale + 16}, ${padding + (buildableWidth * scale) / 2})`}>ROAD</text>
          </>
        )}
        {facing === "west" && (
          <>
            <line x1={padding - 10} y1={padding} x2={padding - 10} y2={padding + buildableWidth * scale} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" />
            <text x={padding - 16} y={padding + (buildableWidth * scale) / 2} textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="600" fontFamily="var(--font-sans)" transform={`rotate(-90, ${padding - 16}, ${padding + (buildableWidth * scale) / 2})`}>ROAD</text>
          </>
        )}
      </g>
    </svg>
  );
}

// ─── Donut Chart Component ───────────────────────────────

function DonutChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const size = 180;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
        {data.map((item, i) => {
          const pct = item.value / total;
          const offset = circumference * (1 - accumulated);
          accumulated += pct;
          return (
            <circle
              key={i}
              cx={size/2}
              cy={size/2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference * pct} ${circumference * (1 - pct)}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size/2} ${size/2})`}
              style={{ transition: "all 0.8s ease-out" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total</span>
        <span className="text-lg font-bold text-white">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

// ─── PDF Export ──────────────────────────────────────────

async function exportPDF(
  result: PlanResult,
  form: { plot_length: number; plot_width: number; house_type: string; facing: string; cost_tier: string; vastu_compliant: boolean },
  planContainerRef: React.RefObject<HTMLDivElement | null>
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = 800;
  const H = 1100;
  canvas.width = W;
  canvas.height = H;

  // Background
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, W, H);

  // Header gradient bar
  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, "#6366f1");
  headerGrad.addColorStop(1, "#a855f7");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, 80);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Inter, system-ui, sans-serif";
  ctx.fillText("PlanWise", 30, 52);
  ctx.font = "14px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Pre-Construction Intelligence System", 170, 52);

  let y = 110;

  // Plot info
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillText("PLOT DETAILS", 30, y);
  y += 25;
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "14px Inter, system-ui, sans-serif";
  ctx.fillText(`Plot: ${form.plot_length}×${form.plot_width} ft (${result.plot_area} sqft)  |  Type: ${form.house_type}  |  Facing: ${form.facing}  |  Vastu: ${form.vastu_compliant ? 'Yes' : 'No'}`, 30, y);
  y += 15;
  ctx.fillText(`Buildable Area: ${result.buildable_area} sqft  |  Built Area: ${result.built_area} sqft  |  Tier: ${form.cost_tier}`, 30, y);
  y += 35;

  ctx.fillStyle = "#334155";
  ctx.fillRect(30, y, W - 60, 1);
  y += 25;

  // Floor Plan SVG
  const svgEl = planContainerRef.current?.querySelector("svg");
  if (svgEl) {
    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const planW = W - 60;
          const planH = 300;
          ctx.fillStyle = "#111827";
          ctx.fillRect(30, y, planW, planH);
          const aspectRatio = img.width / img.height;
          let drawW = planW;
          let drawH = planW / aspectRatio;
          if (drawH > planH) {
            drawH = planH;
            drawW = planH * aspectRatio;
          }
          ctx.drawImage(img, 30 + (planW - drawW) / 2, y + (planH - drawH) / 2, drawW, drawH);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
      y += 310;
    } catch {
      y += 10;
    }
  }

  // Room details table
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillText("ROOM DETAILS", 30, y);
  y += 20;

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(30, y, W - 60, 24);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.fillText("Room", 40, y + 16);
  ctx.fillText("Size", 300, y + 16);
  ctx.fillText("Area", 450, y + 16);
  ctx.fillText("Position", 580, y + 16);
  y += 24;

  result.rooms.forEach((room, i) => {
    ctx.fillStyle = i % 2 === 0 ? "#111827" : "#0f172a";
    ctx.fillRect(30, y, W - 60, 22);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillText(room.name, 40, y + 15);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`${room.width}' × ${room.length}'`, 300, y + 15);
    ctx.fillText(`${room.area} sqft`, 450, y + 15);
    ctx.fillText(`(${room.x}, ${room.y})`, 580, y + 15);
    y += 22;
  });
  y += 20;

  // Cost summary
  ctx.fillStyle = "#334155";
  ctx.fillRect(30, y, W - 60, 1);
  y += 20;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillText("COST ESTIMATION", 30, y);
  y += 20;

  const costItems = [
    ["Materials", result.cost.materials],
    ["Labor", result.cost.labor],
    ["Plumbing & Electrical", result.cost.plumbing_electrical],
    ["Finishing", result.cost.finishing],
    ["Miscellaneous", result.cost.miscellaneous],
  ] as const;

  costItems.forEach(([label, value]) => {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillText(label, 40, y + 14);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(formatCurrency(value), 300, y + 14);
    y += 22;
  });

  y += 5;
  const totalGrad = ctx.createLinearGradient(30, y, 350, y);
  totalGrad.addColorStop(0, "#10b981");
  totalGrad.addColorStop(1, "#06b6d4");
  ctx.fillStyle = totalGrad;
  ctx.fillRect(30, y, 340, 30);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Inter, system-ui, sans-serif";
  ctx.fillText(`Total Estimated Cost: ${formatCurrency(result.cost.total_cost)}`, 40, y + 20);
  y += 50;

  // Budget analysis
  if (result.budget_analysis) {
    ctx.fillStyle = result.budget_analysis.within_budget ? "#10b981" : "#ef4444";
    ctx.font = "bold 12px Inter, system-ui, sans-serif";
    ctx.fillText(
      result.budget_analysis.within_budget
        ? `✓ Within Budget (₹${result.budget_analysis.difference.toLocaleString("en-IN")} remaining)`
        : `✗ Over Budget by ₹${Math.abs(result.budget_analysis.difference).toLocaleString("en-IN")}`,
      30, y
    );
    y += 25;
  }

  // Disclaimer
  ctx.fillStyle = "#475569";
  ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.fillText("DISCLAIMER: This is a pre-construction planning aid, not a certified architectural plan.", 30, H - 40);
  ctx.fillText("Always consult a licensed architect/engineer before starting construction.", 30, H - 26);

  // Download
  const link = document.createElement("a");
  link.download = `PlanWise_${form.house_type}_${form.plot_length}x${form.plot_width}.png`;
  link.href = canvas.toDataURL("image/png", 1.0);
  link.click();
}

// ─── Validation ─────────────────────────────────────────

interface ValidationErrors {
  plot_length?: string;
  plot_width?: string;
  budget?: string;
}

function validateForm(form: {
  plot_length: number;
  plot_width: number;
  budget: string;
  house_type: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  if (form.plot_length < 15) errors.plot_length = "Minimum 15 ft required";
  else if (form.plot_length > 200) errors.plot_length = "Maximum 200 ft allowed";

  if (form.plot_width < 15) errors.plot_width = "Minimum 15 ft required";
  else if (form.plot_width > 200) errors.plot_width = "Maximum 200 ft allowed";

  const area = form.plot_length * form.plot_width;
  const minAreas: Record<string, number> = {
    "1BHK": 400, "2BHK": 800, "3BHK": 1200,
    "2BHK_with_pooja": 900, "3BHK_with_pooja": 1400,
  };
  const minArea = minAreas[form.house_type] || 400;
  if (area < minArea && !errors.plot_length && !errors.plot_width) {
    errors.plot_width = `Plot area (${area} sqft) too small for ${form.house_type}. Need ${minArea}+ sqft`;
  }

  if (form.budget && parseFloat(form.budget) < 100000) {
    errors.budget = "Budget must be at least ₹1,00,000";
  }

  return errors;
}

// ─── Main Page Component ─────────────────────────────────

export default function Home() {
  const [form, setForm] = useState({
    plot_length: 50,
    plot_width: 30,
    house_type: "2BHK",
    floors: 1,
    facing: "east",
    vastu_compliant: true,
    cost_tier: "standard",
    parking: false,
    budget: "",
  });

  const [result, setResult] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "cost" | "details">("plan");
  const [hoveredRoom, setHoveredRoom] = useState<number | null>(null);
  const [showHero, setShowHero] = useState(true);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const planContainerRef = useRef<HTMLDivElement>(null);
  const plannerRef = useRef<HTMLDivElement>(null);

  const scrollToPlanner = useCallback(() => {
    setShowHero(false);
    setTimeout(() => {
      plannerRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  // Get active variation data
  const activeData = result?.variations && result.variations.length > 0
    ? result.variations[selectedVariation] || result
    : result;

  async function handleGenerate() {
    // Validate
    const errors = validateForm(form);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedVariation(0);

    try {
      const payload: Record<string, unknown> = { ...form };
      if (form.budget) {
        payload.budget = parseFloat(form.budget);
      } else {
        delete payload.budget;
      }

      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail?.error || "Failed to generate plan");
      }

      const data: PlanResult = await res.json();
      setResult(data);
      setActiveTab("plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Buildable dimensions for the SVG
  const setbacks = { front: 5, rear: 3, left: 3, right: 3 };
  const buildableLength =
    form.facing === "north" || form.facing === "south"
      ? form.plot_length - setbacks.left - setbacks.right
      : form.plot_length - setbacks.front - setbacks.rear;
  const buildableWidth =
    form.facing === "north" || form.facing === "south"
      ? form.plot_width - setbacks.front - setbacks.rear
      : form.plot_width - setbacks.left - setbacks.right;

  const plotArea = form.plot_length * form.plot_width;

  // Use activeData for display
  const displayRooms = activeData?.rooms || [];
  const displayCorridor = activeData?.corridor || null;
  const displayCost = activeData?.cost;
  const displayPhase = activeData?.phase_wise_cost;
  const displayExplanations = activeData?.explanations || [];
  const displayWarnings = activeData?.warnings || [];
  const displayVastuNotes = activeData?.vastu_notes || [];
  const displayBudget = activeData?.budget_analysis || null;

  // Cost donut data
  const costDonutData = displayCost
    ? [
        { label: "Materials", value: displayCost.materials, color: "#6366f1" },
        { label: "Labor", value: displayCost.labor, color: "#06b6d4" },
        { label: "Plumbing & Electrical", value: displayCost.plumbing_electrical, color: "#f59e0b" },
        { label: "Finishing", value: displayCost.finishing, color: "#10b981" },
        { label: "Miscellaneous", value: displayCost.miscellaneous, color: "#a855f7" },
      ]
    : [];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* ═══ HEADER ═══ */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(10, 14, 26, 0.8)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "var(--gradient-primary)" }}
            >
              P
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Plan<span style={{ color: "var(--accent-primary-light)" }}>Wise</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <button
                className="btn-secondary"
                onClick={() => exportPDF(result, form, planContainerRef)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export PDF
              </button>
            )}
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wider uppercase"
              style={{
                background: "rgba(99,102,241,0.15)",
                color: "var(--accent-primary-light)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              v2.0
            </span>
          </div>
        </div>
      </header>

      {/* ═══ HERO SECTION ═══ */}
      {showHero && (
        <section
          className="relative overflow-hidden"
          style={{
            background: "var(--gradient-hero)",
            minHeight: "85vh",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div className="hero-grid" />
          <div className="hero-orb" style={{ width: 400, height: 400, background: "#6366f1", top: "-10%", left: "10%" }} />
          <div className="hero-orb" style={{ width: 300, height: 300, background: "#a855f7", bottom: "-5%", right: "15%" }} />
          <div className="hero-orb" style={{ width: 200, height: 200, background: "#06b6d4", top: "40%", right: "5%" }} />

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
            <div className="animate-fade-in-up">
              <span
                className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-6"
                style={{
                  background: "rgba(99,102,241,0.12)",
                  color: "var(--accent-primary-light)",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                Pre-Construction Intelligence System
              </span>
            </div>

            <h2
              className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 animate-fade-in-up delay-150"
              style={{ color: "#fff", lineHeight: 1.1 }}
            >
              Plan Your
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #818cf8, #c084fc, #22d3ee)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Dream Home
              </span>
            </h2>

            <p
              className="text-lg md:text-xl max-w-2xl mx-auto mb-10 animate-fade-in-up delay-300"
              style={{ color: "#94a3b8", lineHeight: 1.7 }}
            >
              Enter your plot dimensions and requirements. Get a realistic,
              constraint-validated floor plan with Vastu compliance, cost estimation,
              and construction guidance — in seconds.
            </p>

            <div className="animate-fade-in-up delay-400">
              <button
                onClick={scrollToPlanner}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg"
                style={{
                  background: "var(--gradient-primary)",
                  boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
                  transition: "all 0.3s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(99,102,241,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.3)";
                }}
              >
                Start Planning
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 animate-fade-in-up delay-500">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="glass-card p-5 text-center"
                  style={{ animationDelay: `${600 + i * 100}ms` }}
                >
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <div className="text-sm font-semibold text-white mb-1">{f.title}</div>
                  <div className="text-xs" style={{ color: "#64748b" }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ PLANNER SECTION ═══ */}
      <main
        ref={plannerRef}
        className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── INPUT PANEL ─── */}
          <div className="lg:col-span-4">
            <div className="glass-card p-6 sticky top-20">
              <div className="flex items-center gap-2 mb-5">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.15)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-white">Plot Details</h2>
              </div>

              <div className="space-y-5">
                {/* Plot dimensions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Length (ft)</label>
                    <input
                      type="number"
                      value={form.plot_length}
                      onChange={(e) => {
                        setForm({ ...form, plot_length: +e.target.value });
                        setValidationErrors((v) => ({ ...v, plot_length: undefined }));
                      }}
                      className={`input-field ${validationErrors.plot_length ? "!border-red-500" : ""}`}
                      min={15}
                      max={200}
                    />
                    {validationErrors.plot_length && (
                      <p className="text-[11px] mt-1" style={{ color: "#ef4444" }}>{validationErrors.plot_length}</p>
                    )}
                  </div>
                  <div>
                    <label className="input-label">Width (ft)</label>
                    <input
                      type="number"
                      value={form.plot_width}
                      onChange={(e) => {
                        setForm({ ...form, plot_width: +e.target.value });
                        setValidationErrors((v) => ({ ...v, plot_width: undefined }));
                      }}
                      className={`input-field ${validationErrors.plot_width ? "!border-red-500" : ""}`}
                      min={15}
                      max={200}
                    />
                    {validationErrors.plot_width && (
                      <p className="text-[11px] mt-1" style={{ color: "#ef4444" }}>{validationErrors.plot_width}</p>
                    )}
                  </div>
                </div>

                {/* Plot area display */}
                <div
                  className="rounded-lg p-3 flex items-center justify-between"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Plot Area
                  </span>
                  <span className="text-base font-bold" style={{ color: "var(--accent-primary-light)" }}>
                    {plotArea.toLocaleString()} sqft
                  </span>
                </div>

                {/* House type */}
                <div>
                  <label className="input-label">House Type</label>
                  <select
                    value={form.house_type}
                    onChange={(e) => setForm({ ...form, house_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="1BHK">1 BHK</option>
                    <option value="2BHK">2 BHK</option>
                    <option value="3BHK">3 BHK</option>
                    <option value="2BHK_with_pooja">2 BHK + Pooja Room</option>
                    <option value="3BHK_with_pooja">3 BHK + Pooja Room</option>
                  </select>
                </div>

                {/* Floors & Facing */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Floors</label>
                    <select
                      value={form.floors}
                      onChange={(e) => setForm({ ...form, floors: +e.target.value })}
                      className="input-field"
                    >
                      <option value={1}>Ground Floor</option>
                      <option value={2}>G + 1</option>
                      <option value={3}>G + 2</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Road Facing</label>
                    <select
                      value={form.facing}
                      onChange={(e) => setForm({ ...form, facing: e.target.value })}
                      className="input-field"
                    >
                      <option value="north">North</option>
                      <option value="south">South</option>
                      <option value="east">East</option>
                      <option value="west">West</option>
                    </select>
                  </div>
                </div>

                {/* Cost tier */}
                <div>
                  <label className="input-label">Construction Quality</label>
                  <select
                    value={form.cost_tier}
                    onChange={(e) => setForm({ ...form, cost_tier: e.target.value })}
                    className="input-field"
                  >
                    <option value="economy">Economy (~₹1,200/sqft)</option>
                    <option value="standard">Standard (~₹1,600/sqft)</option>
                    <option value="premium">Premium (~₹2,200/sqft)</option>
                  </select>
                </div>

                {/* Budget (optional) */}
                <div>
                  <label className="input-label">Budget (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#64748b" }}>₹</span>
                    <input
                      type="number"
                      value={form.budget}
                      onChange={(e) => {
                        setForm({ ...form, budget: e.target.value });
                        setValidationErrors((v) => ({ ...v, budget: undefined }));
                      }}
                      className={`input-field !pl-7 ${validationErrors.budget ? "!border-red-500" : ""}`}
                      placeholder="e.g. 1000000"
                      min={0}
                    />
                  </div>
                  {validationErrors.budget && (
                    <p className="text-[11px] mt-1" style={{ color: "#ef4444" }}>{validationErrors.budget}</p>
                  )}
                </div>

                {/* Toggles */}
                <div className="flex items-center justify-between gap-4">
                  <label className="flex items-center gap-3 cursor-pointer" htmlFor="toggle-vastu">
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={form.vastu_compliant}
                        onChange={(e) => setForm({ ...form, vastu_compliant: e.target.checked })}
                        id="toggle-vastu"
                      />
                      <span className="toggle-slider" />
                    </div>
                    <span className="text-sm text-slate-300 font-medium">Vastu</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer" htmlFor="toggle-parking">
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={form.parking}
                        onChange={(e) => setForm({ ...form, parking: e.target.checked })}
                        id="toggle-parking"
                      />
                      <span className="toggle-slider" />
                    </div>
                    <span className="text-sm text-slate-300 font-medium">Parking</span>
                  </label>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "spin-slow 0.8s linear infinite" }} />
                      Generating Plans...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Generate Plans
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ─── RESULTS PANEL ─── */}
          <div className="lg:col-span-8">
            {/* Error */}
            {error && (
              <div className="alert-warning mb-4 animate-slide-down">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-400 text-base">⚠️</span>
                  <span className="text-sm font-semibold" style={{ color: "#fbbf24" }}>Error</span>
                </div>
                <p className="text-sm" style={{ color: "#fcd34d" }}>{error}</p>
              </div>
            )}

            {/* Empty state */}
            {!result && !loading && !error && (
              <div className="glass-card p-16 text-center animate-fade-in">
                <div className="text-6xl mb-5 animate-float">🏠</div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Enter your plot details
                </h3>
                <p className="text-sm max-w-md mx-auto" style={{ color: "#64748b", lineHeight: 1.7 }}>
                  Fill in your plot dimensions, select house type, and click
                  &quot;Generate Plans&quot; to get realistic, constraint-validated
                  floor plans with cost estimation.
                </p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="glass-card p-16 text-center animate-fade-in">
                <div className="flex justify-center mb-5">
                  <div className="spinner" />
                </div>
                <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>
                  Analyzing constraints & generating layout variations...
                </p>
              </div>
            )}

            {/* Results */}
            {result && activeData && (
              <div className="space-y-5 animate-fade-in-up">
                {/* Variation selector */}
                {result.variations.length > 1 && (
                  <div className="glass-card p-4">
                    <p className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: "#64748b" }}>
                      Layout Options ({result.variations.length} variations)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {result.variations.map((v, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedVariation(i)}
                          className="text-left p-3 rounded-lg transition-all"
                          style={{
                            background: selectedVariation === i ? "rgba(99,102,241,0.12)" : "var(--surface-1)",
                            border: `1px solid ${selectedVariation === i ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ background: selectedVariation === i ? "#6366f1" : "#475569" }}
                            />
                            <span className="text-sm font-semibold text-white">{v.variation_name}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: "#64748b" }}>
                            {v.variation_description}
                          </p>
                          <p className="text-[11px] mt-1 font-medium" style={{ color: "#10b981" }}>
                            {formatCurrency(v.cost.total_cost)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Budget analysis banner */}
                {displayBudget && (
                  <div
                    className="rounded-xl p-4 animate-slide-down"
                    style={{
                      background: displayBudget.within_budget
                        ? "rgba(16,185,129,0.08)"
                        : "rgba(239,68,68,0.08)",
                      border: `1px solid ${displayBudget.within_budget ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {displayBudget.within_budget ? "✅" : "⚠️"}
                        </span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: displayBudget.within_budget ? "#10b981" : "#ef4444" }}>
                            {displayBudget.within_budget ? "Within Budget" : "Over Budget"}
                          </p>
                          <p className="text-xs" style={{ color: "#94a3b8" }}>{displayBudget.suggestion}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs" style={{ color: "#64748b" }}>
                          Budget: {formatCurrency(displayBudget.budget)}
                        </p>
                        <p className="text-sm font-bold" style={{ color: displayBudget.within_budget ? "#10b981" : "#ef4444" }}>
                          {displayBudget.within_budget ? "+" : "-"}{formatCurrency(Math.abs(displayBudget.difference))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary stat cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="stat-card animate-count-up" style={{ animationDelay: "0ms" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--gradient-accent)" }} />
                    <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#64748b" }}>Plot Area</p>
                    <p className="text-2xl font-extrabold text-white">
                      {(activeData.plot_area).toLocaleString()}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "#475569" }}>sqft</p>
                  </div>
                  <div className="stat-card animate-count-up" style={{ animationDelay: "100ms" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(135deg, #6366f1, #818cf8)" }} />
                    <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#64748b" }}>Built Area</p>
                    <p className="text-2xl font-extrabold" style={{ color: "var(--accent-primary-light)" }}>
                      {(activeData.built_area).toLocaleString()}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "#475569" }}>sqft</p>
                  </div>
                  <div className="stat-card animate-count-up" style={{ animationDelay: "200ms" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--gradient-cost)" }} />
                    <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#64748b" }}>Est. Cost</p>
                    <p className="text-2xl font-extrabold" style={{ color: "#10b981" }}>
                      {displayCost ? formatCurrency(displayCost.total_cost) : "—"}
                    </p>
                    <p className="text-[10px] mt-1 capitalize" style={{ color: "#475569" }}>{form.cost_tier} tier</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="glass-card overflow-hidden">
                  <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
                    {(["plan", "cost", "details"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`tab-button ${activeTab === tab ? "active" : ""}`}
                      >
                        {tab === "plan" ? "🏗️ Floor Plan" : tab === "cost" ? "💰 Cost Breakdown" : "📋 Details"}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    {/* ─── FLOOR PLAN TAB ─── */}
                    {activeTab === "plan" && (
                      <div className="space-y-5 animate-fade-in">
                        <div className="floor-plan-container" ref={planContainerRef}>
                          <FloorPlanView
                            rooms={displayRooms}
                            corridor={displayCorridor}
                            buildableLength={buildableLength}
                            buildableWidth={buildableWidth}
                            facing={form.facing}
                            hoveredRoom={hoveredRoom}
                            onRoomHover={setHoveredRoom}
                          />
                        </div>

                        {/* Room legend */}
                        <div className="flex flex-wrap gap-3 justify-center">
                          {displayRooms.map((room, i) => {
                            const colors = ROOM_COLORS[room.room_type] || { fill: "#64748b", stroke: "#94a3b8", bg: "rgba(100,116,139,0.15)" };
                            const icon = ROOM_ICONS[room.room_type] || "📦";
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs cursor-pointer"
                                style={{
                                  background: hoveredRoom === i ? colors.bg : "var(--surface-1)",
                                  border: `1px solid ${hoveredRoom === i ? colors.fill : "var(--border)"}`,
                                  transition: "all 0.2s",
                                  color: hoveredRoom === i ? colors.stroke : "#94a3b8",
                                }}
                                onMouseEnter={() => setHoveredRoom(i)}
                                onMouseLeave={() => setHoveredRoom(null)}
                              >
                                <span>{icon}</span>
                                <span className="font-medium">{room.name}</span>
                                <span style={{ color: "#475569" }}>({room.area} sqft)</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Warnings */}
                        {displayWarnings.length > 0 && (
                          <div className="alert-warning animate-slide-down">
                            <div className="flex items-center gap-2 mb-2">
                              <span>⚠️</span>
                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#fbbf24" }}>Warnings</span>
                            </div>
                            {displayWarnings.map((w, i) => (
                              <p key={i} className="text-sm" style={{ color: "#fcd34d", lineHeight: 1.6 }}>{w}</p>
                            ))}
                          </div>
                        )}

                        {/* Vastu notes */}
                        {displayVastuNotes.length > 0 && (
                          <div className="alert-vastu animate-slide-down">
                            <div className="flex items-center gap-2 mb-2">
                              <span>🪷</span>
                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#c084fc" }}>Vastu Notes</span>
                            </div>
                            {displayVastuNotes.map((v, i) => (
                              <p key={i} className="text-sm" style={{ color: "#d8b4fe", lineHeight: 1.6 }}>{v}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─── COST TAB ─── */}
                    {activeTab === "cost" && displayCost && (
                      <div className="space-y-8 animate-fade-in">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                          <DonutChart data={costDonutData} total={displayCost.total_cost} />
                          <div className="flex-1 w-full space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
                              Cost Breakdown
                            </h3>
                            {costDonutData.map((item) => (
                              <div key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                                  <span className="text-sm" style={{ color: "#94a3b8" }}>{item.label}</span>
                                </div>
                                <span className="text-sm font-semibold text-white">{formatCurrency(item.value)}</span>
                              </div>
                            ))}
                            <div
                              className="flex items-center justify-between pt-3 mt-3"
                              style={{ borderTop: "1px solid var(--border)" }}
                            >
                              <span className="text-sm font-bold text-white">Total</span>
                              <span className="text-lg font-extrabold" style={{ color: "#10b981" }}>
                                {formatCurrency(displayCost.total_cost)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Phase-wise */}
                        {displayPhase && (
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
                              Phase-wise Construction Cost
                            </h3>
                            <div className="space-y-4">
                              {Object.entries(displayPhase).map(([phase, amount], i) => {
                                const pct = (amount / displayCost.total_cost) * 100;
                                const colors = ["#6366f1", "#8b5cf6", "#a855f7", "#06b6d4", "#10b981", "#f59e0b", "#f97316", "#64748b"];
                                return (
                                  <div key={phase}>
                                    <div className="flex justify-between items-center mb-1.5">
                                      <span className="text-sm" style={{ color: "#94a3b8" }}>{formatLabel(phase)}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-semibold" style={{ color: "#475569" }}>{pct.toFixed(0)}%</span>
                                        <span className="text-sm font-semibold text-white">{formatCurrency(amount)}</span>
                                      </div>
                                    </div>
                                    <div className="progress-bar-bg">
                                      <div
                                        className="progress-bar-fill"
                                        style={{ width: `${pct}%`, background: colors[i % colors.length] }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─── DETAILS TAB ─── */}
                    {activeTab === "details" && (
                      <div className="space-y-6 animate-fade-in">
                        {/* Room table */}
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
                            Room Details
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                  <th className="text-left py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: "#64748b" }}>Room</th>
                                  <th className="text-right py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: "#64748b" }}>Size</th>
                                  <th className="text-right py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: "#64748b" }}>Area</th>
                                  <th className="text-right py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: "#64748b" }}>Position</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayRooms.map((room, i) => {
                                  const colors = ROOM_COLORS[room.room_type] || { fill: "#64748b", stroke: "#94a3b8" };
                                  const icon = ROOM_ICONS[room.room_type] || "📦";
                                  return (
                                    <tr
                                      key={i}
                                      style={{
                                        borderBottom: "1px solid rgba(148,163,184,0.06)",
                                        transition: "background 0.2s",
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,102,241,0.05)"; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                    >
                                      <td className="py-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ background: colors.fill }} />
                                          <span className="text-xs">{icon}</span>
                                          <span className="font-medium text-white">{room.name}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 text-right" style={{ color: "#94a3b8" }}>
                                        {room.width}&apos; × {room.length}&apos;
                                      </td>
                                      <td className="py-3 text-right font-medium text-white">{room.area} sqft</td>
                                      <td className="py-3 text-right text-xs" style={{ color: "#475569" }}>
                                        ({room.x}, {room.y})
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Explanations */}
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
                            Plan Explanation
                          </h3>
                          <div className="space-y-3">
                            {displayExplanations.map((exp, i) => (
                              <div
                                key={i}
                                className="flex gap-3 p-3 rounded-lg"
                                style={{
                                  background: i === displayExplanations.length - 1
                                    ? "rgba(245,158,11,0.06)"
                                    : "var(--surface-1)",
                                  border: `1px solid ${i === displayExplanations.length - 1 ? "rgba(245,158,11,0.15)" : "var(--border)"}`,
                                }}
                              >
                                <span className="text-xs mt-0.5" style={{ color: "#475569" }}>
                                  {i === displayExplanations.length - 1 ? "⚠️" : "💡"}
                                </span>
                                <p className="text-sm leading-relaxed" style={{ color: i === displayExplanations.length - 1 ? "#fcd34d" : "#94a3b8" }}>
                                  {exp}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer
        className="mt-auto py-6 px-6"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs" style={{ color: "#475569" }}>
            PlanWise is a pre-construction planning aid. Always consult a licensed architect before construction.
          </p>
          <p className="text-xs" style={{ color: "#334155" }}>
            © 2026 PlanWise
          </p>
        </div>
      </footer>
    </div>
  );
}
