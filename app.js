const INTENTS = {
  toilet:{icon:'🚻',label:'トイレに行きたい',sub:'多目的トイレ・おむつ台',conditions:{toilet:'must',walk:'must'}},
  rest:{icon:'🪑',label:'休みたい',sub:'座って休める場所',conditions:{price:'must',indoor:'must',purchaseNo:'prefer',seating:'must',walk:'must'}},
  eat:{icon:'🍙',label:'食べたい',sub:'飲食スペース・フードコート',conditions:{seating:'must',eating:'must',outsideFood:'prefer',price:'prefer',indoor:'prefer',walk:'must'}},
  nursing:{icon:'🍼',label:'授乳したい',sub:'授乳室・ベビー休憩室',conditions:{nursing:'must',diaper:'off',male:'off',walk:'must'}},
  diaper:{icon:'🚼',label:'おむつを替えたい',sub:'交換台のある場所',conditions:{diaper:'must',male:'must',walk:'must'}},
  kids:{icon:'🧸',label:'子どもを遊ばせたい',sub:'キッズスペース',conditions:{kids:'must',price:'must',indoor:'must',age:'prefer',walk:'must'}},
  work:{icon:'💻',label:'作業したい',sub:'Wi-Fi・電源のある場所',conditions:{wifi:'prefer',power:'prefer',calls:'off',walk:'must'}},
  storage:{icon:'🧳',label:'荷物を預けたい',sub:'コインロッカー・荷物預かり',conditions:{suitcase:'off',icpay:'off',walk:'must'}}
};
const CONDS = {
  price:{label:'無料',attr:'price'}, indoor:{label:'屋内',attr:'indoor'}, purchaseNo:{label:'購入不要',attr:'purchase_required'},
  seating:{label:'座席あり',attr:'seating'}, current:{label:'現在利用可能',attr:'current_available'}, walk:{label:'徒歩範囲',attr:'walk'},
  eating:{label:'飲食可能',attr:'eating_allowed'}, outsideFood:{label:'持込飲食可能',attr:'outside_food_allowed'},
  male:{label:'男性も利用可能',attr:'male_accessible'}, diaper:{label:'おむつ交換台',attr:'diaper_table'},
  nursing:{label:'授乳室',attr:'nursing_room'}, kids:{label:'キッズスペース',attr:'kids_space'}, age:{label:'対象年齢',attr:'age_eligibility'},
  toilet:{label:'トイレ',attr:'toilet'},
  stepFree:{label:'段差なしで到達',attr:'step_free'}, elevator:{label:'エレベーター',attr:'elevator_present'},
  accessibleToilet:{label:'多目的トイレ',attr:'accessible_toilet'},
  stroller:{label:'ベビーカーのまま入れる',attr:'stroller_ok'},
  wifi:{label:'Wi-Fi',attr:'wifi_available'}, power:{label:'電源',attr:'power_available'},
  calls:{label:'通話・Web会議OK',attr:'calls_allowed'}, fee:{label:'無料',attr:'fee_type'},
  suitcase:{label:'スーツケース可',attr:'suitcase_ok'}, icpay:{label:'IC支払い可',attr:'ic_payment'}
};
const QUICK_CONDS = {rest:['price','indoor','purchaseNo','walk'],eat:['seating','outsideFood','price','indoor','walk'],diaper:['male','price','walk'],nursing:['nursing','price','walk'],kids:['price','indoor','age','walk'],toilet:['toilet','walk'],work:['wifi','power','calls','price','walk'],storage:['suitcase','icpay','walk']};
const ATTRS = {seating:'座席',free_seating:'無料で座れる',indoor:'屋内',purchase_required:'購入が必要',eating_allowed:'飲食可能',outside_food_allowed:'持込飲食可能',current_available:'現在の利用可否',price:'利用料金',kids_space:'キッズスペース',age_eligibility:'対象年齢',diaper_table:'おむつ交換台',male_accessible:'男性も利用可能',nursing_room:'授乳室',toilet:'トイレ',accessible_toilet:'多目的トイレ',elevator_present:'エレベーター',step_free:'段差なしで到達',stroller_ok:'ベビーカーのまま入れる',workspace:'作業スペース',wifi_available:'Wi-Fi',power_available:'電源',calls_allowed:'通話・Web会議',food_allowed:'飲食',fee_type:'料金',luggage_storage:'荷物預かり',storage_type:'預かりの種類',locker_sizes:'ロッカーのサイズ',suitcase_ok:'スーツケース',ic_payment:'IC支払い',fee_from:'料金目安',payment_methods:'支払い方法',time_limit_note:'時間制限'};
const app = document.getElementById('app');
const state = {screen:'home',intent:null,filters:{},draft:null,priceMode:'freeOnly',walkMinutes:10,relaxed:new Set(),spotId:null,detailFrom:'results',confirmation:null,confirmMain:null,confirmValue:null,confirmSent:null,history:[],origin:null,originMessage:'',selectedSpotId:null};
const FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSeyS4-4AXz06ZC3KSf0ncHFFWbNWhtCMAHCUwCWbYsIlstLEA/viewform';
const FORM_SHORT = 'https://forms.gle/Zu81eGnTPPFAHziM7';
function reportUrl(spot){return `${FORM_BASE}?entry.259277641=${encodeURIComponent('誤情報の報告')}&entry.1161295391=${encodeURIComponent(spot.name+'（'+spot.facility+'）')}`;}
const copy = x => JSON.parse(JSON.stringify(x));
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function enter(screen){state.history.push({screen:state.screen,spotId:state.spotId});state.screen=screen;state._pushed=(state._pushed||0)+1;history.pushState({screen},'',`#${screen}`);render();}
function back(){state._pushed=Math.max(0,(state._pushed||0)-1);const prev=state.history.pop();if(prev){state.screen=prev.screen;state.spotId=prev.spotId;}else{state.screen='home';}if(history.replaceState)history.replaceState({screen:state.screen},'',`#${state.screen}`);render();}
function backButton(){/* アプリ内の「戻る」はブラウザ履歴を1つ消費し、実際の遷移は popstate 側の back() に任せる（2026-11-28 シナリオテスト第1弾の指摘：従来は replaceState で現在の履歴エントリを書き換えるだけだったため、アプリ内「戻る」の後にブラウザの戻るを押すと、内部履歴とブラウザ履歴のずれで意図しない画面（条件画面）に戻っていた）。履歴エントリが無い場合（直接開いた等）は従来どおり内部履歴だけで戻る。 */
  if((state._pushed||0)>0&&typeof history.back==='function'){history.back();}else{back();}}
window.addEventListener('popstate',()=>back());
function chooseIntent(intent){state.intent=intent;state.filters=copy(INTENTS[intent].conditions);if(state.filters.price===undefined)state.filters.price='prefer';state.priceMode=state.filters.price==='must'?'freeOnly':state.filters.price==='prefer'?'freePrefer':'includePaid';state.walkMinutes=10;state.relaxed=new Set();state.history=[{screen:'home',spotId:null}];state.screen='results';state._pushed=(state._pushed||0)+1;history.pushState({screen:'results'},'','#results');render();}
function supportsIntent(spot){const f=spot.facts;switch(state.intent){case 'rest':case 'eat':return f.seating===true;case 'diaper':return f.diaper_table===true;case 'kids':return f.kids_space===true;case 'nursing':return f.nursing_room===true;case 'toilet':return f.toilet===true;case 'work':return f.workspace===true;case 'storage':return f.luggage_storage===true;default:return false;}}
/* 料金の正本は fee_type（新しい調査で書く項目）。旧項目 price しかないスポットは
   price を読み、両方ある場合は fee_type を優先する。「無料」の条件が price/fee の
   2キーに分かれて別々の項目を読むと、同じ場所で判定が食い違う（2026-11-28
   シナリオテスト S01 の不具合）。そのため両キーは必ずこの1関数で判定する。 */
function feeCondValue(f){const v=(f.fee_type&&f.fee_type!=='UNKNOWN')?f.fee_type:f.price;return v==='FREE'?'yes':v==='PAID'?'no':(v==='CONDITIONAL_FREE'||v==='PURCHASE_REQUIRED')?'conditional':'unknown';}
/* 表示用：解決した料金の値そのもの（既知の enum でなければ null）。詳細画面では
   price と fee_type を別々に出さず、この値で1つだけ表示する（Codexレビュー
   2026-11-28 の指摘：詳細画面に旧来の二重表示が残っていた）。 */
function feeValueOf(f){const v=(f.fee_type&&f.fee_type!=='UNKNOWN')?f.fee_type:f.price;return (v==='FREE'||v==='PAID'||v==='CONDITIONAL_FREE'||v==='PURCHASE_REQUIRED')?v:null;}
function condValue(spot,key){const f=spot.facts;switch(key){
  case 'price': case 'fee': return feeCondValue(f);
  case 'purchaseNo':return f.purchase_required===false?'yes':f.purchase_required===true?'no':'unknown';
  case 'walk':return 'unknown'; // dynamic origin has no verified walking route or duration
  case 'age':return f.age_eligibility===true?'yes':f.age_eligibility===false?'no':'unknown';
  default:{const v=f[CONDS[key].attr];return v===true?'yes':v===false?'no':'unknown';}
}}
function condText(key,status){if(status==='yes')return `${CONDS[key].label} ✓`;if(status==='no')return `${CONDS[key].label}：条件外`;if(status==='conditional')return `${CONDS[key].label}：条件付き`;return `${CONDS[key].label}：未確認`;}
function evaluate(spot){let missing=[],negative=[],relaxedMissing=[],soft=[];for(const [key,mode] of Object.entries(state.filters)){if(mode==='off')continue;const v=condValue(spot,key);if(mode==='prefer'){if(v!=='yes')soft.push({key,v});continue;}if(v==='no'){negative.push(key);continue;}if(v!=='yes'){if(state.relaxed.has(key))relaxedMissing.push({key,v});else missing.push({key,v});}}
  if(negative.length)return {kind:'D',negative,missing,soft};
  if(missing.length)return {kind:'B',missing,soft};
  if(relaxedMissing.length)return {kind:'B',missing:relaxedMissing,soft}; // 2026-11-16 本人指示: 広げた条件だけが未確認の候補は条件内として扱う
  return {kind:'A',missing:[],soft};
}
function activeChips(){return Object.entries(state.filters).filter(([,v])=>v!=='off').map(([k,v])=>{const relaxed=state.relaxed.has(k);const cur=relaxed?'未確認も含む':v==='must'?'必須':'できれば';const next=v==='must'?(relaxed?'できれば':'未確認も含む'):'指定なし';const label=`${CONDS[k].label}${k==='walk'?` ${state.walkMinutes}分`:''}`;return `<button class="chip ${relaxed?'relaxed':''}" data-action="chipCondition" data-key="${k}" aria-label="${esc(label)}：${cur}。タップで${next}に変更">${esc(label)} · ${cur}</button>`;}).join('');}
function cycleChipCondition(key){const mode=state.filters[key]||'off';if(mode==='must'&&!state.relaxed.has(key)){state.relaxed.add(key);}else if(mode==='must'){state.relaxed.delete(key);state.filters[key]='prefer';if(key==='price')state.priceMode='freePrefer';}else if(mode==='prefer'){state.filters[key]='off';state.relaxed.delete(key);if(key==='price')state.priceMode='includePaid';}else{state.filters[key]='must';if(key==='price')state.priceMode='freeOnly';}render();}
function quickConditions(){const keys=QUICK_CONDS[state.intent]||[];return `<section class="quick-conditions"><h2>よく使う条件</h2><div class="quick-grid">${keys.map(k=>{const mode=state.filters[k]||'off';const next=mode==='must'?'できれば':mode==='prefer'?'指定なし':'必須';const label=CONDS[k].label+(k==='walk'?` ${state.walkMinutes}分`:'');return `<button class="quick-button mode-${mode}" data-action="quickCondition" data-key="${k}" aria-label="${esc(label)}：${mode==='must'?'必須':mode==='prefer'?'できれば':'指定なし'}。タップで${next}に変更"><strong>${esc(label)}</strong><span>${mode==='must'?'必須':mode==='prefer'?'できれば':'指定なし'}</span></button>`}).join('')}</div></section>`;}
function cycleQuickCondition(key){const mode=state.filters[key]||'off';const next=mode==='must'?'prefer':mode==='prefer'?'off':'must';state.filters[key]=next;if(key==='price')state.priceMode=next==='must'?'freeOnly':next==='prefer'?'freePrefer':'includePaid';if(next!=='must')state.relaxed.delete(key);render();}
function unknownName(k){return k==='purchase_required'?'購入不要':ATTRS[k]||k;}
function unknownSummary(spot){const unknown=Object.entries(spot.facts).filter(([k,v])=>k!=='current_available'&&(v===null||v==='UNKNOWN')).map(([k])=>`${unknownName(k)}：未確認`);return unknown.length?`<p class="evidence-unknown">${esc(unknown.join('／'))}</p>`:'';}
function renderHeader(title,backTo=true){return `<header class="top">${backTo?'<button class="icon-btn" data-action="back" aria-label="戻る">←</button>':''}<div><small>ヤスミル</small><h1>${title}</h1></div></header>`;}
function renderHome(){return `${renderHeader('今、何したい？',false)}<section class="intro"><p>今いる場所：みなとみらい駅</p><p class="muted">施設入口までの徒歩目安です。館内移動と現在の空き状況は未確認です。</p></section><section class="intent-grid">${Object.entries(INTENTS).map(([id,i])=>`<button class="intent" data-action="intent" data-id="${id}"><span class="ic ic-${id}" aria-hidden="true">${i.icon}</span><strong>${i.label}</strong><small>${i.sub}</small></button>`).join('')}</section><p class="footnote">公式情報をもとに作成しています。最新の営業状況は現地でご確認ください。</p>`;}
function card(spot,result){const key=state.intent;const important=key==='rest'?['price','indoor','purchaseNo','seating']:key==='eat'?['seating','eating','outsideFood','price','indoor']:key==='diaper'?['diaper','male']:key==='kids'?['kids','price','indoor','age']:key==='nursing'?['nursing']:['toilet'];const badge=result.kind==='A'?'条件に一致':result.kind==='B'?'一部条件を確認できません':'条件を広げると候補';const unresolved=result.missing?.map(x=>condText(x.key,x.v)).join('／');return `<article class="card state-${result.kind}"><div class="badge">${badge}</div><h3>${esc(spot.name)}</h3><p class="facility">${esc(spot.facility)}</p>${unresolved?`<p class="alert">${esc(unresolved)}</p>`:''}<div class="facts">${important.map(k=>{const v=condValue(spot,k);return `<span class="fact ${v}">${esc(condText(k,v))}</span>`}).join('')}</div><p class="meta">${esc(spot.walk.label)} · ${CHECKED_AT}時点の情報</p>${unknownSummary(spot)}<button class="primary" data-action="detail" data-id="${spot.id}">詳しく見る</button></article>`;}
function renderResults(){const i=INTENTS[state.intent];const evaluated=SPOTS.filter(supportsIntent).map(s=>({s,e:evaluate(s)}));const a=evaluated.filter(x=>x.e.kind==='A'),b=evaluated.filter(x=>x.e.kind==='B'),c=evaluated.filter(x=>x.e.kind==='C');const noTrusted=!a.length;let html=`${renderHeader(`${i.icon} ${i.label}`)}<div class="result-head"><div><strong>みなとみらい</strong><small>出発：みなとみらい駅</small></div><button class="secondary" data-action="filter">条件</button></div><div class="chips">${activeChips()}</div>${quickConditions()}`;
  if(noTrusted)html+=`<section class="zero"><h2>すべての条件を確認できる場所は見つかりませんでした。</h2><p>未確認の候補は別に表示します。条件を広げる場合は、変更内容を選んでください。</p>${relaxOptions()}</section>`;
  if(a.length)html+=`<section><h2>条件に一致</h2>${a.map(x=>card(x.s,x.e)).join('')}</section>`;
  if(b.length)html+=`<section><h2>一部条件を確認できない候補</h2>${b.map(x=>card(x.s,x.e)).join('')}</section>`;
  if(c.length)html+=`<section><h2>条件を広げると候補</h2>${c.map(x=>card(x.s,x.e)).join('')}</section>`;
  if(!noTrusted)html+=`<section class="relax-block"><h2>条件を広げる</h2>${relaxOptions()}</section>`;
  return html;
}
function relaxOptions(){const options=[];for(const [key,mode] of Object.entries(state.filters)){if(mode==='must'&&!state.relaxed.has(key)&&key!=='walk'){const exists=SPOTS.filter(supportsIntent).some(s=>{const v=condValue(s,key);return v==='unknown'||v==='conditional';});if(exists)options.push(`<button class="option" data-action="relax" data-key="${key}">「${esc(CONDS[key].label)}：未確認」も含める →</button>`);}}
  if(state.filters.indoor==='must')options.push('<button class="option" data-action="downgrade" data-key="indoor">屋外も含める（屋内を「できれば」に変更） →</button>');
  if(state.walkMinutes<15&&state.filters.walk!=='off')options.push('<button class="option" data-action="walk15">徒歩15分まで広げる →</button>');
  if(state.priceMode==='freeOnly'&&state.filters.price==='must')options.push('<button class="option" data-action="pricePref">無料を「できれば」に変更する →</button>');
  return options.length?`<div class="options">${options.join('')}</div>`:'<p class="muted">追加で広げられる条件はありません。</p>';
}
function evaluateWithRelax(spot,key){const v=condValue(spot,key);if(v==='no')return 'D';for(const [k,mode] of Object.entries(state.filters)){if(mode!=='must'||k===key||state.relaxed.has(k))continue;const other=condValue(spot,k);if(other==='no'||other==='unknown'||other==='conditional')return 'B';}return 'B';}
function renderFilter(){const keys=Object.keys(CONDS).filter(k=>Object.prototype.hasOwnProperty.call(INTENTS[state.intent].conditions,k)||['price','indoor','purchaseNo','seating','walk'].includes(k));const rowLabel=k=>k==='walk'?'徒歩範囲の扱い':CONDS[k].label;const filterRow=k=>`<label class="filter-row"><span>${esc(rowLabel(k))}</span><select data-filter="${k}"><option value="off" ${state.draft.filters[k]==='off'||!state.draft.filters[k]?'selected':''}>指定しない</option><option value="must" ${state.draft.filters[k]==='must'?'selected':''}>必須</option><option value="prefer" ${state.draft.filters[k]==='prefer'?'selected':''}>できれば</option></select></label>`;return `${renderHeader('条件を選ぶ')}<div class="pad"><button class="secondary" data-action="resetDraft">条件を初期値に戻す</button></div><p class="muted pad">条件を「必須」にすると、その条件を確認できた場所が「条件に一致」として上に並び、確認できていない場所は下の「一部条件を確認できない候補」に出ます（候補から消えるわけではありません）。「できれば」は、合う場所を並び順で優遇します。</p><section class="filter-section"><h2>利用料金</h2><div class="radio-row">${[['freeOnly','無料のみ'],['freePrefer','無料優先'],['includePaid','有料も含む']].map(([v,t])=>`<label><input type="radio" name="priceMode" value="${v}" ${state.draft.priceMode===v?'checked':''}>${t}</label>`).join('')}</div></section><section class="filter-section"><h2>条件</h2>${keys.filter(k=>k!=='price').map(filterRow).join('')}<label class="filter-row"><span>徒歩の分数</span><select id="walkRange">${[5,10,15].map(n=>`<option value="${n}" ${state.draft.walkMinutes===n?'selected':''}>${n}分</option>`).join('')}</select></label></section><section class="filter-section"><h2>車椅子・ベビーカー</h2>${['stepFree','elevator','accessibleToilet','stroller'].map(filterRow).join('')}</section><div class="sticky"><button class="primary" data-action="applyFilter">この条件で探す</button></div>`;}
function factCopy(k,v){const label=ATTRS[k]||k;if(v===null||v===undefined||v==='UNKNOWN')return `${unknownName(k)}：未確認`;if(v==='FREE')return '無料';if(v==='CONDITIONAL_FREE')return '条件付き無料';if(v==='PURCHASE_REQUIRED')return '購入が必要';if(v==='PAID')return '有料';const yes={seating:'座席あり',free_seating:'無料で座れる',indoor:'屋内',purchase_required:'購入が必要',eating_allowed:'飲食可能',outside_food_allowed:'持込飲食可能',kids_space:'キッズスペースあり',diaper_table:'おむつ交換台あり',male_accessible:'男性も利用可能',nursing_room:'授乳室あり',toilet:'トイレあり',accessible_toilet:'多目的トイレあり',elevator_present:'エレベーターあり',step_free:'段差のない経路で到達できます',stroller_ok:'ベビーカーのまま入れます',wifi_available:'Wi-Fiあり',power_available:'電源あり',calls_allowed:'通話・Web会議OK',food_allowed:'飲食可能',suitcase_ok:'スーツケース可',ic_payment:'IC支払い可'};const no={seating:'座席なし',free_seating:'無料では座れない',indoor:'屋内ではない',purchase_required:'購入不要',eating_allowed:'飲食不可',outside_food_allowed:'持込飲食不可',kids_space:'キッズスペースなし',diaper_table:'おむつ交換台なし',male_accessible:'男性は利用不可',nursing_room:'授乳室なし',toilet:'トイレなし',accessible_toilet:'多目的トイレなし',elevator_present:'エレベーターなし',step_free:'段差なしの経路では到達できません',stroller_ok:'ベビーカーのままでは入れません',wifi_available:'Wi-Fiなし',power_available:'電源なし',calls_allowed:'通話・Web会議不可',food_allowed:'飲食不可',suitcase_ok:'スーツケース不可',ic_payment:'IC支払い不可'};return v===true?(yes[k]||`${label}：はい`):(no[k]||`${label}：いいえ`);}
function candidateReasonText(spot,key){
  if(key==='walk')return spot.walk.direct?'駅直結 ✓':`徒歩${state.walkMinutes}分以内 ✓`;
  const labels={toilet:'トイレあり',diaper:'おむつ交換台あり'};
  return `${labels[key]||CONDS[key].label} ✓`;
}
function unknownQuestion(k){
  const questions={free_seating:'無料で座れるか',purchase_required:'購入不要か',eating_allowed:'飲食可能か',outside_food_allowed:'持込飲食可能か',price:'利用料金',age_eligibility:'対象年齢',current_available:'現在の利用可否'};
  return questions[k]||`${unknownName(k)}か`;
}
function floorTokensOf(str){const out=new Set();const s=String(str??'');for(const m of s.matchAll(/(B?\d+F|中\d+F)/g))out.add(m[1]);for(const m of s.matchAll(/(\d+(?:・\d+)+)F/g))m[1].split('・').forEach(n=>out.add(n+'F'));return out;}
function floorLineHtml(spot){
  const floor=String(spot.floor??'');
  if(!floor||floor.includes('未確認'))return '';
  const loc=String(spot.location??'');
  if(loc.includes(floor))return '';
  const ft=floorTokensOf(floor),lt=floorTokensOf(loc);
  if(ft.size&&[...ft].every(t=>lt.has(t)))return '';
  return `<p>階：${esc(floor)}</p>`;
}
function renderDetail(){
  const spot=SPOTS.find(s=>s.id===state.spotId);
  if(!spot)return renderResults();
  const e=evaluate(spot);
  const ACCESS_KEYS=['elevator_present','step_free','stroller_ok']; // 多目的トイレはアクセスではなく特徴（2026-11-28 本人指摘で分類見直し）
  const WORK_KEYS=['workspace','wifi_available','power_available','calls_allowed','food_allowed','fee_type','time_limit_note'];
  const STORAGE_KEYS=['luggage_storage','storage_type','locker_sizes','suitcase_ok','ic_payment','fee_from','fee_note','payment_methods'];
  const SECTION_KEYS=[...ACCESS_KEYS,...WORK_KEYS,...STORAGE_KEYS,'price','accessible_toilet']; // 多目的トイレは特徴欄に常時表示（キー自体が無いスポットでも未確認タイルを出す。アクセス欄時代の常時表示を維持するため）
  const known=Object.entries(spot.facts).filter(([k,v])=>!SECTION_KEYS.includes(k)&&v!==null&&v!=='UNKNOWN');
  const unknown=Object.entries(spot.facts).filter(([k,v])=>!SECTION_KEYS.includes(k)&&k!=='current_available'&&(v===null||v==='UNKNOWN')).map(([k])=>`${unknownQuestion(k)}は未確認`);
  const feeVal=feeValueOf(spot.facts);
  /* 料金の表示方針（2026-11-28、Codex再レビューの指摘を受けて明文化）:
     解決した値があれば1つだけ表示する。値がなく、料金フィールド自体は
     あるスポットは「利用料金は未確認」と注意に出す。料金フィールドが
     そもそも無いスポット（公衆トイレ等、料金が意味を持たない種別が大半）
     には料金の表示も注意も出さない — 調査していない項目を「未確認」と
     並べると、本当に確認が必要な注意が埋もれるため。作業環境の料金行は
     作業スポットの項目として常時出す（未確認は未確認として表示）。 */
  if(!feeVal&&('price' in spot.facts||'fee_type' in spot.facts))unknown.push('利用料金は未確認');
  /* 詳細画面の事実表示は全セクションでタイル（まる囲み）に統一する
     （2026-11-28 現地レビュー指摘：セクションごとに表示形式が違うと読みにくい）。
     確認済み=白タイル+✓、未確認=グレー、否定（〜不可・なし）=赤系。 */
  const tile=(text,cls)=>`<span class="fact-tile${cls?' '+cls:''}">${esc(text)}</span>`;
  const factTile=(k,v)=>tile(factCopy(k,v),(v===null||v===undefined||v==='UNKNOWN')?'tile-unknown':(v===false?'tile-no':''));
  const textTile=(label,v)=>{const unk=v===null||v===undefined||v===''||v==='UNKNOWN';return tile(`${label}：${unk?'未確認':v}`,unk?'tile-unknown':'');};
  const feeTile=feeVal?factTile('fee_type',feeVal):'';
  const accessRows=`<div class="fact-grid">${ACCESS_KEYS.map(k=>factTile(k,spot.facts[k])).join('')}</div>`;
  const workSection=spot.facts.workspace===true?`<section><h2>作業環境</h2><div class="fact-grid">${['wifi_available','power_available','calls_allowed','food_allowed'].map(k=>factTile(k,spot.facts[k])).join('')}${factTile('fee_type',feeVal)}${textTile('時間制限',spot.facts.time_limit_note)}</div></section>`:'';
  const storageTypeText={LOCKER:'コインロッカー',STAFFED:'有人預かり',BOTH:'コインロッカー・有人預かりの両方'};
  const storageSection=spot.facts.luggage_storage===true?`<section><h2>荷物預かり</h2><div class="fact-grid">${textTile('種類',storageTypeText[spot.facts.storage_type]||null)}${textTile('ロッカーのサイズ',spot.facts.locker_sizes)}${factTile('suitcase_ok',spot.facts.suitcase_ok)}${textTile('料金目安',spot.facts.fee_from===null||spot.facts.fee_from===undefined?null:String(spot.facts.fee_from))}${spot.facts.fee_note?textTile('料金',spot.facts.fee_note):''}${textTile('支払い方法',spot.facts.payment_methods)}${factTile('ic_payment',spot.facts.ic_payment)}</div></section>`:'';
  return `${renderHeader('スポットの詳細')}
    <div class="detail-title"><span class="badge state-${e.kind}">${e.kind==='A'?'条件に一致':e.kind==='B'?'一部条件を確認できません':e.kind==='C'?'条件を広げると候補':'条件外'}</span><span class="official-mark">✓ 公式情報のみ</span><h2>${esc(spot.name)}</h2><p>${esc(spot.facility)}</p></div>
    <section><h2>場所</h2><p>${esc(spot.facility)}／${esc(spot.location)}</p>${floorLineHtml(spot)}<p>${esc(spot.walk.label)}（施設入口まで。館内移動は含みません）</p></section>
    <section><h2>特徴</h2><div class="fact-grid">${(()=>{const seen=new Set();return known.filter(([k,v])=>{const t=factCopy(k,v);if(seen.has(t))return false;seen.add(t);return true;}).map(([k,v])=>factTile(k,v)).join('');})()}${factTile('accessible_toilet',spot.facts.accessible_toilet)}${feeTile}</div></section>
    <section><h2>アクセス</h2>${accessRows}</section>
    ${workSection}${storageSection}
    <section><h2>利用時間</h2><p>${esc(spot.hours)}</p></section>
    ${unknown.length?`<div class="caution">⚠ ${esc(unknown.join('／'))}です。現地でご確認ください。</div>`:''}
    <section><p class="report-row"><a href="${reportUrl(spot)}" target="_blank" rel="noopener">この情報の誤りを報告する</a></p></section>
    <div class="sticky"><button class="primary" data-action="goUse">ここへ行く</button></div>`;
}
function microQuestion(){if(state.intent==='eat')return '持参した食べ物を食べられましたか？';if(state.intent==='rest')return '何も買わずに利用できましたか？';if(state.intent==='kids')return '対象年齢の条件を確認できましたか？';if(state.intent==='diaper')return '男性でもおむつ交換場所を使えましたか？';if(state.intent==='work')return '作業スペースとして使えましたか？';if(state.intent==='storage')return '荷物を預けられましたか？';return 'この設備を利用できましたか？';}
/* 利用確認の回答は運営に届くようにする（2026-11-28 本人決定A案）。
   専用Googleフォームへ送信し、あわせて端末内にも保存して、選んだボタンが
   色を変えたまま残るようにする（現地レビュー指摘：送信後に何を選んだか
   分からないのは困る。操作の結果が見える状態で残るのがUIの基本でもある）。
   送信先が未設定の間は送信しない（端末保存のみ）。 */
const CONFIRM_FORM={action:'https://docs.google.com/forms/d/e/1FAIpQLScN-F-SPLaEscjfMrBx2SyoyyuzAMHpxT8sMrpzt6GgDtfQ0A/formResponse',entries:{id:'entry.217740588',name:'entry.351391821',facility:'entry.1265105552',answer:'entry.614168269',detail:'entry.992854405'}};
function loadConfirmations(){try{return JSON.parse(localStorage.getItem('yasumiru.confirmations')||'{}');}catch(e){return{};}}
function saveConfirmation(id,rec){try{const all=loadConfirmations();all[id]=rec;localStorage.setItem('yasumiru.confirmations',JSON.stringify(all));}catch(e){}}
function clearConfirmation(id){try{const all=loadConfirmations();delete all[id];localStorage.setItem('yasumiru.confirmations',JSON.stringify(all));}catch(e){}}
function buildConfirmPost(spot,main,detail){if(!CONFIRM_FORM.action)return null;const p=new URLSearchParams();p.set(CONFIRM_FORM.entries.id,spot.id);p.set(CONFIRM_FORM.entries.name,spot.name);p.set(CONFIRM_FORM.entries.facility,spot.facility);p.set(CONFIRM_FORM.entries.answer,main==='worked'?'使えた':'情報と違った');p.set(CONFIRM_FORM.entries.detail,detail||'');return{url:CONFIRM_FORM.action,body:p.toString()};}
function sendConfirmation(spot,main,detail){const post=buildConfirmPost(spot,main,detail);if(!post)return Promise.resolve(false);return fetch(post.url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:post.body}).then(()=>true).catch(()=>false);}
function submitConfirmation(){const spot=SPOTS.find(s=>s.id===state.spotId);if(!spot)return;const rec={main:state.confirmMain,detail:state.confirmValue,at:new Date().toISOString().slice(0,10),sent:false};saveConfirmation(spot.id,rec);state.confirmSent=false;sendConfirmation(spot,rec.main,rec.detail).then(ok=>{if(ok){rec.sent=true;saveConfirmation(spot.id,rec);state.confirmSent=true;if(state.screen==='confirm')render();}});}
function renderConfirm(){const spot=SPOTS.find(s=>s.id===state.spotId);const c=state.confirmation;const main=state.confirmMain;const val=state.confirmValue;const sel=v=>v?' class="selected" aria-pressed="true"':'';const dis=c==='done'?' disabled':'';const mainRow=`<div class="choice"><button data-action="worked"${sel(main==='worked')}${dis}>使えた</button><button data-action="different"${sel(main==='different')}${dis}>情報と違った</button></div>`;const followW=(c==='worked'||(c==='done'&&main==='worked'))?`<div class="followup"><h3>${microQuestion()}</h3><div class="choice">${['はい','いいえ','わからない'].map(v=>`<button data-action="answer" data-value="${v}"${sel(val===v)}${dis}>${v}</button>`).join('')}</div></div>`:'';const followD=(c==='different'||(c==='done'&&main==='different'))?`<div class="followup"><h3>何が違いましたか？</h3><div class="reason-grid">${['閉まっていた','有料だった','購入が必要だった','持込できなかった','設備がなかった','営業時間が違った','対象条件が違った','その他'].map(v=>`<button data-action="reason" data-value="${v}"${sel(val===v)}${dis}>${v}</button>`).join('')}</div></div>`:'';const done=c==='done'?`<div class="done"><h3>回答済みです</h3><p>「${main==='worked'?'使えた':'情報と違った'}」${val?`（${esc(val)}）`:''}と回答しました。ありがとうございました。</p>${state.confirmSent?'<p>回答を運営に送信しました。「情報と違った」の回答は、運営が内容を確認して情報を直します。</p>':`<p>回答はこの端末に保存されましたが、運営への送信はできていません。</p><p><button class="secondary" data-action="resendConfirm">運営に送り直す</button></p>`}${main==='different'?`<p><a class="secondary report-link" href="${reportUrl(spot)}" target="_blank" rel="noopener">詳しい状況を報告フォームで送る</a></p>`:""}<p><button class="secondary" data-action="redoConfirm">回答を変える</button></p></div>`:'';return `${renderHeader('利用確認')}<section class="confirm"><h2>${esc(spot.name)}</h2><p>${esc(spot.facility)}</p><h2>この場所は使えましたか？</h2>${mainRow}${followW}${followD}${done}</section>`;}
function render(){if(!state.intent&&state.screen!=='home')state.screen='home';app.innerHTML=state.screen==='home'?renderHome():state.screen==='results'?renderResults():state.screen==='filter'?renderFilter():state.screen==='detail'?renderDetail():renderConfirm();window.scrollTo(0,0);}
app.addEventListener('click',ev=>{const btn=ev.target.closest('[data-action]');if(!btn)return;const a=btn.dataset.action;if(a==='intent')return chooseIntent(btn.dataset.id);if(a==='back')return backButton();if(a==='filter'){state.draft={filters:copy(state.filters),priceMode:state.priceMode,walkMinutes:state.walkMinutes};return enter('filter');}if(a==='resetDraft'){const f=copy(INTENTS[state.intent].conditions);state.draft={filters:f,priceMode:f.price==='must'?'freeOnly':f.price==='prefer'?'freePrefer':'includePaid',walkMinutes:10};return render();}if(a==='applyFilter'){state.draft.priceMode=document.querySelector('input[name="priceMode"]:checked').value;state.draft.walkMinutes=Number(document.getElementById('walkRange').value);document.querySelectorAll('[data-filter]').forEach(el=>state.draft.filters[el.dataset.filter]=el.value);state.filters=state.draft.filters;state.walkMinutes=state.draft.walkMinutes;state.priceMode=state.draft.priceMode;state.filters.price=state.priceMode==='freeOnly'?'must':state.priceMode==='freePrefer'?'prefer':'off';state.relaxed=new Set([...state.relaxed].filter(k=>state.filters[k]==='must'));state.screen='results';state.history.push({screen:'filter',spotId:null});state._pushed=(state._pushed||0)+1;history.pushState({screen:'results'},'','#results');return render();}if(a==='quickCondition')return cycleQuickCondition(btn.dataset.key);if(a==='chipCondition')return cycleChipCondition(btn.dataset.key);if(a==='relax'){state.relaxed.add(btn.dataset.key);return render();}if(a==='downgrade'){state.filters.indoor='prefer';state.relaxed.delete('indoor');return render();}if(a==='walk15'){state.walkMinutes=15;return render();}if(a==='pricePref'){state.priceMode='freePrefer';state.filters.price='prefer';return render();}if(a==='detail'){state.spotId=btn.dataset.id;return enter('detail');}if(a==='goUse'){const saved=loadConfirmations()[state.spotId];state.confirmMain=saved?saved.main:null;state.confirmValue=saved?saved.detail:null;state.confirmation=saved?'done':null;state.confirmSent=saved?!!saved.sent:null;const r=enter('confirm');return r;}if(a==='worked'||a==='different'){state.confirmMain=a;state.confirmValue=null;state.confirmation=a;return render();}if(a==='answer'||a==='reason'){state.confirmValue=btn.dataset.value;state.confirmation='done';submitConfirmation();return render();}if(a==='resendConfirm'){submitConfirmation();return render();}if(a==='redoConfirm'){clearConfirmation(state.spotId);state.confirmation=null;state.confirmMain=null;state.confirmValue=null;state.confirmSent=null;return render();}});
render();
