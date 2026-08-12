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

// 연속 정답 마디 터뜨리기 (5·10·15…)
//
// 60초 스프린트(암산·어휘력·수 비교…)에서는 판정을 매번 크게 띄우면 방해만 된다.
// 답이 초당 하나씩 나오는데 화면을 가리면 다음 문제를 못 읽기 때문이다.
// 대신 마디마다 한 번씩 터뜨려서 "타고 있다"는 감각만 준다.
export function comboBurst(container, n) {
  const old = container.querySelector('.combo-burst');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'combo-burst' + (n >= 15 ? ' hot' : '');
  el.innerHTML = `<span class="cb-num">${n}</span><span class="cb-label">연속</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

/** 5의 배수마다만 터뜨린다. 게임 쪽에서 조건을 매번 쓰지 않게. */
export function comboTick(container, streak) {
  if (streak >= 5 && streak % 5 === 0) comboBurst(container, streak);
}
