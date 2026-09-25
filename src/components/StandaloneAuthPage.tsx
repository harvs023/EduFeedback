import React, { useState } from "react";
import { UserProfile, Position } from "../types";
import {
  DEPARTMENTS_DATA,
  PROGRAMS_BY_DEPARTMENT,
  DEMO_ACCOUNTS_CREDENTIALS,
  DemoAccountCredential,
} from "../data/initialData";
import { DatabaseService } from "../lib/databaseService";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  ShieldCheck,
  Sparkles,
  LogIn,
  UserPlus,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Building,
  GraduationCap,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  KeyRound,
  Users,
  Database,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

interface StandaloneAuthPageProps {
  onLogin: (user: UserProfile) => void;
  defaultMode?: "login" | "register";
}

export const StandaloneAuthPage: React.FC<StandaloneAuthPageProps> = ({
  onLogin,
  defaultMode = "login",
}) => {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [autoFilledAccount, setAutoFilledAccount] = useState<string | null>(null);

  // Sign In Form States
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Registration Form States
  const [regName, setRegName] = useState<string>("");
  const [regEmail, setRegEmail] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>("");
  const [regPos, setRegPos] = useState<"Student" | "Student Officer" | "Faculty">("Student");
  const [regDepartment, setRegDepartment] = useState<string>("College of Computer Studies");
  const [regProgram, setRegProgram] = useState<string>("Bachelor of Science in Computer Science");
  const [regYear, setRegYear] = useState<string>("3rd Year");
  const [regSection, setRegSection] = useState<string>("CS-3A");
  const [regIdNumber, setRegIdNumber] = useState<string>("");

  const programsForDept = PROGRAMS_BY_DEPARTMENT[regDepartment] || [];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAutoFill = (account: DemoAccountCredential) => {
    setMode("login");
    setLoginEmail(account.email);
    setLoginPassword(account.password);
    setAutoFilledAccount(account.email);
    setError(null);
    setTimeout(() => setAutoFilledAccount(null), 2500);
  };

  const handleDirectSignIn = async (account: DemoAccountCredential) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await DatabaseService.login(account.email, account.password);
      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.error || "Unable to sign in with demo credentials.");
      }
    } catch (err: any) {
      setError(err?.message || "An authentication error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginEmail.trim()) {
      setError("Please enter your university email address.");
      return;
    }
    if (!loginPassword) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await DatabaseService.login(loginEmail, loginPassword);
      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.error || "Invalid university credentials. Please check your email or password.");
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred during authentication.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!regEmail.trim()) {
      setError("Please enter your institutional email.");
      return;
    }
    if (!regEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!regPassword) {
      setError("Please create a password.");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      let roleType: "superadmin" | "user" = "user";
      const newProfile: UserProfile = {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        pos: regPos as Position,
        role: roleType,
        status: "active",
        department: regDepartment,
        program: regProgram,
        surveys: 0,
        joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };

      if (regPos === "Student" || regPos === "Student Officer") {
        newProfile.studentId = regIdNumber.trim() || `2026-${Math.floor(10000 + Math.random() * 90000)}`;
        newProfile.year = regYear;
        newProfile.section = regSection.trim() || "A";
      }

      const result = await DatabaseService.register(newProfile, regPassword);
      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.error || "Failed to create account.");
      }
    } catch (err: any) {
      setError(err?.message || "Registration encountered an unexpected issue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top University QA App Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">EduFeedback Hub</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Institutional QA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Academic Survey Intelligence & Tagalog Sentiment NLP Platform
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-medium">Tagalog NLP v3 Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isFirebaseConfigured() ? "Firebase Cloud Mode" : "Local & Prisma DB Ready"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dual-Pane Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start my-auto">
        {/* Left Column: Demo Users & Admin Credentials Showcase */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/40 text-indigo-300 text-xs font-semibold border border-indigo-700/50 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Instant Access Demonstration Accounts</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Sign In to Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-teal-300">University Portal</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
              Welcome to the institutional feedback system. You can sign in using your university email or use any of the pre-configured accounts below to test different roles.
            </p>
          </div>

          {/* Credentials Cards Container */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Available Demo Users & Admin Credentials
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                1-Click Sign In Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
              {DEMO_ACCOUNTS_CREDENTIALS.map((acc) => {
                const isAutoFilled = autoFilledAccount === acc.email;
                return (
                  <div
                    key={acc.email}
                    className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between relative ${
                      isAutoFilled
                        ? "bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-400"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                    }`}
                  >
                    <div>
                      {/* Badge and Name */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acc.badgeColor}`}>
                          {acc.badgeLabel}
                        </span>
                        {acc.pos === "Superadmin" && (
                          <span className="text-[9px] font-semibold text-rose-400 bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-900/50">
                            Root Admin
                          </span>
                        )}
                      </div>

                      <div className="font-semibold text-sm text-white">{acc.name}</div>
                      <div className="text-[11px] text-slate-400 truncate mb-3">{acc.department}</div>

                      {/* Credentials Display with Copy */}
                      <div className="space-y-1.5 bg-slate-900/90 rounded-lg p-2 border border-slate-800/80 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Email</span>
                          <div className="flex items-center gap-1.5">
                            <code className="text-indigo-300 font-mono text-[11px] select-all truncate max-w-[170px]">
                              {acc.email}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopy(acc.email, `email-${acc.email}`)}
                              className="text-slate-400 hover:text-slate-200 p-0.5 transition-colors cursor-pointer"
                              title="Copy email"
                            >
                              {copiedKey === `email-${acc.email}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Pass</span>
                          <div className="flex items-center gap-1.5">
                            <code className="text-amber-300 font-mono text-[11px] select-all">
                              {acc.password}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopy(acc.password, `pass-${acc.email}`)}
                              className="text-slate-400 hover:text-slate-200 p-0.5 transition-colors cursor-pointer"
                              title="Copy password"
                            >
                              {copiedKey === `pass-${acc.email}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed line-clamp-2">
                        {acc.description}
                      </p>
                    </div>

                    {/* Actions: Auto-fill or Direct Sign In */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => handleAutoFill(acc)}
                        className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
                      >
                        <span>Auto-fill</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectSignIn(acc)}
                        disabled={isLoading}
                        className={`w-full py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          acc.pos === "Superadmin"
                            ? "bg-rose-600 hover:bg-rose-500 text-white shadow-xs shadow-rose-600/30"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs shadow-indigo-600/30"
                        }`}
                      >
                        <span>Sign In</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Firebase & Demo Data Note */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Demo datasets match <code>scripts/demo-data.json</code> &amp; Firebase Cloud</span>
              </span>
              <span className="text-slate-400">Version 3.0</span>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Form Card (Sign In & Register) */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SIGN IN FORM */}
            {/* ======================================================== */}
            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    University Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. admin@edufeedback.edu"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Account Password
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                    />
                    <span>Remember this session</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail("admin@edufeedback.edu");
                      setLoginPassword("admin123");
                      setError(null);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    Quick fill admin
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="mt-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    New user without an account? Click <strong>Create Account</strong> above or click any demo credential card on the left to test.
                  </span>
                </div>
              </form>
            ) : (
              /* ======================================================== */
              /* CREATE ACCOUNT / REGISTRATION FORM */
              /* ======================================================== */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Juan A. Dela Cruz"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    University Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. user@school.edu"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      required
                      className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Confirm
                    </label>
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Campus Role Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Campus Position / Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Student", "Student Officer", "Faculty"] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setRegPos(pos)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                          regPos === pos
                            ? "bg-indigo-600/30 border-indigo-500 text-indigo-200 ring-1 ring-indigo-400"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Department Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    College / Department
                  </label>
                  <select
                    value={regDepartment}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      setRegDepartment(newDept);
                      const progs = PROGRAMS_BY_DEPARTMENT[newDept] || [];
                      if (progs.length > 0) setRegProgram(progs[0]);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.keys(DEPARTMENTS_DATA).map((dept) => (
                      <option key={dept} value={dept} className="bg-slate-900 text-white">
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Academic Program */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Academic Degree Program
                  </label>
                  <select
                    value={regProgram}
                    onChange={(e) => setRegProgram(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {programsForDept.map((prog) => (
                      <option key={prog} value={prog} className="bg-slate-900 text-white">
                        {prog}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conditional Fields for Students & Student Officers */}
                {(regPos === "Student" || regPos === "Student Officer") && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Year Level
                      </label>
                      <select
                        value={regYear}
                        onChange={(e) => setRegYear(e.target.value)}
                        className="w-full px-2 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Section
                      </label>
                      <input
                        type="text"
                        value={regSection}
                        onChange={(e) => setRegSection(e.target.value)}
                        placeholder="CS-3A"
                        className="w-full px-2 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Student ID
                      </label>
                      <input
                        type="text"
                        value={regIdNumber}
                        onChange={(e) => setRegIdNumber(e.target.value)}
                        placeholder="2026-00123"
                        className="w-full px-2 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating university account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration & Enter</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 px-6 py-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 Institutional Quality Assurance Office. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 transition-colors">Privacy & Student Protection Policy</span>
            <span>•</span>
            <span className="hover:text-slate-400 transition-colors">CHED / DepEd QA Guidelines</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
