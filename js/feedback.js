// 판정 플래시 — 정답/오답을 화면 한가운데 크게 띄운다.
// 버튼 색이나 작은 글씨만으로는 "맞았는지"가 한눈에 안 들어온다는 제보로 추가.
// container는 position: relative여야 한다 (게임 화면 .game-body가 그렇다).
export function judge(container, ok, text = '') {
  const old = container.querySelector('.judge');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'judge ' + (ok ? 'ok' : 'bad');
  el.innerHTML = `<div class="judge-icon">${ok ? '◯' : '✕'}</div>`
    + (text ? `<div class="judge-text">${text}</div>` : '');
  container.appendChild(el);
  // 애니메이션이 끝나면 치운다. 세션이 먼저 끝나 DOM째 사라져도 remove는 무해하다.
  setTimeout(() => el.remove(), 950);
}
