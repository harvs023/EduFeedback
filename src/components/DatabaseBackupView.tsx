import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  ActivityLog,
  NewsAnnouncement,
  TagalogMLSample,
  SystemBackupData,
  DatabaseSnapshot,
} from "../types";
import { LocalStorageManager } from "../lib/storage";
import {
  Database,
  Download,
  UploadCloud,
  FileCheck,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Trash2,
  HardDrive,
  Users,
  ClipboardList,
  MessageSquareText,
  BrainCircuit,
  Activity,
  CheckCircle2,
  X,
  FileJson,
  Layers,
  Sparkles,
  Flame,
  Server,
  Code,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { isFirebaseConfigured, seedFirestoreWithInitialDemoData } from "../lib/firebase";
import { USE_FIREBASE } from "../lib/databaseService";

interface DatabaseBackupViewProps {
  surveys: Survey[];
  responses: SurveyResponse[];
  users: UserProfile[];
  logs: ActivityLog[];
  newsList: NewsAnnouncement[];
  mlDataset: TagalogMLSample[];
  currentUser: UserProfile | null;
  onRestoreBackup: (backupData: SystemBackupData, mode: "overwrite" | "merge") => void;
  onResetDatabase: () => void;
  showToast: (text: string, type?: "success" | "info") => void;
}

export const DatabaseBackupView: React.FC<DatabaseBackupViewProps> = ({
  surveys,
  responses,
  users,
  logs,
  newsList,
  mlDataset,
  currentUser,
  onRestoreBackup,
  onResetDatabase,
  showToast,
}) => {
  // Snapshots State
  const [snapshots, setSnapshots] = useState<DatabaseSnapshot[]>([]);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotCustomName, setSnapshotCustomName] = useState("");

  // File Upload / Restore State
  const [importedBackup, setImportedBackup] = useState<SystemBackupData | null>(null);
  const [importFileName, setImportFileName] = useState<string>("");
  const [restoreMode, setRestoreMode] = useState<"overwrite" | "merge">("overwrite");
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Factory Reset Safety State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  // Storage footprint calculation
  const storageMetrics = useMemo(() => {
    return LocalStorageManager.calculateStorageMetrics();
  }, [surveys, responses, users, logs, newsList, mlDataset]);

  // Load existing snapshots on mount
  useEffect(() => {
    setSnapshots(LocalStorageManager.getSnapshots());
  }, []);

  // Handle Export Full Database
  const handleExportDatabase = () => {
    try {
      const backup = LocalStorageManager.exportFullDatabase(currentUser?.email || "admin@edufeedback.edu");
      const jsonString = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const timestampStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName = `EduFeedback_DB_Backup_${timestampStr}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Also create a local snapshot record
      const newSnap = LocalStorageManager.createSnapshot(
        `Exported Archive (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
        currentUser?.email
      );
      setSnapshots(LocalStorageManager.getSnapshots());

      showToast("System database backup successfully downloaded as JSON!", "success");
    } catch (err: any) {
      showToast(`Backup failed: ${err.message}`, "info");
    }
  };

  // Handle Create Instant Snapshot
  const handleCreateSnapshotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const name = snapshotCustomName.trim() || `Snapshot ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      LocalStorageManager.createSnapshot(name, currentUser?.email || "admin@edufeedback.edu");
      setSnapshots(LocalStorageManager.getSnapshots());
      setIsCreatingSnapshot(false);
      setSnapshotCustomName("");
      showToast(`Snapshot "${name}" saved to local recovery points.`, "success");
    } catch (err: any) {
      showToast(`Snapshot failed: ${err.message}`, "info");
    }
  };

  // Handle File Selected for Restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setUploadError("Invalid file type. Please select a .json database backup file.");
      return;
    }

    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validate basic schema
        if (!parsed.data || typeof parsed.data !== "object") {
          throw new Error("Missing required root 'data' object in backup.");
        }
        if (!Array.isArray(parsed.data.surveys) && !Array.isArray(parsed.data.responses)) {
          throw new Error("File does not contain valid EduFeedback surveys or response collections.");
        }

        setImportedBackup(parsed);
      } catch (err: any) {
        setUploadError(`Failed to parse backup JSON: ${err.message}`);
        setImportedBackup(null);
      }
    };
    reader.onerror = () => {
      setUploadError("Error reading the selected file.");
    };
    reader.readAsText(file);
  };

  // Execute Restore
  const handleExecuteRestore = () => {
    if (!importedBackup) return;

    try {
      onRestoreBackup(importedBackup, restoreMode);
      setIsConfirmingRestore(false);
      setImportedBackup(null);
      setImportFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast(
        `Database successfully restored in ${restoreMode === "overwrite" ? "Full Overwrite" : "Smart Merge"} mode!`,
        "success"
      );
    } catch (err: any) {
      showToast(`Restore failed: ${err.message}`, "info");
    }
  };

  // Quick Restore to Snapshot
  const handleRestoreSnapshot = (snapshot: DatabaseSnapshot) => {
    if (
      window.confirm(
        `Are you sure you want to restore the system to "${snapshot.name}" (${snapshot.createdAt})? Current unsaved modifications will be overwritten.`
      )
    ) {
      const backupData: SystemBackupData = {
        app: "EduFeedback Institutional Evaluation Platform",
        version: "2.5.0-production",
        exportedAt: snapshot.createdAt,
        exportTimestamp: snapshot.timestamp,
        exportedBy: snapshot.createdBy,
        stats: snapshot.stats,
        data: snapshot.data,
      };
      onRestoreBackup(backupData, "overwrite");
      showToast(`Restored system state from snapshot "${snapshot.name}"`, "success");
    }
  };

  // Delete Snapshot
  const handleDeleteSnapshot = (id: string, name: string) => {
    if (window.confirm(`Delete snapshot "${name}"?`)) {
      const updated = LocalStorageManager.deleteSnapshot(id);
      setSnapshots(updated);
      showToast("Snapshot deleted.", "info");
    }
  };

  // Factory Reset
  const handleFactoryReset = () => {
    if (resetConfirmText.trim().toUpperCase() !== "RESET") {
      showToast("Please type RESET exactly to confirm factory reset.", "info");
      return;
    }
    onResetDatabase();
    setShowResetModal(false);
    setResetConfirmText("");
    showToast("Database successfully reset to pristine factory demo seed data.", "success");
  };

  // Firebase Seed & Readiness State
  const [showFirebaseGuide, setShowFirebaseGuide] = useState(true);
  const [isSeedingFirestore, setIsSeedingFirestore] = useState(false);

  const handleSeedFirestore = async () => {
    if (!isFirebaseConfigured()) {
      showToast("Firebase credentials not configured yet. Please update src/lib/firebase.ts first.", "info");
      return;
    }
    setIsSeedingFirestore(true);
    try {
      const res = await seedFirestoreWithInitialDemoData();
      if (res.success) {
        showToast(res.message, "success");
      } else {
        showToast(res.message, "info");
      }
    } catch (e: any) {
      showToast(e?.message || "Failed to seed Firestore.", "info");
    } finally {
      setIsSeedingFirestore(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Quick Action Bar */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>Disaster Recovery & Institutional Data Persistence</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">
              System Database Backup & Snapshots
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Create full archival snapshots of campus surveys, sentiment classification models, user accounts, and activity audit trails.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsCreatingSnapshot(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-slate-200"
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Create Local Snapshot</span>
            </button>

            <button
              onClick={handleExportDatabase}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Full Backup (JSON)</span>
            </button>
          </div>
        </div>

        {/* Database Health & Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <ClipboardList className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Surveys</span>
            </div>
            <div className="font-serif text-2xl font-black text-slate-900">{surveys.length}</div>
            <span className="text-[11px] text-slate-500">authored forms</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
              <MessageSquareText className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Responses</span>
            </div>
            <div className="font-serif text-2xl font-black text-emerald-700">{responses.length}</div>
            <span className="text-[11px] text-emerald-600">student entries</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-blue-600 mb-1">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Users</span>
            </div>
            <div className="font-serif text-2xl font-black text-blue-700">{users.length}</div>
            <span className="text-[11px] text-blue-600">registered accounts</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-purple-600 mb-1">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">ML Corpus</span>
            </div>
            <div className="font-serif text-2xl font-black text-purple-700">{mlDataset.length}</div>
            <span className="text-[11px] text-purple-600">Tagalog sentences</span>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-amber-600 mb-1">
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Audit Logs</span>
            </div>
            <div className="font-serif text-2xl font-black text-amber-700">{logs.length}</div>
            <span className="text-[11px] text-amber-600">recorded events</span>
          </div>

          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200">
            <div className="flex items-center gap-1.5 text-indigo-700 mb-1">
              <HardDrive className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Storage Footprint</span>
            </div>
            <div className="font-serif text-2xl font-black text-indigo-700">
              {storageMetrics.formattedSize}
            </div>
            <span className="text-[11px] text-indigo-600">active storage</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Backup Export & Restore Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: Export Database Archive */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Download className="w-6 h-6" />
            </div>

            <div>
              <h2 className="font-serif text-xl font-bold text-slate-900">
                Institutional Database Export
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Generates a complete, structured JSON archive containing every database table and relation in the platform.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs text-slate-700">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Archive Includes:</span>
              </div>
              <ul className="space-y-1.5 text-slate-600 pl-6 list-disc text-[11px]">
                <li>All Survey Questionnaires, Options, and Form Settings ({surveys.length})</li>
                <li>All Student Feedback Entries & Sentiment Ratings ({responses.length})</li>
                <li>All User Profiles, Roles, and Departmental Assignments ({users.length})</li>
                <li>Tagalog & Taglish Machine Learning Training Datasets ({mlDataset.length})</li>
                <li>Institutional Activity & Audit Security Logs ({logs.length})</li>
                <li>Campus News & Survey Result Announcements ({newsList.length})</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Format: Standard <code className="font-mono text-indigo-600 font-bold">.json</code> (v2.5.0)
            </div>
            <button
              onClick={handleExportDatabase}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Generate Backup File</span>
            </button>
          </div>
        </div>

        {/* Module 2: Restore Database from File */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div>
              <h2 className="font-serif text-xl font-bold text-slate-900">
                Restore Database from Archive
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Upload a verified <code className="font-mono text-indigo-600">.json</code> snapshot to restore institutional surveys and responses.
              </p>
            </div>

            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <FileJson className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-700">
                {importFileName ? (
                  <span className="text-indigo-600">{importFileName}</span>
                ) : (
                  <span>Click to browse or drop backup .json file</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Accepts official EduFeedback exported JSON files
              </p>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Preview of Selected Backup */}
            {importedBackup && (
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3 text-xs">
                <div className="flex items-center justify-between text-emerald-900 font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Valid Archive Verified</span>
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-mono">
                    {importedBackup.version || "v2.5"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-slate-700 text-[11px]">
                  <div className="bg-white p-2 rounded-xl border border-emerald-100">
                    <div className="font-bold text-slate-900">{importedBackup.data?.surveys?.length || 0}</div>
                    <div className="text-slate-500 text-[10px]">Surveys</div>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-emerald-100">
                    <div className="font-bold text-slate-900">{importedBackup.data?.responses?.length || 0}</div>
                    <div className="text-slate-500 text-[10px]">Responses</div>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-emerald-100">
                    <div className="font-bold text-slate-900">{importedBackup.data?.users?.length || 0}</div>
                    <div className="text-slate-500 text-[10px]">Users</div>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block">Restore Strategy:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                        restoreMode === "overwrite"
                          ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === "overwrite"}
                        onChange={() => setRestoreMode("overwrite")}
                        className="text-indigo-600"
                      />
                      <span>Full Overwrite</span>
                    </label>

                    <label
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                        restoreMode === "merge"
                          ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="restoreMode"
                        checked={restoreMode === "merge"}
                        onChange={() => setRestoreMode("merge")}
                        className="text-indigo-600"
                      />
                      <span>Smart Merge</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              disabled={!importedBackup}
              onClick={() => setIsConfirmingRestore(true)}
              className={`px-5 py-2.5 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors ${
                importedBackup
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Apply Restore</span>
            </button>
          </div>
        </div>
      </div>

      {/* Snapshots History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-900">
              System Recovery Points & Saved Snapshots
            </h3>
            <p className="text-xs text-slate-500">
              Fast rollbacks stored locally in platform cache. Allows instant rollback without file uploads.
            </p>
          </div>
          <button
            onClick={() => setIsCreatingSnapshot(true)}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto border border-indigo-200"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create Recovery Point</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Snapshot Label</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Created By</th>
                <th className="p-4">Records Contained</th>
                <th className="p-4">Size</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {snapshots.length > 0 ? (
                snapshots.map((snap) => (
                  <tr key={snap.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{snap.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500">{snap.createdAt}</td>
                    <td className="p-4 font-mono text-[11px] text-slate-600">{snap.createdBy}</td>
                    <td className="p-4 text-slate-700">
                      <span className="font-bold text-slate-900">{snap.stats.surveysCount}</span> surveys,{" "}
                      <span className="font-bold text-slate-900">{snap.stats.responsesCount}</span> responses
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-500">
                      {(snap.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="p-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleRestoreSnapshot(snap)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-emerald-200"
                        title="Restore system to this snapshot point"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snap.id, snap.name)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Delete Snapshot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <Clock className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <div className="font-semibold text-slate-600 text-xs">No local snapshots saved yet</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Click "Create Recovery Point" or download a backup to automatically save a snapshot.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Firebase Cloud Database Readiness & Activation Section */}
      <div className="bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/10 rounded-3xl border border-amber-200 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider border border-amber-200">
              <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
              <span>Firebase Cloud Architecture Ready</span>
            </div>
            <h3 className="font-serif text-xl font-bold text-slate-900">
              Database Persistence Mode & Firebase Switcher
            </h3>
            <p className="text-xs text-slate-600 max-w-2xl">
              Currently operating on local demonstration datasets. The entire codebase is pre-wired for Google Firebase Firestore and Auth with clean commenting markers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-500 font-medium">Active Database:</span>
              <span className="font-bold text-slate-900">
                {USE_FIREBASE && isFirebaseConfigured() ? "Firebase Firestore (Cloud)" : "Local Demo Storage (v2.5)"}
              </span>
            </div>

            <button
              onClick={() => setShowFirebaseGuide(!showFirebaseGuide)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Code className="w-3.5 h-3.5 text-amber-600" />
              <span>{showFirebaseGuide ? "Hide Setup Steps" : "Show Setup Steps"}</span>
              {showFirebaseGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showFirebaseGuide && (
          <div className="space-y-4 pt-2 border-t border-amber-200/60 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold">1</span>
                  <span>Paste Credentials</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Open <code className="font-mono text-amber-700 bg-amber-50 px-1 py-0.5 rounded">src/lib/firebase.ts</code> and paste your project config in <code className="font-mono text-slate-700">firebaseConfig</code>.
                </p>
                <div className="text-[10px] text-slate-400">
                  Status: {isFirebaseConfigured() ? "✅ Credentials Detected" : "⏳ Standby (Placeholder)"}
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold">2</span>
                  <span>Flip The Switch</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  In <code className="font-mono text-amber-700 bg-amber-50 px-1 py-0.5 rounded">src/lib/databaseService.ts</code>, change:
                  <br />
                  <code className="font-mono text-slate-700 block mt-1 bg-slate-50 p-1 rounded font-semibold">export const USE_FIREBASE = true;</code>
                </p>
                <div className="text-[10px] text-slate-400">
                  Current: <span className="font-mono font-bold text-amber-600">{USE_FIREBASE ? "true" : "false"}</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold">3</span>
                    <span>Migrate Demo Data</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Upload all initial demo surveys, questions, and students to your fresh Firestore collection with 1 click.
                  </p>
                </div>

                <button
                  onClick={handleSeedFirestore}
                  disabled={isSeedingFirestore || !isFirebaseConfigured()}
                  className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    isFirebaseConfigured()
                      ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>{isSeedingFirestore ? "Seeding Cloud..." : "Seed Firestore From Demo"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone: Factory Reset */}
      <div className="bg-rose-50/50 rounded-3xl border border-rose-200 p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-rose-700 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>Administrative Danger Zone</span>
            </div>
            <h3 className="font-serif text-lg font-bold text-slate-900">
              Reset Database to Initial Factory Seed Demo Data
            </h3>
            <p className="text-xs text-slate-600">
              Restores the default institutional surveys, student feedback responses, and Tagalog sentiment training sentences.
            </p>
          </div>

          <button
            onClick={() => {
              setResetConfirmText("");
              setShowResetModal(true);
            }}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors shrink-0"
          >
            Reset to Demo Seeds
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: CREATE INSTANT SNAPSHOT */}
      {/* ============================================================ */}
      {isCreatingSnapshot && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCreatingSnapshot(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Create Recovery Point Snapshot
                </h3>
                <p className="text-xs text-slate-500">
                  Save a point-in-time state of surveys, responses, and users.
                </p>
              </div>
              <button
                onClick={() => setIsCreatingSnapshot(false)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSnapshotSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Snapshot Label / Description</label>
                <input
                  type="text"
                  value={snapshotCustomName}
                  onChange={(e) => setSnapshotCustomName(e.target.value)}
                  placeholder="e.g. Pre-Midterm Backup, Q1 Evaluation Archive"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-400"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] space-y-1">
                <div className="font-bold text-slate-800">Snapshot Contents:</div>
                <div>{surveys.length} Surveys · {responses.length} Responses · {users.length} Users · {mlDataset.length} ML Sentences</div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingSnapshot(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CONFIRM RESTORE */}
      {/* ============================================================ */}
      {isConfirmingRestore && importedBackup && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsConfirmingRestore(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-slate-900">
                Confirm Database Restore
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to restore the system from{" "}
                <strong className="text-slate-900">{importFileName}</strong> using{" "}
                <strong className="text-indigo-600 uppercase font-mono">{restoreMode}</strong> mode.
              </p>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold">Important Notice:</div>
              <p className="text-[11px] leading-relaxed">
                {restoreMode === "overwrite"
                  ? "This will replace all current surveys, responses, users, and ML datasets with the records from the backup archive."
                  : "New records from the archive will be merged into your current database. Existing IDs will not be duplicated."}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmingRestore(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Confirm & Apply Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: FACTORY RESET CONFIRMATION */}
      {/* ============================================================ */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowResetModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-slate-900">
                Confirm Factory Database Reset
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This action will wipe all customized surveys and responses, reverting the platform back to the initial sample datasets.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                To confirm, type <span className="font-mono text-rose-600 font-black">RESET</span> below:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Type RESET"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:border-rose-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={resetConfirmText.trim().toUpperCase() !== "RESET"}
                onClick={handleFactoryReset}
                className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-xs transition-colors ${
                  resetConfirmText.trim().toUpperCase() === "RESET"
                    ? "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
