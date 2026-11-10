import React, { useState } from "react";

/** Review Center card (admin): turn survey creation on or off for everyone except the admin. */
export const SurveyCreationSwitch: React.FC<{ open: boolean; onChange: (open: boolean) => Promise<void> }> = ({ open, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await onChange(!open);
    } catch {
      setError("Could not change it. Check that the latest rules are in the Firebase Console.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Survey creation</span>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Survey creation for faculty and officers"
          onClick={toggle}
          disabled={busy}
          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${open ? "bg-emerald-500" : "bg-slate-600"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${open ? "left-[22px]" : "left-0.5"}`} />
        </button>
        <span className={`font-serif text-xl font-black ${open ? "text-emerald-400" : "text-amber-400"}`}>{open ? "On" : "Off"}</span>
      </div>
      <span className="text-[11px] text-slate-400">{open ? "Everyone allowed can create surveys" : "Only you can create surveys"}</span>
      {error && <p className="text-[11px] text-rose-300 mt-1">{error}</p>}
    </div>
  );
};

export default SurveyCreationSwitch;
