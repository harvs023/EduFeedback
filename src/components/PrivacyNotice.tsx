import React from "react";
import { ShieldCheck, X } from "lucide-react";
import { MASTER_ADMIN_EMAIL } from "../data/initialData";

/** Change this when the notice's meaning changes: everyone is asked to agree again. */
export const PRIVACY_NOTICE_VERSION = "v1";
export const SCHOOL_NAME = "Dr. Yanga's Colleges Inc.";

/**
 * The privacy notice (Data Privacy Act of 2012, RA 10173). Every sentence must stay true to what
 * the system really does; update it (and the version) when that changes.
 */
export function PrivacyNoticeText() {
  const h = "font-bold text-slate-900 mt-4 mb-1";
  return (
    <div className="text-sm text-slate-700 leading-relaxed">
      <p>
        EduFeedback is the survey and evaluation system of {SCHOOL_NAME}. This notice explains what personal data it
        collects and how it is used.
      </p>

      <h4 className={h}>What we collect</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Your account:</strong> name, email and position. Students and student officers also give their
          department, program, year level, section and student ID. Faculty give their department only.
        </li>
        <li>
          <strong>Your survey answers:</strong> ratings, choices and written comments.
        </li>
        <li>
          <strong>Activity:</strong> when you last used the app, and a log of actions such as submitting a survey or
          posting news.
        </li>
      </ul>

      <h4 className={h}>Why</h4>
      <p>
        To run school surveys and evaluations, show results to the people who made each survey, and help the school
        improve. Answers are also used for research on this system, including measuring how well the sentiment
        analysis works, using comments with names removed.
      </p>

      <h4 className={h}>Anonymous answers</h4>
      <p>
        When you answer anonymously, your name, email and section are <strong>not</strong> saved with your answers. Your
        department, program and year level <strong>are</strong> kept. The system keeps a private record that you
        answered a survey, so you can answer only once; that record holds only the survey's ID, not your answers.
      </p>

      <h4 className={h}>Who can see your information</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          The <strong>person who made a survey</strong> sees its answers, including your name only if you answered with
          your name.
        </li>
        <li>
          The <strong>system administrator</strong> can see all accounts and answers, to manage the system and review
          reports.
        </li>
        <li>Nobody else sees your answers.</li>
      </ul>

      <h4 className={h}>Where your data is processed</h4>
      <p>
        Data is stored in Google Firebase. Written comments are read by an AI service (Gemini) to label their sentiment
        (positive, neutral or negative), exactly as you typed them. Please do not write names or personal details in
        comments.
      </p>

      <h4 className={h}>Your rights (Data Privacy Act of 2012)</h4>
      <p>
        You may ask to see, correct or delete your personal data. School details can be corrected through{" "}
        <strong>Request a change</strong> in your profile. For anything else, contact the system administrator at{" "}
        <strong>{MASTER_ADMIN_EMAIL}</strong>.
      </p>

      <p className="mt-4 text-slate-500">By creating an account or continuing, you agree to this notice.</p>
    </div>
  );
}

interface PrivacyNoticeModalProps {
  /** "read": just the notice with Close. "agree": asks a signed-in person to agree (or sign out). */
  mode: "read" | "agree";
  onClose?: () => void;
  onAgree?: () => Promise<void> | void;
  onSignOut?: () => void;
}

export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({ mode, onClose, onAgree, onSignOut }) => {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (mode !== "read" || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  const agree = async () => {
    if (!onAgree) return;
    setBusy(true);
    setError(null);
    try {
      await onAgree();
    } catch {
      setError("Could not save your answer. Please check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={mode === "read" ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-title"
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="privacy-title" className="text-lg font-extrabold text-slate-900">
                Privacy Notice
              </h3>
              <p className="text-xs text-slate-500">
                {SCHOOL_NAME} · EduFeedback · version {PRIVACY_NOTICE_VERSION.replace("v", "")}
              </p>
            </div>
          </div>
          {mode === "read" && onClose && (
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          {mode === "agree" && (
            <p className="mb-3 p-3 rounded-xl bg-indigo-50 text-indigo-900 text-sm">
              Please read how EduFeedback uses your data. You need to agree to keep using your account.
            </p>
          )}
          <PrivacyNoticeText />
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          {error && <p className="text-xs text-rose-600 sm:mr-auto">{error}</p>}
          {mode === "agree" ? (
            <>
              <button
                onClick={onSignOut}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                Sign out
              </button>
              <button
                onClick={agree}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {busy ? "Saving..." : "I agree"}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
