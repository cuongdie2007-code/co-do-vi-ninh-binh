import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Restaurant } from '../types/restaurant';
import { auth, db } from './firebaseApp';

export type VoteChoice = 'like' | 'pass';

export interface GroupVoteRoom {
  roomCode: string;
  hostUid: string;
  hostName: string;
  title: string;
  status: 'voting' | 'closed';
  restaurantIds: string[];
  members: Record<string, string>;
  votesByMember: Record<string, Record<string, VoteChoice>>;
  winnerId?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceMode?: 'cloud' | 'local';
}

export interface RoomTallyItem {
  restaurant: Restaurant;
  likes: number;
  passes: number;
  likedBy: string[];
  isUnanimous: boolean;
}

export interface DecodedInviteUrl {
  roomCode: string;
  title?: string;
  hostName?: string;
  hostUid?: string;
  candidateTokens?: string;
  ballotToken?: string;
}

export interface DecodedBallot {
  roomCode: string;
  uid: string;
  memberName: string;
  votes: Record<string, VoteChoice>;
}

const LOCAL_ROOMS_KEY = 'codovi_vote_rooms_v1';
const CHANNEL_NAME = 'codovi_vote_rooms_channel';

function safeStorageRead(): Record<string, GroupVoteRoom> {
  try {
    const raw = window.localStorage.getItem(LOCAL_ROOMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeStorageWriteRoom(room: GroupVoteRoom) {
  try {
    const all = safeStorageRead();
    all[room.roomCode] = room;
    // Keep last 12 rooms cached locally
    const entries = Object.values(all)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 12);
    const trimmed: Record<string, GroupVoteRoom> = {};
    for (const r of entries) trimmed[r.roomCode] = r;
    window.localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage quota errors
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ type: 'room-updated', room });
      ch.close();
    }
  } catch {
    // ignore
  }
}

export function getLocalVoteRoom(roomCode: string): GroupVoteRoom | null {
  const all = safeStorageRead();
  return all[roomCode.trim().toUpperCase()] || null;
}

export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function shortRestaurantHash(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(6, '0');
}

export function encodeCandidateTokens(ids: string[], allRestaurants: Restaurant[]): string {
  const hashCounts = new Map<string, number>();
  for (const r of allRestaurants) {
    const h = shortRestaurantHash(r.id);
    hashCounts.set(h, (hashCounts.get(h) || 0) + 1);
  }
  return ids
    .map((id) => {
      const h = shortRestaurantHash(id);
      return hashCounts.get(h) === 1 ? h : encodeURIComponent(id);
    })
    .join(',');
}

export function decodeCandidateTokens(tokenStr: string, allRestaurants: Restaurant[]): string[] {
  if (!tokenStr.trim()) return [];
  const byId = new Set(allRestaurants.map((r) => r.id));
  const byHash = new Map<string, string>();
  for (const r of allRestaurants) {
    const h = shortRestaurantHash(r.id);
    if (!byHash.has(h)) byHash.set(h, r.id);
  }
  const resolved: string[] = [];
  for (const rawTok of tokenStr.split(',')) {
    const tok = decodeURIComponent(rawTok.trim());
    if (!tok) continue;
    if (byId.has(tok)) {
      resolved.push(tok);
    } else if (byHash.has(tok)) {
      resolved.push(byHash.get(tok)!);
    }
  }
  return Array.from(new Set(resolved));
}

function toBase64Url(jsonStr: string): string {
  const b64 = window.btoa(unescape(encodeURIComponent(jsonStr)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(token: string): string {
  const norm = token.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
  return decodeURIComponent(escape(window.atob(norm + pad)));
}

export function buildRoomInviteUrl(room: GroupVoteRoom, allRestaurants: Restaurant[]): string {
  const url = new URL(window.location.href.split('?')[0]);
  url.searchParams.set('room', room.roomCode);
  url.searchParams.set('t', room.title.slice(0, 50));
  url.searchParams.set('h', room.hostName.slice(0, 30));
  url.searchParams.set('p', encodeCandidateTokens(room.restaurantIds, allRestaurants));
  return url.toString();
}

export function encodeBallotToken(
  roomCode: string,
  uid: string,
  memberName: string,
  votes: Record<string, VoteChoice>,
  orderedIds: string[]
): string {
  const bits = orderedIds
    .map((id) => {
      const c = votes[id];
      return c === 'like' ? '1' : c === 'pass' ? '0' : '_';
    })
    .join('');
  return toBase64Url(
    JSON.stringify({
      r: roomCode,
      u: uid,
      n: memberName.slice(0, 40),
      v: bits,
    })
  );
}

export function buildBallotShareUrl(
  room: GroupVoteRoom,
  uid: string,
  memberName: string,
  votes: Record<string, VoteChoice>,
  allRestaurants: Restaurant[]
): string {
  const base = new URL(buildRoomInviteUrl(room, allRestaurants));
  base.searchParams.set(
    'ballot',
    encodeBallotToken(room.roomCode, uid, memberName, votes, room.restaurantIds)
  );
  return base.toString();
}

export function parseBallotInput(
  rawInput: string,
  orderedIds: string[]
): DecodedBallot | null {
  try {
    let token = rawInput.trim();
    if (!token) return null;
    if (token.startsWith('http://') || token.startsWith('https://') || token.includes('ballot=')) {
      const qIdx = token.indexOf('?');
      const params = new URLSearchParams(qIdx >= 0 ? token.slice(qIdx) : token);
      token = params.get('ballot') || '';
    }
    if (!token) return null;
    const parsed = JSON.parse(fromBase64Url(token)) as {
      r?: string;
      u?: string;
      n?: string;
      v?: string;
    };
    if (!parsed || !parsed.r || !parsed.u || typeof parsed.v !== 'string') return null;
    const votes: Record<string, VoteChoice> = {};
    for (let i = 0; i < orderedIds.length && i < parsed.v.length; i++) {
      const ch = parsed.v[i];
      if (ch === '1') votes[orderedIds[i]] = 'like';
      else if (ch === '0') votes[orderedIds[i]] = 'pass';
    }
    return {
      roomCode: String(parsed.r).toUpperCase(),
      uid: String(parsed.u),
      memberName: String(parsed.n || 'Bạn bè'),
      votes,
    };
  } catch {
    return null;
  }
}

export function parseInviteFromUrl(search: string): DecodedInviteUrl | null {
  const params = new URLSearchParams(search);
  const rawCode = params.get('room');
  if (!rawCode) return null;
  const roomCode = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(roomCode)) return null;
  return {
    roomCode,
    title: params.get('t') || undefined,
    hostName: params.get('h') || undefined,
    candidateTokens: params.get('p') || undefined,
    ballotToken: params.get('ballot') || undefined,
  };
}

export function mergeGroupRoom(base: GroupVoteRoom, incoming: GroupVoteRoom): GroupVoteRoom {
  const mergedMembers = { ...(base.members || {}), ...(incoming.members || {}) };
  const mergedVotes: Record<string, Record<string, VoteChoice>> = {
    ...(base.votesByMember || {}),
  };
  for (const [uid, votes] of Object.entries(incoming.votesByMember || {})) {
    mergedVotes[uid] = { ...(mergedVotes[uid] || {}), ...(votes || {}) };
  }
  const useIncomingMeta = (incoming.updatedAt || '') >= (base.updatedAt || '');
  return {
    ...base,
    ...(useIncomingMeta ? incoming : {}),
    members: mergedMembers,
    votesByMember: mergedVotes,
    sourceMode:
      base.sourceMode === 'cloud' || incoming.sourceMode === 'cloud' ? 'cloud' : 'local',
  };
}

export async function createGroupVoteRoom(params: {
  roomCode?: string;
  hostUid: string;
  hostName: string;
  title: string;
  restaurantIds: string[];
}): Promise<{ room: GroupVoteRoom; syncedCloud: boolean }> {
  const roomCode = (params.roomCode || generateRoomCode()).toUpperCase();
  const nowIso = new Date().toISOString();
  const cleanHostName = params.hostName.trim().slice(0, 60) || 'Chủ phòng';
  const cleanTitle = params.title.trim().slice(0, 80) || 'Chốt kèo đi ăn Ninh Bình';
  const uniqueIds = Array.from(new Set(params.restaurantIds)).slice(0, 30);

  const room: GroupVoteRoom = {
    roomCode,
    hostUid: params.hostUid,
    hostName: cleanHostName,
    title: cleanTitle,
    status: 'voting',
    restaurantIds: uniqueIds,
    members: { [params.hostUid]: cleanHostName },
    votesByMember: { [params.hostUid]: {} },
    winnerId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    sourceMode: 'local',
  };

  safeStorageWriteRoom(room);

  if (auth.currentUser && auth.currentUser.uid === params.hostUid) {
    try {
      const { sourceMode: _omit, ...cloudPayload } = room;
      await setDoc(doc(db, 'voteRooms', roomCode), cloudPayload);
      const cloudRoom: GroupVoteRoom = { ...room, sourceMode: 'cloud' };
      safeStorageWriteRoom(cloudRoom);
      return { room: cloudRoom, syncedCloud: true };
    } catch {
      return { room, syncedCloud: false };
    }
  }

  return { room, syncedCloud: false };
}

export async function loadVoteRoomOnce(roomCode: string): Promise<GroupVoteRoom | null> {
  const code = roomCode.trim().toUpperCase();
  const local = getLocalVoteRoom(code);
  if (auth.currentUser) {
    try {
      const snap = await getDoc(doc(db, 'voteRooms', code));
      if (snap.exists()) {
        const cloudData = { ...(snap.data() as GroupVoteRoom), sourceMode: 'cloud' as const };
        const merged = local ? mergeGroupRoom(local, cloudData) : cloudData;
        safeStorageWriteRoom(merged);
        return merged;
      }
    } catch {
      // fall through to local
    }
  }
  return local;
}

export async function submitMemberVotesToRoom(params: {
  room: GroupVoteRoom;
  uid: string;
  memberName: string;
  myVotes: Record<string, VoteChoice>;
}): Promise<{ room: GroupVoteRoom; syncedCloud: boolean }> {
  const nowIso = new Date().toISOString();
  const cleanName = params.memberName.trim().slice(0, 60) || 'Thành viên';
  const nextLocal: GroupVoteRoom = {
    ...params.room,
    members: { ...params.room.members, [params.uid]: cleanName },
    votesByMember: {
      ...params.room.votesByMember,
      [params.uid]: { ...params.myVotes },
    },
    updatedAt: nowIso,
  };
  safeStorageWriteRoom(nextLocal);

  if (auth.currentUser && auth.currentUser.uid === params.uid) {
    try {
      await updateDoc(doc(db, 'voteRooms', params.room.roomCode), {
        [`members.${params.uid}`]: cleanName,
        [`votesByMember.${params.uid}`]: params.myVotes,
        updatedAt: nowIso,
      });
      const cloudRoom: GroupVoteRoom = { ...nextLocal, sourceMode: 'cloud' };
      safeStorageWriteRoom(cloudRoom);
      return { room: cloudRoom, syncedCloud: true };
    } catch {
      return { room: nextLocal, syncedCloud: false };
    }
  }

  return { room: nextLocal, syncedCloud: false };
}

export async function closeGroupVoteRoom(params: {
  room: GroupVoteRoom;
  uid: string;
  winnerId: string | null;
}): Promise<GroupVoteRoom> {
  const nowIso = new Date().toISOString();
  const nextLocal: GroupVoteRoom = {
    ...params.room,
    status: 'closed',
    winnerId: params.winnerId,
    updatedAt: nowIso,
  };
  safeStorageWriteRoom(nextLocal);

  if (auth.currentUser && params.room.hostUid === params.uid) {
    try {
      await updateDoc(doc(db, 'voteRooms', params.room.roomCode), {
        status: 'closed',
        winnerId: params.winnerId,
        updatedAt: nowIso,
      });
    } catch {
      // local state already updated
    }
  }
  return nextLocal;
}

export function importBallotIntoRoom(room: GroupVoteRoom, ballot: DecodedBallot): GroupVoteRoom {
  const nowIso = new Date().toISOString();
  const nextRoom: GroupVoteRoom = {
    ...room,
    members: {
      ...room.members,
      [ballot.uid]: ballot.memberName,
    },
    votesByMember: {
      ...room.votesByMember,
      [ballot.uid]: {
        ...(room.votesByMember[ballot.uid] || {}),
        ...ballot.votes,
      },
    },
    updatedAt: nowIso,
  };
  safeStorageWriteRoom(nextRoom);
  return nextRoom;
}

export function subscribeVoteRoom(
  roomCode: string,
  onUpdate: (room: GroupVoteRoom) => void,
  onSyncStatus?: (mode: 'cloud' | 'local-share') => void
): () => void {
  const code = roomCode.trim().toUpperCase();
  const initialLocal = getLocalVoteRoom(code);
  if (initialLocal) onUpdate(initialLocal);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev) => {
      if (ev.data?.type === 'room-updated' && ev.data.room?.roomCode === code) {
        onUpdate(ev.data.room as GroupVoteRoom);
      }
    };
  }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_ROOMS_KEY) {
      const latest = getLocalVoteRoom(code);
      if (latest) onUpdate(latest);
    }
  };
  window.addEventListener('storage', onStorage);

  let unsubFirestore: (() => void) | null = null;
  if (auth.currentUser) {
    try {
      unsubFirestore = onSnapshot(
        doc(db, 'voteRooms', code),
        (snap) => {
          if (snap.exists()) {
            const cloudRoom: GroupVoteRoom = {
              ...(snap.data() as GroupVoteRoom),
              sourceMode: 'cloud',
            };
            const curLocal = getLocalVoteRoom(code);
            const merged = curLocal ? mergeGroupRoom(curLocal, cloudRoom) : cloudRoom;
            safeStorageWriteRoom(merged);
            onUpdate(merged);
            onSyncStatus?.('cloud');
          }
        },
        () => {
          onSyncStatus?.('local-share');
        }
      );
    } catch {
      onSyncStatus?.('local-share');
    }
  } else {
    onSyncStatus?.('local-share');
  }

  return () => {
    channel?.close();
    window.removeEventListener('storage', onStorage);
    unsubFirestore?.();
  };
}

export function tallyGroupRoomVotes(
  room: GroupVoteRoom,
  allRestaurants: Restaurant[]
): RoomTallyItem[] {
  const byId = new Map(allRestaurants.map((r) => [r.id, r]));
  const voterUids = Object.keys(room.votesByMember || {}).filter(
    (uid) => Object.keys(room.votesByMember[uid] || {}).length > 0
  );
  const voterCount = Math.max(voterUids.length, Object.keys(room.members || {}).length);

  return room.restaurantIds
    .map((id) => {
      const restaurant = byId.get(id);
      if (!restaurant) return null;
      const likedBy: string[] = [];
      let passes = 0;
      for (const [uid, votes] of Object.entries(room.votesByMember || {})) {
        if (votes[id] === 'like') {
          likedBy.push(room.members[uid] || 'Thành viên');
        } else if (votes[id] === 'pass') {
          passes++;
        }
      }
      const isUnanimous =
        voterCount >= 2 && likedBy.length >= 2 && likedBy.length === voterUids.length && passes === 0;
      return {
        restaurant,
        likes: likedBy.length,
        passes,
        likedBy,
        isUnanimous,
      };
    })
    .filter((x): x is RoomTallyItem => Boolean(x))
    .sort((a, b) => {
      if (b.isUnanimous !== a.isUnanimous) return b.isUnanimous ? 1 : -1;
      if (b.likes !== a.likes) return b.likes - a.likes;
      if (a.passes !== b.passes) return a.passes - b.passes;
      return (b.restaurant.totalScore || 0) - (a.restaurant.totalScore || 0);
    });
}
