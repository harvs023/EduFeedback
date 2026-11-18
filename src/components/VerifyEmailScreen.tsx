import { useEffect, useState } from "react";
import { MailCheck, RefreshCw, LogOut } from "lucide-react";

interface Props {
  email: string;
  /** Asks Firebase again; resolves true when the email is now verified. */
  onCheck: () => Promise<boolean>;
  onResend: () => Promise<void>;
  onSignOut: () => void;
}

const RESEND_WAIT_SECONDS = 60;

/**
 * Shown after sign-up and at login while the person's email is not verified yet. The real lock is in
 * the security rules (isActive needs a verified email, unless the admin marked it as checked).
 */
export function VerifyEmailScreen({ email, onCheck, onResend, onSignOut }: Props) {
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const check = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const ok = await onCheck();
      if (!ok) setMessage({ kind: "info", text: "Not verified yet. Open the link in the email first, then press this button again." });
    } catch {
      setMessage({ kind: "error", text: "Could not check right now. Please check your internet and try again." });
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    setSending(true);
    setMessage(null);
    try {
      await onResend();
      setWait(RESEND_WAIT_SECONDS);
      setMessage({ kind: "info", text: `A new link was sent to ${email}. Check your spam folder too.` });
    } catch (err: any) {
      const code = String(err?.code || "");
      setMessage({
        kind: "error",
        text: code.includes("too-many-requests")
          ? "Too many emails were sent. Please wait a few minutes and try again."
          : "Could not send the email right now. Please try again later.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
          <MailCheck className="w-7 h-7" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-xl font-extrabold text-slate-900">Verify your email</h1>
          <p className="text-sm text-slate-600">
            We sent a link to <strong className="text-slate-900 break-all">{email}</strong>. Open it to confirm that this
            email is yours, then come back and press <strong>I've verified it</strong>.
          </p>
          <p className="text-xs text-slate-500">Can't find it? Check your spam or promotions folder.</p>
        </div>

        {message && (
          <p
            className={`text-sm p-3 rounded-xl ${
              message.kind === "error" ? "bg-rose-50 text-rose-700" : "bg-indigo-50 text-indigo-800"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="space-y-2">
          <button
            onClick={check}
            disabled={checking}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm cursor-pointer disabled:opacity-50"
          >
            {checking ? "Checking..." : "I've verified it"}
          </button>
          <button
            onClick={resend}
            disabled={sending || wait > 0}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            {sending ? "Sending..." : wait > 0 ? `Resend email (${wait}s)` : "Resend email"}
          </button>
          <button
            onClick={onSignOut}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center">
          No access to this email? Ask the system administrator to mark your email as checked.
        </p>
      </div>
    </div>
  );
}
