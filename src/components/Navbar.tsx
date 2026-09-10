import React, { useState } from "react";
import { UserProfile, NotificationItem } from "../types";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  BrainCircuit,
  Newspaper,
  PlusCircle,
  ShieldAlert,
  Search,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  currentUser: UserProfile | null;
  onSwitchUser: (user: UserProfile) => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (cat: string) => void;
  notifications?: NotificationItem[];
  unreadNotifsCount?: number;
  unreadNewsCount?: number;
  flaggedSurveysCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onSwitchUser,
  onOpenProfile,
  onOpenAuth,
  searchQuery,
  onSearchChange,
  notifications = [],
  unreadNotifsCount = 0,
  unreadNewsCount = 0,
  flaggedSurveysCount = 0,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  // All users except admin can create surveys (Students, Student Officers, Faculty)
  const canCreateSurvey = !isSuperadmin;

  const navItems = [
    { id: "surveys", label: "Surveys", icon: ClipboardList, badge: undefined },
    { id: "analytics", label: "Analytics", icon: BarChart3, badge: undefined },
    ...(isSuperadmin ? [{ id: "tagalog-ml", label: "ML Models", icon: BrainCircuit, badge: "94.2%" }] : []),
    { id: "news", label: "News & Actions", icon: Newspaper, badgeCount: unreadNewsCount },
    ...(canCreateSurvey ? [{ id: "create", label: "Create Survey", icon: PlusCircle, badge: undefined }] : []),
    ...(isSuperadmin
      ? [
          {
            id: "admin",
            label: "Admin Moderation",
            icon: ShieldAlert,
            badgeCount: flaggedSurveysCount,
          },
        ]
      : []),
  ];

  const handleRoleQuickSelect = (pos: "Student" | "Student Officer" | "Faculty" | "Superadmin") => {
    const demoUser: UserProfile = {
      email:
        pos === "Student"
          ? "juan.delacruz@school.edu"
          : pos === "Student Officer"
          ? "clara.santos@school.edu"
          : pos === "Faculty"
          ? "maria.reyes@school.edu"
          : "admin@edufeedback.edu",
      name:
        pos === "Student"
          ? "Juan Dela Cruz"
          : pos === "Student Officer"
          ? "Clara Santos"
          : pos === "Faculty"
          ? "Dr. Maria Reyes"
          : "System Administrator",
      pos: pos,
      role: pos === "Superadmin" ? "superadmin" : "user",
      status: "active",
      department:
        pos === "Faculty"
          ? "College of Computer Studies"
          : pos === "Superadmin"
          ? "Institutional QA Office"
          : pos === "Student Officer"
          ? "College of Business Administration"
          : "College of Computer Studies",
      program: pos === "Student" ? "BS Computer Science" : pos === "Student Officer" ? "BSBA Major in Marketing Management" : undefined,
      year: pos === "Student" ? "3rd Year" : pos === "Student Officer" ? "4th Year" : undefined,
      studentId: pos === "Student" ? "2024-00189" : pos === "Student Officer" ? "2023-01452" : undefined,
    };
    onSwitchUser(demoUser);
  };

  return (
    <>
      {/* Sleek Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Mobile Left: Menu Toggle + Brand */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold italic shadow-xs">
              E
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">EduFeedback</span>
          </div>
        </div>

        {/* Desktop Search Bar: Sleek pill input */}
        <div className="hidden sm:flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-full w-80 md:w-96 border border-slate-200/50 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search themes or surveys..."
            className="bg-transparent border-none outline-hidden text-sm w-full text-slate-800 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Quick Role Switcher */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Role:</span>
            <button
              onClick={() => handleRoleQuickSelect("Student")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                currentUser?.pos === "Student"
                  ? "bg-white text-indigo-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Student
            </button>
            <button
              onClick={() => handleRoleQuickSelect("Student Officer")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                currentUser?.pos === "Student Officer"
                  ? "bg-white text-indigo-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Officer
            </button>
            <button
              onClick={() => handleRoleQuickSelect("Faculty")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                currentUser?.pos === "Faculty"
                  ? "bg-white text-indigo-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Faculty
            </button>
            <button
              onClick={() => handleRoleQuickSelect("Superadmin")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin"
                  ? "bg-slate-900 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Admin
            </button>
          </div>

          {/* Quick Create Survey Button for all users except admin */}
          {canCreateSurvey && (
            <button
              onClick={() => onNavigate("create")}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs cursor-pointer transition-all shrink-0"
              title="Create a New Survey"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Create Survey</span>
            </button>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifMenu(!showNotifMenu);
                setShowUserMenu(false);
              }}
              className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              title="Notifications"
            >
              {unreadNotifsCount > 0 ? (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              ) : (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-white" />
              )}
              <Bell className="w-5 h-5" />
            </button>

            {/* Notification Dropdown */}
            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
                    <p className="text-xs text-slate-500">System alerts & survey updates</p>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-full">
                    Active
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">No new notifications</div>
                  ) : (
                    notifications.slice(0, 4).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setShowNotifMenu(false);
                          if (n.type === "news") onNavigate("news");
                          else if (n.type === "response") onNavigate("analytics");
                          else onNavigate("surveys");
                        }}
                        className="p-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Bell className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{n.title}</p>
                            <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {n.displayTime || n.time}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      setShowNotifMenu(false);
                      onNavigate("news");
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    View Campus News & Updates →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill / Menu */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifMenu(false);
                }}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight max-w-[110px] truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">{currentUser.pos}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Signed In As</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
                    <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                    <div className="mt-2 inline-block px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-md">
                      {currentUser.pos} · {currentUser.department || "Academic Department"}
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenProfile();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>User Profile & Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate("analytics");
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <span>View Analytics Dashboard</span>
                    </button>
                  </div>
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAuth();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      <span>Switch Account Persona</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2">
          {/* Mobile Search */}
          <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-full w-full">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search themes or surveys..."
              className="bg-transparent border-none outline-hidden text-sm w-full text-slate-800"
            />
          </div>

          {/* Mobile Quick Role Switcher */}
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-100 rounded-xl">
            <span className="w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Switch Test Role:
            </span>
            {(["Student", "Student Officer", "Faculty", "Superadmin"] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  handleRoleQuickSelect(r);
                  setMobileMenuOpen(false);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                  currentUser?.pos === r
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white text-slate-700 shadow-xs"
                }`}
              >
                {r === "Student Officer" ? "Officer" : r === "Superadmin" ? "Admin" : r}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {Boolean(item.badgeCount && item.badgeCount > 0) && (
                    <span className="px-2 py-0.5 text-xs font-bold text-white bg-rose-500 rounded-full">
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
