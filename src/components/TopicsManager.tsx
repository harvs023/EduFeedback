import React, { useMemo, useState } from "react";
import { useConfirm } from "./ConfirmDialog";
import { Tag, Plus, Pencil, Check, X, Archive, RotateCcw, Trash2 } from "lucide-react";
import { Survey, Topic } from "../types";

interface TopicsManagerProps {
  topics: Topic[];
  surveys: Survey[];
  onSaveTopic?: (topic: Topic) => Promise<void> | void;
  onDeleteTopic?: (topicId: string) => Promise<void> | void;
}

const MIN_LEN = 2;
const MAX_LEN = 60;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

export const TopicsManager: React.FC<TopicsManagerProps> = ({
  topics,
  surveys,
  onSaveTopic,
  onDeleteTopic,
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // How many surveys use each topic (by topicBlocks.topicId)
  const usageByTopic = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of surveys) {
      const used = new Set<string>();
      for (const b of s.topicBlocks || []) {
        if (b?.topicId) used.add(b.topicId);
      }
      used.forEach((id) => {
        map[id] = (map[id] || 0) + 1;
      });
    }
    return map;
  }, [surveys]);

  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [topics]
  );

  const activeCount = sortedTopics.filter((t) => t.status === "active").length;
  const retiredCount = sortedTopics.length - activeCount;

  const validateName = (raw: string, ignoreId?: string): string | null => {
    const name = raw.trim();
    if (name.length < MIN_LEN) return `Topic name must be at least ${MIN_LEN} characters.`;
    if (name.length > MAX_LEN) return `Topic name must be at most ${MAX_LEN} characters.`;
    const duplicate = topics.some(
      (t) => t.id !== ignoreId && t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) return "A topic with this name already exists.";
    return null;
  };

  const run = async (id: string, action: () => Promise<void> | void) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    const problem = validateName(newName);
    if (problem) {
      setError(problem);
      return;
    }
    if (!onSaveTopic) return;
    const name = newName.trim();
    const maxOrder = topics.reduce((m, t) => Math.max(m, t.order ?? 0), 0);
    const topic: Topic = {
      id: `topic_${slugify(name) || "new"}_${Date.now().toString(36)}`,
      name,
      status: "active",
      order: maxOrder + 1,
      createdAt: Date.now(),
    };
    await run("__new__", async () => {
      await onSaveTopic(topic);
      setNewName("");
    });
  };

  const startEdit = (t: Topic) => {
    setEditingId(t.id);
    setEditName(t.name);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setError(null);
  };

  const handleRename = async (t: Topic) => {
    const problem = validateName(editName, t.id);
    if (problem) {
      setError(problem);
      return;
    }
    if (!onSaveTopic) return;
    await run(t.id, async () => {
      await onSaveTopic({ ...t, name: editName.trim() });
      cancelEdit();
    });
  };

  const handleToggleStatus = async (t: Topic) => {
    if (!onSaveTopic) return;
    const next: Topic = { ...t, status: t.status === "active" ? "retired" : "active" };
    await run(t.id, async () => {
      await onSaveTopic(next);
    });
  };

  const handleDelete = async (t: Topic) => {
    if (!onDeleteTopic) return;
    if ((usageByTopic[t.id] || 0) > 0) return;
    const ok = await confirm({
      title: "Delete this topic?",
      message: `The topic "${t.name}" will be deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await run(t.id, async () => {
      await onDeleteTopic(t.id);
    });
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
      {confirmDialog}
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900">
            Survey Topics ({sortedTopics.length})
          </h2>
          <p className="text-xs text-slate-500">
            Topics group questions inside a survey. Renaming a topic updates it everywhere. A topic
            already used by a survey can only be retired, never deleted, so old reports stay intact.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            {activeCount} active
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {retiredCount} retired
          </span>
        </div>
      </div>

      {/* Add topic */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={newName}
          maxLength={MAX_LEN}
          onChange={(e) => {
            setNewName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="New topic name (e.g. Library Services)"
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={busyId === "__new__" || !onSaveTopic}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Topic
        </button>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* List */}
      {sortedTopics.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No topics yet. Add your first topic above.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
          {sortedTopics.map((t) => {
            const used = usageByTopic[t.id] || 0;
            const isEditing = editingId === t.id;
            const isBusy = busyId === t.id;
            const retired = t.status === "retired";
            return (
              <li
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Tag className={`w-4 h-4 shrink-0 ${retired ? "text-slate-300" : "text-indigo-500"}`} />
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      maxLength={MAX_LEN}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(t);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  ) : (
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          retired ? "text-slate-400 line-through" : "text-slate-800"
                        }`}
                      >
                        {t.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {used > 0
                          ? `Used in ${used} survey${used === 1 ? "" : "s"}`
                          : "Not used by any survey"}
                      </p>
                    </div>
                  )}
                  {!isEditing && (
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        retired
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-100"
                      }`}
                    >
                      {retired ? "Retired" : "Active"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRename(t)}
                        disabled={isBusy}
                        title="Save name"
                        className="p-2 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        title="Cancel"
                        className="p-2 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        disabled={isBusy}
                        title="Rename"
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(t)}
                        disabled={isBusy}
                        title={retired ? "Reactivate" : "Retire (hide from new surveys)"}
                        className="p-2 rounded-lg text-amber-700 hover:bg-amber-50 disabled:opacity-50 cursor-pointer"
                      >
                        {retired ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        disabled={isBusy || used > 0}
                        title={
                          used > 0
                            ? "Used by surveys: retire it instead of deleting"
                            : "Delete topic"
                        }
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TopicsManager;