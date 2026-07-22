import { useState } from "react";

type Props = {
  projectId: number;
  onDeleted?: () => void; // parent ko refresh karne ke liye
};

export default function DeleteProjectButton({ projectId, onDeleted }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const deleteProject = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const resp = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Delete failed");
      setMsg("✅ Project deleted.");
      onDeleted?.();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        className="rounded bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-sm"
        onClick={() => setShowConfirm(true)}
        disabled={loading}
      >
        {loading ? "Deleting…" : "Delete Project"}
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-gray-800 p-5 rounded shadow-lg max-w-sm w-full text-white">
            <h2 className="text-lg font-semibold mb-3">Confirm Delete</h2>
            <p className="mb-4">
              Kya aap yaqeenan is project ko permanently delete karna chahte hain?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-red-600 rounded hover:bg-red-500"
                onClick={deleteProject}
                disabled={loading}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result message */}
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </>
  );
}
