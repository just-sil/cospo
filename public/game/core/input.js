// Keyboard + on-screen joystick/buttons merged into one plain state object.
//
// Modes only read these fields (so tests can pass an object literal instead):
//   left, right, up, down  – direction keys
//   jump, fire             – held buttons
//   stickX, stickY         – analogue joystick in [-1, 1] (0 inside the dead zone)
// One-shot presses ('jump', 'nitro') are delivered through the onPress callback.

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'fire', KeyF: 'fire', KeyX: 'fire',
};
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const DEAD_ZONE = 0.2;

export class Input {
  /**
   * @param {object} opts
   * @param {(action: string) => void} opts.onPress  called once per key/button press
   * @param {() => void} opts.onGesture             called on any user gesture (unlocks audio)
   * @param {() => boolean} opts.isRotated          true when the stage is rotated 90° (portrait phone)
   */
  constructor({ onPress, onGesture, isRotated }) {
    this.onPress = onPress;
    this.onGesture = onGesture;
    this.isRotated = isRotated;
    this.held = new Set();
    this.stickX = 0;
    this.stickY = 0;
    this.buttonJump = false;
    this.buttonFire = false;

    addEventListener('keydown', e => this.keyDown(e));
    addEventListener('keyup', e => this.keyUp(e));
    addEventListener('blur', () => this.reset()); // keys released while the tab was hidden never fire keyup
  }

  get left() { return this.held.has('left'); }
  get right() { return this.held.has('right'); }
  get up() { return this.held.has('up'); }
  get down() { return this.held.has('down'); }
  get jump() { return this.buttonJump || this.held.has('Space') || this.held.has('up'); }
  get fire() { return this.buttonFire || this.held.has('fire'); }

  reset() {
    this.held.clear();
    this.buttonJump = this.buttonFire = false;
    this.stickX = this.stickY = 0;
  }

  keyDown(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; // typing a name, not playing
    this.onGesture();
    const name = e.code === 'Space' ? 'Space' : KEYS[e.code];
    if (name) this.held.add(name);
    if (JUMP_KEYS.has(e.code)) {
      e.preventDefault(); // keep Space/arrows from scrolling the page
      if (!e.repeat) {
        this.onPress('jump');
        if (e.code === 'Space') this.onPress('nitro');
      }
    }
  }

  keyUp(e) {
    this.held.delete(e.code === 'Space' ? 'Space' : KEYS[e.code]);
  }

  /** Hold-style touch button (JUMP, FIRE). */
  bindHoldButton(el, field, pressAction) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.onGesture();
      this[field] = true;
      el.classList.add('on');
      if (pressAction) this.onPress(pressAction);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
      el.addEventListener(type, () => { this[field] = false; el.classList.remove('on'); });
    }
  }

  /** Tap-style touch button (NITRO). */
  bindTapButton(el, action) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); this.onGesture(); this.onPress(action); });
  }

  /** Virtual joystick: a base element with a knob that follows the finger. */
  bindJoystick(base, knob) {
    let pointer = null;
    const move = e => {
      const r = base.getBoundingClientRect(), radius = r.width / 2;
      let ex = e.clientX - (r.left + radius), ey = e.clientY - (r.top + radius);
      if (this.isRotated()) [ex, ey] = [ey, -ex];
      let dx = ex / radius, dy = ey / radius;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      knob.style.transform = `translate(${dx * radius * 0.7}px,${dy * radius * 0.7}px)`;
      this.stickX = Math.abs(dx) < DEAD_ZONE ? 0 : dx;
      this.stickY = Math.abs(dy) < DEAD_ZONE ? 0 : dy;
    };
    const release = e => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      this.stickX = this.stickY = 0;
      knob.style.transform = '';
    };
    base.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.onGesture();
      pointer = e.pointerId;
      base.setPointerCapture(pointer);
      move(e);
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === pointer) move(e); });
    base.addEventListener('pointerup', release);
    base.addEventListener('pointercancel', release);
  }
}

/** Horizontal intent in [-1, 1] from keys + joystick. */
export const axisX = i => Math.max(-1, Math.min(1, (i.right ? 1 : 0) - (i.left ? 1 : 0) + i.stickX));
/** Vertical intent in [-1, 1] (down is positive) from keys + joystick. */
export const axisY = i => Math.max(-1, Math.min(1, (i.down ? 1 : 0) - (i.up ? 1 : 0) + i.stickY));
