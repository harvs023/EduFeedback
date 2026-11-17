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
    <div className="bg-white p-4 rounded-2xl border border-slate-200">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">Survey creation</span>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Survey creation for everyone except the admin"
          onClick={toggle}
          disabled={busy}
          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${open ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${open ? "left-[22px]" : "left-0.5"}`} />
        </button>
        <span className={`text-xl font-extrabold ${open ? "text-emerald-700" : "text-amber-700"}`}>{open ? "On" : "Off"}</span>
      </div>
      <span className="text-[11px] text-slate-500">{open ? "Everyone allowed can create surveys" : "Only you can create surveys"}</span>
      {error && <p className="text-[11px] text-rose-700 mt-1">{error}</p>}
    </div>
  );
};

export default SurveyCreationSwitch;
