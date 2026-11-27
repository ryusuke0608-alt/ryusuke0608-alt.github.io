/* WP9.1 bounded interaction layer. WP8 facts remain unchanged.
   Classification adapter (2026-11-10, 本人決定で変更): walk は、出発地点から
   入口（確認済みの場合）または施設の代表点までの直線距離を、一般的な徒歩速度
   80m/分で割った「目安」で判定する。段差・傾斜・道路形状は考慮しない。
   入口も代表点も無い施設は未確認のまま。 */
let mapInstance = null;
const facilityMarkers = new Map();
const markerBaseStyles = new Map();
let guideTargets = [];
/* spotId → {sec, idx}: 結果リスト内での位置。ピンを押したとき、対象カードが
   初期表示（各セクション8件）の外にある場合に、そのセクションを広げてから
   ハイライトするために使う（Codexレビュー 2026-11-27 指摘への対応）。 */
let cardIndex = new Map();
const wp8Render = render;
const wp8Detail = renderDetail;
const wp8Filter = renderFilter;

/* 検索結果画面UX（決定16・17、2026-11-09）: 下部シート・状態保持・2種類ピン。
   sheetOpen はシートの開閉、state.resultsView は詳細から戻ったときの
   地図位置・一覧スクロール位置の保持に使う。 */
let sheetOpen = false;
let intentMenuOpen = false;
let suppressSheetClick = false;
/* 出発地点ポップアップ（2026-11-20 本人指示）: ホームで出発地点が未設定のまま
   用途を選ぶと、先に出発地点を決めるダイアログを出す。pendingIntent は
   ダイアログ表示中の用途ID。出発地点が決まった時点で結果画面へ進む。 */
let pendingIntent = null;
function proceedPendingIntent() { if (!pendingIntent) return false; const p = pendingIntent; pendingIntent = null; chooseIntent(p); return true; }
function renderOriginPrompt() {
  if (!pendingIntent) return '';
  const i = INTENTS[pendingIntent];
  return `<div class="origin-prompt-overlay"><div class="origin-prompt" role="dialog" aria-modal="true" aria-labelledby="originPromptTitle"><h2 id="originPromptTitle">出発地点を設定してください</h2><p>「${esc(i.label)}」の場所は、出発地点から近い順に表示されます。先に出発地点を決めてください。</p>${state.originMessage ? `<p class="origin-message" role="status">${esc(state.originMessage)}</p>` : ''}<div class="origin-prompt-actions"><button class="primary" data-action="geolocate">現在地を使う</button><button class="secondary" data-action="manualOrigin">場所を選ぶ</button><button class="secondary" data-action="originPromptCancel">キャンセル</button></div><p class="muted">位置情報はこの画面の中だけで使います。</p></div></div>`;
}
cycleQuickCondition = function (key) { const mode = state.filters[key] || 'off'; if (mode === 'must' && !state.relaxed.has(key)) { state.relaxed.add(key); } else if (mode === 'must') { state.relaxed.delete(key); state.filters[key] = 'prefer'; if (key === 'price') state.priceMode = 'freePrefer'; } else if (mode === 'prefer') { state.filters[key] = 'off'; state.relaxed.delete(key); if (key === 'price') state.priceMode = 'includePaid'; } else { state.filters[key] = 'must'; if (key === 'price') state.priceMode = 'freeOnly'; } render(); };
const wpChooseIntent = chooseIntent;
chooseIntent = function (intent) { state.resultsView = null; sheetOpen = false; intentMenuOpen = false; wpChooseIntent(intent); };
function stripChips() {
  const quick = new Set(QUICK_CONDS[state.intent] || []);
  return Object.entries(state.filters).filter(([k, v]) => v !== 'off' && !quick.has(k)).map(([k, v]) => { const relaxed = state.relaxed.has(k); const cur = relaxed ? '未確認も含む' : v === 'must' ? '必須' : 'できれば'; const next = v === 'must' ? (relaxed ? 'できれば' : '未確認も含む') : '指定なし'; const label = `${CONDS[k].label}${k === 'walk' ? ` ${state.walkMinutes}分` : ''}`; return `<button class="chip ${relaxed ? 'relaxed' : ''}" data-action="chipCondition" data-key="${k}" aria-label="${esc(label)}：${cur}。タップで${next}に変更">${esc(label)} · ${cur}</button>`; }).join('');
}
let stripDownPos = null, stripDragMoved = false;
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('pointerdown', ev => { stripDownPos = (ev.target && ev.target.closest && ev.target.closest('.chips-strip')) ? { x: ev.clientX, y: ev.clientY } : null; }, { passive: true });
  document.addEventListener('pointerup', ev => { if (stripDownPos && (Math.abs(ev.clientX - stripDownPos.x) > 8 || Math.abs(ev.clientY - stripDownPos.y) > 8)) { stripDragMoved = true; if (typeof setTimeout === 'function') setTimeout(() => { stripDragMoved = false; }, 150); } stripDownPos = null; }, { passive: true });
  document.addEventListener('click', ev => { if (stripDragMoved && ev.target && ev.target.closest && ev.target.closest('.chips-strip')) { ev.stopPropagation(); ev.preventDefault(); stripDragMoved = false; } }, true);
}
function attachSheet() {
  const body = document.getElementById('sheetBody');
  if (body) {
    if (state.resultsView && state.resultsView.scroll) body.scrollTop = state.resultsView.scroll;
    /* 詳細から戻ったときの位置復元（2026-11-27 UI改善セット）: 写真の読み込み等で
       カードの高さが変わっても、開いたカードの相対位置を基準に補正して元へ戻す。 */
    const rv = state.resultsView;
    if (rv && rv.anchorId && typeof rv.anchorDelta === 'number') {
      let corrected = 0;
      const correct = () => {
        if (state.screen !== 'results') return;
        const b = document.getElementById('sheetBody'), c = document.getElementById(`card-${rv.anchorId}`);
        if (!b || !c || !c.getBoundingClientRect || !b.getBoundingClientRect) return;
        const d = c.getBoundingClientRect().top - b.getBoundingClientRect().top;
        if (Number.isFinite(d) && Number.isFinite(rv.anchorDelta)) { b.scrollTop += (d - rv.anchorDelta); corrected++; if (corrected >= 2) rv.anchorDelta = null; }
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(correct);
      if (typeof setTimeout === 'function') setTimeout(correct, 400);
    }
    body.addEventListener('scroll', () => { if (state.screen === 'results') { state.resultsView = state.resultsView || { intent: state.intent }; state.resultsView.scroll = body.scrollTop; } }, { passive: true });
  }
  if (typeof document.querySelector !== 'function') return;
  const handle = document.querySelector('.sheet-handle'), sheet = document.getElementById('resultSheet'), stage = document.querySelector('.results-stage');
  if (!handle || !sheet || !stage || !handle.addEventListener) return;
  let startY = null, startH = 0, moved = false;
  handle.addEventListener('pointerdown', ev => { startY = ev.clientY; startH = sheet.getBoundingClientRect().height; moved = false; if (handle.setPointerCapture) { try { handle.setPointerCapture(ev.pointerId); } catch (e) {} } });
  handle.addEventListener('pointermove', ev => {
    if (startY === null) return;
    const dy = startY - ev.clientY;
    if (Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    const max = stage.getBoundingClientRect().height * 0.92;
    sheet.classList.add('dragging');
    sheet.style.height = Math.max(76, Math.min(max, startH + dy)) + 'px';
  });
  const finish = () => {
    if (startY === null) return;
    startY = null;
    sheet.classList.remove('dragging');
    if (!moved) return;
    suppressSheetClick = true;
    setTimeout(() => { suppressSheetClick = false; }, 50);
    sheetOpen = sheet.getBoundingClientRect().height > stage.getBoundingClientRect().height * 0.55;
    sheet.style.height = '';
    sheet.classList.toggle('open', sheetOpen);
    handle.setAttribute('aria-expanded', String(sheetOpen));
    const label = handle.querySelector('.sheet-toggle'); if (label) label.textContent = sheetOpen ? '閉じる' : '一覧を広げる';
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}

let resultsResizePinned = false;
function pinResultsScroll() {
  window.scrollTo(0, 0);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { if (state.screen === 'results') window.scrollTo(0, 0); });
  if (typeof setTimeout === 'function') setTimeout(() => { if (state.screen === 'results') window.scrollTo(0, 0); }, 350);
  if (!resultsResizePinned && typeof window.addEventListener === 'function') { resultsResizePinned = true; window.addEventListener('resize', () => { if (state.screen === 'results') window.scrollTo(0, 0); }, { passive: true }); }
}
function entrance(spot) { return FACILITY_ENTRANCES[spot.facility] || null; }
function originLabel() { return state.origin ? state.origin.label : '出発地点未設定'; }
function haversine(a, b) {
  const rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/* 徒歩判定と距離表示の基点: 入口が確認済みなら入口、なければ施設の代表点。
   代表点は「施設の場所」であって入口ではないので、表示では言い分ける。
   道順の目的地には使わない（従来どおり入口座標か施設名検索）。 */
function walkPoint(spot) {
  const at = entrance(spot);
  if (at) return { at, entrance: true };
  if (typeof FACILITY_POINTS !== 'undefined' && FACILITY_POINTS[spot.facility]) return { at: FACILITY_POINTS[spot.facility], entrance: false };
  return null;
}
function walkEstimateMin(spot) {
  if (!state.origin) return null;
  const wp = walkPoint(spot);
  if (!wp) return null;
  return haversine(state.origin, wp.at) / 80;
}
const wpCondValue = condValue;
condValue = function (spot, key) {
  if (key !== 'walk') return wpCondValue(spot, key);
  const est = walkEstimateMin(spot);
  if (est === null) return 'unknown';
  return est <= state.walkMinutes ? 'yes' : 'no';
};
function distanceLabel(spot) {
  const wp = walkPoint(spot);
  if (!wp) return '施設入口位置：未確認';
  if (!state.origin) return '直線距離：出発地点未設定';
  const d = haversine(state.origin, wp.at);
  const body = `直線約${Math.round(d / 10) * 10}m（徒歩約${Math.max(1, Math.round(d / 80))}分の目安`;
  return wp.entrance ? `施設入口まで${body}）` : `施設の場所まで${body}・入口は未確認）`;
}
/* 「いま使える」判定（2026-11-27 UI改善セット）: 公式確認済みの営業時間が
   「9:00–17:00」のような単一の時間帯として読み取れる場合だけ、現在時刻と比べて
   営業中かどうかを返す。読み取れない・未確認の場合は null（バッジを付けない。
   付けないこと自体が「分からないことを断定しない」設計）。曜日別の閉館日などは
   単一時間帯の形をしていないため、この判定には入らない。 */
function openNow(spot, now) {
  const h = String(spot.hours ?? '').trim();
  if (h === '24時間' || h === '24時間営業') return true;
  const m = h.match(/^(\d{1,2}):(\d{2})\s*[–—\-〜~～]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  // 時刻としてあり得ない値（分が60以上、開始が24時台、終了が24:00超）は
  // 「読み取れない」として null を返す（Codexレビュー 2026-11-27 指摘）。
  if (Number(m[2]) > 59 || Number(m[4]) > 59) return null;
  if (Number(m[1]) > 23) return null;
  if (Number(m[3]) > 24 || (Number(m[3]) === 24 && Number(m[4]) !== 0)) return null;
  const open = Number(m[1]) * 60 + Number(m[2]);
  let close = Number(m[3]) * 60 + Number(m[4]);
  const t = (now || new Date());
  let cur = t.getHours() * 60 + t.getMinutes();
  if (close <= open) { close += 1440; if (cur < open) cur += 1440; }
  return cur >= open && cur < close;
}
function candidateView() {
  return SPOTS.filter(supportsIntent).map(s => ({s, e: evaluate(s)})).filter(x => x.e.kind !== 'D');
}
/* 並び順：必須の該当数が多い順 → 出発地点から近い順（2026-11-08 本人指示）。
   並び替えの距離はこの sortPoint のまま。表示用の距離は distanceLabel が担当し、
   入口が無い施設は代表点を「施設の場所まで」と明記して出す（2026-11-10）。 */
/* 施設写真（Wikimedia Commons の自由ライセンス画像のみ。無い施設・読み込み失敗時は表示しない） */
function facilityPhoto(spot) { return (typeof FACILITY_PHOTOS !== 'undefined' && FACILITY_PHOTOS[spot.facility]) || null; }
function photoUrl(p, width) { return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.file)}?width=${width}`; }
function photoCredit(p) { return [p.credit, p.license].filter(Boolean).join(' / ') + ' · Wikimedia Commons'; }
function cardPhotoHtml(spot) { const p = facilityPhoto(spot); if (!p) return ''; return `<div class="card-photo"><img src="${photoUrl(p, 300)}" alt="${esc(spot.facility)}の写真" loading="lazy" onerror="this.closest('.card-photo').style.display='none'"><span class="photo-credit">${esc(photoCredit(p))}</span></div>`; }
function detailPhotoHtml(spot) { const p = facilityPhoto(spot); if (!p) return ''; return `<figure class="spot-photo"><img src="${photoUrl(p, 1000)}" alt="${esc(spot.facility)}の写真" loading="lazy" onerror="this.closest('.spot-photo').style.display='none'"><figcaption>写真：${esc(photoCredit(p))}</figcaption></figure>`; }
/* スポット概要（2026-11-27 本人決定・敬語指定）: 確認済み（true / FREE 等）の事実からのみ
   表示時に組み立てる。文章は保存しないので、事実が更新されれば概要も自動で追随する。
   未確認・否定済みの項目には触れない（「ありません」とも書かない）。 */
function spotSummaryText(spot) {
  const f = spot.facts || {};
  const T = k => f[k] === true;
  const joinNouns = list => list.length <= 1 ? (list[0] || '') : list.slice(0, -1).join('・') + 'と' + list[list.length - 1];
  const floorStr = String(spot.floor ?? '');
  let floorPhrase = '', floorToken = '';
  const fm = floorStr.match(/^(\d+)F$/), bm = floorStr.match(/^B(\d+)F$/);
  if (fm) { floorPhrase = `の${fm[1]}階`; floorToken = fm[0]; }
  else if (bm) { floorPhrase = `の地下${bm[1]}階`; floorToken = bm[0]; }
  let name = String(spot.name ?? '');
  if (floorToken && name.startsWith(floorToken)) {
    const stripped = name.slice(floorToken.length).replace(/^[\s　]+/, '');
    if (stripped) name = stripped; else floorPhrase = '';
  }
  const facility = String(spot.facility ?? '');
  let s1;
  if (facility && name && name !== facility && !name.startsWith(facility)) s1 = `${facility}${floorPhrase}にある${name}です。`;
  else if (facility && name.startsWith(facility)) s1 = `${name}です。`;
  else if (facility) s1 = `${facility}${floorPhrase}にあるスポットです。`;
  else s1 = `${name}です。`;
  const priceSentence = preferFee => {
    const order = preferFee ? [f.fee_type, f.price] : [f.price, f.fee_type];
    for (const v of order) {
      if (v === 'FREE') return '利用は無料です。';
      if (v === 'PAID') return '利用は有料です。';
      if (v === 'PURCHASE_REQUIRED') return '利用には購入が必要です。';
      if (v === 'CONDITIONAL_FREE') return '条件付きで無料です。';
    }
    if (f.purchase_required === true) return '利用には購入が必要です。';
    return '';
  };
  const accessSentence = () => {
    if (T('elevator_present') && T('step_free')) return 'エレベーターがあり、段差のない経路で到達できます。';
    if (T('elevator_present')) return 'エレベーターがあります。';
    if (T('step_free')) return '段差のない経路で到達できます。';
    return '';
  };
  const body = [];
  let price = '';
  if (T('luggage_storage')) {
    const st = f.storage_type;
    body.push(st === 'LOCKER' ? 'コインロッカーが利用できます。'
      : st === 'STAFFED' ? '有人預かりが利用できます。'
      : st === 'BOTH' ? 'コインロッカーと有人預かりが利用できます。'
      : '荷物預かりが利用できます。');
    if (T('suitcase_ok')) body.push('スーツケースも預けられます。');
    if (T('ic_payment')) body.push('ICカードで支払いができます。');
    price = priceSentence(false);
  } else if (T('workspace')) {
    const usable = [];
    if (T('wifi_available')) usable.push('Wi-Fi');
    if (T('power_available')) usable.push('電源');
    if (usable.length) body.push(`${joinNouns(usable)}が利用できます。`);
    const canDo = [];
    if (T('calls_allowed')) canDo.push('通話やWeb会議');
    if (T('food_allowed')) canDo.push('飲食');
    if (canDo.length) body.push(`${canDo.join('、')}も可能です。`);
    if (!usable.length && !canDo.length) body.push('作業スペースが利用できます。');
    price = priceSentence(true);
  } else if (T('nursing_room') || T('diaper_table')) {
    const items = [];
    if (T('nursing_room')) items.push('授乳室');
    if (T('diaper_table')) items.push('おむつ替え台');
    if (T('accessible_toilet')) items.push('多目的トイレ');
    if (T('kids_space')) items.push('キッズスペース');
    body.push(`${joinNouns(items)}が利用できます。`);
    if (T('male_accessible')) body.push('男性も利用できます。');
    price = priceSentence(false);
  } else if (T('kids_space')) {
    body.push('キッズスペースが利用できます。');
    const extras = [];
    if (T('nursing_room')) extras.push('授乳室');
    if (T('diaper_table')) extras.push('おむつ替え台');
    if (extras.length) body.push(`${joinNouns(extras)}も利用できます。`);
    price = priceSentence(false);
  } else if (T('toilet')) {
    const base = T('accessible_toilet') ? '多目的トイレ' : 'トイレ';
    const extras = [];
    if (T('diaper_table')) extras.push('おむつ替え台');
    if (T('nursing_room')) extras.push('授乳室');
    if (T('kids_space')) extras.push('キッズスペース');
    body.push(extras.length ? `${base}と${joinNouns(extras)}が利用できます。` : `${base}が利用できます。`);
    if (T('male_accessible') && T('diaper_table')) body.push('男性も利用できます。');
    price = priceSentence(false);
  } else if (T('seating')) {
    if (T('eating_allowed') && T('outside_food_allowed')) body.push('座席があり、飲食や飲食物の持ち込みができます。');
    else if (T('eating_allowed')) body.push('座席があり、飲食ができます。');
    else if (T('outside_food_allowed')) body.push('座席があり、飲食物の持ち込みができます。');
    else body.push('座席があり、休憩に利用できます。');
    // 購入が必要（確認済み）のスポットでは「無料で座れます」を出さない（両立データが実在するため、強い利用条件を優先する）
    price = T('purchase_required') ? '利用には購入が必要です。' : T('free_seating') ? '無料で座れます。' : priceSentence(false);
  } else {
    price = priceSentence(false);
  }
  return [s1, ...body, accessSentence(), price].filter(Boolean).join('');
}
function detailSummaryHtml(spot) { const t = spotSummaryText(spot); return t ? `<p class="spot-summary">${esc(t)}</p>` : ''; }
function sortPoint(spot) {
  const at = entrance(spot);
  if (at) return at;
  if (typeof FACILITY_POINTS !== 'undefined' && FACILITY_POINTS[spot.facility]) return FACILITY_POINTS[spot.facility];
  if (typeof AREA_ANCHORS !== 'undefined' && AREA_ANCHORS[spot.area]) return AREA_ANCHORS[spot.area];
  return null;
}
function floorPenaltyM(spot) {
  // 階数差を並び替え専用の換算距離にする（1階との差 × 約4m）。同じ施設の中では下の階が上に来る。
  // 階が複数ある表記（「1F・3F」など）は地上に一番近い階で数える。未確認はペナルティなし。
  const floors = [];
  const re = /B(\d+)F|(\d+)F/g;
  let m;
  while ((m = re.exec(String(spot.floor || ''))) !== null) floors.push(m[1] ? -Number(m[1]) : Number(m[2]));
  if (!floors.length) return 0;
  return Math.min(...floors.map(f => Math.abs(f - 1))) * 4;
}
function sortDistance(spot) {
  if (!state.origin) return null;
  const p = sortPoint(spot);
  return p ? haversine(state.origin, p) + floorPenaltyM(spot) : null;
}
function mustYesCount(spot) {
  let n = 0;
  for (const [key, mode] of Object.entries(state.filters)) {
    if (mode === 'must' && condValue(spot, key) === 'yes') n++;
  }
  return n;
}
function preferYesCount(spot) {
  let n = 0;
  for (const [key, mode] of Object.entries(state.filters)) {
    if (mode === 'prefer' && condValue(spot, key) === 'yes') n++;
  }
  return n;
}
function sortCandidates(list) {
  // 2026-11-16 本人指示: 「できれば」に該当する候補を上位に表示する。ただし遠方の候補が近くの候補を
  // 追い越さないよう、一致1件あたり250m分の距離割引として並び替え専用の距離にだけ反映する（2026-11-08の並び順指示と両立させる）。
  const decorated = list.map(x => { const d = sortDistance(x.s); return {x, m: mustYesCount(x.s), d: d === null ? null : Math.max(0, d - 250 * preferYesCount(x.s))}; });
  decorated.sort((p, q) => (q.m - p.m) || ((p.d === null ? Infinity : p.d) - (q.d === null ? Infinity : q.d)));
  return decorated.map(y => y.x);
}
function loadHiddenIntents(){ try{ const v=JSON.parse(localStorage.getItem('yasumiru.hiddenIntents')||localStorage.getItem('cocomiru.hiddenIntents')||'[]'); return new Set(Array.isArray(v)?v.filter(x=>INTENTS[x]):[]); }catch(e){ return new Set(); } }
function saveHiddenIntents(){ try{ localStorage.setItem('yasumiru.hiddenIntents', JSON.stringify([...state.hiddenIntents])); }catch(e){} }
state.hiddenIntents = loadHiddenIntents();
function renderSettings(){
  const visibleCount = Object.keys(INTENTS).filter(id=>!state.hiddenIntents.has(id)).length;
  return `${renderHeader('表示する用途')}<section><p class="muted">ホームに表示する用途を選べます。設定はこの端末の中に保存されます。</p>${Object.entries(INTENTS).map(([id,i])=>{ const on=!state.hiddenIntents.has(id); const lastOne=on&&visibleCount===1; return `<div class="setting-row"><span>${i.icon} ${esc(i.label)}</span><button class="secondary" data-action="toggleIntent" data-id="${id}"${lastOne?' disabled':''}>${on?'表示中':'非表示'}</button></div>`; }).join('')}</section>`;
}
function renderHome() {
  return `${renderHeader('今、何したい？', false)}<section class="tagline"><p class="catch">"使えるかも"じゃなく、"使える"場所を。</p><p class="sub">載っているのは、行政データと施設の公式サイトで確認した情報だけ。休憩・食事・授乳・おむつ替え・トイレなど、色々な用途から探せます。</p><p class="scale">${new Set(SPOTS.map(s => s.area)).size}エリア・全${SPOTS.length}件のスポットを掲載しています。</p></section><section class="intro origin-card"><div class="origin-head"><span class="pin" aria-hidden="true">📍</span><div><h2>出発地点</h2><p class="origin-label">${esc(originLabel())}</p></div></div>${state.originMessage ? `<p class="origin-message" role="status">${esc(state.originMessage)}</p>` : ''}<div class="origin-actions"><button class="secondary main" data-action="geolocate">現在地を使う</button><button class="secondary" data-action="manualOrigin">場所を選ぶ</button></div><p class="muted">位置情報はこの画面の中だけで使います。</p></section><section class="intent-grid">${Object.entries(INTENTS).filter(([id]) => !state.hiddenIntents.has(id)).map(([id, i]) => `<button class="intent" data-action="intent" data-id="${id}"><span class="ic ic-${id}" aria-hidden="true">${i.icon}</span><strong>${i.label}</strong><small>${i.sub}</small></button>`).join('')}</section><div class="home-tools"><button class="secondary" data-action="settings">表示する用途を設定</button><a class="secondary" href="https://forms.gle/Zu81eGnTPPFAHziM7" target="_blank" rel="noopener">要望・誤情報の報告</a></div><details class="privacy"><summary>このサイトについて</summary><p>ヤスミルは、外出先で『今、使える場所』を探すためのサイトです。掲載している情報は、行政の公開データと施設の公式サイトで確認したものだけです。確認できていない情報は載せていません。そのぶん載っていない場所もありますが、『行ってみたら使えなかった』を減らすための方針です。位置情報は、お使いの端末の中だけで距離の計算に使い、外部へ送ることはありません。地図の表示にはOpenStreetMapを使っていて、地図画像の取得先には、表示している範囲が伝わります。「この場所は使えましたか？」への回答は、保存も送信もされません。表示する用途の設定は、この端末の中に保存されます。誤りにお気づきの点や、掲載のリクエストは、要望フォームから送れます。送られた内容は公開されず、運営だけが確認します。連絡先のメールアドレスを書いた場合は、内容の確認や連絡にだけ使い、対応が終わってから1年を目安に削除します。内容によっては、回答や情報の修正をお約束できない場合があります。</p><p><a href="./safety.html">安全性とデータの取り扱いについて</a></p></details>${renderOriginPrompt()}`;
}
function renderOrigin() {
  return `${renderHeader('出発地点を選ぶ')}<section><p class="muted">施設の入口を選ぶか、地図をタップして地点を決めてください。</p><div class="origin-actions">${MANUAL_PRESETS.map(p => `<button class="secondary" data-action="preset" data-key="${esc(p.facility)}">${esc(p.label)}</button>`).join('')}</div>${state.originMessage ? `<p class="origin-message" role="status">${esc(state.originMessage)}</p>` : ''}</section><div id="map" class="map origin-map" aria-label="出発地点を選ぶ地図"></div><p class="map-attribution-note">地図：© OpenStreetMap contributors</p>`;
}
function card(spot, result) {
  const key = state.intent;
  const important = key === 'rest' ? ['price','indoor','purchaseNo','seating'] : key === 'eat' ? ['seating','eating','outsideFood','price','indoor'] : key === 'diaper' ? ['diaper','male'] : key === 'kids' ? ['kids','price','indoor','age'] : key === 'nursing' ? ['nursing'] : key === 'work' ? ['wifi','power','calls','fee'] : key === 'storage' ? ['suitcase','icpay'] : ['toilet'];
  const badge = result.kind === 'A' ? '条件に一致' : result.kind === 'B' ? '一部条件を確認できません' : '条件を広げると候補';
  const unresolved = result.missing?.length ? condText(result.missing[0].key, result.missing[0].v) + (result.missing.length > 1 ? ' ほか' : '') : '';
  return `<article id="card-${esc(spot.id)}" data-spot-id="${esc(spot.id)}" class="card state-${result.kind}"><div class="card-row"><div class="card-text"><div class="badge">${badge}</div>${openNow(spot) === true ? '<span class="open-now">● いま使える</span>' : ''}<span class="official-mark">✓ 公式情報のみ</span><h3>${esc(spot.name)}</h3><p class="facility">${esc(spot.facility)}</p>${unresolved ? `<p class="alert">${esc(unresolved)}</p>` : ''}<div class="facts">${important.map(k => `<span class="fact ${condValue(spot,k)}">${esc(condText(k,condValue(spot,k)))}</span>`).join('')}</div><p class="meta"><span class="dist">${esc(distanceLabel(spot))}</span>${spot.floor ? `<span class="floor">${esc(String(spot.floor))}</span>` : ''}</p></div>${cardPhotoHtml(spot)}</div><div class="card-actions"><button class="primary" data-action="detail" data-id="${esc(spot.id)}">詳しく見る</button>${(entrance(spot) || (typeof FACILITY_POINTS !== 'undefined' && FACILITY_POINTS[spot.facility])) ? `<button class="secondary" data-action="focusMap" data-id="${esc(spot.id)}">地図で見る</button>` : ''}</div></article>`;
}
function quickStrip() {
  const keys = QUICK_CONDS[state.intent] || [];
  return keys.map(k => { const mode = state.filters[k] || 'off'; const relaxed = mode === 'must' && state.relaxed.has(k); const cur = relaxed ? '未確認も含む' : mode === 'must' ? '必須' : mode === 'prefer' ? 'できれば' : '指定なし'; const next = relaxed ? 'できれば' : mode === 'must' ? '未確認も含む' : mode === 'prefer' ? '指定なし' : '必須'; const label = CONDS[k].label + (k === 'walk' ? ` ${state.walkMinutes}分` : ''); return `<button class="quick-button mode-${mode}${relaxed ? ' relaxed' : ''}" data-action="quickCondition" data-key="${k}" aria-label="${esc(label)}：${cur}。タップで${next}に変更"><strong>${esc(label)}</strong><span>${cur}</span></button>`; }).join('');
}
const SECTION_CAP = 100;
/* 初期表示は各セクション上位8件（2026-11-27 本人採用）。残りは「もっと見る」で
   SECTION_CAP 件ずつ広げる。 */
const INITIAL_CAP = 8;
function sectionCaps() {
  const sig = JSON.stringify([state.intent, state.filters, state.walkMinutes, [...state.relaxed].sort(), state.origin ? [state.origin.lat.toFixed(5), state.origin.lon.toFixed(5)] : null]);
  if (state._capSig !== sig) { state._capSig = sig; state._caps = { a: INITIAL_CAP, b: INITIAL_CAP, c: INITIAL_CAP }; }
  return state._caps;
}
function sectionHtml(list, capKey, heading) {
  if (!list.length) return '';
  const caps = sectionCaps(), cap = caps[capKey];
  let h = `<section><h2>${heading}</h2>${list.slice(0, cap).map(x => card(x.s, x.e)).join('')}`;
  if (list.length > cap) h += `<div class="options"><button class="option" data-action="showMore" data-section="${capKey}">もっと見る（あと${list.length - cap}件）→</button></div>`;
  return h + '</section>';
}
/* 徒歩分数を広げたときに「条件に一致」が何件増えるか（2026-11-27 UI改善セット）。
   判定は state.walkMinutes を一時的に差し替えて数え直し、すぐ元に戻す。 */
function widenInfo(aCount) {
  if (state.filters.walk === 'off' || state.walkMinutes >= 15) return null;
  const next = state.walkMinutes === 5 ? 10 : 15;
  const cur = state.walkMinutes;
  state.walkMinutes = next;
  let n = 0;
  try { n = candidateView().filter(x => x.e.kind === 'A').length; } finally { state.walkMinutes = cur; }
  return n > aCount ? { next, add: n - aCount } : null;
}
function renderResults() {
  const i = INTENTS[state.intent], evaluated = candidateView();
  const a = sortCandidates(evaluated.filter(x => x.e.kind === 'A')), b = sortCandidates(evaluated.filter(x => x.e.kind === 'B')), c = sortCandidates(evaluated.filter(x => x.e.kind === 'C')), noTrusted = !a.length;
  cardIndex = new Map();
  a.forEach((x, idx) => cardIndex.set(x.s.id, { sec: 'a', idx }));
  b.forEach((x, idx) => cardIndex.set(x.s.id, { sec: 'b', idx }));
  c.forEach((x, idx) => cardIndex.set(x.s.id, { sec: 'c', idx }));
  const total = a.length + b.length + c.length;
  const scopeLabel = state.filters.walk === 'off' ? '全エリア' : state.filters.walk === 'prefer' ? `全エリア（徒歩${state.walkMinutes}分を目安）` : `徒歩${state.walkMinutes}分圏内`;
  const intentItems = Object.entries(INTENTS).filter(([id]) => !state.hiddenIntents.has(id)).map(([id, it]) => `<button class="intent-chip${id === state.intent ? ' active' : ''}" data-action="intent" data-id="${id}" aria-pressed="${id === state.intent}">${it.icon} ${esc(it.label)}</button>`).join('');
  let html = `<header class="top results-top"><button class="icon-btn" data-action="back" aria-label="戻る">←</button><div class="top-controls"><button class="intent-select" data-action="intentMenu" aria-expanded="${intentMenuOpen}" aria-haspopup="true" aria-label="目的を切り替える（現在：${esc(i.label)}）">${i.icon} ${esc(i.label)}<span class="caret" aria-hidden="true">▾</span></button><button class="top-btn" data-action="manualOrigin">地点</button><button class="top-btn" data-action="filter">条件</button></div><div class="intent-menu" id="intentMenu"${intentMenuOpen ? '' : ' hidden'} role="group" aria-label="目的を選ぶ">${intentItems}</div></header><div class="results-stage"><div id="map" class="map results-map" aria-label="周辺Spotの地図"></div><div class="offscreen-guides" id="offscreenGuides"></div><div class="options-bar"><div class="chips-strip">${quickStrip()}${stripChips()}</div></div>${state.origin ? `<button class="locate-btn" data-action="recenter" aria-label="出発地点に戻る" title="出発地点に戻る">◎</button>` : ''}`;
  const wi = a.length <= 3 ? widenInfo(a.length) : null;
  const walkStepper = `<div class="walk-stepper" role="group" aria-label="徒歩の分数を変える"><span class="walk-stepper-label">徒歩</span>${[5, 10, 15].map(n => `<button class="walk-step${n === state.walkMinutes ? ' active' : ''}" data-action="walkSet" data-minutes="${n}" aria-pressed="${n === state.walkMinutes}">${n}分</button>`).join('')}</div>`;
  html += `<div class="sheet${sheetOpen ? ' open' : ''}" id="resultSheet"><button class="sheet-handle" data-action="toggleSheet" aria-expanded="${sheetOpen}"><span class="grip" aria-hidden="true"></span><span class="sheet-count">${i.icon} ${esc(i.label)}：${a.length}件（条件に一致・${scopeLabel}）／未確認の候補 ${b.length + c.length}件</span><span class="sheet-toggle">${sheetOpen ? '閉じる' : '一覧を広げる'}</span></button><div class="sheet-body" id="sheetBody"><div class="result-head"><div><small>出発：${esc(originLabel())}</small><small class="count-note">「必須」の条件が確認できた場所は「条件に一致」に、確認できていない場所は下の候補に出ます。</small></div>${walkStepper}</div>${wi ? `<div class="options widen-hint"><button class="option" data-action="walkSet" data-minutes="${wi.next}">徒歩${wi.next}分に広げると、条件に一致があと${wi.add}件あります →</button></div>` : ''}`;
  if (!total) html += `<section class="zero"><h2>条件に合う場所が見つかりませんでした。</h2><p>条件を緩めるか、リセットして探し直してください。</p>${relaxOptions()}<div class="options"><button class="option" data-action="resetFilters">条件をリセットする →</button></div></section>`;
  else {
    if (noTrusted) html += `<section class="zero"><h2>すべての条件を確認できる場所は見つかりませんでした。</h2><p>未確認の候補は別に表示します。条件を広げる場合は、変更内容を選んでください。</p>${relaxOptions()}</section>`;
    html += sectionHtml(a, 'a', '条件に一致');
    html += sectionHtml(b, 'b', '一部条件を確認できない候補');
    html += sectionHtml(c, 'c', '条件を広げると候補');
    if (!noTrusted) html += `<section class="relax-block"><h2>条件を広げる</h2>${relaxOptions()}</section>`;
  }
  return html + '</div></div></div>';
}
function relaxOptions() {
  const options = [];
  for (const [key, mode] of Object.entries(state.filters)) {
    if (mode !== 'must' || state.relaxed.has(key)) continue;
    if (SPOTS.filter(supportsIntent).some(s => ['unknown','conditional'].includes(condValue(s,key)))) options.push(`<button class="option" data-action="relax" data-key="${key}">「${esc(CONDS[key].label)}：未確認」も含める →</button>`);
  }
  if (state.filters.indoor === 'must') options.push('<button class="option" data-action="downgrade" data-key="indoor">屋外も含める（屋内を「できれば」に変更） →</button>');
  if (state.walkMinutes < 15 && state.filters.walk !== 'off') options.push('<button class="option" data-action="walk15">表示条件を徒歩15分へ変更 →</button>');
  if (state.priceMode === 'freeOnly' && state.filters.price === 'must') options.push('<button class="option" data-action="pricePref">無料を「できれば」に変更する →</button>');
  return options.length ? `<div class="options">${options.join('')}</div>` : '<p class="muted">追加で広げられる条件はありません。</p>';
}
renderFilter = function () {
  return wp8Filter();
};
renderDetail = function () {
  const spot = SPOTS.find(s => s.id === state.spotId);
  if (!spot) return renderResults();
  let html = wp8Detail();
  html = html.replace(`<p>${esc(spot.walk.label)}（施設入口まで。館内移動は含みません）</p>`, `<p>${esc(distanceLabel(spot))}</p>`);
  if (!entrance(spot) && walkPoint(spot)) {
    const dp = `<p>${esc(distanceLabel(spot))}</p>`;
    if (html.includes(dp)) html = html.replace(dp, dp + '<p class="muted">入口は未確認：入口の正確な位置は公式情報で確認できていないため、距離は施設の場所までの目安です。</p>');
  }
  const titleEnd = `<p>${esc(spot.facility)}</p></div>`;
  if (html.includes(titleEnd)) html = html.replace(titleEnd, titleEnd + detailSummaryHtml(spot) + detailPhotoHtml(spot));
  return html;
};
/* ピンの選択状態（2026-11-27 UI改善セット）: 選択中は輪郭だけでなく
   大きさと不透明度も変える（reading-notes の作法）。色分けは維持する。 */
function selectFacilityMarker(facility) {
  for (const [f, m] of facilityMarkers) {
    if (!m.setStyle) continue;
    const base = markerBaseStyles.get(f);
    if (!base) continue;
    if (f === facility) { m.setStyle({ radius: base.radius + 6, weight: base.weight + 2, fillOpacity: 1 }); if (m.bringToFront) m.bringToFront(); }
    else m.setStyle({ radius: base.radius, weight: base.weight, fillOpacity: base.fillOpacity });
  }
}
function highlightCard(id, scroll) {
  state.selectedSpotId = id;
  const cardEl = document.getElementById(`card-${id}`);
  if (!cardEl) return;
  document.querySelectorAll('.selected-card').forEach(el => el.classList.remove('selected-card'));
  cardEl.classList.add('selected-card');
  cardEl.classList.remove('pulse'); void cardEl.offsetWidth; cardEl.classList.add('pulse');
  if (scroll) cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
/* 画面外ガイド（2026-11-27 本人提案・仕様確定）: 初期表示の上位8件（条件に一致）のうち
   地図の表示範囲の外にある施設について、画面端に矢印＋「あと○m」を出す。
   タップでそのスポットへ地図が移動する。対象は8件の施設だけ（全部のピンには出さない）。 */
function guideDistanceLabel(d) { return d < 1000 ? `あと約${Math.max(10, Math.round(d / 10) * 10)}m` : `あと約${(d / 1000).toFixed(1)}km`; }
function updateOffscreenGuides() {
  if (!mapInstance || typeof mapInstance.latLngToContainerPoint !== 'function' || typeof mapInstance.getSize !== 'function') return;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function' || typeof document.getElementById !== 'function') return;
  const box = document.getElementById('offscreenGuides');
  const mapNode = document.getElementById('map');
  if (!box || !mapNode || !mapNode.getBoundingClientRect) return;
  box.innerHTML = '';
  if (!guideTargets.length) return;
  const size = mapInstance.getSize();
  const center = mapInstance.getCenter();
  const mr = mapNode.getBoundingClientRect(), br = box.getBoundingClientRect();
  const offX = (mr.left || 0) - (br.left || 0), offY = (mr.top || 0) - (br.top || 0);
  let yMax = size.y - 42;
  const sheet = document.getElementById('resultSheet');
  if (sheet && sheet.getBoundingClientRect) { const stop = (sheet.getBoundingClientRect().top || 0) - (mr.top || 0); if (stop > 80 && stop < yMax) yMax = stop - 34; }
  const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  // Pills are wide (~150px), so clamp the center far enough in that the whole
  // pill stays inside the map, keep clear of the chips row at the top, and
  // de-collide pills that would land on top of each other (same direction,
  // similar distance happens with neighbouring facilities).
  const MX = 80, MY = 76, placed = [];
  for (const g of guideTargets) {
    const pt = mapInstance.latLngToContainerPoint([g.at.lat, g.at.lon]);
    if (pt.x >= 0 && pt.x <= size.x && pt.y >= 0 && pt.y <= size.y) continue;
    let cx = size.x > 2 * MX ? Math.max(MX, Math.min(size.x - MX, pt.x)) : size.x / 2;
    let cy = Math.max(MY, Math.min(yMax, pt.y));
    for (let tries = 0; tries < 8; tries++) {
      if (!placed.some(p => Math.abs(p.x - cx) < 140 && Math.abs(p.y - cy) < 40)) break;
      cy += 42;
      if (cy > yMax) { cy = Math.max(MY, Math.min(yMax, pt.y)); cx = Math.min(size.x - MX, cx + 148); }
    }
    placed.push({ x: cx, y: cy });
    const ang = Math.atan2(pt.y - size.y / 2, pt.x - size.x / 2);
    const arrow = ARROWS[Math.round(ang / (Math.PI / 4)) & 7];
    const dist = guideDistanceLabel(haversine({ lat: center.lat, lon: center.lng }, g.at));
    const btn = document.createElement('button');
    btn.className = 'offscreen-guide';
    btn.style.left = (offX + cx) + 'px';
    btn.style.top = (offY + cy) + 'px';
    btn.setAttribute('aria-label', `${g.facility}は画面の外、${dist}の方向にあります`);
    btn.innerHTML = `<span class="guide-arrow" aria-hidden="true">${arrow}</span><span class="guide-dist">${dist}</span>`;
    btn.addEventListener('click', () => { if (mapInstance) { mapInstance.panTo([g.at.lat, g.at.lon]); selectFacilityMarker(g.facility); const mk = facilityMarkers.get(g.facility); if (mk && mk.openPopup) mk.openPopup(); } });
    box.appendChild(btn);
  }
}
function renderRoute() {
  const spot = SPOTS.find(s => s.id === state.spotId), at = entrance(spot);
  const url = at ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(at.lat + ',' + at.lon)}&travelmode=walking` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(spot.facility + ' ' + spot.location)}&travelmode=walking`;
  return `${renderHeader('ここへ行く')}<section><h2>${esc(spot.name)}</h2><p>${esc(spot.facility)}／${esc(spot.location)}</p><p>${esc(distanceLabel(spot))}</p><p class="muted">目的地は施設の入口です。</p><a class="primary route-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">外部地図で道順を見る ↗</a><button class="secondary route-confirm" data-action="usageConfirm">利用確認へ</button></section>`;
}
function initMap() {
  const node = document.getElementById('map');
  if (!node) return;
  if (!window.L) { node.textContent = '地図を読み込めません。Spot一覧は利用できます。'; return; }
  const TOKYO_CENTER=[35.6812,139.7671];
  const L = window.L;
  let center = state.origin ? [state.origin.lat,state.origin.lon] : TOKYO_CENTER, zoom = state.origin?15:10;
  if (state.screen === 'origin' && !state.origin) {
    const firstPreset = (typeof MANUAL_PRESETS !== 'undefined' && MANUAL_PRESETS[0]) ? FACILITY_ENTRANCES[MANUAL_PRESETS[0].facility] : null;
    if (firstPreset) { center = [firstPreset.lat, firstPreset.lon]; zoom = 14; }
  }
  mapInstance = L.map(node,{zoomControl:true,scrollWheelZoom:false}).setView(center,zoom);
  if (state.screen === 'results') {
    const saved = state.resultsView;
    if (saved && saved.intent === state.intent && saved.center) mapInstance.setView([saved.center.lat, saved.center.lng], saved.zoom);
    mapInstance.on('moveend', () => { if (state.screen === 'results' && mapInstance) state.resultsView = Object.assign(state.resultsView || {}, { intent: state.intent, center: mapInstance.getCenter(), zoom: mapInstance.getZoom() }); });
  }
  L.tileLayer(MAP_CONFIG.tileUrl,{maxZoom:18,attribution:MAP_CONFIG.attribution,updateWhenIdle:true}).addTo(mapInstance);
  if (state.origin) L.circleMarker([state.origin.lat,state.origin.lon],{radius:7,color:'#1a4a90',fillColor:'#4c85d0',fillOpacity:1}).addTo(mapInstance).bindPopup('出発地点');
  if (state.screen === 'origin') {
    mapInstance.on('click', ev => { const c=ev.latlng; state.origin={kind:'map_tap',lat:c.lat,lon:c.lng,label:'地図で選んだ地点',selectedAt:new Date().toISOString()}; state.originMessage='地図上の地点を出発地点に設定しました。'; if (!proceedPendingIntent()) back(); });
    return;
  }
  const grouped = new Map();
  for (const x of candidateView()) { if (!grouped.has(x.s.facility)) grouped.set(x.s.facility,[]); grouped.get(x.s.facility).push(x); }
  for (const [facility,items] of grouped) {
    const ent=FACILITY_ENTRANCES[facility], at=ent||FACILITY_POINTS[facility];
    if (!at) continue;
    const color=items.some(x=>x.e.kind==='A')?'#1f6d58':items.some(x=>x.e.kind==='B')?'#a76617':'#546ba1';
    const spotsHtml=items.map(x=>`<button class="map-spot" data-action="detail" data-id="${esc(x.s.id)}">${esc(x.s.name)} · ${x.e.kind==='A'?'条件に一致':x.e.kind==='B'?'一部未確認':'条件を広げると候補'}（タップで詳細）</button>`).join('');
    const marker=ent
      ? L.circleMarker([at.lat,at.lon],{radius:16,color,fillColor:color,fillOpacity:.88,weight:3}).addTo(mapInstance)
      : L.circleMarker([at.lat,at.lon],{radius:12,color,fillColor:color,fillOpacity:.55,weight:2.5}).addTo(mapInstance);
    marker.bindPopup(ent
      ? `<strong>${esc(facility)} 入口</strong><br>${spotsHtml}`
      : `<strong>${esc(facility)}</strong><br><span class="pin-note">施設の場所（入口は未確認）</span><br><span class="pin-note">入口の正確な位置は公式情報で確認できていません</span><br>${spotsHtml}`);
    facilityMarkers.set(facility,marker);
    markerBaseStyles.set(facility, ent ? { radius: 16, weight: 3, fillOpacity: .88 } : { radius: 12, weight: 2.5, fillOpacity: .55 });
    if (marker.on) marker.on('click', () => {
      selectFacilityMarker(facility);
      const first = items.map(x => x.s.id).find(id => document.getElementById(`card-${id}`));
      if (first) { highlightCard(first, true); return; }
      /* 対象カードが初期表示の外にある場合は、そのセクションを対象の位置まで
         広げて再描画してからハイライトする。再描画は Leaflet のイベント処理が
         終わってから行う（処理中の地図破棄を避ける）。 */
      const secRank = { a: 0, b: 1, c: 2 };
      const target = items.map(x => cardIndex.get(x.s.id)).filter(Boolean)
        .sort((p, q) => (secRank[p.sec] - secRank[q.sec]) || (p.idx - q.idx))[0];
      if (!target) return;
      setTimeout(() => {
        const caps = sectionCaps();
        if (caps[target.sec] <= target.idx) caps[target.sec] = target.idx + 1;
        render();
        selectFacilityMarker(facility);
        const shown = items.map(x => x.s.id).find(id => document.getElementById(`card-${id}`));
        if (shown) highlightCard(shown, true);
      }, 0);
    });
  }
  guideTargets = [];
  const seenFac = new Set();
  for (const x of sortCandidates(candidateView().filter(x => x.e.kind === 'A')).slice(0, INITIAL_CAP)) {
    if (seenFac.has(x.s.facility)) continue;
    seenFac.add(x.s.facility);
    const at = entrance(x.s) || (typeof FACILITY_POINTS !== 'undefined' ? FACILITY_POINTS[x.s.facility] : null);
    if (at) guideTargets.push({ facility: x.s.facility, at });
  }
  updateOffscreenGuides();
  mapInstance.on('move', updateOffscreenGuides);
}
function announceScreen() {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const el = document.getElementById('sr-announcer');
  if (!el || typeof app.querySelector !== 'function') return;
  const sc = app.querySelector('.sheet-count'), h = app.querySelector('h1');
  const text = sc ? sc.textContent : h ? h.textContent : '';
  if (text) { el.textContent = ''; el.textContent = text; }
}
function focusOriginPrompt() {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
  const btn = document.querySelector('.origin-prompt [data-action="geolocate"]');
  if (btn && typeof btn.focus === 'function') btn.focus();
}
function showToast(message) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function' || !document.body) return;
  let t = document.getElementById('yasumiru-toast');
  if (!t) { t = document.createElement('div'); t.id = 'yasumiru-toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = message;
  if (showToast._timer) clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 1800);
}
render = function () {
  if (mapInstance) { mapInstance.remove(); mapInstance=null; facilityMarkers.clear(); markerBaseStyles.clear(); guideTargets = []; }
  if (state.screen === 'settings') { app.innerHTML=renderSettings(); window.scrollTo(0,0); }
  else if (state.screen === 'origin' || state.screen === 'route') { app.innerHTML=state.screen==='origin'?renderOrigin():renderRoute(); window.scrollTo(0,0); }
  else wp8Render();
  if (state.screen === 'origin' || state.screen === 'results') initMap();
  if (state.screen === 'results') { attachSheet(); pinResultsScroll(); }
  announceScreen();
  if (pendingIntent) focusOriginPrompt();
};
function useGeolocation() {
  state.originMessage='現在地を取得しています…'; render();
  if (!navigator.geolocation) { state.originMessage='このブラウザでは現在地を取得できません。場所を選んでください。'; enter('origin'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude,longitude,accuracy}=pos.coords;
    if (!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||accuracy>200) { state.originMessage='現在地の精度が低いため、場所を選んでください。'; enter('origin'); return; }
    state.origin={kind:'gps',lat:latitude,lon:longitude,accuracyM:accuracy,label:`現在地（精度約${Math.round(accuracy)}m）`,selectedAt:new Date().toISOString()};
    state.originMessage='現在地を出発地点に設定しました。'; if (!proceedPendingIntent()) render();
  }, () => { state.originMessage='現在地を取得できませんでした。場所を選んでください。'; enter('origin'); }, {enableHighAccuracy:false,timeout:8000,maximumAge:0});
}
app.addEventListener('click', ev => {
  const sbtn = ev.target.closest('[data-action="settings"],[data-action="toggleIntent"]');
  if (sbtn) { const sa=sbtn.dataset.action; if (sa==='settings') return enter('settings'); if (sa==='toggleIntent') { const id=sbtn.dataset.id; if (state.hiddenIntents.has(id)) state.hiddenIntents.delete(id); else { if (Object.keys(INTENTS).filter(x=>!state.hiddenIntents.has(x)).length<=1) return; state.hiddenIntents.add(id); } saveHiddenIntents(); return render(); } }
  const btn=ev.target.closest('[data-action]'); if (!btn) return;
  const {action:a,id,key}=btn.dataset;
  if (a==='intent' && state.screen==='home' && !state.origin) { ev.stopImmediatePropagation(); pendingIntent = id; state.originMessage=''; render(); return; }
  if (a==='originPromptCancel') { ev.stopImmediatePropagation(); const backTo = pendingIntent; pendingIntent = null; render(); if (backTo && typeof document !== 'undefined' && typeof document.querySelector === 'function') { const b = document.querySelector(`button.intent[data-id="${backTo}"]`); if (b && typeof b.focus === 'function') b.focus(); } return; }
  if (a==='detail' && state.screen==='results') { const b=document.getElementById('sheetBody'); if (b && typeof b.scrollTop==='number') { const c=document.getElementById(`card-${id}`); let delta=null; if (c && c.getBoundingClientRect && b.getBoundingClientRect) { const d=c.getBoundingClientRect().top - b.getBoundingClientRect().top; if (Number.isFinite(d)) delta=d; } state.resultsView = Object.assign(state.resultsView || {}, { intent: state.intent, scroll: b.scrollTop, anchorId: id, anchorDelta: delta }); } return; }
  if (!['geolocate','manualOrigin','preset','selectCard','focusMap','goUse','usageConfirm','toggleSheet','resetFilters','intentMenu','recenter','showMore','walkSet'].includes(a)) return;
  ev.stopImmediatePropagation();
  if (a==='walkSet') { const n = Number(btn.dataset.minutes); if ([5, 10, 15].includes(n)) state.walkMinutes = n; return render(); }
  if (a==='showMore') { const caps = sectionCaps(); const sec = btn.dataset.section; if (caps[sec]) caps[sec] += SECTION_CAP; return render(); }
  if (a==='intentMenu') { intentMenuOpen = !intentMenuOpen; const menu = document.getElementById('intentMenu'); if (menu) { menu.hidden = !intentMenuOpen; btn.setAttribute('aria-expanded', String(intentMenuOpen)); } return; }
  if (a==='toggleSheet') { if (suppressSheetClick) return; sheetOpen=!sheetOpen; const sheet=document.getElementById('resultSheet'); if (sheet) { sheet.classList.toggle('open',sheetOpen); btn.setAttribute('aria-expanded',String(sheetOpen)); const label=btn.querySelector('.sheet-toggle'); if (label) label.textContent=sheetOpen?'閉じる':'一覧を広げる'; } return; }
  if (a==='resetFilters') { state.filters=Object.fromEntries(Object.keys(CONDS).map(k=>[k,'off'])); state.priceMode='includePaid'; state.relaxed=new Set(); return render(); }
  if (a==='recenter') { if (mapInstance && state.origin) { mapInstance.setView([state.origin.lat, state.origin.lon], Math.max(mapInstance.getZoom(), 15)); showToast('出発地点に戻りました'); } return; }
  if (a==='geolocate') return useGeolocation();
  if (a==='manualOrigin') return enter('origin');
  if (a==='preset') { const at=FACILITY_ENTRANCES[key]; if (!at) return; state.origin={kind:'preset',lat:at.lat,lon:at.lon,label:MANUAL_PRESETS.find(p=>p.facility===key)?.label||key,selectedAt:new Date().toISOString()}; state.originMessage='出発地点を設定しました。'; if (!proceedPendingIntent()) back(); return; }
  if (a==='selectCard') { highlightCard(id, true); const spot=SPOTS.find(s=>s.id===id); if (spot) selectFacilityMarker(spot.facility); return; }
  if (a==='focusMap') { const spot=SPOTS.find(s=>s.id===id), marker=spot&&facilityMarkers.get(spot.facility); highlightCard(id, false); if (spot) selectFacilityMarker(spot.facility); if (marker&&mapInstance) { marker.openPopup(); mapInstance.panTo(marker.getLatLng()); document.getElementById('map').scrollIntoView({behavior:'smooth',block:'center'}); } return; }
  if (a==='goUse') return enter('route');
  if (a==='usageConfirm') { state.confirmation=null; return enter('confirm'); }
}, true);
render();
