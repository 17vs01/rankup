// 기록 백업 — 내보내기 / 가져오기
// 기록이 브라우저 저장소에만 있어서, 데이터를 지우면 랭크가 날아간다.
// 덮어쓰기 전에 파일 내용을 먼저 보여주고 확인받는다.

const FORMAT = 'rankup-backup';
const VERSION = 1;

function pad(n) { return String(n).padStart(2, '0'); }

export function exportState(state) {
  const now = new Date();
  const payload = {
    format: FORMAT,
    version: VERSION,
    exportedAt: now.toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rankup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return a.download;
}

// 파일을 읽어 검증만 한다. 실제 적용은 사용자가 확인한 뒤에.
export function readBackup(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('파일을 읽지 못했습니다'));
    fr.onload = () => {
      let data;
      try { data = JSON.parse(fr.result); }
      catch { return reject(new Error('JSON 형식이 아닙니다')); }

      // 백업 파일인지 확인 — 아무 JSON이나 덮어쓰게 두면 기록이 깨진다
      const s = data && data.format === FORMAT ? data.state : data;
      if (!s || typeof s !== 'object' || !s.disc || typeof s.disc !== 'object') {
        return reject(new Error('RANKUP 백업 파일이 아닙니다'));
      }
      const ids = Object.keys(s.disc);
      if (!ids.length) return reject(new Error('종목 기록이 비어 있습니다'));
      for (const id of ids) {
        const d = s.disc[id];
        if (!d || typeof d.rating !== 'number' || !Number.isFinite(d.rating)) {
          return reject(new Error(`'${id}' 기록이 손상되었습니다`));
        }
      }

      const sessions = ids.reduce((a, id) => a + (s.disc[id].sessions || 0), 0);
      const lastPlayed = Math.max(0, ...ids.map(id => s.disc[id].lastPlayed || 0));
      resolve({
        state: s,
        summary: {
          종목: ids.length,
          누적판수: s.totalSessions || sessions,
          스트릭: s.streak || 0,
          마지막플레이: lastPlayed ? new Date(lastPlayed) : null,
          내보낸시각: data.exportedAt ? new Date(data.exportedAt) : null,
        },
      });
    };
    fr.readAsText(file);
  });
}

export function fmtDate(d) {
  if (!d) return '기록 없음';
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
