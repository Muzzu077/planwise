"use client";

import { useState } from "react";

interface Room {
  name: string;
  room_type: string;
  x: number;
  y: number;
  width: number;
  length: number;
  area: number;
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

interface PlanResult {
  success: boolean;
  plot_area: number;
  buildable_area: number;
  built_area: number;
  rooms: Room[];
  cost: CostBreakdown;
  phase_wise_cost: PhaseWiseCost;
  explanations: string[];
  warnings: string[];
  vastu_notes: string[];
}

const ROOM_COLORS: Record<string, string> = {
  living_room: "#3B82F6",
  master_bedroom: "#8B5CF6",
  bedroom: "#A78BFA",
  kitchen: "#F59E0B",
  dining: "#10B981",
  bathroom_attached: "#06B6D4",
  bathroom_common: "#67E8F9",
  pooja_room: "#F97316",
  staircase: "#6B7280",
  parking: "#9CA3AF",
};

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function FloorPlanView({ rooms, buildableLength, buildableWidth }: {
  rooms: Room[];
  buildableLength: number;
  buildableWidth: number;
}) {
  const padding = 20;
  const maxViewWidth = 600;
  const maxViewHeight = 450;

  const scaleX = (maxViewWidth - padding * 2) / buildableLength;
  const scaleY = (maxViewHeight - padding * 2) / buildableWidth;
  const scale = Math.min(scaleX, scaleY);

  const svgWidth = buildableLength * scale + padding * 2;
  const svgHeight = buildableWidth * scale + padding * 2;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full max-w-[600px] border border-slate-300 rounded-lg bg-white"
      style={{ maxHeight: "500px" }}
    >
      {/* Plot boundary */}
      <rect
        x={padding}
        y={padding}
        width={buildableLength * scale}
        height={buildableWidth * scale}
        fill="none"
        stroke="#CBD5E1"
        strokeWidth="2"
        strokeDasharray="8,4"
      />

      {/* Rooms */}
      {rooms.map((room, i) => {
        const rx = padding + room.x * scale;
        const ry = padding + room.y * scale;
        const rw = room.width * scale;
        const rh = room.length * scale;
        const color = ROOM_COLORS[room.room_type] || "#94A3B8";

        return (
          <g key={i}>
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              fill={color}
              fillOpacity={0.2}
              stroke={color}
              strokeWidth="2"
              rx="2"
            />
            {/* Room name */}
            <text
              x={rx + rw / 2}
              y={ry + rh / 2 - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={color}
              fontWeight="600"
              fontSize={Math.min(rw / 8, 12)}
            >
              {room.name}
            </text>
            {/* Dimensions */}
            <text
              x={rx + rw / 2}
              y={ry + rh / 2 + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#64748B"
              fontSize={Math.min(rw / 10, 10)}
            >
              {room.width}&apos;x{room.length}&apos;
            </text>
            {/* Area */}
            <text
              x={rx + rw / 2}
              y={ry + rh / 2 + 20}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#94A3B8"
              fontSize={Math.min(rw / 12, 9)}
            >
              {room.area} sqft
            </text>
          </g>
        );
      })}

      {/* North indicator */}
      <text x={svgWidth / 2} y={12} textAnchor="middle" fill="#64748B" fontSize="11" fontWeight="600">
        N
      </text>
      <polygon
        points={`${svgWidth / 2},2 ${svgWidth / 2 - 4},10 ${svgWidth / 2 + 4},10`}
        fill="#64748B"
      />
    </svg>
  );
}

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
  });

  const [result, setResult] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "cost" | "details">("plan");

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  // Calculate buildable dimensions for the SVG view
  const setbacks = { front: 5, rear: 3, left: 3, right: 3 };
  const buildableLength =
    form.facing === "north" || form.facing === "south"
      ? form.plot_length - setbacks.left - setbacks.right
      : form.plot_length - setbacks.front - setbacks.rear;
  const buildableWidth =
    form.facing === "north" || form.facing === "south"
      ? form.plot_width - setbacks.front - setbacks.rear
      : form.plot_width - setbacks.left - setbacks.right;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Plan<span className="text-blue-600">Wise</span>
            </h1>
            <p className="text-sm text-slate-500">Pre-Construction Intelligence System</p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
            MVP v1.0
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Plot Details</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Length (ft)
                    </label>
                    <input
                      type="number"
                      value={form.plot_length}
                      onChange={(e) => setForm({ ...form, plot_length: +e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Width (ft)
                    </label>
                    <input
                      type="number"
                      value={form.plot_width}
                      onChange={(e) => setForm({ ...form, plot_width: +e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={10}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                  Plot Area: <strong>{form.plot_length * form.plot_width} sqft</strong>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    House Type
                  </label>
                  <select
                    value={form.house_type}
                    onChange={(e) => setForm({ ...form, house_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1BHK">1 BHK</option>
                    <option value="2BHK">2 BHK</option>
                    <option value="3BHK">3 BHK</option>
                    <option value="2BHK_with_pooja">2 BHK + Pooja Room</option>
                    <option value="3BHK_with_pooja">3 BHK + Pooja Room</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Floors
                    </label>
                    <select
                      value={form.floors}
                      onChange={(e) => setForm({ ...form, floors: +e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>Ground Floor</option>
                      <option value={2}>G + 1</option>
                      <option value={3}>G + 2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Road Facing
                    </label>
                    <select
                      value={form.facing}
                      onChange={(e) => setForm({ ...form, facing: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="north">North</option>
                      <option value="south">South</option>
                      <option value="east">East</option>
                      <option value="west">West</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Construction Quality
                  </label>
                  <select
                    value={form.cost_tier}
                    onChange={(e) => setForm({ ...form, cost_tier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="economy">Economy (~₹1,200/sqft)</option>
                    <option value="standard">Standard (~₹1,600/sqft)</option>
                    <option value="premium">Premium (~₹2,200/sqft)</option>
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.vastu_compliant}
                      onChange={(e) => setForm({ ...form, vastu_compliant: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Vastu Compliant
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.parking}
                      onChange={(e) => setForm({ ...form, parking: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Car Parking
                  </label>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {loading ? "Generating Plan..." : "Generate Plan"}
                </button>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4">
                {error}
              </div>
            )}

            {!result && !loading && !error && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="text-6xl mb-4">&#x1F3E0;</div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">
                  Enter your plot details
                </h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  Fill in your plot dimensions, select house type, and click
                  &quot;Generate Plan&quot; to get a realistic, constraint-validated floor plan
                  with cost estimation.
                </p>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="animate-spin text-4xl mb-4">&#x2699;</div>
                <p className="text-slate-600">Generating your plan...</p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
                    <p className="text-sm text-slate-500">Plot Area</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {result.plot_area.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">sqft</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
                    <p className="text-sm text-slate-500">Built Area</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {result.built_area.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">sqft</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
                    <p className="text-sm text-slate-500">Est. Cost</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(result.cost.total_cost)}
                    </p>
                    <p className="text-xs text-slate-400">{form.cost_tier}</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                  <div className="flex border-b border-slate-200">
                    {(["plan", "cost", "details"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${
                          activeTab === tab
                            ? "text-blue-600 border-b-2 border-blue-600"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {tab === "plan" ? "Floor Plan" : tab === "cost" ? "Cost Breakdown" : "Details"}
                      </button>
                    ))}
                  </div>

                  <div className="p-6">
                    {/* Floor Plan Tab */}
                    {activeTab === "plan" && (
                      <div className="flex flex-col items-center gap-4">
                        <FloorPlanView
                          rooms={result.rooms}
                          buildableLength={buildableLength}
                          buildableWidth={buildableWidth}
                        />

                        {/* Room Legend */}
                        <div className="flex flex-wrap gap-3 justify-center">
                          {result.rooms.map((room, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              <div
                                className="w-3 h-3 rounded"
                                style={{
                                  backgroundColor: ROOM_COLORS[room.room_type] || "#94A3B8",
                                }}
                              />
                              <span className="text-slate-600">
                                {room.name} ({room.area} sqft)
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Warnings */}
                        {result.warnings.length > 0 && (
                          <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-amber-800 mb-1">Warnings</p>
                            {result.warnings.map((w, i) => (
                              <p key={i} className="text-sm text-amber-700">
                                {w}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Vastu Notes */}
                        {result.vastu_notes.length > 0 && (
                          <div className="w-full bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-purple-800 mb-1">
                              Vastu Notes
                            </p>
                            {result.vastu_notes.map((v, i) => (
                              <p key={i} className="text-sm text-purple-700">
                                {v}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cost Tab */}
                    {activeTab === "cost" && (
                      <div className="space-y-6">
                        {/* Cost Breakdown */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">
                            Cost Breakdown
                          </h3>
                          <div className="space-y-2">
                            {Object.entries(result.cost)
                              .filter(([key]) => key !== "total_cost")
                              .map(([key, value]) => (
                                <div key={key} className="flex justify-between items-center">
                                  <span className="text-sm text-slate-600 capitalize">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {formatCurrency(value)}
                                  </span>
                                </div>
                              ))}
                            <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                              <span className="text-sm font-bold text-slate-900">Total</span>
                              <span className="text-lg font-bold text-green-600">
                                {formatCurrency(result.cost.total_cost)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Phase-wise Cost */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-3">
                            Phase-wise Construction Cost
                          </h3>
                          <div className="space-y-2">
                            {Object.entries(result.phase_wise_cost).map(([phase, amount]) => {
                              const pct = (amount / result.cost.total_cost) * 100;
                              return (
                                <div key={phase}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-600 capitalize">
                                      {phase.replace(/_/g, " ")}
                                    </span>
                                    <span className="font-medium">{formatCurrency(amount)}</span>
                                  </div>
                                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Details Tab */}
                    {activeTab === "details" && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-2">
                            Room Details
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left py-2 text-slate-500 font-medium">Room</th>
                                  <th className="text-right py-2 text-slate-500 font-medium">Size</th>
                                  <th className="text-right py-2 text-slate-500 font-medium">Area</th>
                                  <th className="text-right py-2 text-slate-500 font-medium">Position</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.rooms.map((room, i) => (
                                  <tr key={i} className="border-b border-slate-100">
                                    <td className="py-2 font-medium">{room.name}</td>
                                    <td className="py-2 text-right text-slate-600">
                                      {room.width}&apos; x {room.length}&apos;
                                    </td>
                                    <td className="py-2 text-right text-slate-600">{room.area} sqft</td>
                                    <td className="py-2 text-right text-slate-400 text-xs">
                                      ({room.x}, {room.y})
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-slate-700 mb-2">
                            Plan Explanation
                          </h3>
                          <div className="space-y-2">
                            {result.explanations.map((exp, i) => (
                              <p key={i} className="text-sm text-slate-600 leading-relaxed">
                                {exp}
                              </p>
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-3 mt-auto">
        <p className="text-center text-xs text-slate-400">
          PlanWise is a pre-construction planning aid. Always consult a licensed
          architect before construction.
        </p>
      </footer>
    </div>
  );
}
