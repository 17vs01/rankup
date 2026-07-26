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
  bad() { beep(160, 0.15, 'square', 0.08); vibrate([30, 40, 30]); },
  tick() { beep(660, 0.04, 'sine', 0.06); },
  start() { beep(523, 0.1); setTimeout(() => beep(784, 0.12), 110); },
  finish() { beep(523, 0.09); setTimeout(() => beep(659, 0.09), 100); setTimeout(() => beep(784, 0.18), 200); },
  tierup() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'triangle', 0.15), i * 120));
    vibrate([40, 60, 40, 60, 80]);
  },
};
