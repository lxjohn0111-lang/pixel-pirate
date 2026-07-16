// Tiny publish/subscribe event bus. This is the seam future systems
// (combat, quests, achievements, statistics...) plug into: they subscribe
// to gameplay events without the emitting code knowing about them.
//
// Events currently emitted by the game:
//   'input:pause'        - user pressed the pause key / button
//   'game:pause'         - game entered the paused state
//   'game:resume'        - game resumed
//   'collect'            - { type, x, y, gains: {coins?, wood?} }
//   'resources:changed'  - { coins, wood }
//   'ship:collide'       - { x, y, speed }
//   'weather:changed'    - { kind }
//   'weather:lightning'  - {}
//   'daynight:phase'     - { phase }  ('dawn'|'day'|'dusk'|'night')
//   'sfx'                - name of a one-shot sound to play
//   'settings:changed'   - the settings object

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /** Subscribe. Returns an unsubscribe function. */
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    this.listeners.get(name)?.delete(fn);
  }

  emit(name, payload) {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of set) fn(payload);
  }
}
