import React, { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { DatabaseService } from "../lib/databaseService";

/**
 * Login page "Forgot password?": Firebase emails a link to choose a new password.
 * The message is the same whether or not the email has a login, so the page cannot be
 * used to find out who has an account.
 */
export function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail.trim());
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Please enter the email address you signed up with.");
      return;
    }
    setBusy(true);
    try {
      await DatabaseService.sendPasswordReset(value);
      setSentTo(value);
    } catch (err: any) {
      const code = String(err?.code || "");
      if (code.includes("user-not-found")) {
        // Same answer as a real send, so nobody can test which emails have accounts.
        setSentTo(value);
      } else if (code.includes("invalid-email")) {
        setError("That email address does not look right. Please check it.");
      } else if (code.includes("too-many-requests")) {
        setError("Too many tries. Please wait a few minutes and try again.");
      } else {
        setError("Could not send the email right now. Please check your internet and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed space-y-1.5">
            <p>
              If <strong className="text-white">{sentTo}</strong> has an EduFeedback account, we sent it a link to choose a new
              password.
            </p>
            <p className="text-emerald-300/80 text-xs">
              Check your inbox and spam folder. The link works for a limited time. Your old password keeps working until you
              change it.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Forgot your password?</h2>
        <p className="text-sm text-slate-400 mt-1">
          Enter the email you signed up with. We will email you a link to choose a new password.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      <div>
        <label htmlFor="reset-email" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
          Email address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-4 h-4" />
          </div>
          <input
            id="reset-email"
            type="email"
            autoCapitalize="none"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. name@university.edu"
            autoFocus
            className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? "Sending..." : "Send reset link"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </button>
    </form>
  );
}
