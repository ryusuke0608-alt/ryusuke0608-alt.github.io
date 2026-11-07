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
function renderHome() {
  return `${renderHeader('今、何したい？', false)}<section class="intro"><h2>出発地点</h2><p>${esc(originLabel())}</p>${state.originMessage ? `<p class="origin-message" role="status">${esc(state.originMessage)}</p>` : ''}<div class="origin-actions"><button class="secondary" data-action="geolocate">現在地を使う</button><button class="secondary" data-action="manualOrigin">場所を選ぶ</button></div><p class="muted">位置情報は画面を開いている間だけ使います。地図タイルの取得先には表示範囲が伝わります。徒歩時間は未確認です。</p></section><section class="intent-grid">${Object.entries(INTENTS).map(([id, i]) => `<button class="intent" data-action="intent" data-id="${id}"><span aria-hidden="true">${i.icon}</span><strong>${i.label}</strong><span class="arrow">→</span></button>`).join('')}</section><p class="footnote">公式公開情報を使った検証用試作品。最新の営業状況は現地で確認してください。</p>`;
}
function renderOrigin() {
  return `${renderHeader('出発地点を選ぶ')}<section><p class="muted">確認済みの施設入口を選ぶか、地図上の任意の地点をタップしてください。住所検索はありません。</p><div class="origin-actions">${MANUAL_PRESETS.map(p => `<button class="secondary" data-action="preset" data-key="${esc(p.facility)}">${esc(p.label)}</button>`).join('')}</div>${state.originMessage ? `<p class="origin-message" role="status">${esc(state.originMessage)}</p>` : ''}</section><div id="map" class="map origin-map" aria-label="出発地点を選ぶ地図"></div><p class="map-attribution-note">地図：© OpenStreetMap contributors。地図が読めない場合も上の入口から選べます。</p>`;
}
function card(spot, result) {
  const key = state.intent;
  const important = key === 'rest' ? ['price','indoor','purchaseNo','seating'] : key === 'eat' ? ['seating','eating','outsideFood','price','indoor'] : key === 'diaper' ? ['diaper','male'] : key === 'kids' ? ['kids','price','indoor','age'] : key === 'nursing' ? ['nursing'] : ['toilet'];
  const badge = result.kind === 'A' ? '条件に一致' : result.kind === 'B' ? '一部条件を確認できません' : '条件を広げると候補';
  const unresolved = result.missing?.map(x => condText(x.key, x.v)).join('／');
  return `<article id="card-${esc(spot.id)}" data-spot-id="${esc(spot.id)}" class="card state-${result.kind}"><div class="badge">${badge}</div><h3>${esc(spot.name)}</h3><p class="facility">${esc(spot.facility)}</p>${unresolved ? `<p class="alert">${esc(unresolved)}</p>` : ''}<div class="facts">${important.map(k => `<span class="fact ${condValue(spot,k)}">${esc(condText(k,condValue(spot,k)))}</span>`).join('')}</div><p class="meta">${esc(distanceLabel(spot))} · ${CHECKED_AT}時点の情報</p>${unknownSummary(spot)}<div class="card-actions"><button class="primary" data-action="detail" data-id="${esc(spot.id)}">詳しく見る</button>${entrance(spot) ? `<button class="secondary" data-action="focusMap" data-id="${esc(spot.id)}">地図で見る</button>` : ''}</div></article>`;
}
function renderResults() {
  const i = INTENTS[state.intent], evaluated = candidateView();
  const a = evaluated.filter(x => x.e.kind === 'A'), b = evaluated.filter(x => x.e.kind === 'B'), c = evaluated.filter(x => x.e.kind === 'C'), noTrusted = !a.length;
  let html = `${renderHeader(`${i.icon} ${i.label}`)}<div class="result-head"><div><strong>みなとみらい</strong><small>出発：${esc(originLabel())}</small></div><div class="origin-actions"><button class="secondary" data-action="manualOrigin">地点</button><button class="secondary" data-action="filter">条件</button></div></div><div class="chips">${activeChips()}</div><div id="map" class="map results-map" aria-label="周辺Spotの地図"></div><p class="map-attribution-note">ピンは施設入口です。Spotの館内位置と徒歩時間は別です。MARK ISの入口位置は未確認のためピンを表示しません。</p><div class="candidate-sheet">${quickConditions()}`;
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
  return wp8Filter().replace('「できれば」は未確認でも候補に残します。', '歩行経路の根拠がないため徒歩時間は未確認です。');
};
renderDetail = function () {
  const spot = SPOTS.find(s => s.id === state.spotId);
  if (!spot) return renderResults();
  let html = wp8Detail();
  html = html.replace('<p class="muted">現時点の営業・空き・一時休止は未確認です。</p>', `${state.filters.walk !== 'off' ? '<div class="status-row"><span class="fact-copy evidence-unknown">徒歩時間：未確認（歩行経路の根拠なし）</span></div>' : ''}<p class="muted">現時点の営業・空き・一時休止は未確認です。</p>`);
  html = html.replace(`<p>${esc(spot.walk.label)}（施設入口まで。館内移動は含みません）</p>`, `<p>${esc(distanceLabel(spot))}</p><p>館内のSpotまでの移動は未確認です。</p>${entrance(spot) ? `<p class="muted">入口座標：${esc(entrance(spot).precision)} · <a href="${esc(entrance(spot).sourceUrl)}" target="_blank" rel="noopener">位置の出典を見る</a></p>` : ''}`);
  return html;
};
function renderRoute() {
  const spot = SPOTS.find(s => s.id === state.spotId), at = entrance(spot);
  const url = at ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(at.lat + ',' + at.lon)}&travelmode=walking` : null;
  return `${renderHeader('ここへ行く')}<section><h2>${esc(spot.name)}</h2><p>${esc(spot.facility)}／${esc(spot.location)}</p><p>${esc(distanceLabel(spot))}</p><p class="muted">外部地図の目的地は施設入口です。館内のSpotまでの案内はありません。現在地はこのサイトから外部地図URLに含めません。</p>${url ? `<a class="primary route-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">外部地図で道順を見る ↗</a>` : '<p class="alert">入口座標が未確認のため、外部地図への座標リンクは表示しません。</p>'}<button class="secondary route-confirm" data-action="usageConfirm">利用確認へ</button></section>`;
}
function initMap() {
  const node = document.getElementById('map');
  if (!node) return;
  if (!window.L) { node.textContent = '地図を読み込めません。Spot一覧は利用できます。'; return; }
  const defaultPoint=FACILITY_ENTRANCES['横浜美術館'];
  const L = window.L, center = state.origin ? [state.origin.lat,state.origin.lon] : [defaultPoint.lat,defaultPoint.lon];
  mapInstance = L.map(node,{zoomControl:true,scrollWheelZoom:false}).setView(center,15);
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
  if (state.screen === 'origin' || state.screen === 'route') { app.innerHTML=state.screen==='origin'?renderOrigin():renderRoute(); window.scrollTo(0,0); }
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
  const btn=ev.target.closest('[data-action]'); if (!btn) return;
  const {action:a,id,key}=btn.dataset;
  if (!['geolocate','manualOrigin','preset','selectCard','focusMap','goUse','usageConfirm'].includes(a)) return;
  ev.stopImmediatePropagation();
  if (a==='geolocate') return useGeolocation();
  if (a==='manualOrigin') return enter('origin');
  if (a==='preset') { const at=FACILITY_ENTRANCES[key]; if (!at) return; state.origin={kind:'preset',lat:at.lat,lon:at.lon,label:MANUAL_PRESETS.find(p=>p.facility===key)?.label||key,selectedAt:new Date().toISOString()}; state.originMessage='出発地点を設定しました。'; return back(); }
  if (a==='selectCard') { state.selectedSpotId=id; const cardEl=document.getElementById(`card-${id}`); if (cardEl) { document.querySelectorAll('.selected-card').forEach(el=>el.classList.remove('selected-card')); cardEl.classList.add('selected-card'); cardEl.scrollIntoView({behavior:'smooth',block:'center'}); } return; }
  if (a==='focusMap') { const spot=SPOTS.find(s=>s.id===id), marker=spot&&facilityMarkers.get(spot.facility); state.selectedSpotId=id; if (marker&&mapInstance) { marker.openPopup(); mapInstance.panTo(marker.getLatLng()); document.getElementById('map').scrollIntoView({behavior:'smooth',block:'center'}); } return; }
  if (a==='goUse') return enter('route');
  if (a==='usageConfirm') { state.confirmation=null; return enter('confirm'); }
}, true);
render();
