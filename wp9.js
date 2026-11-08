/* WP9.1 bounded interaction layer. WP8 facts and classification remain unchanged.
   The only classification adapter is walk=UNKNOWN for dynamic origins. */
let mapInstance = null;
const facilityMarkers = new Map();
const wp8Render = render;
const wp8Detail = renderDetail;
const wp8Filter = renderFilter;

function entrance(spot) { return FACILITY_ENTRANCES[spot.facility] || null; }
function originLabel() { return state.origin ? state.origin.label : '出発地点未設定'; }
function haversine(a, b) {
  const rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function distanceLabel(spot) {
  const at = entrance(spot);
  if (!at) return '施設入口位置：未確認';
  if (!state.origin) return '直線距離：出発地点未設定';
  return `施設入口まで直線約${Math.round(haversine(state.origin, at) / 10) * 10}m（徒歩時間は未確認）`;
}
function candidateView() {
  return SPOTS.filter(supportsIntent).map(s => ({s, e: evaluate(s)})).filter(x => x.e.kind !== 'D');
}
/* 並び順：必須の該当数が多い順 → 出発地点から近い順（2026-11-08 本人指示）。
   距離は並び替え専用。表示用の距離は従来どおり入口座標のみ（distanceLabel）。
   施設の代表点は入口座標ではないので、表示・道順には使わない。 */
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
function sortCandidates(list) {
  const decorated = list.map(x => ({x, m: mustYesCount(x.s), d: sortDistance(x.s)}));
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
  return `${renderHeader('今、何したい？', false)}<section class="tagline"><p class="catch">"ありそう"じゃなく、"使える"場所を。</p><p class="sub">載っているのは、行政データと施設の公式サイトで確認した情報だけ。休憩・食事・授乳・おむつ替え・トイレなど、色々な用途から探せます。</p></section><section class="intro origin-card"><div class="origin-head"><span class="pin" aria-hidden="true">📍</span><div><h2>出発地点</h2><p class="origin-label">${esc(originLabel())}</p></div></div>${state.originMessage ? `<p class="origin-message" role="status">${esc(state.originMessage)}</p>` : ''}<div class="origin-actions"><button class="secondary main" data-action="geolocate">現在地を使う</button><button class="secondary" data-action="manualOrigin">場所を選ぶ</button></div><p class="muted">位置情報はこの画面の中だけで使います。</p></section><section class="intent-grid">${Object.entries(INTENTS).filter(([id]) => !state.hiddenIntents.has(id)).map(([id, i]) => `<button class="intent" data-action="intent" data-id="${id}"><span class="ic ic-${id}" aria-hidden="true">${i.icon}</span><strong>${i.label}</strong><small>${i.sub}</small></button>`).join('')}</section><div class="home-tools"><button class="secondary" data-action="settings">表示する用途を設定</button></div><details class="privacy"><summary>このサイトについて</summary><p>ヤスミルは、外出先で『今、使える場所』を探すためのサイトです。掲載している情報は、行政の公開データと施設の公式サイトで確認したものだけです。確認できていない情報は載せていません。そのぶん載っていない場所もありますが、『行ってみたら使えなかった』を減らすための方針です。位置情報は、お使いの端末の中だけで距離の計算に使い、外部へ送ることはありません。地図の表示にはOpenStreetMapを使っていて、地図画像の取得先には、表示している範囲が伝わります。「この場所は使えましたか？」への回答は、保存も送信もされません。表示する用途の設定は、この端末の中に保存されます。</p></details>`;
}
function renderOrigin() {
  return `${renderHeader('出発地点を選ぶ')}<section><p class="muted">施設の入口を選ぶか、地図をタップして地点を決めてください。</p><div class="origin-actions">${MANUAL_PRESETS.map(p => `<button class="secondary" data-action="preset" data-key="${esc(p.facility)}">${esc(p.label)}</button>`).join('')}</div>${state.originMessage ? `<p class="origin-message" role="status">${esc(state.originMessage)}</p>` : ''}</section><div id="map" class="map origin-map" aria-label="出発地点を選ぶ地図"></div><p class="map-attribution-note">地図：© OpenStreetMap contributors</p>`;
}
function card(spot, result) {
  const key = state.intent;
  const important = key === 'rest' ? ['price','indoor','purchaseNo','seating'] : key === 'eat' ? ['seating','eating','outsideFood','price','indoor'] : key === 'diaper' ? ['diaper','male'] : key === 'kids' ? ['kids','price','indoor','age'] : key === 'nursing' ? ['nursing'] : key === 'work' ? ['wifi','power','calls','fee'] : key === 'storage' ? ['suitcase','icpay'] : ['toilet'];
  const badge = result.kind === 'A' ? '条件に一致' : result.kind === 'B' ? '一部条件を確認できません' : '条件を広げると候補';
  const unresolved = result.missing?.length ? condText(result.missing[0].key, result.missing[0].v) + (result.missing.length > 1 ? ' ほか' : '') : '';
  return `<article id="card-${esc(spot.id)}" data-spot-id="${esc(spot.id)}" class="card state-${result.kind}"><div class="badge">${badge}</div><h3>${esc(spot.name)}</h3><p class="facility">${esc(spot.facility)}</p>${unresolved ? `<p class="alert">${esc(unresolved)}</p>` : ''}<div class="facts">${important.map(k => `<span class="fact ${condValue(spot,k)}">${esc(condText(k,condValue(spot,k)))}</span>`).join('')}</div><p class="meta"><span class="dist">${esc(distanceLabel(spot))}</span></p><div class="card-actions"><button class="primary" data-action="detail" data-id="${esc(spot.id)}">詳しく見る</button>${entrance(spot) ? `<button class="secondary" data-action="focusMap" data-id="${esc(spot.id)}">地図で見る</button>` : ''}</div></article>`;
}
function renderResults() {
  const i = INTENTS[state.intent], evaluated = candidateView();
  const a = sortCandidates(evaluated.filter(x => x.e.kind === 'A')), b = sortCandidates(evaluated.filter(x => x.e.kind === 'B')), c = sortCandidates(evaluated.filter(x => x.e.kind === 'C')), noTrusted = !a.length;
  let html = `${renderHeader(`${i.icon} ${i.label}`)}<div class="result-head"><div><small>出発：${esc(originLabel())}</small></div><div class="origin-actions"><button class="secondary" data-action="manualOrigin">地点</button><button class="secondary" data-action="filter">条件</button></div></div><div class="chips">${activeChips()}</div><div id="map" class="map results-map" aria-label="周辺Spotの地図"></div><div class="candidate-sheet">${quickConditions()}`;
  if (noTrusted) html += `<section class="zero"><h2>すべての条件を確認できる場所は見つかりませんでした。</h2><p>未確認の候補は別に表示します。条件を広げる場合は、変更内容を選んでください。</p>${relaxOptions()}</section>`;
  if (a.length) html += `<section><h2>条件に一致</h2>${a.map(x => card(x.s,x.e)).join('')}</section>`;
  if (b.length) html += `<section><h2>一部条件を確認できない候補</h2>${b.map(x => card(x.s,x.e)).join('')}</section>`;
  if (c.length) html += `<section><h2>条件を広げると候補</h2>${c.map(x => card(x.s,x.e)).join('')}</section>`;
  if (!noTrusted) html += `<section class="relax-block"><h2>条件を広げる</h2>${relaxOptions()}</section>`;
  return html + '</div>';
}
function relaxOptions() {
  const options = [];
  for (const [key, mode] of Object.entries(state.filters)) {
    if (mode !== 'must' || state.relaxed.has(key)) continue;
    if (SPOTS.filter(supportsIntent).some(s => ['unknown','conditional'].includes(condValue(s,key)))) options.push(`<button class="option" data-action="relax" data-key="${key}">「${esc(CONDS[key].label)}：未確認」も含める →</button>`);
  }
  if (state.filters.indoor === 'must') options.push('<button class="option" data-action="downgrade" data-key="indoor">屋外も含める（屋内を「できれば」に変更） →</button>');
  if (state.walkMinutes < 15 && state.filters.walk !== 'off') options.push('<button class="option" data-action="walk15">表示条件を徒歩15分へ変更（徒歩時間自体は未確認） →</button>');
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
  return html;
};
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
  const L = window.L, center = state.origin ? [state.origin.lat,state.origin.lon] : TOKYO_CENTER;
  mapInstance = L.map(node,{zoomControl:true,scrollWheelZoom:false}).setView(center,state.origin?15:10);
  L.tileLayer(MAP_CONFIG.tileUrl,{maxZoom:18,attribution:MAP_CONFIG.attribution,updateWhenIdle:true}).addTo(mapInstance);
  if (state.origin) L.circleMarker([state.origin.lat,state.origin.lon],{radius:7,color:'#1a4a90',fillColor:'#4c85d0',fillOpacity:1}).addTo(mapInstance).bindPopup('出発地点');
  if (state.screen === 'origin') {
    mapInstance.on('click', ev => { const c=ev.latlng; state.origin={kind:'map_tap',lat:c.lat,lon:c.lng,label:'地図で選んだ地点',selectedAt:new Date().toISOString()}; state.originMessage='地図上の地点を出発地点に設定しました。'; back(); });
    return;
  }
  const grouped = new Map();
  for (const x of candidateView()) { const at=entrance(x.s); if (at) { if (!grouped.has(x.s.facility)) grouped.set(x.s.facility,[]); grouped.get(x.s.facility).push(x); } }
  for (const [facility,items] of grouped) {
    const at=FACILITY_ENTRANCES[facility], color=items.some(x=>x.e.kind==='A')?'#1f6d58':items.some(x=>x.e.kind==='B')?'#a76617':'#546ba1';
    const marker=L.circleMarker([at.lat,at.lon],{radius:11,color,fillColor:color,fillOpacity:.82,weight:2}).addTo(mapInstance);
    marker.bindPopup(`<strong>${esc(facility)} 入口</strong><br>${items.map(x=>`<button class="map-spot" data-action="selectCard" data-id="${esc(x.s.id)}">${esc(x.s.name)} · ${x.e.kind==='A'?'条件に一致':x.e.kind==='B'?'一部未確認':'条件を広げると候補'}</button>`).join('')}`);
    facilityMarkers.set(facility,marker);
  }
}
render = function () {
  if (mapInstance) { mapInstance.remove(); mapInstance=null; facilityMarkers.clear(); }
  if (state.screen === 'settings') { app.innerHTML=renderSettings(); window.scrollTo(0,0); }
  else if (state.screen === 'origin' || state.screen === 'route') { app.innerHTML=state.screen==='origin'?renderOrigin():renderRoute(); window.scrollTo(0,0); }
  else wp8Render();
  if (state.screen === 'origin' || state.screen === 'results') initMap();
};
function useGeolocation() {
  state.originMessage='現在地を取得しています…'; render();
  if (!navigator.geolocation) { state.originMessage='このブラウザでは現在地を取得できません。場所を選んでください。'; enter('origin'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude,longitude,accuracy}=pos.coords;
    if (!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||accuracy>200) { state.originMessage='現在地の精度が低いため、場所を選んでください。'; enter('origin'); return; }
    state.origin={kind:'gps',lat:latitude,lon:longitude,accuracyM:accuracy,label:`現在地（精度約${Math.round(accuracy)}m）`,selectedAt:new Date().toISOString()};
    state.originMessage='現在地を出発地点に設定しました。'; render();
  }, () => { state.originMessage='現在地を取得できませんでした。場所を選んでください。'; enter('origin'); }, {enableHighAccuracy:false,timeout:8000,maximumAge:0});
}
app.addEventListener('click', ev => {
  const sbtn = ev.target.closest('[data-action="settings"],[data-action="toggleIntent"]');
  if (sbtn) { const sa=sbtn.dataset.action; if (sa==='settings') return enter('settings'); if (sa==='toggleIntent') { const id=sbtn.dataset.id; if (state.hiddenIntents.has(id)) state.hiddenIntents.delete(id); else { if (Object.keys(INTENTS).filter(x=>!state.hiddenIntents.has(x)).length<=1) return; state.hiddenIntents.add(id); } saveHiddenIntents(); return render(); } }
  const btn=ev.target.closest('[data-action]'); if (!btn) return;
  const {action:a,id,key}=btn.dataset;
  if (!['geolocate','manualOrigin','preset','selectCard','focusMap','goUse','usageConfirm'].includes(a)) return;
  ev.stopImmediatePropagation();
  if (a==='geolocate') return useGeolocation();
  if (a==='manualOrigin') return enter('origin');
  if (a==='preset') { const at=FACILITY_ENTRANCES[key]; if (!at) return; state.origin={kind:'preset',lat:at.lat,lon:at.lon,label:MANUAL_PRESETS.find(p=>p.facility===key)?.label||key,selectedAt:new Date().toISOString()}; state.originMessage='出発地点を設定しました。'; return back(); }
  if (a==='selectCard') { state.selectedSpotId=id; const cardEl=document.getElementById(`card-${id}`); if (cardEl) { document.querySelectorAll('.selected-card').forEach(el=>el.classList.remove('selected-card')); cardEl.classList.add('selected-card'); cardEl.classList.remove('pulse'); void cardEl.offsetWidth; cardEl.classList.add('pulse'); cardEl.scrollIntoView({behavior:'smooth',block:'center'}); } return; }
  if (a==='focusMap') { const spot=SPOTS.find(s=>s.id===id), marker=spot&&facilityMarkers.get(spot.facility); state.selectedSpotId=id; const cardEl=document.getElementById(`card-${id}`); if (cardEl) { document.querySelectorAll('.selected-card').forEach(el=>el.classList.remove('selected-card')); cardEl.classList.add('selected-card'); cardEl.classList.remove('pulse'); void cardEl.offsetWidth; cardEl.classList.add('pulse'); } if (marker&&mapInstance) { marker.openPopup(); mapInstance.panTo(marker.getLatLng()); document.getElementById('map').scrollIntoView({behavior:'smooth',block:'center'}); } return; }
  if (a==='goUse') return enter('route');
  if (a==='usageConfirm') { state.confirmation=null; return enter('confirm'); }
}, true);
render();
