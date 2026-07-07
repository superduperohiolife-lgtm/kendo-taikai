/* 剣道大会 試合管理 フロントエンド v0.1
 * GAS Web App API と通信。POSTは text/plain でプリフライト回避。
 */
'use strict';

// ---------------- 設定 ----------------
const CFG_KEY = 'kendo_cfg_v1';
let cfg = loadCfg();
function loadCfg() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
}
function saveCfg() { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

// ---------------- APIクライアント ----------------
async function apiGet(action, params) {
  requireCfg();
  const q = new URLSearchParams(Object.assign({ action, k: cfg.k }, params || {}));
  const res = await fetch(cfg.api + '?' + q.toString());
  const j = await res.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}
async function apiPost(action, body) {
  requireCfg();
  const payload = Object.assign({ action, k: cfg.k, ek: cfg.ek, by: cfg.by || '' }, body || {});
  const res = await fetch(cfg.api, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}
function requireCfg() {
  if (!cfg.api || !cfg.k) {
    switchTab('view-admin');
    throw new Error('先に「運営 > 接続設定」でURLとキーを設定してください');
  }
}

// ---------------- 共通UI ----------------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', !!isErr);
  t.classList.remove('hidden');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.add('hidden'), 3000);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- タブ ----------------
$$('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
function switchTab(id) {
  $$('.tabpane').forEach((p) => p.classList.toggle('active', p.id === id));
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  if (id === 'view-bracket') startPolling(); else stopPolling();
  if (id === 'view-input') refreshInput();
  if (id === 'view-admin') loadMetaIntoAdmin();
  if (id === 'view-players') loadTeams();
}
$$('.seg-btn').forEach((b) => b.addEventListener('click', () => {
  $$('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
  $('#bracketArea').classList.toggle('hidden', b.dataset.sub !== 'bracket');
  $('#matchListArea').classList.toggle('hidden', b.dataset.sub !== 'list');
}));

// ---------------- 部門選択・state ----------------
let meta = { tournaments: [], divisions: [] };
let state = null;            // 現在部門の state
let pollTimer = null;

async function loadMeta() {
  meta = await apiGet('meta');
  const sel = $('#divisionSelect');
  const cur = cfg.division_id;
  sel.innerHTML = '<option value="">部門を選択…</option>' + meta.divisions.map((d) => {
    const t = meta.tournaments.find((x) => x.tournament_id === d.tournament_id);
    return `<option value="${esc(d.division_id)}">${esc(t ? t.name + ' / ' : '')}${esc(d.name)}</option>`;
  }).join('');
  if (cur) sel.value = cur;
}
$('#divisionSelect').addEventListener('change', async (e) => {
  cfg.division_id = e.target.value; saveCfg();
  state = null;
  await refreshState();
  renderBracket(); renderMatchList(); refreshInput();
});

async function refreshState() {
  if (!cfg.division_id) return;
  try {
    state = await apiGet('state', { division_id: cfg.division_id });
    $('#pollStatus').textContent = '更新: ' + new Date().toLocaleTimeString('ja-JP');
  } catch (e) { toast(e.message, true); }
}

// ---------------- 閲覧: ブラケット描画 ----------------
function entryLabel(id) {
  if (!id) return '<span class="tbd">—</span>';
  if (id === 'BYE') return '<span class="bye">BYE</span>';
  const e = state.entries.find((x) => x.entry_id === id);
  return e ? `<span class="pname">${esc(e.name)}</span><span class="pteam">${esc(e.team)}</span>` : '?';
}
function ptsLabel(p) { return p ? p.split(',').join(' ') : ''; }

function renderBracket() {
  const area = $('#bracketArea');
  if (!state) { area.innerHTML = '<p class="meta">部門を選択してください</p>'; return; }
  const rounds = {};
  state.matches.forEach((m) => {
    if (m.code === '3RD') return;
    (rounds[m.round] = rounds[m.round] || []).push(m);
  });
  const roundNums = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  let html = '<div class="bracket">';
  roundNums.forEach((r) => {
    const label = state.division && String(state.division.placement) === 'true' || state.division.placement === true
      ? (r === 1 ? 'Placement' : r === 2 ? '本戦1回戦' : 'Round ' + r)
      : 'Round ' + r;
    html += `<div class="round"><div class="round-label">${esc(label)}</div>`;
    rounds[r].sort((a, b) => a.match_id > b.match_id ? 1 : -1).forEach((m) => {
      html += matchCard(m, false);
    });
    html += '</div>';
  });
  html += '</div>';
  const third = state.matches.find((m) => m.code === '3RD');
  if (third) html += '<h3>3位決定戦</h3>' + matchCard(third, false);
  area.innerHTML = html;
}

function matchCard(m, tappable) {
  const wr = m.winner === 'R', ww = m.winner === 'W';
  return `<div class="match ${tappable ? 'tappable' : ''}" data-mid="${esc(m.match_id)}">
    <div class="mcode">${esc(m.code)}${m.outcome === 'bye' ? ' <em>BYE</em>' : ''}${m.outcome === 'fusen' ? ' <em>不戦</em>' : ''}${m.outcome === 'encho' ? ' <em>延長</em>' : ''}</div>
    <div class="side-row red ${wr ? 'won' : ''}"><i></i>${entryLabel(m.red_entry_id)}<b class="pts">${esc(ptsLabel(m.red_points))}</b></div>
    <div class="side-row white ${ww ? 'won' : ''}"><i></i>${entryLabel(m.white_entry_id)}<b class="pts">${esc(ptsLabel(m.white_points))}</b></div>
  </div>`;
}

function renderMatchList() {
  const area = $('#matchListArea');
  if (!state) { area.innerHTML = ''; return; }
  let html = '<table class="mlist"><tr><th>試合</th><th>赤</th><th>得点</th><th>得点</th><th>白</th></tr>';
  state.matches.forEach((m) => {
    html += `<tr>
      <td>${esc(m.code)}</td>
      <td class="${m.winner === 'R' ? 'won' : ''}">${entryLabel(m.red_entry_id)}</td>
      <td class="red-lbl">${esc(ptsLabel(m.red_points))}</td>
      <td class="white-lbl">${esc(ptsLabel(m.white_points))}</td>
      <td class="${m.winner === 'W' ? 'won' : ''}">${entryLabel(m.white_entry_id)}</td>
    </tr>`;
  });
  area.innerHTML = html + '</table>';
}

function startPolling() {
  stopPolling();
  const tick = async () => { await refreshState(); renderBracket(); renderMatchList(); };
  tick();
  pollTimer = setInterval(tick, 8000);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

// ---------------- 結果入力 ----------------
async function refreshInput() {
  if (!cfg.division_id) { $('#readyMatches').innerHTML = '<p class="meta">部門を選択してください</p>'; return; }
  if (!state) await refreshState();
  if (!state) return;
  const ready = state.matches.filter((m) =>
    m.red_entry_id && m.white_entry_id && !m.winner &&
    m.red_entry_id !== 'BYE' && m.white_entry_id !== 'BYE');
  const done = state.matches.filter((m) => m.winner && m.outcome !== 'bye');
  $('#readyMatches').innerHTML = ready.length
    ? ready.map((m) => matchCard(m, true)).join('')
    : '<p class="meta">入力可能な試合はありません</p>';
  $('#doneMatches').innerHTML = done.map((m) =>
    `<div class="done-row">${matchCard(m, false)}
     <button class="undo" data-mid="${esc(m.match_id)}">取消</button></div>`).join('');
  $$('#readyMatches .match.tappable').forEach((el) =>
    el.addEventListener('click', () => openResultDialog(el.dataset.mid)));
  $$('#doneMatches .undo').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('この結果を取り消します。下流の確定も消えます。よろしいですか？')) return;
    try {
      await apiPost('undo_result', { division_id: cfg.division_id, match_id: b.dataset.mid });
      toast('取消しました');
      await refreshState(); refreshInput();
    } catch (e) { toast(e.message, true); }
  }));
}

// 入力ダイアログ
let dlg = { mid: null, winner: null, red: [], white: [] };
function openResultDialog(mid) {
  const m = state.matches.find((x) => x.match_id === mid);
  if (!m) return;
  dlg = { mid, winner: null, red: [], white: [] };
  $('#rdTitle').textContent = m.code + ' 結果入力';
  const rName = nameOf(m.red_entry_id), wName = nameOf(m.white_entry_id);
  $('#rdRedBtn').textContent = '赤 ' + rName;
  $('#rdWhiteBtn').textContent = '白 ' + wName;
  $('#rdOutcome').value = 'normal';
  renderChips();
  updateWinnerUI();
  $('#resultDialog').showModal();
}
function nameOf(eid) {
  const e = state.entries.find((x) => x.entry_id === eid);
  return e ? e.name : '?';
}
function renderChips() {
  ['red', 'white'].forEach((side) => {
    const box = $(side === 'red' ? '#rdRedPts' : '#rdWhitePts');
    box.innerHTML = ['M', 'K', 'D', 'T', 'H'].map((p) =>
      `<button type="button" class="chip ${dlg[side].includes(p) && dlg[side].indexOf(p) !== dlg[side].lastIndexOf(p) ? 'dbl' : ''} ${dlg[side].includes(p) ? 'on' : ''}" data-side="${side}" data-p="${p}">
        ${p}${countOf(dlg[side], p) === 2 ? '×2' : ''}</button>`).join('');
  });
  $$('.chip').forEach((c) => c.addEventListener('click', () => {
    const side = c.dataset.side, p = c.dataset.p;
    const arr = dlg[side];
    const total = arr.length;
    const cnt = countOf(arr, p);
    if (cnt === 0 && total < 2) arr.push(p);         // 0→1
    else if (cnt === 1 && total < 2) arr.push(p);    // 1→2（同記号2本: M,M等）
    else removeAll(arr, p);                          // →0
    renderChips();
  }));
}
function countOf(arr, p) { return arr.filter((x) => x === p).length; }
function removeAll(arr, p) { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] === p) arr.splice(i, 1); }

$('#rdRedBtn').addEventListener('click', () => { dlg.winner = 'R'; updateWinnerUI(); });
$('#rdWhiteBtn').addEventListener('click', () => { dlg.winner = 'W'; updateWinnerUI(); });
function updateWinnerUI() {
  $('#rdRedBtn').classList.toggle('sel', dlg.winner === 'R');
  $('#rdWhiteBtn').classList.toggle('sel', dlg.winner === 'W');
}
$('#rdCancel').addEventListener('click', () => $('#resultDialog').close());
$('#rdSave').addEventListener('click', async () => {
  if (!dlg.winner) { toast('勝者（赤/白）を選択してください', true); return; }
  const outcome = $('#rdOutcome').value;
  try {
    await apiPost('save_result', {
      division_id: cfg.division_id, match_id: dlg.mid,
      winner: dlg.winner,
      red_points: dlg.red.join(','), white_points: dlg.white.join(','),
      outcome
    });
    $('#resultDialog').close();
    toast('保存しました');
    await refreshState(); refreshInput();
  } catch (e) { toast(e.message, true); }
});

// ---------------- 選手登録 ----------------
async function loadTeams() {
  try {
    const players = await apiGet('players');
    const teams = [...new Set(players.map((p) => p.team).filter(Boolean))].sort();
    $('#teamList').innerHTML = teams.map((t) => `<option value="${esc(t)}">`).join('');
  } catch (e) { /* 設定前は無視 */ }
}
$('#btnSearchPlayers').addEventListener('click', async () => {
  try {
    const rows = await apiGet('players', { team: $('#teamFilter').value, q: $('#nameFilter').value });
    $('#playerList').innerHTML = rows.length
      ? '<table class="mlist"><tr><th>ID</th><th>選手名</th><th>団体</th></tr>' +
        rows.map((p) => `<tr><td>${esc(p.player_id)}</td><td>${esc(p.name)}</td><td>${esc(p.team)}</td></tr>`).join('') +
        '</table>'
      : '<p class="meta">該当なし</p>';
  } catch (e) { toast(e.message, true); }
});
$('#btnAddPlayer').addEventListener('click', async () => {
  const name = $('#newName').value.trim(), team = $('#newTeam').value.trim();
  if (!name) { toast('選手名を入力してください', true); return; }
  try {
    const r = await apiPost('register_player', { name, team });
    toast(r.duplicated ? '既に登録済み: ' + r.player_id : '追加しました: ' + r.player_id);
    $('#newName').value = '';
    loadTeams();
  } catch (e) { toast(e.message, true); }
});

// ---------------- 運営 ----------------
function fillCfgForm() {
  $('#cfgApi').value = cfg.api || '';
  $('#cfgViewKey').value = cfg.k || '';
  $('#cfgEditKey').value = cfg.ek || '';
  $('#cfgBy').value = cfg.by || '';
}
$('#btnSaveCfg').addEventListener('click', async () => {
  cfg.api = $('#cfgApi').value.trim();
  cfg.k = $('#cfgViewKey').value.trim();
  cfg.ek = $('#cfgEditKey').value.trim();
  cfg.by = $('#cfgBy').value.trim();
  saveCfg();
  try { await loadMeta(); toast('接続OK。設定を保存しました'); }
  catch (e) { toast('保存しましたが接続確認に失敗: ' + e.message, true); }
});

async function loadMetaIntoAdmin() {
  fillCfgForm();
  if (!cfg.api) return;
  try {
    await loadMeta();
    $('#tourSelect').innerHTML = meta.tournaments.map((t) =>
      `<option value="${esc(t.tournament_id)}">${esc(t.name)}</option>`).join('');
  } catch (e) { /* 未設定時は無視 */ }
}
$('#chkPlacement').addEventListener('change', (e) => {
  $('#placementOpts').classList.toggle('hidden', !e.target.checked);
  $('#elimOpts').classList.toggle('hidden', e.target.checked);
});
$('#btnCreateTour').addEventListener('click', async () => {
  try {
    const r = await apiPost('create_tournament', { name: $('#newTourName').value.trim(), date: $('#newTourDate').value });
    toast('大会を作成: ' + r.tournament_id);
    loadMetaIntoAdmin();
  } catch (e) { toast(e.message, true); }
});
$('#btnCreateDiv').addEventListener('click', async () => {
  const placement = $('#chkPlacement').checked;
  try {
    const r = await apiPost('create_division', {
      tournament_id: $('#tourSelect').value,
      name: $('#newDivName').value.trim(),
      placement,
      group_count: placement ? $('#groupCount').value : undefined,
      bracket_size: placement ? undefined : $('#bracketSize').value,
      third_place: placement ? false : $('#chkThird').checked
    });
    toast(`部門を作成: ${r.division_id}（枠数 ${r.slots}）`);
    cfg.division_id = r.division_id; saveCfg();
    await loadMeta();
    $('#divisionSelect').value = r.division_id;
  } catch (e) { toast(e.message, true); }
});

// 枠割当
let slotPlayers = [];
$('#btnLoadSlots').addEventListener('click', async () => {
  if (!cfg.division_id) { toast('上部で部門を選択してください', true); return; }
  try {
    await refreshState();
    slotPlayers = await apiGet('players');
    const slotSrc = state.matches.flatMap((m) =>
      [m.red_source, m.white_source].filter((s) => /^slot:\d+$/.test(String(s))));
    const maxSlot = Math.max(...slotSrc.map((s) => parseInt(s.split(':')[1], 10)));
    const bySlot = {};
    state.entries.forEach((e) => { bySlot[String(e.slot)] = e; });
    let html = '';
    for (let s = 1; s <= maxSlot; s++) {
      const cur = bySlot[String(s)];
      html += `<div class="slot-row">
        <span class="slot-no">${s}</span>
        <select class="slot-sel" data-slot="${s}">
          <option value="">（未定）</option>
          <option value="BYE" ${cur && cur.player_id === 'BYE' ? 'selected' : ''}>BYE</option>
          ${slotPlayers.map((p) => `<option value="${esc(p.player_id)}" ${cur && cur.player_id === p.player_id ? 'selected' : ''}>${esc(p.team)} ${esc(p.name)}</option>`).join('')}
        </select>
        <input class="slot-comp" data-slot="${s}" placeholder="ゼッケン" value="${esc(cur ? cur.comp_no : '')}">
      </div>`;
    }
    $('#slotArea').innerHTML = html;
    $('#btnSaveSlots').classList.remove('hidden');
  } catch (e) { toast(e.message, true); }
});
$('#btnSaveSlots').addEventListener('click', async () => {
  const assignments = $$('.slot-sel').map((sel) => ({
    slot: parseInt(sel.dataset.slot, 10),
    player_id: sel.value,
    comp_no: ($(`.slot-comp[data-slot="${sel.dataset.slot}"]`) || {}).value || ''
  })).filter((a) => a.player_id);
  try {
    await apiPost('assign_entries', { division_id: cfg.division_id, assignments });
    toast('割当を保存しました');
    await refreshState(); renderBracket();
  } catch (e) { toast(e.message, true); }
});

// ---------------- 起動 ----------------
(async function init() {
  fillCfgForm();
  if (cfg.api && cfg.k) {
    try {
      await loadMeta();
      if (cfg.division_id) { await refreshState(); renderBracket(); renderMatchList(); }
      startPolling();
    } catch (e) { toast(e.message, true); switchTab('view-admin'); }
  } else {
    switchTab('view-admin');
    toast('初回設定: GAS URLとキーを入力してください');
  }
})();
