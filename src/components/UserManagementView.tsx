import React, { useState, useMemo } from "react";
import { UserProfile } from "../types";
import { DEPARTMENTS_DATA } from "../data/initialData";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Briefcase,
  UserCheck,
  UserX,
  X,
  Check,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Building,
  Mail,
  Hash,
  Sparkles,
} from "lucide-react";

interface UserManagementViewProps {
  users: UserProfile[];
  currentUser: UserProfile | null;
  onAddUser: (user: UserProfile) => void;
  onUpdateUser: (email: string, changes: Partial<UserProfile>) => void;
  onDeleteUser: (email: string) => void;
  onToggleUserStatus: (email: string, status: "active" | "suspended") => void;
  onPromoteUser: (email: string, newPos: UserProfile["pos"]) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onToggleUserStatus,
  onPromoteUser,
}) => {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [resetCredsUser, setResetCredsUser] = useState<{ user: UserProfile; tempPass: string } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Form State for Add User
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    pos: "Student" as UserProfile["pos"],
    department: "College of Computer Studies",
    program: "Bachelor of Science in Computer Science",
    year: "1st Year",
    section: "A",
    studentId: "",
    status: "active" as UserProfile["status"],
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Metrics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const suspended = users.filter((u) => u.status === "suspended").length;
    const students = users.filter((u) => u.pos === "Student").length;
    const creators = users.filter((u) => u.pos === "Faculty" || u.pos === "Student Officer").length;
    const admins = users.filter((u) => u.pos === "Superadmin").length;
    return { total, active, suspended, students, creators, admins };
  }, [users]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesId = (u.studentId || "").toLowerCase().includes(q);
        const matchesProg = (u.program || "").toLowerCase().includes(q);
        const matchesDept = (u.department || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesId && !matchesProg && !matchesDept) {
          return false;
        }
      }

      // Role filter
      if (roleFilter !== "all" && u.pos !== roleFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && u.status !== statusFilter) {
        return false;
      }

      // Department filter
      if (departmentFilter !== "all" && u.department !== departmentFilter) {
        return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter, departmentFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Position",
      "Role",
      "Status",
      "Department",
      "Program",
      "Year Level",
      "Section",
      "Student/Employee ID",
      "Joined Date",
      "Surveys Count",
    ];

    const rows = filteredUsers.map((u) => [
      `"${u.name}"`,
      `"${u.email}"`,
      `"${u.pos}"`,
      `"${u.role}"`,
      `"${u.status}"`,
      `"${u.department || "N/A"}"`,
      `"${u.program || "N/A"}"`,
      `"${u.year || "N/A"}"`,
      `"${u.section || "N/A"}"`,
      `"${u.studentId || "N/A"}"`,
      `"${u.joined || "Aug 2024"}"`,
      `"${u.surveys || 0}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EduFeedback_Users_Roster_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit Add User
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!addForm.name.trim()) {
      setFormError("Please provide the user's full name.");
      return;
    }
    if (!addForm.email.trim() || !addForm.email.includes("@")) {
      setFormError("Please enter a valid institutional email address.");
      return;
    }

    const emailLower = addForm.email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === emailLower)) {
      setFormError(`An account with email "${addForm.email}" is already registered.`);
      return;
    }

    const newUser: UserProfile = {
      name: addForm.name.trim(),
      email: emailLower,
      pos: addForm.pos,
      role: addForm.pos === "Superadmin" ? "superadmin" : "user",
      status: addForm.status,
      department: addForm.department,
      program: addForm.program,
      year: addForm.year,
      section: addForm.section,
      studentId: addForm.studentId.trim() || undefined,
      joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      surveys: 0,
    };

    try {
      onAddUser(newUser);
      setShowAddModal(false);
      setAddForm({
        name: "",
        email: "",
        pos: "Student",
        department: "College of Computer Studies",
        program: "Bachelor of Science in Computer Science",
        year: "1st Year",
        section: "A",
        studentId: "",
        status: "active",
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to create user account.");
    }
  };

  // Generate Temporary Credentials
  const handleGenerateCreds = (user: UserProfile) => {
    const randomSuffix = Math.random().toString(36).slice(-6).toUpperCase();
    const tempPass = `EduPass_${randomSuffix}!`;
    setResetCredsUser({ user, tempPass });
    setCopiedPass(false);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Quick Action Bar */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Institutional Identity & Access Management</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">
              User & Permission Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Supervise student respondents, faculty survey creators, student council officers, and system administrator privileges.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-slate-200"
              title="Download user roster spreadsheet"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export Roster (CSV)</span>
            </button>

            <button
              onClick={() => {
                setFormError(null);
                setShowAddModal(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add / Invite User</span>
            </button>
          </div>
        </div>

        {/* Global User Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Accounts
            </span>
            <div className="font-serif text-2xl font-black text-slate-900 mt-0.5">{stats.total}</div>
            <span className="text-[11px] text-slate-500">enrolled on platform</span>
          </div>

          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Active Status
            </span>
            <div className="font-serif text-2xl font-black text-emerald-700 mt-0.5">{stats.active}</div>
            <span className="text-[11px] text-emerald-600">authorized access</span>
          </div>

          <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
              Suspended
            </span>
            <div className="font-serif text-2xl font-black text-rose-700 mt-0.5">{stats.suspended}</div>
            <span className="text-[11px] text-rose-600">login restricted</span>
          </div>

          <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              Students
            </span>
            <div className="font-serif text-2xl font-black text-blue-700 mt-0.5">{stats.students}</div>
            <span className="text-[11px] text-blue-600">primary respondents</span>
          </div>

          <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
              Survey Creators
            </span>
            <div className="font-serif text-2xl font-black text-purple-700 mt-0.5">{stats.creators}</div>
            <span className="text-[11px] text-purple-600">Faculty & Officers</span>
          </div>

          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
              Administrators
            </span>
            <div className="font-serif text-2xl font-black text-amber-700 mt-0.5">{stats.admins}</div>
            <span className="text-[11px] text-amber-600">superadmin rights</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, student ID, program..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-400"
            />
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Roles & Positions</option>
              <option value="Student">Student (Respondent)</option>
              <option value="Student Officer">Student Officer (Creator)</option>
              <option value="Faculty">Faculty (Creator)</option>
              <option value="Superadmin">Superadmin (Administrator)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="sm:col-span-3">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Academic Colleges</option>
              {Object.keys(DEPARTMENTS_DATA).map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter tags & Reset */}
        {(searchQuery || roleFilter !== "all" || statusFilter !== "all" || departmentFilter !== "all") && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs flex-wrap">
            <span className="text-slate-500 font-medium">Active filters:</span>
            {searchQuery && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
                "{searchQuery}"
              </span>
            )}
            {roleFilter !== "all" && (
              <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                Role: {roleFilter}
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
                Status: {statusFilter}
              </span>
            )}
            {departmentFilter !== "all" && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
                Dept: {departmentFilter}
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("all");
                setStatusFilter("all");
                setDepartmentFilter("all");
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold ml-auto cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* User Directory Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700">
            Showing <strong className="text-slate-900">{filteredUsers.length}</strong> of{" "}
            <strong className="text-slate-900">{users.length}</strong> registered accounts
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">User & Contact Details</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4">Department & Academic Program</th>
                <th className="p-4">Surveys Authored</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.email.toLowerCase() === u.email.toLowerCase();
                  const roleBadgeColor =
                    u.pos === "Superadmin"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : u.pos === "Faculty"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : u.pos === "Student Officer"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-700 border-slate-200";

                  const initial = u.name.charAt(0).toUpperCase();

                  return (
                    <tr key={u.email} className="hover:bg-slate-50 transition-colors">
                      {/* Name & Email */}
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 border border-indigo-200 shadow-2xs">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded-md bg-indigo-600 text-white text-[9px] font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{u.email}</span>
                            </div>
                            {u.studentId && (
                              <div className="text-[10px] text-slate-400 font-mono">ID: {u.studentId}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role selector */}
                      <td className="p-4">
                        <select
                          value={u.pos}
                          disabled={isCurrent}
                          onChange={(e) => onPromoteUser(u.email, e.target.value as any)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors focus:outline-hidden ${roleBadgeColor}`}
                        >
                          <option value="Student">Student (Respondent)</option>
                          <option value="Student Officer">Student Officer (Creator)</option>
                          <option value="Faculty">Faculty (Creator)</option>
                          <option value="Superadmin">Superadmin (Admin)</option>
                        </select>
                      </td>

                      {/* Department & Program */}
                      <td className="p-4 space-y-0.5">
                        <div className="font-semibold text-slate-900">{u.department || "Institutional QA"}</div>
                        {u.program && (
                          <div className="text-[11px] text-slate-500 max-w-xs truncate">{u.program}</div>
                        )}
                        {(u.year || u.section) && (
                          <div className="text-[10px] text-slate-400">
                            {u.year} {u.section ? `· Sec ${u.section}` : ""}
                          </div>
                        )}
                      </td>

                      {/* Surveys Authored */}
                      <td className="p-4">
                        <span className="font-bold text-slate-900 text-xs">
                          {u.surveys || 0}
                        </span>{" "}
                        <span className="text-[11px] text-slate-500">surveys</span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            u.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === "active" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span>{u.status.toUpperCase()}</span>
                        </span>
                      </td>

                      {/* Administrative Actions */}
                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        {/* Edit User Button */}
                        <button
                          onClick={() => setEditingUser(u)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="Edit Account Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => handleGenerateCreds(u)}
                          className="p-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                          title="Reset Password / Generate Temp Credentials"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        {/* Suspend / Activate Button */}
                        {!isCurrent && (
                          u.status === "active" ? (
                            <button
                              onClick={() => onToggleUserStatus(u.email, "suspended")}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Suspend Account Access"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onToggleUserStatus(u.email, "active")}
                              className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer"
                              title="Restore Active Access"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )
                        )}

                        {/* Delete User Button */}
                        {!isCurrent && (
                          <button
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <div className="font-bold text-slate-700 text-sm">No Accounts Match Filters</div>
                    <p className="text-xs text-slate-400 mt-1">
                      Try broadening your search term or resetting the role and department filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: ADD NEW USER */}
      {/* ============================================================ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                  <UserPlus className="w-3 h-3" />
                  <span>Account Provisioning</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-slate-900 mt-1.5">
                  Add / Invite University User
                </h3>
                <p className="text-xs text-slate-500">
                  Register a student respondent, faculty creator, or administrative account.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. John Doe, Ph.D. or Juanita Santos"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-400"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="e.g. user@school.edu.ph"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-400"
                />
              </div>

              {/* Position / Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Role *</label>
                  <select
                    value={addForm.pos}
                    onChange={(e) => setAddForm({ ...addForm, pos: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  >
                    <option value="Student">Student (Respondent)</option>
                    <option value="Student Officer">Student Officer (Creator)</option>
                    <option value="Faculty">Faculty (Creator)</option>
                    <option value="Superadmin">Superadmin (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Student / Employee ID</label>
                  <input
                    type="text"
                    value={addForm.studentId}
                    onChange={(e) => setAddForm({ ...addForm, studentId: e.target.value })}
                    placeholder="e.g. 2026-00412"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Academic Department / College</label>
                <select
                  value={addForm.department}
                  onChange={(e) => {
                    const dept = e.target.value;
                    const progs = DEPARTMENTS_DATA[dept] || [];
                    setAddForm({
                      ...addForm,
                      department: dept,
                      program: progs[0] || "",
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
                >
                  {Object.keys(DEPARTMENTS_DATA).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Program */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Academic Degree Program</label>
                <select
                  value={addForm.program}
                  onChange={(e) => setAddForm({ ...addForm, program: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
                >
                  {(DEPARTMENTS_DATA[addForm.department] || []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Year Level</label>
                  <select
                    value={addForm.year}
                    onChange={(e) => setAddForm({ ...addForm, year: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Graduate School">Graduate School</option>
                    <option value="N/A">N/A (Faculty/Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={addForm.section}
                    onChange={(e) => setAddForm({ ...addForm, section: e.target.value })}
                    placeholder="e.g. A, CS-3A"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: EDIT USER */}
      {/* ============================================================ */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-slate-900">
                  Edit User: {editingUser.name}
                </h3>
                <p className="text-xs text-slate-500">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateUser(editingUser.email, {
                  name: editingUser.name,
                  pos: editingUser.pos,
                  role: editingUser.pos === "Superadmin" ? "superadmin" : "user",
                  department: editingUser.department,
                  program: editingUser.program,
                  year: editingUser.year,
                  section: editingUser.section,
                  studentId: editingUser.studentId,
                  status: editingUser.status,
                });
                setEditingUser(null);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role / Position</label>
                  <select
                    value={editingUser.pos}
                    onChange={(e) => setEditingUser({ ...editingUser, pos: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  >
                    <option value="Student">Student (Respondent)</option>
                    <option value="Student Officer">Student Officer (Creator)</option>
                    <option value="Faculty">Faculty (Creator)</option>
                    <option value="Superadmin">Superadmin (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  >
                    <option value="active">Active (Authorized)</option>
                    <option value="suspended">Suspended (Restricted)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Student / Employee ID</label>
                <input
                  type="text"
                  value={editingUser.studentId || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, studentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={editingUser.department || "College of Computer Studies"}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                >
                  {Object.keys(DEPARTMENTS_DATA).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Program</label>
                <input
                  type="text"
                  value={editingUser.program || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, program: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Year Level</label>
                  <input
                    type="text"
                    value={editingUser.year || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, year: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={editingUser.section || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, section: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: RESET CREDENTIALS */}
      {/* ============================================================ */}
      {resetCredsUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setResetCredsUser(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <KeyRound className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-slate-900">
                Temporary Credentials Generated
              </h3>
              <p className="text-xs text-slate-500">
                A single-use temporary password has been issued for <strong>{resetCredsUser.user.name}</strong> ({resetCredsUser.user.email}).
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Temporary Password (Valid 24h)
              </div>
              <div className="flex items-center justify-between font-mono text-sm font-black text-indigo-700 bg-white p-2.5 rounded-xl border border-slate-200">
                <span>{resetCredsUser.tempPass}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resetCredsUser.tempPass);
                    setCopiedPass(true);
                    setTimeout(() => setCopiedPass(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPass ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Provide this temporary password to the user. They will be prompted to choose a permanent secure password upon login.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setResetCredsUser(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: DELETE USER CONFIRMATION */}
      {/* ============================================================ */}
      {userToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setUserToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-slate-900">
                Permanently Remove Account?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete the account for{" "}
                <strong className="text-slate-900">{userToDelete.name}</strong> ({userToDelete.email})?
              </p>
            </div>

            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Irreversible Action</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                The user will lose authentication access immediately. Their historical responses will be retained anonymously for institutional reporting.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteUser(userToDelete.email);
                  setUserToDelete(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
