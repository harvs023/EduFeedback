import React, { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

interface SurveyCriteriaModalProps {
  onAccept: (acceptedAt: number) => void;
  onCancel: () => void;
}

const CRITERIA: Array<{ title: string; text: string }> = [
  {
    title: "A real purpose",
    text: "The survey must evaluate or improve something real at the school, such as a course, an instructor, a facility or a service.",
  },
  {
    title: "Respectful, professional wording",
    text: "No insults, jokes, offensive language or misleading questions. Write clearly so respondents understand every question.",
  },
  {
    title: "No sensitive personal data",
    text: "Do not ask for passwords, ID numbers, contact details or other private information.",
  },
  {
    title: "The right audience",
    text: "Target the groups who can actually answer. Do not use a survey to single out or target an individual person.",
  },
  {
    title: "Admin review",
    text: "Every survey is reviewed by the administrator before it is published. Test, nonsense or inappropriate surveys will be rejected, and repeated misuse can lead to survey creation being switched off for your account.",
  },
];

export const SurveyCriteriaModal: React.FC<SurveyCriteriaModalProps> = ({ onAccept, onCancel }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="criteria-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 id="criteria-title" className="font-serif text-xl font-bold text-slate-900">
                Before you create a survey
              </h2>
              <p className="text-xs text-slate-500">Please read and agree to these criteria.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title="Cancel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ol className="space-y-3">
          {CRITERIA.map((c, i) => (
            <li key={c.title} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800">{c.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{c.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-indigo-600"
          />
          <span className="text-xs text-slate-700 leading-relaxed">
            I have read these criteria and I understand that my survey will be reviewed before it is published.
          </span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!agreed}
            onClick={() => onAccept(Date.now())}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            I agree, continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyCriteriaModal;