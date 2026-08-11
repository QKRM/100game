/* 100 만들기 — 게임 로직 (순수 JavaScript, 외부 의존 없음) */
'use strict';

var MAX = 100;          /* 이 점수를 넘으면 그 자리에서 패배 */
var EXPLORE = 'explore';
var PROB = 'prob';

/* ---------------- DOM 헬퍼 ---------------- */

function el(id) { return document.getElementById(id); }
function show(node, on) { node.classList.toggle('hidden', !on); }

/* ---------------- 상태 ---------------- */

var S = {
  mode: EXPLORE,
  names: ['1번', '2번'],
  players: null,
  deck: [],
  card: null,
  phase: 'idle',      /* 'place' | 'draw' | 'over' */
  turn: 0,
  first: 0,
  pending: {},        /* 탐구 모드: 이번 카드에 대한 각자의 선택 (공개 전) */
  reveal: null,       /* 탐구 모드: 방금 공개된 결과 */
  showRemaining: true,
  history: [],
  result: null
};

function newPlayer(name) {
  return { name: name, score: 0, log: [], busted: false, stood: false };
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function buildDeck(mode) {
  var d = [], n, k;
  if (mode === EXPLORE) {
    for (n = 1; n <= 6; n++) { d.push(n); }          /* 1~6 각 1장 = 6장 */
  } else {
    for (n = 1; n <= 6; n++) {
      for (k = 0; k < 4; k++) { d.push(n); }          /* 1~6 각 4장 = 24장 */
    }
  }
  return shuffle(d);
}

/* ---------------- 화면 전환 ---------------- */

function goScreen(name) {
  show(el('screen-start'), name === 'start');
  show(el('screen-game'), name === 'game');
  show(el('screen-result'), name === 'result');
  window.scrollTo(0, 0);
}

/* ---------------- 게임 시작 ---------------- */

function startGame(mode, names, first) {
  S.mode = mode;
  S.names = names.slice();
  S.players = [newPlayer(names[0]), newPlayer(names[1])];
  S.deck = buildDeck(mode);
  S.first = first;
  S.turn = first;
  S.pending = {};
  S.reveal = null;
  S.result = null;

  if (mode === EXPLORE) {
    S.card = S.deck.pop();       /* 공유 카드 한 장 공개 */
    S.phase = 'place';
  } else {
    S.card = null;
    S.phase = 'draw';
  }
  goScreen('game');
  render(true);
}

/* ---------------- 선택 처리 ---------------- */

function placeValue(card, kind) { return kind === 'tens' ? card * 10 : card; }

function place(kind) {
  if (S.phase !== 'place' || S.card === null) { return; }

  if (S.mode === EXPLORE) {
    S.pending[S.turn] = kind;
    var other = 1 - S.turn;
    if (S.pending[other] === undefined) {
      S.turn = other;               /* 두 번째 사람 차례 (첫 번째 선택은 비밀) */
      render(false);
      return;
    }
    resolveExplore();
    return;
  }

  /* 확률 모드 */
  var p = S.players[S.turn];
  var add = placeValue(S.card, kind);
  p.score += add;
  p.log.push({ card: S.card, kind: kind, total: p.score });
  S.card = null;

  if (p.score > MAX) {             /* 100을 넘는 순간 그 자리에서 끝 */
    p.busted = true;
    endGame();
    return;
  }
  S.phase = 'draw';
  render(false);
}

function resolveExplore() {
  var order = [S.first, 1 - S.first];
  var items = [];
  var i, idx, p, kind, add;

  for (i = 0; i < order.length; i++) {
    idx = order[i];
    p = S.players[idx];
    kind = S.pending[idx];
    add = placeValue(S.card, kind);
    p.score += add;
    p.log.push({ card: S.card, kind: kind, total: p.score });
    items.push({ idx: idx, kind: kind, add: add, total: p.score });
  }
  S.reveal = { card: S.card, items: items };
  S.pending = {};

  var busted = [];
  for (i = 0; i < order.length; i++) {
    if (S.players[order[i]].score > MAX) {
      S.players[order[i]].busted = true;
      busted.push(order[i]);
    }
  }
  if (busted.length > 0) { endGame(); return; }
  if (S.deck.length === 0) { endGame(); return; }   /* 6장 모두 사용 */

  S.card = S.deck.pop();
  S.turn = S.first;
  render(true);
}

function hit() {
  if (S.phase !== 'draw' || S.deck.length === 0) { return; }
  S.card = S.deck.pop();
  S.phase = 'place';
  render(true);
}

function stand() {
  if (S.phase !== 'draw') { return; }
  var p = S.players[S.turn];
  if (p.log.length === 0 && S.deck.length > 0) { return; }   /* 최소 1장은 뽑아야 함 */

  p.stood = true;
  if (S.turn === S.first) {
    S.turn = 1 - S.first;          /* 뒷사람 차례 시작 */
    S.phase = 'draw';
    S.card = null;
    render(false);
  } else {
    endGame();
  }
}

/* ---------------- 종료 / 판정 ---------------- */

function endGame() {
  var a = S.players[0], b = S.players[1];
  var winner, reason;

  if (a.busted && b.busted) {
    winner = -1; reason = '두 사람 모두 100을 넘었어요.';
  } else if (a.busted) {
    winner = 1; reason = a.name + ' 점수가 100을 넘었어요.';
  } else if (b.busted) {
    winner = 0; reason = b.name + ' 점수가 100을 넘었어요.';
  } else if (a.score > b.score) {
    winner = 0; reason = a.name + ' 점수가 100에 더 가까워요.';
  } else if (b.score > a.score) {
    winner = 1; reason = b.name + ' 점수가 100에 더 가까워요.';
  } else {
    winner = -1; reason = '두 사람 점수가 같아요.';
  }

  S.phase = 'over';
  S.result = { winner: winner, reason: reason };
  S.history.push({
    mode: S.mode,
    names: [a.name, b.name],
    scores: [a.score, b.score],
    busted: [a.busted, b.busted],
    winner: winner
  });
  renderResult();
  goScreen('result');
}

/* ---------------- 그리기 ---------------- */

function kindText(kind) { return kind === 'tens' ? '십의 자리' : '일의 자리'; }

function render(flip) {
  var i, p, sc;

  /* 점수판 */
  for (i = 0; i < 2; i++) {
    p = S.players[i];
    sc = el('sc' + i);
    sc.querySelector('.sc-name-text').textContent = p.name;
    sc.querySelector('.sc-score-text').textContent = String(p.score);
    sc.classList.toggle('active', S.phase !== 'over' && S.turn === i);
    sc.classList.toggle('out', p.busted);
    sc.querySelector('.sc-state').textContent =
      p.busted ? '✖ 100 넘음' : (p.stood ? '■ 멈춤' : '');
  }

  /* 기록 */
  for (i = 0; i < 2; i++) {
    p = S.players[i];
    el('log-title' + i).textContent = p.name + ' 기록 (' + p.log.length + ')';
    var list = el('log' + i);
    list.innerHTML = '';
    for (var j = 0; j < p.log.length; j++) {
      var e = p.log[j];
      var li = document.createElement('li');
      li.textContent = e.card + ' → ' + kindText(e.kind) +
        ' (+' + placeValue(e.card, e.kind) + ') = ' + e.total;
      if (e.total > MAX) { li.className = 'over'; }
      list.appendChild(li);
    }
  }

  renderCard(flip);
  renderReveal();
  renderRemaining();
  renderControls();
  renderBanner();
}

function renderCard(flip) {
  var card = el('card');
  var face = el('card-face');
  if (S.card === null) {
    card.classList.add('back');
    face.textContent = '?';
  } else {
    card.classList.remove('back');
    face.textContent = String(S.card);
    if (flip) {
      card.classList.remove('flip');
      void card.offsetWidth;      /* 애니메이션 다시 시작 */
      card.classList.add('flip');
    }
  }
  el('card-hint').textContent =
    S.card === null ? '아직 카드를 뽑지 않았어요.'
                    : (S.mode === EXPLORE ? '두 사람이 함께 쓰는 카드예요.' : '뽑은 카드예요.');
}

function renderReveal() {
  var box = el('round-reveal');
  if (!S.reveal || S.mode !== EXPLORE) { show(box, false); return; }
  var html = '<b>바로 전 카드 ' + S.reveal.card + '</b> — ';
  var parts = [];
  for (var i = 0; i < S.reveal.items.length; i++) {
    var it = S.reveal.items[i];
    parts.push(S.players[it.idx].name + ': ' + kindText(it.kind) +
      ' (+' + it.add + ') = ' + it.total + '점');
  }
  box.innerHTML = html + parts.join(' / ');
  show(box, true);
}

function renderRemaining() {
  var box = el('remain-box');
  if (S.mode !== PROB) { show(box, false); return; }
  show(box, true);

  var btn = el('btn-remain');
  btn.textContent = S.showRemaining ? '숨기기' : '보기';
  btn.setAttribute('aria-pressed', S.showRemaining ? 'true' : 'false');
  el('remain-total').textContent = String(S.deck.length);

  var list = el('remain-list');
  show(list, S.showRemaining);
  list.innerHTML = '';
  if (!S.showRemaining) { return; }

  var counts = [0, 0, 0, 0, 0, 0, 0];
  for (var i = 0; i < S.deck.length; i++) { counts[S.deck[i]]++; }
  for (var n = 1; n <= 6; n++) {
    var li = document.createElement('li');
    if (counts[n] === 0) { li.className = 'zero'; }
    li.innerHTML = '<span class="rn">' + n + '</span>' + counts[n] + '장';
    list.appendChild(li);
  }
}

function renderControls() {
  var bHit = el('btn-hit'), bOnes = el('btn-ones'),
      bTens = el('btn-tens'), bStand = el('btn-stand');

  var placing = (S.phase === 'place' && S.card !== null);
  show(bOnes, placing);
  show(bTens, placing);

  if (placing) {
    setChoice(bOnes, 'ones');
    setChoice(bTens, 'tens');
  }

  if (S.mode === PROB) {
    show(bHit, S.phase === 'draw');
    show(bStand, S.phase === 'draw');
    var p = S.players[S.turn];
    bHit.disabled = S.deck.length === 0;
    bHit.textContent = S.deck.length === 0 ? '카드가 없어요' : '카드 뽑기';
    /* 최소 1장 규칙: 아직 한 장도 안 뽑았으면 멈추기 불가 */
    var mustDraw = (p.log.length === 0 && S.deck.length > 0);
    bStand.disabled = mustDraw;
    bStand.textContent = mustDraw
      ? '멈추기 (카드를 1장은 뽑아야 해요)'
      : '멈추기 (지금 점수로 확정)';
  } else {
    show(bHit, false);
    show(bStand, false);
  }
}

function setChoice(btn, kind) {
  var p = S.players[S.turn];
  var add = placeValue(S.card, kind);
  var total = p.score + add;
  var over = total > MAX;
  btn.querySelector('.ch-title').textContent =
    kindText(kind) + '에 넣기  +' + add;
  btn.querySelector('.ch-detail').textContent =
    p.score + ' + ' + add + ' = ' + total + '점' + (over ? '  ⚠️ 100 초과' : '');
  btn.classList.toggle('over', over);
}

function renderBanner() {
  var b = el('turn-banner');
  var p = S.players[S.turn];
  if (S.mode === EXPLORE) {
    var otherPicked = S.pending[1 - S.turn] !== undefined;
    if (S.phase === 'place') {
      b.textContent = p.name + ' 차례 — 어디에 넣을까요?' +
        (otherPicked ? ' (' + S.players[1 - S.turn].name + ' 선택 끝, 아직 비밀)' : '');
    } else {
      b.textContent = '';
    }
  } else {
    if (S.phase === 'draw') {
      b.textContent = p.name + ' 차례 — 뽑을까요, 멈출까요?';
    } else if (S.phase === 'place') {
      b.textContent = p.name + ' 차례 — 어디에 넣을까요?';
    } else {
      b.textContent = '';
    }
  }
}

function renderResult() {
  var r = S.result;

  el('result-title').textContent =
    r.winner === -1 ? '무승부!' : '🏆 ' + S.players[r.winner].name + ' 승리!';
  el('result-reason').textContent = r.reason;

  for (var i = 0; i < 2; i++) {
    var p = S.players[i];
    var fc = el('fc' + i);
    fc.querySelector('.fc-name').textContent = p.name;
    fc.querySelector('.fc-score').textContent = p.score + '점';
    fc.querySelector('.fc-note').textContent =
      p.busted ? '✖ 100 넘음' : (r.winner === i ? '🏆 승리' : '');
    fc.classList.toggle('out', p.busted);
    fc.classList.toggle('win', r.winner === i && !p.busted);
  }

  var list = el('history');
  list.innerHTML = '';
  for (var k = 0; k < S.history.length; k++) {
    var h = S.history[k];
    var li = document.createElement('li');
    var txt = '<span class="h-mode">' +
      (h.mode === EXPLORE ? '탐구' : '확률') + '</span>' +
      h.names[0] + ' <b>' + h.scores[0] + '</b>' + (h.busted[0] ? '(넘음)' : '') +
      ' : ' + h.names[1] + ' <b>' + h.scores[1] + '</b>' + (h.busted[1] ? '(넘음)' : '');
    li.innerHTML = txt;
    list.appendChild(li);
  }
}

/* ---------------- 이벤트 연결 ---------------- */

function readNames() {
  var n1 = el('name1').value.trim() || '1번';
  var n2 = el('name2').value.trim() || '2번';
  if (n1 === n2) { n2 = n2 + '(2)'; }
  return [n1, n2];
}

function bind() {
  var modeBtns = document.querySelectorAll('.mode-btn');
  Array.prototype.forEach.call(modeBtns, function (btn) {
    btn.addEventListener('click', function () {
      S.mode = btn.getAttribute('data-mode');
      Array.prototype.forEach.call(modeBtns, function (b) {
        var on = (b === btn);
        b.classList.toggle('selected', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  });

  el('btn-start').addEventListener('click', function () {
    startGame(S.mode, readNames(), 0);
  });

  el('btn-ones').addEventListener('click', function () { place('ones'); });
  el('btn-tens').addEventListener('click', function () { place('tens'); });
  el('btn-hit').addEventListener('click', hit);
  el('btn-stand').addEventListener('click', stand);

  el('btn-remain').addEventListener('click', function () {
    S.showRemaining = !S.showRemaining;
    renderRemaining();
  });

  el('btn-quit').addEventListener('click', function () { goScreen('start'); });

  el('btn-again').addEventListener('click', function () {
    startGame(S.mode, S.names, 1 - S.first);   /* 선공 교대 */
  });

  el('btn-modes').addEventListener('click', function () { goScreen('start'); });
}

bind();

/* ---------------- 서비스 워커 등록 ---------------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 캐시 없이도 동작 */ });
  });
}
