"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft,
  Lightbulb, 
  FileText, 
  Hammer, 
  Rocket, 
  Archive,
  TrendingUp,
  Clock,
  Tag,
  ExternalLink,
  Edit3,
  Save,
  Zap
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
  notes: string;
  spec_doc: string;
  source_type: string;
  source_url: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  { value: "idea", label: "💡 Idea", color: "bg-yellow-500/20 text-yellow-400" },
  { value: "spec", label: "📄 Spec", color: "bg-blue-500/20 text-blue-400" },
  { value: "building", label: "🔨 Building", color: "bg-orange-500/20 text-orange-400" },
  { value: "shipped", label: "🚀 Shipped", color: "bg-green-500/20 text-green-400" },
  { value: "archived", label: "📦 Archived", color: "bg-gray-500/20 text-gray-400" },
];

export default function BlueprintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Blueprint>>({});

  useEffect(() => {
    fetchBlueprint();
  }, [id]);

  const fetchBlueprint = async () => {
    try {
      const res = await fetch(`/api/blueprints/${id}`);
      const data = await res.json();
      if (data.blueprint) {
        setBlueprint(data.blueprint);
        setEditData(data.blueprint);
      }
    } catch (error) {
      console.error("Error fetching blueprint:", error);
    }
    setLoading(false);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      await fetch("/api/blueprints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editData }),
      });
      setBlueprint({ ...blueprint, ...editData } as Blueprint);
      setEditing(false);
    } catch (error) {
      console.error("Error saving:", error);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </main>
    );
  }

  if (!blueprint) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Blueprint not found</p>
          <button onClick={() => router.push("/blueprints")} className="text-[#EA580C]">
            ← Back to Blueprints
          </button>
        </div>
      </main>
    );
  }

  const priorityScore = blueprint.priority_score || (blueprint.impact_score * blueprint.feasibility_score);
  const statusConfig = STATUS_OPTIONS.find(s => s.value === blueprint.status) || STATUS_OPTIONS[0];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push("/blueprints")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Blueprints
          </button>
          
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#EA580C] hover:bg-[#d14d0a] rounded-lg"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#222] rounded-lg"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Title & Score */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            {editing ? (
              <input
                type="text"
                value={editData.title || ""}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="text-3xl font-bold bg-transparent border-b border-[#333] focus:border-[#EA580C] outline-none w-full mb-2"
              />
            ) : (
              <h1 className="text-3xl font-bold mb-2">{blueprint.title}</h1>
            )}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              <span className="text-gray-500 text-sm">{blueprint.category}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-[#EA580C]">{priorityScore}</div>
            <div className="text-gray-500 text-sm">priority score</div>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#141414] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
              <TrendingUp className="w-4 h-4" />
              Impact
            </div>
            {editing ? (
              <input
                type="number"
                min="1"
                max="10"
                value={editData.impact_score || ""}
                onChange={(e) => setEditData({ ...editData, impact_score: parseInt(e.target.value) })}
                className="text-2xl font-bold bg-transparent border-b border-[#333] w-16 outline-none"
              />
            ) : (
              <div className="text-2xl font-bold">{blueprint.impact_score}/10</div>
            )}
          </div>
          <div className="bg-[#141414] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
              <Zap className="w-4 h-4" />
              Feasibility
            </div>
            {editing ? (
              <input
                type="number"
                min="1"
                max="10"
                value={editData.feasibility_score || ""}
                onChange={(e) => setEditData({ ...editData, feasibility_score: parseInt(e.target.value) })}
                className="text-2xl font-bold bg-transparent border-b border-[#333] w-16 outline-none"
              />
            ) : (
              <div className="text-2xl font-bold">{blueprint.feasibility_score}/10</div>
            )}
          </div>
          <div className="bg-[#141414] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
              <Clock className="w-4 h-4" />
              Effort
            </div>
            {editing ? (
              <select
                value={editData.effort_estimate || ""}
                onChange={(e) => setEditData({ ...editData, effort_estimate: e.target.value })}
                className="text-2xl font-bold bg-transparent border-b border-[#333] outline-none"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            ) : (
              <div className="text-2xl font-bold capitalize">{blueprint.effort_estimate}</div>
            )}
          </div>
        </div>

        {/* Status */}
        {editing && (
          <div className="mb-8">
            <label className="text-gray-500 text-sm mb-2 block">Status</label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setEditData({ ...editData, status: s.value })}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    editData.status === s.value
                      ? s.color + " ring-2 ring-white/20"
                      : "bg-[#1a1a1a] text-gray-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Description</h2>
          {editing ? (
            <textarea
              value={editData.description || ""}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={4}
              className="w-full bg-[#141414] rounded-xl p-4 border border-[#222] focus:border-[#EA580C] outline-none resize-none"
            />
          ) : (
            <p className="text-gray-300 bg-[#141414] rounded-xl p-4">{blueprint.description}</p>
          )}
        </div>

        {/* Spec Doc */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Specification</h2>
          {editing ? (
            <textarea
              value={editData.spec_doc || ""}
              onChange={(e) => setEditData({ ...editData, spec_doc: e.target.value })}
              rows={12}
              placeholder="Add detailed specification, requirements, user stories..."
              className="w-full bg-[#141414] rounded-xl p-4 border border-[#222] focus:border-[#EA580C] outline-none resize-none font-mono text-sm"
            />
          ) : blueprint.spec_doc ? (
            <pre className="text-gray-300 bg-[#141414] rounded-xl p-4 whitespace-pre-wrap font-mono text-sm">
              {blueprint.spec_doc}
            </pre>
          ) : (
            <p className="text-gray-500 bg-[#141414] rounded-xl p-4 italic">
              No specification yet. Click Edit to add one.
            </p>
          )}
        </div>

        {/* Tags */}
        {blueprint.tags && blueprint.tags.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {blueprint.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-3 py-1 bg-[#1a1a1a] rounded-full text-sm text-gray-400"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Notes</h2>
          {editing ? (
            <textarea
              value={editData.notes || ""}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              rows={4}
              placeholder="Add internal notes, links, references..."
              className="w-full bg-[#141414] rounded-xl p-4 border border-[#222] focus:border-[#EA580C] outline-none resize-none"
            />
          ) : blueprint.notes ? (
            <p className="text-gray-300 bg-[#141414] rounded-xl p-4">{blueprint.notes}</p>
          ) : (
            <p className="text-gray-500 bg-[#141414] rounded-xl p-4 italic">
              No notes yet. Click Edit to add some.
            </p>
          )}
        </div>

        {/* Meta */}
        <div className="text-gray-500 text-sm border-t border-[#222] pt-6">
          <p>Created: {new Date(blueprint.created_at).toLocaleDateString()}</p>
          {blueprint.source_url && (
            <a
              href={blueprint.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[#EA580C] mt-1"
            >
              <ExternalLink className="w-3 h-3" />
              Source: {blueprint.source_type}
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
