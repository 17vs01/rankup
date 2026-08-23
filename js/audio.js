// 미니 사운드 + 진동 피드백
import { haptic } from './platform.js';

let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep(freq, dur = 0.08, type = 'sine', gain = 0.12) {
  try {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  } catch { /* 무음 환경 무시 */ }
}

// 진동은 플랫폼에 맡긴다 — 토스(iOS 포함)는 SDK 햅틱, 웹은 navigator.vibrate
function vibrate(type) { haptic(type); }

export const sfx = {
  good() { beep(880, 0.07); vibrate('tickMedium'); },
  // 연속 정답 — 이어질수록 음이 올라간다 (5연속부터는 화음)
  combo(n) {
    const f = Math.min(1568, 880 * Math.pow(1.06, n));
    beep(f, 0.07);
    if (n >= 5) setTimeout(() => beep(f * 1.25, 0.06, 'sine', 0.08), 45);
    vibrate('tickMedium');
  },
  // 음높이를 직접 정하는 소리 (메아리처럼 패드마다 음이 달라야 할 때)
  tone(freq, dur = 0.16) { beep(freq, dur, 'triangle', 0.14); vibrate('tap'); },
  bad() { beep(160, 0.15, 'square', 0.08); vibrate('error'); },
  tick() { beep(660, 0.04, 'sine', 0.06); },
  start() { beep(523, 0.1); setTimeout(() => beep(784, 0.12), 110); },
  finish() { beep(523, 0.09); setTimeout(() => beep(659, 0.09), 100); setTimeout(() => beep(784, 0.18), 200); },
  tierup() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'triangle', 0.15), i * 120));
    vibrate('confetti');
  },
};
