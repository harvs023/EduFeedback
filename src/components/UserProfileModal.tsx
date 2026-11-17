import React, { useState } from "react";
import { ProfileChangeRequest, ProfileSchoolFields as Fields, SchoolLists, UserProfile } from "../types";
import { X, CheckCircle2, Shield } from "lucide-react";
import { ProfileSchoolFields } from "./ProfileSchoolFields";

interface UserProfileModalProps {
  currentUser: UserProfile;
  schoolLists: SchoolLists | null;
  /** This person's latest school-details change request, or null. */
  profileRequest: ProfileChangeRequest | null;
  /** true only the first time My Profile is opened after the admin decided the request. */
  showRequestDecision: boolean;
  onClose: () => void;
  /** Saves only the name; the school details are locked. */
  onUpdateName: (name: string) => Promise<boolean>;
  onSendProfileRequest: (requested: Fields, reason: string) => Promise<boolean>;
  onCancelProfileRequest: () => Promise<void>;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentUser,
  schoolLists,
  profileRequest,
  showRequestDecision,
  onClose,
  onUpdateName,
  onSendProfileRequest,
  onCancelProfileRequest,
}) => {
  const [name, setName] = useState<string>(currentUser.name);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const hasSchoolFields = currentUser.pos === "Student" || currentUser.pos === "Student Officer" || currentUser.pos === "Faculty";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setError(null);
    if (name.trim() === currentUser.name) {
      onClose();
      return;
    }
    if (!(await onUpdateName(name.trim()))) return;
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Shield className="w-3.5 h-3.5" />
              <span>{currentUser.role} Account</span>
            </div>
            <h2 className="font-serif text-xl font-bold text-slate-900">My Profile</h2>
            <p className="text-xs text-slate-500">Your name and school details</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Profile information updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              disabled
              value={currentUser.email}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
            />
          </div>

          {hasSchoolFields && (
            <ProfileSchoolFields
              user={currentUser}
              lists={schoolLists}
              request={profileRequest}
              showDecision={showRequestDecision}
              onSend={onSendProfileRequest}
              onCancel={onCancelProfileRequest}
            />
          )}

          {error && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs font-semibold text-rose-700">{error}</div>
          )}

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
            >
              Save name
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
