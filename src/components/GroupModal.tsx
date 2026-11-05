import React, { useState, useEffect, useRef } from 'react';
import { X, Users, Check, ShieldCheck, UserMinus, Plus, Camera, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Conversation, UserProfile } from '../types';
import { Avatar } from './Avatar';
import { api } from '../services/api';

interface GroupModalProps {
  currentUser: UserProfile;
  friends?: UserProfile[];
  allUsers?: UserProfile[];
  existingGroup?: Conversation | null;
  onClose: () => void;
  onCreateGroup: (payload: { name: string; avatarEmoji: string; avatarUrl?: string; description: string; participantIds: string[] }) => void;
  onUpdateGroup?: (convId: string, updates: { name?: string; avatarEmoji?: string; avatarUrl?: string; description?: string; addParticipants?: string[]; removeParticipant?: string }) => void;
}

const GROUP_EMOJIS = ['👥', '🚀', '⚡', '💡', '🔥', '🎮', '💼', '☕', '🎨', '🏖️', '🎧', '🌟'];

export const GroupModal: React.FC<GroupModalProps> = ({
  currentUser,
  friends = [],
  allUsers = [],
  existingGroup,
  onClose,
  onCreateGroup,
  onUpdateGroup,
}) => {
  const isEditing = !!existingGroup;
  const [name, setName] = useState(existingGroup?.name || '');
  const [avatarEmoji, setAvatarEmoji] = useState(existingGroup?.avatarEmoji || '👥');
  const [avatarUrl, setAvatarUrl] = useState(existingGroup?.avatarUrl || '');
  const [description, setDescription] = useState(existingGroup?.description || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // When creating, start with NO friends selected (creator manually chooses each friend)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Load accepted friends for the logged-in user
  const [acceptedFriends, setAcceptedFriends] = useState<UserProfile[]>(friends);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Fetch accepted friends from database using current user's authenticated session
  useEffect(() => {
    let isMounted = true;
    setLoadingFriends(true);
    api
      .getFriends()
      .then((res) => {
        if (isMounted && res?.friends) {
          setAcceptedFriends(res.friends);
        }
      })
      .catch((err) => {
        console.warn('Failed to load friends for group modal:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingFriends(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser.id]);

  const isAdmin = existingGroup?.adminIds?.includes(currentUser.id) || !isEditing;
  const isCreator = existingGroup?.createdBy === currentUser.id;

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setAvatarUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isEditing && onUpdateGroup && existingGroup) {
      onUpdateGroup(existingGroup.id, {
        name: name.trim(),
        avatarEmoji,
        avatarUrl,
        description: description.trim(),
      });
      onClose();
    } else {
      onCreateGroup({
        name: name.trim(),
        avatarEmoji,
        avatarUrl,
        description: description.trim(),
        participantIds: selectedUserIds,
      });
      onClose();
    }
  };

  const handleAddMember = (userId: string) => {
    if (isEditing && onUpdateGroup && existingGroup) {
      onUpdateGroup(existingGroup.id, { addParticipants: [userId] });
    }
  };

  const handleRemoveMember = (userId: string) => {
    if (isEditing && onUpdateGroup && existingGroup) {
      onUpdateGroup(existingGroup.id, { removeParticipant: userId });
    }
  };

  // Filter ONLY accepted friends, excluding the creator themselves
  const selectableFriends = acceptedFriends.filter((f) => f.id !== currentUser.id);

  // For editing mode: find full user profile for existing members
  const getMemberProfile = (memberId: string): UserProfile => {
    if (memberId === currentUser.id) return currentUser;
    const foundFriend = acceptedFriends.find((f) => f.id === memberId);
    if (foundFriend) return foundFriend;
    const foundUser = allUsers.find((u) => u.id === memberId);
    if (foundUser) return foundUser;
    return {
      id: memberId,
      userId: '@user',
      displayName: 'Member',
      statusText: '',
      online: false,
      lastSeen: 0,
      createdAt: 0,
      friends: [],
      blockedUsers: [],
      privacy: {
        showProfilePicture: 'everyone',
        showLastSeen: true,
        readReceipts: true,
        showStatus: true,
        whoCanSendFriendRequests: 'everyone',
      },
    };
  };

  // Friends that can be added to existing group
  const addableFriends = isEditing && existingGroup
    ? selectableFriends.filter((f) => !existingGroup.participants.includes(f.id))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200/90 rounded-3xl max-w-md w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            {isEditing ? 'Group Details' : 'New Group Chat'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Group Photo & Name */}
          <div className="flex items-center gap-3">
            <div className="relative group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!isAdmin}
                onChange={handlePhotoUpload}
              />
              {avatarUrl ? (
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-indigo-200 shadow-sm group">
                  <img
                    src={avatarUrl}
                    alt="Group Avatar"
                    className="w-full h-full object-cover"
                  />
                  {isAdmin && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                      title="Change photo"
                    >
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 flex flex-col items-center justify-center text-3xl shadow-2xs cursor-pointer transition-all group"
                  title="Upload group picture from phone or PC"
                >
                  <span>{avatarEmoji}</span>
                  <span className="text-[9px] font-semibold text-indigo-600 mt-0.5 flex items-center gap-0.5 opacity-90 group-hover:opacity-100">
                    <Camera className="w-2.5 h-2.5" /> Photo
                  </span>
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Group Name
                </label>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>{avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleClearPhoto}
                        className="text-[11px] font-medium text-red-500 hover:text-red-700 flex items-center gap-0.5 cursor-pointer"
                        title="Remove custom photo"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Family & Friends ❤️"
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Preset Emojis (if no custom photo is chosen) */}
          {isAdmin && !avatarUrl && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Or Pick Group Emoji Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {GROUP_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatarEmoji(emoji)}
                    className={`w-9 h-9 text-lg rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      avatarEmoji === emoji
                        ? 'bg-indigo-600 text-white scale-105 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Group Description
            </label>
            <textarea
              disabled={!isAdmin}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none resize-none"
            />
          </div>

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                {isEditing
                  ? `Members (${existingGroup?.participants.length || 0})`
                  : `Select Members (${selectedUserIds.length} selected)`}
              </label>
              {!isEditing && selectableFriends.length > 0 && (
                <span className="text-[10px] text-slate-500 font-medium">
                  {selectableFriends.length} friend{selectableFriends.length === 1 ? '' : 's'} available
                </span>
              )}
            </div>

            {/* EDITING MODE: Show existing group members */}
            {isEditing && existingGroup && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 mb-3">
                {existingGroup.participants.map((pid) => {
                  const member = getMemberProfile(pid);
                  const isMemberAdmin = existingGroup.adminIds?.includes(pid);
                  const isMemberCreator = existingGroup.createdBy === pid;
                  const isSelf = pid === currentUser.id;

                  return (
                    <div
                      key={pid}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={member.displayName}
                          userId={member.userId}
                          avatarUrl={member.avatarUrl}
                          size="sm"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                            {member.displayName}
                            {isSelf && <span className="text-[10px] text-indigo-600 font-normal">(You)</span>}
                            {isMemberCreator && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium border border-amber-200/60">
                                <ShieldCheck className="w-3 h-3 inline text-amber-600" /> Owner
                              </span>
                            )}
                            {!isMemberCreator && isMemberAdmin && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium border border-indigo-100">
                                <ShieldCheck className="w-3 h-3 inline" /> Admin
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                            <span>{member.userId}</span>
                            {member.numericId && <span>• {member.numericId}</span>}
                          </div>
                        </div>
                      </div>

                      {isAdmin && !isSelf && !isMemberCreator && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(pid)}
                          className="text-xs text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer transition-colors"
                          title="Remove from group"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* EDITING MODE: Add more friends section */}
            {isEditing && isAdmin && addableFriends.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Add Friends to Group
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {addableFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={friend.displayName}
                          userId={friend.userId}
                          avatarUrl={friend.avatarUrl}
                          size="sm"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{friend.displayName}</p>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                            <span className="text-indigo-600">{friend.userId}</span>
                            {friend.numericId && <span>• {friend.numericId}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddMember(friend.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 p-1.5 rounded-lg hover:bg-indigo-50 flex items-center gap-1 cursor-pointer transition-colors font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CREATING MODE: Show ONLY accepted friends of currentUser */}
            {!isEditing && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {selectableFriends.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-2.5">
                      <Users className="w-6 h-6 opacity-60" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">You don't have any friends to add yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      Add friends to your Messenger contact list first to invite them to group chats.
                    </p>
                  </div>
                ) : (
                  selectableFriends.map((friend) => {
                    const isSelected = selectedUserIds.includes(friend.id);

                    return (
                      <div
                        key={friend.id}
                        onClick={() => toggleUserSelection(friend.id)}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors border ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-200'
                            : 'bg-white hover:bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={friend.displayName}
                            userId={friend.userId}
                            avatarUrl={friend.avatarUrl}
                            size="sm"
                          />
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{friend.displayName}</p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                              <span className="text-indigo-600">{friend.userId}</span>
                              {friend.numericId && <span>• {friend.numericId}</span>}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-2">
            {isAdmin && (
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-transform active:scale-95 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {isEditing ? 'Save Changes' : `Create Group ${selectedUserIds.length > 0 ? `(${selectedUserIds.length} member${selectedUserIds.length === 1 ? '' : 's'})` : ''}`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
