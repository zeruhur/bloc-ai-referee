import { describe, it, expect, vi } from 'vitest';
import { RefereeEventBus } from '../src/ui/RefereeEventBus';
import type { RefereeEvent } from '../src/ui/RefereeEventBus';

function makeEvent(msg: string): RefereeEvent {
  return { type: 'progress', message: msg, timestamp: new Date() };
}

describe('RefereeEventBus', () => {
  it('delivers emitted events to subscribers', () => {
    const bus = new RefereeEventBus();
    const received: RefereeEvent[] = [];
    bus.on(e => received.push(e));

    const ev = makeEvent('hello');
    bus.emit(ev);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(ev);
  });

  it('delivers to multiple subscribers', () => {
    const bus = new RefereeEventBus();
    const a: RefereeEvent[] = [];
    const b: RefereeEvent[] = [];
    bus.on(e => a.push(e));
    bus.on(e => b.push(e));

    bus.emit(makeEvent('x'));

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('unsubscribe stops delivery', () => {
    const bus = new RefereeEventBus();
    const received: RefereeEvent[] = [];
    const unsub = bus.on(e => received.push(e));

    bus.emit(makeEvent('first'));
    unsub();
    bus.emit(makeEvent('second'));

    expect(received).toHaveLength(1);
    expect(received[0].message).toBe('first');
  });

  it('unsubscribing one listener does not affect others', () => {
    const bus = new RefereeEventBus();
    const a: RefereeEvent[] = [];
    const b: RefereeEvent[] = [];
    const unsubA = bus.on(e => a.push(e));
    bus.on(e => b.push(e));

    bus.emit(makeEvent('one'));
    unsubA();
    bus.emit(makeEvent('two'));

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
  });

  it('emitting with no subscribers does not throw', () => {
    const bus = new RefereeEventBus();
    expect(() => bus.emit(makeEvent('silent'))).not.toThrow();
  });

  it('preserves event fields', () => {
    const bus = new RefereeEventBus();
    let received: RefereeEvent | null = null;
    bus.on(e => { received = e; });

    const ts = new Date();
    bus.emit({ type: 'error', step: 'Step1', message: 'oops', timestamp: ts });

    expect(received).not.toBeNull();
    expect(received!.type).toBe('error');
    expect(received!.step).toBe('Step1');
    expect(received!.message).toBe('oops');
    expect(received!.timestamp).toBe(ts);
  });
});
