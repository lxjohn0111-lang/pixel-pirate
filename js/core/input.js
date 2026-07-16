// Keyboard + touch input. Produces a normalized control state the ship
// consumes: throttle [-1, 1], steer [-1, 1], and (on touch) an absolute
// target heading from the virtual joystick.

export class Input {
  constructor(events, uiRoot) {
    this.events = events;
    this.keys = new Set();
    this.justPressed = new Set();
    this.throttle = 0;
    this.steer = 0;
    /** Absolute heading requested by the joystick, or null on keyboard. */
    this.headingTarget = null;
    this.touchActive = false;
    this._touchId = null;
    this._baseX = 0;
    this._baseY = 0;
    /** Pointer state for boarding combat aiming. */
    this.pointerX = 0;
    this.pointerY = 0;
    this.pointerDown = false;
    this._pointerClicked = false;
    /** Virtual button states set by HUD touch buttons (mobile). */
    this.virtual = {};

    this._buildJoystick(uiRoot);
    this._bind();
  }

  isDown(code) {
    return this.keys.has(code) || !!this.virtual[code];
  }

  /** One-shot: true only on the frame the key went down. */
  pressed(code) {
    return this.justPressed.has(code);
  }

  /** HUD buttons feed key-like signals here (e.g. 'KeyF', 'Space'). */
  pressVirtual(code) {
    this.justPressed.add(code);
  }

  consumeClick() {
    const c = this._pointerClicked;
    this._pointerClicked = false;
    return c;
  }

  /** Clear one-frame state. Call at the END of each game update. */
  endFrame() {
    this.justPressed.clear();
    this._pointerClicked = false;
  }

  _buildJoystick(uiRoot) {
    this.joy = document.createElement('div');
    this.joy.className = 'joystick hidden';
    this.joy.innerHTML = '<div class="joystick-base"></div><div class="joystick-knob"></div>';
    uiRoot.appendChild(this.joy);
    this.joyKnob = this.joy.querySelector('.joystick-knob');
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.events.emit('input:pause');
        return;
      }
      this.keys.add(e.code);
      this.justPressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Pointer tracking (aiming + click attacks during boarding).
    window.addEventListener('pointermove', (e) => {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    });
    window.addEventListener('pointerdown', (e) => {
      if (this._isUiTarget(e.target)) return;
      this.pointerDown = true;
      this._pointerClicked = true;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    });
    window.addEventListener('pointerup', () => {
      this.pointerDown = false;
    });

    // Virtual joystick: touch anywhere on the lower/left play area.
    const opts = { passive: false };
    window.addEventListener('touchstart', (e) => this._touchStart(e), opts);
    window.addEventListener('touchmove', (e) => this._touchMove(e), opts);
    window.addEventListener('touchend', (e) => this._touchEnd(e), opts);
    window.addEventListener('touchcancel', (e) => this._touchEnd(e), opts);
  }

  _isUiTarget(target) {
    return target.closest && target.closest('.screen, .hud button, .pause-btn, .panel, .hud-btn, .quickbar, .toast');
  }

  _touchStart(e) {
    if (this._touchId !== null) return;
    const t = e.changedTouches[0];
    if (this._isUiTarget(t.target)) return;
    e.preventDefault();
    this._touchId = t.identifier;
    this._baseX = t.clientX;
    this._baseY = t.clientY;
    this.touchActive = true;
    this.joy.classList.remove('hidden');
    this.joy.style.left = `${t.clientX}px`;
    this.joy.style.top = `${t.clientY}px`;
    this.joyKnob.style.transform = 'translate(-50%,-50%)';
  }

  _touchMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== this._touchId) continue;
      e.preventDefault();
      const dx = t.clientX - this._baseX;
      const dy = t.clientY - this._baseY;
      const d = Math.hypot(dx, dy);
      const max = 52;
      const k = d > max ? max / d : 1;
      this.joyKnob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      if (d > 10) {
        this.headingTarget = Math.atan2(dy, dx);
        this.throttle = Math.min(1, d / max);
      } else {
        this.headingTarget = null;
        this.throttle = 0;
      }
    }
  }

  _touchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== this._touchId) continue;
      this._touchId = null;
      this.touchActive = false;
      this.headingTarget = null;
      this.throttle = 0;
      this.joy.classList.add('hidden');
    }
  }

  /** Refresh keyboard-driven axes. Call once per frame before the ship update. */
  update() {
    if (this.touchActive) return; // joystick already set throttle/headingTarget
    this.headingTarget = null;
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    this.throttle = (up ? 1 : 0) - (down ? 1 : 0);
    this.steer = (right ? 1 : 0) - (left ? 1 : 0);
  }
}
