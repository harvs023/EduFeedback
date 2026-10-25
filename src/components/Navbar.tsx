import React, { useState } from "react";
import { UserProfile, NotificationItem } from "../types";
import { LocalStorageManager } from "../lib/storage";
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
  UserCheck,
  MessageSquare,
  Flag,
  SlidersHorizontal,
} from "lucide-react";

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  currentUser: UserProfile | null;
  onSwitchUser: (user: UserProfile) => void;
  onSignOut?: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onOpenRegister?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (cat: string) => void;
  notifications?: NotificationItem[];
  unreadNotifsCount?: number;
  unreadNewsCount?: number;
  flaggedSurveysCount?: number;
  onMarkAllNotificationsRead?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onSwitchUser,
  onSignOut,
  onOpenProfile,
  onOpenAuth,
  onOpenRegister,
  searchQuery,
  onSearchChange,
  notifications = [],
  unreadNotifsCount = 0,
  unreadNewsCount = 0,
  flaggedSurveysCount = 0,
  onMarkAllNotificationsRead,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  // All authenticated users can author surveys (Students, Officers, Faculty, Admins)
  const canCreateSurvey = Boolean(currentUser);

  const navItems = [
    { id: "surveys", label: "Surveys", icon: ClipboardList, badge: undefined },
    ...(currentUser
      ? [
          {
            id: "my-surveys",
            label: isSuperadmin ? "Survey Management" : "My Surveys",
            icon: isSuperadmin ? SlidersHorizontal : UserCheck,
            badge: undefined,
          },
        ]
      : []),
    { id: "analytics", label: "Analytics", icon: BarChart3, badge: undefined },
    ...(isSuperadmin ? [{ id: "tagalog-ml", label: "ML Models", icon: BrainCircuit, badge: "94.2%" }] : []),
    { id: "news", label: "News & Actions", icon: Newspaper, badgeCount: unreadNewsCount },
    ...(canCreateSurvey
      ? [
          {
            id: "create",
            label: isSuperadmin ? "New Instrument" : "Create Survey",
            icon: PlusCircle,
            badge: undefined,
          },
        ]
      : []),
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
          {/* Quick Create Survey Button for authorized members */}
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
                  <div className="flex items-center gap-2">
                    {unreadNotifsCount && unreadNotifsCount > 0 ? (
                      <button
                        onClick={() => {
                          if (onMarkAllNotificationsRead) {
                            onMarkAllNotificationsRead();
                          } else {
                            LocalStorageManager.markAllNotificationsRead(currentUser?.email);
                          }
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    ) : null}
                    <span className="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-full">
                      {notifications.length} Total
                    </span>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">No new notifications</div>
                  ) : (
                    notifications.map((n) => {
                      const isUnread = !n.read;
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            setShowNotifMenu(false);
                            if (n.type === "news") onNavigate("news");
                            else if (n.type === "response") onNavigate("analytics");
                            else onNavigate("surveys");
                          }}
                          className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                            isUnread ? "bg-indigo-50/30" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                n.type === "response"
                                  ? "bg-blue-50 text-blue-600"
                                  : n.type === "news"
                                  ? "bg-purple-50 text-purple-600"
                                  : n.type === "flag" || n.type === "flag_cleared"
                                  ? "bg-amber-50 text-amber-600"
                                  : n.type === "approval"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-indigo-50 text-indigo-600"
                              }`}
                            >
                              {n.type === "response" ? (
                                <MessageSquare className="w-3.5 h-3.5" />
                              ) : n.type === "news" ? (
                                <Sparkles className="w-3.5 h-3.5" />
                              ) : n.type === "flag" || n.type === "flag_cleared" ? (
                                <Flag className="w-3.5 h-3.5" />
                              ) : n.type === "approval" ? (
                                <UserCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Bell className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-bold text-slate-900 truncate">{n.title}</p>
                                {isUnread && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                {n.displayTime || n.time}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
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
                        onNavigate("my-surveys");
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      {isSuperadmin ? (
                        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ClipboardList className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{isSuperadmin ? "Campus Survey Management" : "My Created Surveys"}</span>
                    </button>
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
                        if (onSignOut) onSignOut();
                        else onOpenAuth();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAuth}
                className="px-3.5 py-1.5 text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={onOpenRegister || onOpenAuth}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Register
              </button>
            </div>
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

          {/* User Session Info or Login/Register in Mobile */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            {currentUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{currentUser.name}</div>
                    <div className="text-[10px] text-slate-500">{currentUser.pos} · {currentUser.department}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignOut?.();
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Exit</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="flex-1 py-2 text-center text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenRegister) onOpenRegister();
                    else onOpenAuth();
                  }}
                  className="flex-1 py-2 text-center text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-xs"
                >
                  Register
                </button>
              </div>
            )}
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
