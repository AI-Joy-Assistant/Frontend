import NegotiationService, { Negotiation, NegotiationStatus, TimeCandidate } from '../services/negotiationService';

type ActiveMap = Record<string, Negotiation>; // friendId -> negotiation
type MapListener = (active: ActiveMap) => void;
type EventListener = (n: Negotiation) => void;

class NegotiationStoreImpl {
  private activeByFriend: ActiveMap = {};
  private mapListeners: Set<MapListener> = new Set();
  private eventListeners: Set<EventListener> = new Set();
  private unsubByNegotiation: Record<string, () => void> = {};

  onActiveChange(listener: MapListener) {
    this.mapListeners.add(listener);
    listener(this.activeByFriend);
    return () => this.mapListeners.delete(listener);
  }

  onEvent(listener: EventListener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private notifyActive() {
    for (const l of this.mapListeners) l({ ...this.activeByFriend });
  }

  private notifyEvent(n: Negotiation) {
    for (const l of this.eventListeners) l(n);
  }

  private observe(n: Negotiation) {
    const existingUnsub = this.unsubByNegotiation[n.id];
    if (existingUnsub) existingUnsub();
    this.activeByFriend[n.friendId] = n;
    this.notifyActive();
    this.unsubByNegotiation[n.id] = NegotiationService.onNegotiationUpdated(n.id, (updated) => {
      // update
      this.activeByFriend[updated.friendId] = updated;
      this.notifyActive();
      this.notifyEvent(updated);
      if (this.isTerminal(updated.status)) {
        delete this.activeByFriend[updated.friendId];
        this.notifyActive();
      }
    });
  }

  private isTerminal(s: NegotiationStatus) {
    return s === 'CONFIRMED' || s === 'FAILED' || s === 'CANCELLED';
  }

  async start(friendId: string, candidates: TimeCandidate[], note?: string): Promise<Negotiation> {
    const n = await NegotiationService.createNegotiation(friendId, candidates, note);
    this.observe(n);
    this.notifyEvent(n);
    return n;
  }

  async accept(negotiationId: string, friendId: string, candidate: TimeCandidate) {
    await NegotiationService.accept(negotiationId, friendId, candidate);
  }

  getActiveForFriend(friendId: string): Negotiation | undefined {
    return this.activeByFriend[friendId];
  }
}

export const NegotiationStore = new NegotiationStoreImpl();
export default NegotiationStore;










