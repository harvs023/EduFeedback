import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { authFetch } from "../lib/firebase";
import {
  BACKUP_GROUPS,
  BACKUP_GROUP_LABELS,
  checkBackup,
  type BackupCheck,
  type BackupFile,
} from "../lib/backupFormat";
import appletConfig from "../../firebase-applet-config.json";

interface DatabaseBackupViewProps {
  showToast: (text: string, type?: "success" | "info") => void;
}

const CONFIRM_WORD = "RESTORE";

function fileStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
}

function saveJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/** Downloads a full backup made by the server. Returns the backup's item count, or null. */
async function downloadBackup(fileName: string): Promise<{ total: number } | { error: string }> {
  try {
    const res = await authFetch("/api/admin/backup", { method: "POST" });
    if (!res.ok) return { error: await errorText(res, "Could not make the backup now.") };
    const backup = await res.json();
    const check = checkBackup(backup);
    if (!check.ok) return { error: `The server's backup did not pass the check: ${check.error}` };
    saveJson(backup, fileName);
    return { total: check.total };
  } catch {
    return { error: "Could not reach the server. Please check your connection and try again." };
  }
}

const CountsTable: React.FC<{ counts: Record<string, number> }> = ({ counts }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
    {BACKUP_GROUPS.map((g) => (
      <div key={g} className="flex justify-between border-b border-slate-100 py-1">
        <span className="text-slate-600">{BACKUP_GROUP_LABELS[g]}</span>
        <span className="font-bold text-slate-900">{(counts[g] ?? 0).toLocaleString()}</span>
      </div>
    ))}
  </div>
);

export const DatabaseBackupView: React.FC<DatabaseBackupViewProps> = ({ showToast }) => {
  // Download
  const [downloading, setDownloading] = useState(false);
  const [lastDownload, setLastDownload] = useState<string | null>(null);

  // Restore
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileCheck, setFileCheck] = useState<BackupCheck | null>(null);
  const [reading, setReading] = useState(false);
  const [safetyStatus, setSafetyStatus] = useState<"none" | "working" | "done">("none");
  const [understood, setUnderstood] = useState(false);
  const [typed, setTyped] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ written: number; deleted: number; failed: number } | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    const result = await downloadBackup(`EduFeedback_Backup_${fileStamp()}.json`);
    setDownloading(false);
    if ("error" in result) {
      showToast(result.error, "info");
      return;
    }
    setLastDownload(`${result.total.toLocaleString()} items, ${new Date().toLocaleString()}`);
    showToast("Backup downloaded. Keep the file somewhere safe and private.", "success");
  };

  const resetRestore = () => {
    setFileName("");
    setFileCheck(null);
    setSafetyStatus("none");
    setUnderstood(false);
    setTyped("");
    setRestoreError(null);
    setRestoreResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    resetRestore();
    if (!file) return;
    setFileName(file.name);
    setReading(true);
    try {
      const parsed = JSON.parse(await file.text());
      setFileCheck(checkBackup(parsed));
    } catch {
      setFileCheck({ ok: false, error: "This file could not be read. It is not a valid backup file." });
    } finally {
      setReading(false);
    }
  };

  const handleSafetyBackup = async () => {
    setSafetyStatus("working");
    const result = await downloadBackup(`EduFeedback_SafetyBackup_before_restore_${fileStamp()}.json`);
    if ("error" in result) {
      setSafetyStatus("none");
      showToast(result.error, "info");
      return;
    }
    setSafetyStatus("done");
    showToast("Safety backup of the current data downloaded.", "success");
  };

  const backup: BackupFile | null = fileCheck?.ok ? fileCheck.backup : null;
  const otherProject = backup !== null && backup.projectId !== appletConfig.projectId;
  const canRestore =
    backup !== null && safetyStatus === "done" && understood && typed.trim() === CONFIRM_WORD && !restoring && !restoreResult;

  const handleRestore = async () => {
    if (!backup || !canRestore) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const res = await authFetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup }),
      });
      if (!res.ok) {
        setRestoreError(await errorText(res, "The restore failed. Nothing may have changed, or some data may be mixed."));
        return;
      }
      const body = await res.json();
      setRestoreResult({ written: body.written ?? 0, deleted: body.deleted ?? 0, failed: body.failed ?? 0 });
    } catch {
      setRestoreError(
        "Lost contact with the server during the restore. Wait a minute, reload the app and check the data; if it looks wrong, restore your safety backup."
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200">
          <Database className="w-3.5 h-3.5 text-indigo-600" />
          <span>Backup &amp; Restore</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">Database Backup &amp; Restore</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
          Download a complete copy of the database, or replace the database with a backup you downloaded earlier.
          Both are done by the server, so nothing is left out.
        </p>
      </div>

      {/* Download */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Download className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-bold text-slate-900">Download a full backup</h2>
            <p className="text-xs text-slate-600">
              Includes user profiles, surveys, responses with their sentiment results, "already answered" records, news and
              likes, topics, notifications, the activity log, the academic calendar, app settings and saved evaluation results.
              Login passwords are not included (they stay in Firebase Authentication).
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
          <Lock className="w-4 h-4 shrink-0 text-slate-500 mt-0.5" />
          <span>
            The file holds names, emails, every answer and which surveys each person answered. Keep it private (for example
            in a folder only the researchers can open). Never post or share it.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{downloading ? "Making the backup..." : "Download full backup"}</span>
          </button>
          {lastDownload && (
            <span className="text-xs text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Downloaded: {lastDownload}
            </span>
          )}
        </div>
      </div>

      {/* Restore */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-rose-200 shadow-xs space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <Upload className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-bold text-slate-900">Restore from a backup (wipe and restore)</h2>
            <p className="text-xs text-slate-600">Use this only if the data was lost or damaged.</p>
          </div>
        </div>

        {/* How restore works */}
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
          <div className="font-bold flex items-center gap-2 text-rose-800">
            <ShieldAlert className="w-4 h-4" /> How restore works. Please read before you continue.
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Restore <strong>replaces everything</strong> in the database with the contents of the backup file. It does not
              mix old and new data.
            </li>
            <li>
              Anything created or changed <strong>after the backup was made is permanently removed</strong>: new surveys,
              responses, accounts, news, flags, decisions and settings.
            </li>
            <li>Your own admin account is kept as it is now, so you cannot be locked out.</li>
            <li>
              Login passwords are not in the backup and are not changed. People who signed up after the backup was made can
              still sign in, but their profile is gone: they must register again with the same email and password.
            </li>
            <li>
              Do it when <strong>nobody else is using the system</strong>. Anything people do during the restore may be lost.
            </li>
            <li>
              Sentiment results stay valid only if the server's signing secret (<code>RESULT_SIGNING_SECRET</code>) is the
              same as when the backup was made. Otherwise they show as "needs a re-run".
            </li>
            <li>
              It <strong>cannot be undone</strong>, except by restoring the safety backup you download in step 2.
            </li>
          </ul>
        </div>

        {restoreResult ? (
          <div className="space-y-3">
            <div
              className={`p-4 rounded-2xl border text-xs space-y-1 ${
                restoreResult.failed > 0 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              <div className="font-bold flex items-center gap-2">
                {restoreResult.failed > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {restoreResult.failed > 0 ? "Restore finished with problems" : "Restore finished"}
              </div>
              <div>
                {restoreResult.written.toLocaleString()} items written from the backup,{" "}
                {restoreResult.deleted.toLocaleString()} items that were not in the backup removed.
              </div>
              {restoreResult.failed > 0 && (
                <div>
                  {restoreResult.failed.toLocaleString()} items could not be saved. Try the restore again with the same file;
                  if it keeps failing, restore your safety backup.
                </div>
              )}
              <div>Reload the app now so every screen shows the restored data.</div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Reload the app
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Step 1: choose file */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900">Step 1. Choose the backup file to restore</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFile}
                disabled={restoring}
                className="block w-full text-xs text-slate-600 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-slate-100 file:font-bold file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
              />
              {reading && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking the file...
                </div>
              )}
              {fileCheck && !fileCheck.ok && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{fileName}</strong> cannot be restored. {fileCheck.error}
                  </span>
                </div>
              )}
              {backup && fileCheck?.ok && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <FileJson className="w-4 h-4 text-indigo-600" /> {fileName}
                  </div>
                  <div className="text-xs text-slate-600">
                    Made on <strong>{new Date(backup.createdAt).toLocaleString()}</strong> by {backup.createdBy}.{" "}
                    {fileCheck.total.toLocaleString()} items. After the restore, the database will contain exactly this:
                  </div>
                  <CountsTable counts={fileCheck.counts} />
                  {otherProject && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                      This backup was made from a different Firebase project ("{backup.projectId}"). That is fine when moving
                      to a new project, but check that this is the file you mean.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: safety backup */}
            <div className={`space-y-2 ${backup ? "" : "opacity-50 pointer-events-none"}`}>
              <div className="text-xs font-bold text-slate-900">Step 2. Download a safety backup of the current data</div>
              <p className="text-xs text-slate-600">
                This is your only way back if the restore was a mistake. Keep this file until you have checked the restored
                data.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSafetyBackup}
                  disabled={!backup || safetyStatus === "working" || restoring}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {safetyStatus === "working" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Download safety backup</span>
                </button>
                {safetyStatus === "done" && (
                  <span className="text-xs text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Downloaded
                  </span>
                )}
              </div>
            </div>

            {/* Step 3: confirm */}
            <div className={`space-y-3 ${backup && safetyStatus === "done" ? "" : "opacity-50 pointer-events-none"}`}>
              <div className="text-xs font-bold text-slate-900">Step 3. Confirm and restore</div>
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  disabled={restoring}
                  className="mt-0.5"
                />
                <span>
                  I understand that everything in the database will be replaced with this backup, and that anything added after{" "}
                  {backup ? new Date(backup.createdAt).toLocaleString() : "the backup date"} will be permanently removed.
                </span>
              </label>
              <div className="space-y-1">
                <label className="text-xs text-slate-700" htmlFor="restore-confirm">
                  Type <strong>{CONFIRM_WORD}</strong> to confirm:
                </label>
                <input
                  id="restore-confirm"
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={restoring}
                  autoComplete="off"
                  className="w-full max-w-xs px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:outline-hidden focus:border-rose-400"
                />
              </div>
              {restoreError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{restoreError}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={!canRestore}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{restoring ? "Restoring... do not close this page" : "Wipe and restore"}</span>
                </button>
                <button
                  type="button"
                  onClick={resetRestore}
                  disabled={restoring}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
