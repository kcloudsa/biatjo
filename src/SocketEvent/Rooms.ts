export const tripRoom = (tripId: string) => `trip:${tripId}`;
type TripRole = 'rider' | 'driver';

type MemberInfo = {
  userId: string;
  role: TripRole;
  socketId: string;
  joinedAt: number;
};

// --- In-memory registries (single-instance) ---
const tripMembers = new Map<string, Map<string, MemberInfo>>(); // roomName -> socketId -> MemberInfo
// export const userRooms = new Map<string, Set<string>>(); // userId -> Set(roomName)
export const userRooms = new Map<string, Map<string, TripRole>>(); // userId -> Map(roomName -> role)
export const userLastSeen = new Map<string, number>(); // userId -> timestamp (for TTL cleanup)

// Keep user->rooms for some time after disconnect for auto re-join.
const REJOIN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function trackJoin(roomName: string, info: MemberInfo) {
  if (!tripMembers.has(roomName)) tripMembers.set(roomName, new Map());
  tripMembers.get(roomName)!.set(info.socketId, info);

  if (!userRooms.has(info.userId)) userRooms.set(info.userId, new Map());
  userRooms.get(info.userId)!.set(roomName, info.role);

  userLastSeen.set(info.userId, Date.now());
}

export function trackLeave(roomName: string, socketId: string) {
  const members = tripMembers.get(roomName);
  if (members) {
    const info = members.get(socketId);
    members.delete(socketId);
    if (members.size === 0) tripMembers.delete(roomName);

    if (info) {
      const rooms = userRooms.get(info.userId);
      if (rooms) {
        rooms.delete(roomName);
        if (rooms.size === 0) userRooms.delete(info.userId);
      }
      userLastSeen.set(info.userId, Date.now());
    }
  }
}

function cleanupExpiredUserRooms() {
  const now = Date.now();
  for (const [userId, lastSeen] of userLastSeen.entries()) {
    if (now - lastSeen > REJOIN_TTL_MS) {
      userRooms.delete(userId);
      userLastSeen.delete(userId);
    }
  }
}

// Run periodic cleanup
setInterval(cleanupExpiredUserRooms, 60_000).unref();
