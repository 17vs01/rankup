// 미니 사운드 + 진동 피드백
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

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export const sfx = {
  good() { beep(880, 0.07); vibrate(15); },
  // 연속 정답 — 이어질수록 음이 올라간다 (5연속부터는 화음)
  combo(n) {
    const f = Math.min(1568, 880 * Math.pow(1.06, n));
    beep(f, 0.07);
    if (n >= 5) setTimeout(() => beep(f * 1.25, 0.06, 'sine', 0.08), 45);
    vibrate(15);
  },
  // 음높이를 직접 정하는 소리 (사이먼처럼 패드마다 음이 달라야 할 때)
  tone(freq, dur = 0.16) { beep(freq, dur, 'triangle', 0.14); vibrate(12); },
  bad() { beep(160, 0.15, 'square', 0.08); vibrate([30, 40, 30]); },
  tick() { beep(660, 0.04, 'sine', 0.06); },
  start() { beep(523, 0.1); setTimeout(() => beep(784, 0.12), 110); },
  finish() { beep(523, 0.09); setTimeout(() => beep(659, 0.09), 100); setTimeout(() => beep(784, 0.18), 200); },
  tierup() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'triangle', 0.15), i * 120));
    vibrate([40, 60, 40, 60, 80]);
  },
};
