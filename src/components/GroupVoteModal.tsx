import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Heart,
  Link2,
  MapPin,
  RotateCcw,
  Share2,
  Sparkles,
  Star,
  ThumbsDown,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { GeoLocation, Restaurant, UserProfile } from '../types/restaurant';
import {
  buildBallotShareUrl,
  buildRoomInviteUrl,
  closeGroupVoteRoom,
  createGroupVoteRoom,
  decodeCandidateTokens,
  DecodedInviteUrl,
  generateRoomCode,
  getLocalVoteRoom,
  GroupVoteRoom,
  importBallotIntoRoom,
  loadVoteRoomOnce,
  parseBallotInput,
  parseInviteFromUrl,
  submitMemberVotesToRoom,
  subscribeVoteRoom,
  tallyGroupRoomVotes,
  VoteChoice,
} from '../firebase/groupVoteSync';
import {
  calcDistanceKm,
  classifyRestaurantTastes,
  formatDistance,
  getCrispPhotoUrl,
  getEffectivePrice,
  getRestaurantOpenStatus,
  normalizeShortNeighborhood,
} from '../utils/restaurantUtils';
import { playChimeSuccess, playTapTick, spawnCelebrationConfetti } from '../utils/feedbackUtils';
import { useSheetDragDismiss } from '../hooks/useSheetDragDismiss';

interface GroupVoteModalProps {
  allRestaurants: Restaurant[];
  seedCandidates: Restaurant[];
  profile: UserProfile;
  anchor: GeoLocation;
  currentUid: string;
  initialInvite?: DecodedInviteUrl | null;
  onClose: () => void;
  onSelectRestaurant: (r: Restaurant) => void;
  onRecordPick: (r: Restaurant, mode: 'swipe', companion: 'friends') => void;
  onFlashToast: (msg: string) => void;
}

type PoolPreset = 'current' | 'open' | 'saved' | 'lau' | 'de';

async function copyTextSafely(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const GroupVoteModal: React.FC<GroupVoteModalProps> = ({
  allRestaurants,
  seedCandidates,
  profile,
  anchor,
  currentUid,
  initialInvite = null,
  onClose,
  onSelectRestaurant,
  onRecordPick,
  onFlashToast,
}) => {
  const drag = useSheetDragDismiss({ onDismiss: onClose });
  const sheetBodyRef = useRef<HTMLDivElement | null>(null);

  const [activeRoom, setActiveRoom] = useState<GroupVoteRoom | null>(null);
  const [syncMode, setSyncMode] = useState<'cloud' | 'local-share'>('cloud');
  const [roomTab, setRoomTab] = useState<'vote' | 'results'>('vote');

  // Create-room lobby state
  const [roomTitle, setRoomTitle] = useState('Chốt kèo đi ăn Ninh Bình');
  const [poolPreset, setPoolPreset] = useState<PoolPreset>('current');
  const [joinInput, setJoinInput] = useState('');
  const [busyCreate, setBusyCreate] = useState(false);

  // Active voter identity (allows switching/passing phone to friend on 1 device too)
  const [voterUid, setVoterUid] = useState(currentUid);
  const [voterName, setVoterName] = useState(
    profile.displayName?.trim() || 'Mình'
  );
  const [cardIndex, setCardIndex] = useState(0);
  const [swipeDx, setSwipeDx] = useState(0);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const dragCardRef = useRef<{ x: number; pointerId: number | null }>({
    x: 0,
    pointerId: null,
  });

  // Manual ballot merge input for cross-phone sharing without rules deploy
  const [ballotPaste, setBallotPaste] = useState('');
  const [copiedType, setCopiedType] = useState<'invite' | 'ballot' | null>(null);

  const restaurantsById = useMemo(
    () => new Map(allRestaurants.map((r) => [r.id, r])),
    [allRestaurants]
  );

  // Compute candidate list for creating a room
  const chosenPresetCandidates = useMemo(() => {
    const nonBlocked = allRestaurants.filter((r) => !profile.metaById[r.id]?.blacklisted);
    const now = new Date();
    let list: Restaurant[] = [];
    if (poolPreset === 'current') {
      list = seedCandidates.length > 0 ? seedCandidates : nonBlocked;
    } else if (poolPreset === 'open') {
      list = nonBlocked.filter((r) => getRestaurantOpenStatus(r, now).isOpenNow);
    } else if (poolPreset === 'saved') {
      list = nonBlocked.filter((r) => {
        const m = profile.metaById[r.id];
        return Boolean(m?.favorite || m?.wishlist || m?.visited);
      });
    } else if (poolPreset === 'lau') {
      list = nonBlocked.filter((r) => classifyRestaurantTastes(r).includes('lau-nuong'));
    } else if (poolPreset === 'de') {
      list = nonBlocked.filter((r) => classifyRestaurantTastes(r).includes('de-comchay'));
    }
    if (list.length === 0) list = nonBlocked;
    return list.slice(0, 10);
  }, [allRestaurants, seedCandidates, poolPreset, profile.metaById]);

  // Hydrate from URL invite (?room=...&p=...&ballot=...) once allRestaurants finishes loading
  const inviteHandledRef = useRef(false);
  useEffect(() => {
    if (!initialInvite || inviteHandledRef.current || allRestaurants.length === 0) return;
    inviteHandledRef.current = true;

    const hydrateInvite = async () => {
      const code = initialInvite.roomCode.toUpperCase();
      let room = await loadVoteRoomOnce(code);
      const urlIds = initialInvite.candidateTokens
        ? decodeCandidateTokens(initialInvite.candidateTokens, allRestaurants)
        : [];

      if (!room && urlIds.length > 0) {
        const nowIso = new Date().toISOString();
        room = {
          roomCode: code,
          hostUid: 'invite-host',
          hostName: initialInvite.hostName || 'Bạn bè',
          title: initialInvite.title || 'Chốt kèo nhóm',
          status: 'voting',
          restaurantIds: urlIds,
          members: {
            'invite-host': initialInvite.hostName || 'Chủ phòng',
          },
          votesByMember: {},
          createdAt: nowIso,
          updatedAt: nowIso,
          sourceMode: 'local',
        };
      }

      if (room && initialInvite.ballotToken) {
        const decodedBallot = parseBallotInput(initialInvite.ballotToken, room.restaurantIds);
        if (decodedBallot && decodedBallot.roomCode === room.roomCode) {
          room = importBallotIntoRoom(room, decodedBallot);
          setRoomTab('results');
          onFlashToast(`Đã nhận phiếu bầu của ${decodedBallot.memberName}!`);
        }
      }

      if (room) {
        setActiveRoom(room);
      }
    };
    void hydrateInvite();
  }, [initialInvite, allRestaurants, onFlashToast]);

  // Subscribe to realtime updates (Firestore + BroadcastChannel + Storage)
  useEffect(() => {
    if (!activeRoom?.roomCode) return;
    return subscribeVoteRoom(
      activeRoom.roomCode,
      (updated) => setActiveRoom((prev) => (prev ? { ...prev, ...updated } : updated)),
      (mode) => setSyncMode(mode)
    );
  }, [activeRoom?.roomCode]);

  const roomCandidates = useMemo(() => {
    if (!activeRoom) return [];
    return activeRoom.restaurantIds
      .map((id) => restaurantsById.get(id))
      .filter((r): r is Restaurant => Boolean(r));
  }, [activeRoom, restaurantsById]);

  const myVotes: Record<string, VoteChoice> = useMemo(() => {
    if (!activeRoom) return {};
    return activeRoom.votesByMember[voterUid] || {};
  }, [activeRoom, voterUid]);

  const votedCount = Object.keys(myVotes).length;
  const tally = useMemo(
    () => (activeRoom ? tallyGroupRoomVotes(activeRoom, allRestaurants) : []),
    [activeRoom, allRestaurants]
  );

  // Reset cardIndex cleanly if switching voters or loading a room with existing votes
  useEffect(() => {
    if (!activeRoom) return;
    const firstUnvoted = roomCandidates.findIndex((r) => !myVotes[r.id]);
    setCardIndex(firstUnvoted >= 0 ? firstUnvoted : roomCandidates.length);
  }, [activeRoom?.roomCode, voterUid]);

  const handleCreateRoom = async () => {
    if (chosenPresetCandidates.length < 2) {
      onFlashToast('Cần ít nhất 2 quán để tạo phòng bình chọn.');
      return;
    }
    setBusyCreate(true);
    try {
      const myName = voterName.trim() || profile.displayName || 'Chủ phòng';
      const { room, syncedCloud } = await createGroupVoteRoom({
        hostUid: currentUid,
        hostName: myName,
        title: roomTitle,
        restaurantIds: chosenPresetCandidates.map((r) => r.id),
      });
      setVoterUid(currentUid);
      setVoterName(myName);
      setActiveRoom(room);
      setSyncMode(syncedCloud ? 'cloud' : 'local-share');
      setRoomTab('vote');
      setCardIndex(0);
      playChimeSuccess();
      onFlashToast(
        syncedCloud
          ? `Đã tạo phòng ${room.roomCode} trên Cloud!`
          : `Đã tạo phòng ${room.roomCode} — gửi link mời bạn bè cùng quẹt!`
      );
    } finally {
      setBusyCreate(false);
    }
  };

  const handleJoinByInput = async () => {
    const raw = joinInput.trim();
    if (!raw) return;

    // Check if user pasted a full invite URL
    if (raw.includes('room=')) {
      const qIdx = raw.indexOf('?');
      const invite = parseInviteFromUrl(qIdx >= 0 ? raw.slice(qIdx) : raw);
      if (invite) {
        let room = await loadVoteRoomOnce(invite.roomCode);
        const ids = invite.candidateTokens
          ? decodeCandidateTokens(invite.candidateTokens, allRestaurants)
          : [];
        if (!room && ids.length > 0) {
          const nowIso = new Date().toISOString();
          room = {
            roomCode: invite.roomCode,
            hostUid: 'invite-host',
            hostName: invite.hostName || 'Bạn bè',
            title: invite.title || 'Chốt kèo nhóm',
            status: 'voting',
            restaurantIds: ids,
            members: { 'invite-host': invite.hostName || 'Chủ phòng' },
            votesByMember: {},
            createdAt: nowIso,
            updatedAt: nowIso,
            sourceMode: 'local',
          };
        }
        if (room && invite.ballotToken) {
          const ballot = parseBallotInput(invite.ballotToken, room.restaurantIds);
          if (ballot && ballot.roomCode === room.roomCode) {
            room = importBallotIntoRoom(room, ballot);
            setRoomTab('results');
          }
        }
        if (room) {
          setActiveRoom(room);
          setJoinInput('');
          return;
        }
      }
    }

    // Check bare room code (local or cloud)
    const code = raw.toUpperCase();
    const found = (await loadVoteRoomOnce(code)) || getLocalVoteRoom(code);
    if (found) {
      setActiveRoom(found);
      setJoinInput('');
      setRoomTab('vote');
    } else {
      onFlashToast(`Không tìm thấy phòng "${code}". Hãy dán đầy đủ link mời từ bạn bè nhé!`);
    }
  };

  const castVote = async (choice: VoteChoice) => {
    if (!activeRoom) return;
    const currentCard = roomCandidates[cardIndex];
    if (!currentCard) return;

    playTapTick();
    const nextMyVotes: Record<string, VoteChoice> = {
      ...myVotes,
      [currentCard.id]: choice,
    };
    const nextIdx = cardIndex + 1;
    setCardIndex(nextIdx);
    setSwipeDx(0);

    const { room: updated, syncedCloud } = await submitMemberVotesToRoom({
      room: activeRoom,
      uid: voterUid,
      memberName: voterName.trim() || 'Thành viên',
      myVotes: nextMyVotes,
    });
    setActiveRoom(updated);
    setSyncMode(syncedCloud ? 'cloud' : 'local-share');

    if (nextIdx >= roomCandidates.length) {
      playChimeSuccess();
      setRoomTab('results');
      if (sheetBodyRef.current) {
        spawnCelebrationConfetti(sheetBodyRef.current);
      }
    }
  };

  const undoVote = async () => {
    if (!activeRoom || cardIndex <= 0) return;
    const prevIdx = cardIndex - 1;
    const prevCard = roomCandidates[prevIdx];
    const nextMyVotes = { ...myVotes };
    if (prevCard) delete nextMyVotes[prevCard.id];
    setCardIndex(prevIdx);
    const { room: updated } = await submitMemberVotesToRoom({
      room: activeRoom,
      uid: voterUid,
      memberName: voterName.trim() || 'Thành viên',
      myVotes: nextMyVotes,
    });
    setActiveRoom(updated);
  };

  const handleCopyInvite = async () => {
    if (!activeRoom) return;
    const link = buildRoomInviteUrl(activeRoom, allRestaurants);
    const ok = await copyTextSafely(link);
    if (ok) {
      setCopiedType('invite');
      window.setTimeout(() => setCopiedType(null), 2000);
      onFlashToast('Đã copy link mời nhóm! Gửi cho bạn bè qua Zalo / Messenger nhé.');
    }
  };

  const handleCopyMyBallot = async () => {
    if (!activeRoom) return;
    const link = buildBallotShareUrl(
      activeRoom,
      voterUid,
      voterName.trim() || 'Mình',
      myVotes,
      allRestaurants
    );
    const ok = await copyTextSafely(link);
    if (ok) {
      setCopiedType('ballot');
      window.setTimeout(() => setCopiedType(null), 2000);
      onFlashToast('Đã copy link phiếu bầu của bạn!');
    }
  };

  const handleImportFriendBallot = () => {
    if (!activeRoom || !ballotPaste.trim()) return;
    const decoded = parseBallotInput(ballotPaste, activeRoom.restaurantIds);
    if (!decoded || decoded.roomCode !== activeRoom.roomCode) {
      onFlashToast('Link / mã phiếu không đúng phòng này.');
      return;
    }
    const merged = importBallotIntoRoom(activeRoom, decoded);
    setActiveRoom(merged);
    setBallotPaste('');
    playChimeSuccess();
    onFlashToast(`Đã cộng phiếu của ${decoded.memberName} vào kết quả!`);
  };

  const handlePassPhoneFriend = () => {
    const count = Object.keys(activeRoom?.members || {}).length + 1;
    const newUid = `friend_${generateRoomCode().toLowerCase()}`;
    setVoterUid(newUid);
    setVoterName(`Bạn ${count}`);
    setCardIndex(0);
    setRoomTab('vote');
    onFlashToast(`Sẵn sàng lượt quẹt mới cho Bạn ${count}!`);
  };

  const handleLockWinner = async (r: Restaurant) => {
    if (!activeRoom) return;
    const closed = await closeGroupVoteRoom({
      room: activeRoom,
      uid: currentUid,
      winnerId: r.id,
    });
    setActiveRoom(closed);
    playChimeSuccess();
    onRecordPick(r, 'swipe', 'friends');
    onFlashToast(`Cả nhóm đã chốt kèo "${r.title}"! 🎉`);
  };

  const currentCard = roomCandidates[cardIndex] || null;
  const topTally = tally[0] || null;
  const recentRoomCodes = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('codovi_vote_rooms_v1');
      if (!raw) return [] as GroupVoteRoom[];
      return Object.values(JSON.parse(raw) as Record<string, GroupVoteRoom>)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .slice(0, 3);
    } catch {
      return [];
    }
  }, [activeRoom?.roomCode]);

  return (
    <div
      ref={drag.overlayRef}
      className="sheet-backdrop"
      onClick={drag.dismissAnimated}
      style={{ zIndex: 9975 }}
    >
      <div
        ref={drag.panelRef}
        className="sheet-panel lg-surface-strong lg-sheen"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle Header */}
        <div
          ref={drag.handleRef}
          className="sheet-drag-header"
          {...drag.handleGrabProps}
        >
          <div className="sheet-handle" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {activeRoom && (
                <button
                  type="button"
                  className="apple-icon-btn"
                  onClick={() => setActiveRoom(null)}
                  title="Quay lại danh sách phòng"
                  style={{ width: 32, height: 32 }}
                >
                  <ArrowLeft size={15} />
                </button>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={16} />
                  {activeRoom ? `Phòng ${activeRoom.roomCode}` : 'Bình chọn nhóm (2–5 người)'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeRoom
                    ? `${activeRoom.title} · ${syncMode === 'cloud' ? '🟢 Realtime Cloud' : '🔗 Link chia sẻ nhóm'}`
                    : 'Cùng quẹt Tinder để chốt quán đi ăn không cần cãi nhau'}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="apple-icon-btn"
              onClick={drag.dismissAnimated}
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Sheet Body */}
        <div
          ref={(el) => {
            sheetBodyRef.current = el;
            drag.scrollBodyRef.current = el;
          }}
          {...drag.bodyPullProps}
          className="sheet-scroll-body no-scrollbar"
          style={{ gap: 12, paddingBottom: 24, position: 'relative' }}
        >
          {!activeRoom ? (
            <>
              {/* Create Room Card */}
              <div className="apple-inset-group" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} /> Tạo phòng bình chọn mới
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Tên kèo ăn uống
                    </div>
                    <input
                      type="text"
                      className="lg-input"
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder="VD: Tối nay ăn gì?"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Tên của bạn
                    </div>
                    <input
                      type="text"
                      className="lg-input"
                      value={voterName}
                      onChange={(e) => setVoterName(e.target.value)}
                      placeholder="Minh"
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Chọn bộ quán ({chosenPresetCandidates.length} quán):
                  </div>
                  <div className="h-scroll-row" style={{ gap: 6 }}>
                    {(
                      [
                        { key: 'current', label: `✨ Đang lọc (${Math.min(10, seedCandidates.length || 10)})` },
                        { key: 'open', label: '🟢 Đang mở' },
                        { key: 'saved', label: '❤️ Đã lưu' },
                        { key: 'lau', label: '🍲 Lẩu nướng' },
                        { key: 'de', label: '🐐 Dê & Cơm cháy' },
                      ] as Array<{ key: PoolPreset; label: string }>
                    ).map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`lg-pill ${poolPreset === p.key ? 'active' : ''}`}
                        style={{ minHeight: 30, fontSize: 11.5 }}
                        onClick={() => setPoolPreset(p.key)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Strip */}
                <div className="h-scroll-row" style={{ gap: 8 }}>
                  {chosenPresetCandidates.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      style={{
                        width: 78,
                        flexShrink: 0,
                        borderRadius: 12,
                        overflow: 'hidden',
                        background: 'rgba(15,23,42,0.35)',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <div style={{ height: 48, background: 'rgba(15,23,42,0.5)' }}>
                        {r.imageUrl && (
                          <img
                            src={getCrispPhotoUrl(r.imageUrl, 160) || ''}
                            alt={r.title}
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          padding: '4px 5px',
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.title}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="lg-btn-accent"
                  disabled={busyCreate}
                  onClick={handleCreateRoom}
                  style={{ minHeight: 44 }}
                >
                  <Share2 size={15} /> {busyCreate ? 'Đang tạo phòng...' : 'Tạo phòng & Lấy link mời bạn bè'}
                </button>
              </div>

              {/* Join Room Card */}
              <div className="apple-inset-group" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link2 size={14} /> Đã có mã phòng hoặc link mời?
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <input
                    type="text"
                    className="lg-input"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Nhập mã (VD: NB7K2M) hoặc dán link..."
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="lg-btn-accent"
                    style={{ padding: '0 14px', minHeight: 38 }}
                    onClick={handleJoinByInput}
                  >
                    Vào
                  </button>
                </div>

                {recentRoomCodes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                    {recentRoomCodes.map((rm) => (
                      <button
                        key={rm.roomCode}
                        type="button"
                        className="lg-pill"
                        style={{ fontSize: 11, minHeight: 28 }}
                        onClick={() => setActiveRoom(rm)}
                      >
                        Phòng {rm.roomCode} · {rm.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Active Room Header Bar: Members + Copy Invite */}
              <div
                className="apple-inset-group"
                style={{
                  padding: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      Tên bạn:
                    </span>
                    <input
                      type="text"
                      className="lg-input"
                      value={voterName}
                      onChange={(e) => setVoterName(e.target.value)}
                      style={{ minHeight: 30, padding: '4px 9px', fontSize: 12, maxWidth: 135 }}
                    />
                  </div>
                  <button
                    type="button"
                    className="lg-btn-accent"
                    onClick={handleCopyInvite}
                    style={{ minHeight: 32, padding: '0 11px', fontSize: 11.5, flexShrink: 0 }}
                  >
                    {copiedType === 'invite' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedType === 'invite' ? 'Đã copy link' : 'Copy link mời'}
                  </button>
                </div>

                {/* Members Status Chips */}
                <div className="h-scroll-row" style={{ gap: 6 }}>
                  {Object.entries(activeRoom.members || {}).map(([uid, name]) => {
                    const count = Object.keys(activeRoom.votesByMember[uid] || {}).length;
                    const done = count >= roomCandidates.length;
                    return (
                      <span
                        key={uid}
                        className={`lg-pill ${uid === voterUid ? 'active' : ''}`}
                        style={{ minHeight: 26, fontSize: 11, padding: '2px 9px' }}
                      >
                        {done ? '✅' : '⏳'} {name} ({count}/{roomCandidates.length})
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Tab Switch: Vote vs Leaderboard */}
              <div className="apple-segmented" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <button
                  type="button"
                  className={`apple-segment-btn ${roomTab === 'vote' ? 'active' : ''}`}
                  onClick={() => setRoomTab('vote')}
                >
                  🃏 Quẹt chọn ({Math.min(votedCount, roomCandidates.length)}/{roomCandidates.length})
                </button>
                <button
                  type="button"
                  className={`apple-segment-btn ${roomTab === 'results' ? 'active' : ''}`}
                  onClick={() => setRoomTab('results')}
                >
                  🏆 Kết quả nhóm ({Object.keys(activeRoom.votesByMember || {}).length} phiếu)
                </button>
              </div>

              {roomTab === 'vote' ? (
                currentCard ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Progress Bar */}
                    <div
                      style={{
                        height: 5,
                        borderRadius: 999,
                        background: 'rgba(148, 163, 184, 0.22)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round(((cardIndex + 1) / Math.max(1, roomCandidates.length)) * 100)}%`,
                          height: '100%',
                          background: 'var(--accent)',
                          transition: 'width 0.25s ease',
                        }}
                      />
                    </div>

                    {/* Swipeable Restaurant Card */}
                    <div
                      className="lg-surface-strong"
                      onPointerDown={(e) => {
                        dragCardRef.current = { x: e.clientX, pointerId: e.pointerId };
                        setIsDraggingCard(true);
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (!isDraggingCard || dragCardRef.current.pointerId !== e.pointerId) return;
                        setSwipeDx(e.clientX - dragCardRef.current.x);
                      }}
                      onPointerUp={(e) => {
                        if (dragCardRef.current.pointerId !== e.pointerId) return;
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        setIsDraggingCard(false);
                        if (swipeDx > 78) {
                          void castVote('like');
                        } else if (swipeDx < -78) {
                          void castVote('pass');
                        } else {
                          setSwipeDx(0);
                        }
                        dragCardRef.current.pointerId = null;
                      }}
                      style={{
                        borderRadius: 22,
                        overflow: 'hidden',
                        border: '1px solid var(--glass-border)',
                        touchAction: 'pan-y',
                        userSelect: 'none',
                        transform: `translate3d(${swipeDx}px, 0, 0) rotate(${swipeDx * 0.04}deg)`,
                        transition: isDraggingCard ? 'none' : 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                        position: 'relative',
                      }}
                    >
                      {swipeDx > 24 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 14,
                            left: 14,
                            zIndex: 5,
                            padding: '5px 12px',
                            borderRadius: 10,
                            border: '2px solid #34d399',
                            background: 'rgba(16, 185, 129, 0.85)',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: 13,
                          }}
                        >
                          THÍCH 👍
                        </div>
                      )}
                      {swipeDx < -24 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 14,
                            right: 14,
                            zIndex: 5,
                            padding: '5px 12px',
                            borderRadius: 10,
                            border: '2px solid #f87171',
                            background: 'rgba(239, 68, 68, 0.85)',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: 13,
                          }}
                        >
                          BỎ QUA 👎
                        </div>
                      )}

                      <div style={{ height: 195, position: 'relative', background: 'rgba(15,23,42,0.55)' }}>
                        {currentCard.imageUrl ? (
                          <img
                            src={getCrispPhotoUrl(currentCard.imageUrl, 720) || ''}
                            alt={currentCard.title}
                            referrerPolicy="no-referrer"
                            draggable={false}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42 }}>
                            🍜
                          </div>
                        )}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(to top, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.22) 55%, transparent 100%)',
                          }}
                        />
                        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, color: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span
                              className={getRestaurantOpenStatus(currentCard).isOpenNow ? 'status-open' : 'status-closed'}
                              style={{ fontSize: 10.5, fontWeight: 700 }}
                            >
                              ● {getRestaurantOpenStatus(currentCard).label}
                            </span>
                            <span style={{ fontSize: 11, opacity: 0.9 }}>
                              · <MapPin size={10} style={{ display: 'inline' }} /> {formatDistance(calcDistanceKm(anchor, currentCard.location))}
                            </span>
                            {getEffectivePrice(currentCard, profile.metaById[currentCard.id]?.customPrice) && (
                              <span className="price-pill-highlight" style={{ fontSize: 10.5, padding: '1px 7px' }}>
                                {getEffectivePrice(currentCard, profile.metaById[currentCard.id]?.customPrice)}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{currentCard.title}</div>
                          <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{normalizeShortNeighborhood(currentCard)} · {currentCard.categoryName}</span>
                            {currentCard.totalScore && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
                                <Star size={11} fill="#fbbf24" color="#fbbf24" />
                                {currentCard.totalScore.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vote Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        className="lg-pill"
                        disabled={cardIndex === 0}
                        onClick={() => void undoVote()}
                        title="Quay lại quán trước"
                        style={{ minHeight: 46, justifyContent: 'center', opacity: cardIndex === 0 ? 0.45 : 1 }}
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        type="button"
                        className="lg-pill"
                        onClick={() => void castVote('pass')}
                        style={{
                          minHeight: 46,
                          justifyContent: 'center',
                          fontSize: 13.5,
                          fontWeight: 800,
                          color: '#f87171',
                          borderColor: 'rgba(248, 113, 113, 0.35)',
                        }}
                      >
                        <ThumbsDown size={15} /> Bỏ qua
                      </button>
                      <button
                        type="button"
                        className="lg-btn-accent"
                        onClick={() => void castVote('like')}
                        style={{
                          minHeight: 46,
                          fontSize: 13.5,
                          fontWeight: 800,
                        }}
                      >
                        <Heart size={15} fill="currentColor" /> Thích quán này
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="apple-inset-group" style={{ padding: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 32 }}>✅</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>
                      {voterName} đã bình chọn xong {roomCandidates.length} quán!
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                      Hãy gửi link phiếu bầu của bạn cho nhóm hoặc chuyển sang tab Kết quả.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="lg-btn-accent"
                        onClick={() => setRoomTab('results')}
                      >
                        <Trophy size={14} /> Xem Kết quả nhóm
                      </button>
                      <button
                        type="button"
                        className="lg-pill"
                        onClick={handlePassPhoneFriend}
                      >
                        <UserPlus size={14} /> Cho bạn tiếp theo quẹt
                      </button>
                    </div>
                  </div>
                )
              ) : (
                /* Results & Match Leaderboard */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topTally && topTally.likes > 0 && (
                    <div
                      className="lg-surface-strong"
                      style={{
                        borderRadius: 18,
                        padding: 13,
                        border: topTally.isUnanimous
                          ? '1.5px solid #34d399'
                          : '1.5px solid var(--accent)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: topTally.isUnanimous ? '#34d399' : 'var(--accent)',
                          }}
                        >
                          {topTally.isUnanimous ? '💘 CẢ NHÓM ĐỀU MATCH!' : '👑 DẪN ĐẦU BÌNH CHỌN'}
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 800 }}>
                          ❤️ {topTally.likes} lượt thích
                        </span>
                      </div>
                      <div style={{ fontSize: 15.5, fontWeight: 800 }}>{topTally.restaurant.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Người chọn: {topTally.likedBy.join(', ')}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="lg-btn-accent"
                          style={{ flex: 1, minHeight: 38 }}
                          onClick={() => void handleLockWinner(topTally.restaurant)}
                        >
                          ✨ Chốt kèo quán này!
                        </button>
                        <button
                          type="button"
                          className="lg-pill"
                          onClick={() => onSelectRestaurant(topTally.restaurant)}
                        >
                          Xem chi tiết
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ranked List */}
                  <div className="apple-inset-group" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {tally.map((item, idx) => (
                      <div
                        key={item.restaurant.id}
                        onClick={() => onSelectRestaurant(item.restaurant)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '7px 8px',
                          borderRadius: 12,
                          background: idx === 0 && item.likes > 0 ? 'rgba(251, 191, 36, 0.12)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ width: 22, textAlign: 'center', fontSize: 12.5, fontWeight: 800, opacity: 0.85 }}>
                          #{idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.restaurant.title}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
                            {item.likedBy.length > 0 ? `👍 ${item.likedBy.join(', ')}` : 'Chưa có lượt thích'}
                          </div>
                        </div>
                        <span className="lg-pill" style={{ minHeight: 24, fontSize: 11, fontWeight: 800 }}>
                          ❤️ {item.likes}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Share Ballot & Pass-the-Phone Quick Tools */}
                  <div className="apple-inset-group" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800 }}>
                      Đồng bộ phiếu bạn bè (nhắn qua Zalo / Messenger)
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="lg-pill"
                        style={{ flex: 1, minHeight: 34, fontSize: 11.5 }}
                        onClick={handleCopyMyBallot}
                      >
                        {copiedType === 'ballot' ? <Check size={13} /> : <Share2 size={13} />}
                        {copiedType === 'ballot' ? 'Đã copy phiếu' : 'Copy link phiếu của tôi'}
                      </button>
                      <button
                        type="button"
                        className="lg-pill"
                        style={{ flex: 1, minHeight: 34, fontSize: 11.5 }}
                        onClick={handlePassPhoneFriend}
                      >
                        <UserPlus size={13} /> Bạn khác quẹt trên máy này
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        className="lg-input"
                        value={ballotPaste}
                        onChange={(e) => setBallotPaste(e.target.value)}
                        placeholder="Dán link phiếu bầu bạn bè gửi lại..."
                        style={{ flex: 1, fontSize: 11.5 }}
                      />
                      <button
                        type="button"
                        className="lg-btn-accent"
                        style={{ minHeight: 36, padding: '0 12px', fontSize: 11.5 }}
                        onClick={handleImportFriendBallot}
                      >
                        <Download size={13} /> Gộp
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
