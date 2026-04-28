export type RefereeEventType = 'progress' | 'step-start' | 'step-done' | 'error';

export interface RefereeEvent {
  type: RefereeEventType;
  step?: string;
  message: string;
  timestamp: Date;
}

export class RefereeEventBus {
  private listeners: ((e: RefereeEvent) => void)[] = [];

  emit(event: RefereeEvent): void {
    this.listeners.forEach(l => l(event));
  }

  on(listener: (e: RefereeEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const refereeEventBus = new RefereeEventBus();
