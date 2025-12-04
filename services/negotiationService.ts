import AsyncStorage from '@react-native-async-storage/async-storage';

export type NegotiationStatus = 'REQUESTED' | 'PENDING_REMOTE' | 'COUNTER' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export type TimeCandidate = {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string;   // HH:mm
};

export type Negotiation = {
  id: string;
  friendId: string; // primary friend (first)
  friendIds?: string[]; // all participants besides me
  roomId?: string;
  status: NegotiationStatus;
  candidates: TimeCandidate[];
  counterCandidates?: TimeCandidate[];
  note?: string;
};

type Listener = (n: Negotiation) => void;

class NegotiationEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();
  subscribe(negotiationId: string, listener: Listener) {
    if (!this.listeners.has(negotiationId)) this.listeners.set(negotiationId, new Set());
    this.listeners.get(negotiationId)!.add(listener);
    return () => this.listeners.get(negotiationId)!.delete(listener);
  }
  emit(n: Negotiation) {
    const set = this.listeners.get(n.id);
    if (!set) return;
    for (const l of set) l(n);
  }
}

const emitter = new NegotiationEmitter();

async function baseUrl(): Promise<string> { return 'http://localhost:3000'; }

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export const NegotiationService = {
  // Create negotiation; falls back to mock when backend not ready
  async createNegotiation(friendOrFriends: string | string[], candidates: TimeCandidate[], note?: string): Promise<Negotiation> {
    const friendIds = Array.isArray(friendOrFriends) ? friendOrFriends : [friendOrFriends];
    const friendId = friendIds[0];
    const payload = { friendId, participantIds: friendIds, candidates, note } as any;
    try {
      const res = await fetch(`${await baseUrl()}/a2a/negotiations`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(payload) });
      if (res.ok) {
        const data = await res.json();
        const negotiation: Negotiation = { id: String(data.negotiationId), friendId, friendIds, roomId: data.roomId, status: 'REQUESTED', candidates, note };
        // Emit initial and move to pending
        emitter.emit(negotiation);
        const pending: Negotiation = { ...negotiation, status: 'PENDING_REMOTE' };
        emitter.emit(pending);
        return pending;
      }
    } catch {
      // fall through to mock
    }
    // Mock: generate id and simulate lifecycle
    const id = `neg_${Math.random().toString(36).slice(2, 9)}`;
    const mock: Negotiation = { id, friendId, friendIds, status: 'PENDING_REMOTE', candidates, note, roomId: `room_${friendId}` };
    emitter.emit(mock);
    // After delay, send COUNTER
    setTimeout(() => {
      const counter: Negotiation = {
        ...mock,
        status: 'COUNTER',
        counterCandidates: mock.candidates.map((c) => ({ ...c, start: c.start, end: c.end })),
      };
      emitter.emit(counter);
    }, 2000);
    return mock;
  },

  async getNegotiation(id: string): Promise<Negotiation | null> {
    try {
      const res = await fetch(`${await baseUrl()}/a2a/negotiations/${id}`, { headers: await authHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  },

  onNegotiationUpdated(negotiationId: string, listener: Listener) {
    return emitter.subscribe(negotiationId, listener);
  },

  // Accept a counter candidate (mock)
  async accept(negotiationId: string, friendId: string, candidate: TimeCandidate): Promise<void> {
    try {
      await fetch(`${await baseUrl()}/a2a/negotiations/${negotiationId}/accept`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(candidate) });
    } catch {}
    const confirmed: Negotiation = { id: negotiationId, friendId, status: 'CONFIRMED', candidates: [candidate] } as Negotiation;
    emitter.emit(confirmed);
  },
};

export default NegotiationService;


