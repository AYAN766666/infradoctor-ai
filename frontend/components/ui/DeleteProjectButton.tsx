import { useState } from "react";
import { apiFetch } from "@/lib/api";

type Props = {
  projectId: number;
  onDeleted?: () => void;
};

export default function DeleteProjectButton({ projectId, onDeleted }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const deleteProject = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const token = localStorage.getItem("token");
      const resp = await apiFetch(`/projects/${projectId}`, {
        method: "DELETE",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Delete failed");
      setMsg("Project deleted successfully");
      onDeleted?.();
    } catch (e: any) {
      setMsg(`Delete failed: ${e.message}`);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        className="rounded bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm disabled:opacity-50"
        onClick={() => setShowConfirm(true)}
        disabled={loading}
      >
        {loading ? "Deleting..." : "Delete Project"}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-white">
            <h2 className="text-lg font-bold mb-3">Confirm Delete</h2>
            <p className="text-neutral-400 mb-6 text-sm">
              Are you sure you want to permanently delete this project? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-neutral-800 rounded-xl text-sm hover:bg-neutral-700 transition-colors"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 rounded-xl text-sm font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
                onClick={deleteProject}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className={`mt-2 text-sm ${msg.includes("failed") ? "text-red-400" : "text-emerald-400"}`}>
          {msg}
        </div>
      )}
    </>
  );
}
