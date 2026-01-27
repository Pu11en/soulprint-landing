"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Lightbulb, 
  FileText, 
  Hammer, 
  Rocket, 
  Archive,
  TrendingUp,
  Clock,
  Tag,
  ExternalLink,
  RefreshCw,
  ChevronRight
} from "lucide-react";

interface Blueprint {
  id: string;
  title: string;
  description: string;
  category: string;
  impact_score: number;
  feasibility_score: number;
  priority_score: number;
  effort_estimate: string;
  status: string;
  tags: string[];
  source_type: string;
  source_url: string;
  created_at: string;
}

const STATUS_CONFIG = {
  idea: { icon: Lightbulb, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  spec: { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
  building: { icon: Hammer, color: "text-orange-500", bg: "bg-orange-500/10" },
  shipped: { icon: Rocket, color: "text-green-500", bg: "bg-green-500/10" },
  archived: { icon: Archive, color: "text-gray-500", bg: "bg-gray-500/10" },
};

const CATEGORY_COLORS: Record<string, string> = {
  product: "bg-purple-500/20 text-purple-400",
  feature: "bg-blue-500/20 text-blue-400",
  marketing: "bg-pink-500/20 text-pink-400",
  infrastructure: "bg-gray-500/20 text-gray-400",
  content: "bg-green-500/20 text-green-400",
};

export default function BlueprintsPage() {
  const router = useRouter();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    fetchBlueprints();
  }, [filter]);

  const fetchBlueprints = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      
      const res = await fetch(`/api/blueprints?${params}`);
      const data = await res.json();
      setBlueprints(data.blueprints || []);
    } catch (error) {
      console.error("Error fetching blueprints:", error);
    }
    setLoading(false);
  };

  const extractFromSlack = async () => {
    setExtracting(true);
    try {
      const res = await fetch("/api/blueprints/extract-slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Extracted ${data.extracted} ideas!`);
        fetchBlueprints();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert("Failed to extract from Slack");
    }
    setExtracting(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await fetch("/api/blueprints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      fetchBlueprints();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Blueprints</h1>
            <p className="text-gray-500">Ideas ranked by impact × feasibility</p>
          </div>
          <button
            onClick={extractFromSlack}
            disabled={extracting}
            className="flex items-center gap-2 px-4 py-2 bg-[#EA580C] hover:bg-[#d14d0a] rounded-lg font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${extracting ? "animate-spin" : ""}`} />
            {extracting ? "Extracting..." : "Extract from Slack"}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {["all", "idea", "spec", "building", "shipped", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                filter === s
                  ? "bg-[#EA580C] text-white"
                  : "bg-[#141414] text-gray-400 hover:text-white"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Blueprint Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading...</div>
        ) : blueprints.length === 0 ? (
          <div className="text-center py-20">
            <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No blueprints yet</p>
            <p className="text-gray-600 text-sm mt-2">Click &quot;Extract from Slack&quot; to pull ideas</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {blueprints.map((bp, index) => {
              const StatusIcon = STATUS_CONFIG[bp.status as keyof typeof STATUS_CONFIG]?.icon || Lightbulb;
              const statusColor = STATUS_CONFIG[bp.status as keyof typeof STATUS_CONFIG]?.color || "text-gray-500";
              
              return (
                <div
                  key={bp.id}
                  onClick={() => router.push(`/blueprints/${bp.id}`)}
                  className="bg-[#141414] border border-[#222] rounded-xl p-5 hover:border-[#EA580C]/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <div className="text-2xl font-bold text-[#EA580C] w-8">
                      #{index + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold truncate">{bp.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[bp.category] || "bg-gray-500/20 text-gray-400"}`}>
                          {bp.category}
                        </span>
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                        {bp.description}
                      </p>

                      {/* Tags */}
                      {bp.tags && bp.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {bp.tags.slice(0, 5).map((tag) => (
                            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-[#1a1a1a] rounded text-xs text-gray-500">
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Metrics */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Impact: {bp.impact_score}/10
                        </span>
                        <span className="flex items-center gap-1">
                          <Hammer className="w-3 h-3" />
                          Feasibility: {bp.feasibility_score}/10
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {bp.effort_estimate}
                        </span>
                        {bp.source_url && (
                          <a 
                            href={bp.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-[#EA580C]"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Source
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Score & Status */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#EA580C] mb-2">
                        {bp.priority_score || (bp.impact_score * bp.feasibility_score)}
                      </div>
                      <select
                        value={bp.status}
                        onChange={(e) => updateStatus(bp.id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs ${statusColor} bg-[#1a1a1a] border border-[#333] cursor-pointer`}
                      >
                        <option value="idea">💡 Idea</option>
                        <option value="spec">📄 Spec</option>
                        <option value="building">🔨 Building</option>
                        <option value="shipped">🚀 Shipped</option>
                        <option value="archived">📦 Archived</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
