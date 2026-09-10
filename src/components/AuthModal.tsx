import React, { useState } from "react";
import { UserProfile } from "../types";
import { SAMPLE_USERS, DEPARTMENTS_DATA, PROGRAMS_BY_DEPARTMENT } from "../data/initialData";
import { X, LogIn, UserPlus, Shield, Lock, Mail, User, Sparkles, CheckCircle2 } from "lucide-react";

interface AuthModalProps {
  onClose: () => void;
  onLogin: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onLogin }) => {
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [pos, setPos] = useState<UserProfile["pos"]>("Student");
  const [department, setDepartment] = useState<string>("College of Computer Studies");
  const [program, setProgram] = useState<string>("BS Computer Science");
  const [year, setYear] = useState<string>("3rd Year");
  const [section, setSection] = useState<string>("CS-3A");
  const [error, setError] = useState<string | null>(null);

  const handleQuickLogin = (sampleUser: UserProfile) => {
    onLogin(sampleUser);
    onClose();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegisterMode) {
      if (!name || !email) {
        setError("Please enter your name and email.");
        return;
      }
      const newUser: UserProfile = {
        name,
        email,
        pos,
        role: pos === "Faculty" ? "faculty" : pos === "Student Officer" ? "officer" : "student",
        department,
        program,
        year,
        section,
        studentId: `2026-${Math.floor(10000 + Math.random() * 90000)}`,
        status: "active",
      };
      onLogin(newUser);
      onClose();
    } else {
      if (!email) {
        setError("Please enter your email.");
        return;
      }
      const existing = SAMPLE_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        onLogin(existing);
        onClose();
      } else {
        const user: UserProfile = {
          name: email.split("@")[0],
          email,
          pos: "Student",
          role: "student",
          department: "College of Computer Studies",
          program: "BS Computer Science",
          year: "3rd Year",
          section: "CS-3A",
          status: "active",
        };
        onLogin(user);
        onClose();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-bold text-slate-900">
              {isRegisterMode ? "Create EduFeedback Account" : "Sign In to EduFeedback"}
            </h2>
            <p className="text-xs text-slate-500">
              {isRegisterMode
                ? "Join university student & faculty community"
                : "Select a test persona or sign in with university credentials"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Persona Switcher */}
        {!isRegisterMode && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Quick 1-Click Test Personas:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_USERS.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => handleQuickLogin(user)}
                  className="p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all cursor-pointer space-y-0.5"
                >
                  <div className="font-bold text-xs text-slate-900 truncate">{user.name}</div>
                  <div className="text-[10px] text-blue-700 font-semibold">{user.pos}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs font-bold text-rose-700">
            ⚠️ {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
          {isRegisterMode && (
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maria Santos"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">University Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@school.edu.ph"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          {isRegisterMode && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Campus Role</label>
                  <select
                    value={pos}
                    onChange={(e) => setPos(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="Student">Student</option>
                    <option value="Student Officer">Student Officer</option>
                    <option value="Faculty">Faculty</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">College</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    {Object.keys(DEPARTMENTS_DATA).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              {isRegisterMode ? "Create Account & Sign In" : "Sign In with Email"}
            </button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsRegisterMode(!isRegisterMode)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {isRegisterMode ? "Already have an account? Sign In" : "Need an account? Register as Student/Faculty"}
          </button>
        </div>
      </div>
    </div>
  );
};
