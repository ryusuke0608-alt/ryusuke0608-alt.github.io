const INTENTS = {
  toilet:{icon:'🚻',label:'トイレ',conditions:{toilet:'must',walk:'must'}},
  rest:{icon:'🪑',label:'休みたい',conditions:{price:'must',indoor:'must',purchaseNo:'must',seating:'must',walk:'must'}},
  eat:{icon:'🍙',label:'食べたい',conditions:{seating:'must',eating:'must',outsideFood:'must',price:'prefer',indoor:'prefer',walk:'must'}},
  nursing:{icon:'🍼',label:'授乳したい',conditions:{nursing:'must',walk:'must'}},
  diaper:{icon:'🚼',label:'おむつを替えたい',conditions:{diaper:'must',male:'must',walk:'must'}},
  kids:{icon:'🧸',label:'子どもを遊ばせたい',conditions:{kids:'must',price:'must',indoor:'must',age:'prefer',walk:'must'}}
};
const CONDS = {
  price:{label:'無料',attr:'price'}, indoor:{label:'屋内',attr:'indoor'}, purchaseNo:{label:'購入不要',attr:'purchase_required'},
  seating:{label:'座席あり',attr:'seating'}, current:{label:'現在利用可能',attr:'current_available'}, walk:{label:'徒歩範囲',attr:'walk'},
  eating:{label:'飲食可能',attr:'eating_allowed'}, outsideFood:{label:'持込飲食可能',attr:'outside_food_allowed'},
  male:{label:'男性も利用可能',attr:'male_accessible'}, diaper:{label:'おむつ交換',attr:'diaper_table'},
  nursing:{label:'授乳室',attr:'nursing_room'}, kids:{label:'キッズスペース',attr:'kids_space'}, age:{label:'対象年齢',attr:'age_eligibility'},
  toilet:{label:'トイレ',attr:'toilet'}
};
const QUICK_CONDS = {rest:['price','indoor','purchaseNo','walk'],eat:['seating','outsideFood','price','indoor','walk'],diaper:['male','price','walk'],nursing:['nursing','price','walk'],kids:['price','indoor','age','walk'],toilet:['toilet','walk']};
const ATTRS = {seating:'座席',free_seating:'無料で座れる',indoor:'屋内',purchase_required:'購入が必要',eating_allowed:'飲食可能',outside_food_allowed:'持込飲食可能',current_available:'現在の利用可否',price:'利用料金',kids_space:'キッズスペース',age_eligibility:'対象年齢',diaper_table:'おむつ交換台',male_accessible:'男性も利用可能',nursing_room:'授乳室',toilet:'トイレ',accessible_toilet:'多目的トイレ'};
const app = document.getElementById('app');
const state = {screen:'home',intent:null,filters:{},draft:null,priceMode:'freeOnly',walkMinutes:10,relaxed:new Set(),spotId:null,detailFrom:'results',confirmation:null,history:[],origin:null,originMessage:'',selectedSpotId:null};
const copy = x => JSON.parse(JSON.stringify(x));
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function enter(screen){state.history.push({screen:state.screen,spotId:state.spotId});state.screen=screen;history.pushState({screen},'',`#${screen}`);render();}
function back(){const prev=state.history.pop();if(prev){state.screen=prev.screen;state.spotId=prev.spotId;render();}else{state.screen='home';render();}}
window.addEventListener('popstate',()=>back());
function chooseIntent(intent){state.intent=intent;state.filters=copy(INTENTS[intent].conditions);state.priceMode=state.filters.price==='must'?'freeOnly':state.filters.price==='prefer'?'freePrefer':'includePaid';state.walkMinutes=10;state.relaxed=new Set();state.history=[{screen:'home',spotId:null}];state.screen='results';history.pushState({screen:'results'},'','#results');render();}
function supportsIntent(spot){const f=spot.facts;switch(state.intent){case 'rest':case 'eat':return f.seating===true;case 'diaper':return f.diaper_table===true;case 'kids':return f.kids_space===true;case 'nursing':return f.nursing_room===true;case 'toilet':return f.toilet===true;default:return false;}}
function condValue(spot,key){const f=spot.facts;switch(key){
  case 'price': return f.price==='FREE' ? 'yes' : f.price==='PAID' ? 'no' : f.price==='CONDITIONAL_FREE' ? 'conditional' : 'unknown';
  case 'purchaseNo':return f.purchase_required===false?'yes':f.purchase_required===true?'no':'unknown';
  case 'walk':return 'unknown'; // dynamic origin has no verified walking route or duration
  case 'age':return f.age_eligibility===true?'yes':f.age_eligibility===false?'no':'unknown';
  default:{const v=f[CONDS[key].attr];return v===true?'yes':v===false?'no':'unknown';}
}}
function condText(key,status){if(status==='yes')return `${CONDS[key].label} ✓`;if(status==='no')return `${CONDS[key].label}：条件外`;if(status==='conditional')return `${CONDS[key].label}：条件付き`;return `${CONDS[key].label}：未確認`;}
function evaluate(spot){let missing=[],negative=[],relaxedMissing=[],soft=[];for(const [key,mode] of Object.entries(state.filters)){if(mode==='off')continue;const v=condValue(spot,key);if(mode==='prefer'){if(v!=='yes')soft.push({key,v});continue;}if(v==='no'){negative.push(key);continue;}if(v!=='yes'){if(state.relaxed.has(key))relaxedMissing.push({key,v});else missing.push({key,v});}}
  if(negative.length)return {kind:'D',negative,missing,soft};
  if(missing.length)return {kind:'B',missing,soft};
  if(relaxedMissing.length)return {kind:'C',missing:relaxedMissing,soft};
  return {kind:'A',missing:[],soft};
}
function activeChips(){return Object.entries(state.filters).filter(([,v])=>v!=='off').map(([k,v])=>`<span class="chip ${state.relaxed.has(k)?'relaxed':''}">${esc(CONDS[k].label)}${k==='walk'?` ${state.walkMinutes}分`:''} · ${state.relaxed.has(k)?'未確認も含む':v==='must'?'必須':'できれば'}</span>`).join('');}
function quickConditions(){const keys=QUICK_CONDS[state.intent]||[];return `<section class="quick-conditions"><h2>よく使う条件</h2><p class="muted">タップで「必須 → できれば → 指定なし」を切り替えます。</p><div class="quick-grid">${keys.map(k=>{const mode=state.filters[k]||'off';const next=mode==='must'?'できれば':mode==='prefer'?'指定なし':'必須';const label=CONDS[k].label+(k==='walk'?` ${state.walkMinutes}分`:'');return `<button class="quick-button mode-${mode}" data-action="quickCondition" data-key="${k}" aria-label="${esc(label)}：${mode==='must'?'必須':mode==='prefer'?'できれば':'指定なし'}。タップで${next}に変更"><strong>${esc(label)}</strong><span>${mode==='must'?'必須':mode==='prefer'?'できれば':'指定なし'}</span></button>`}).join('')}</div></section>`;}
function cycleQuickCondition(key){const mode=state.filters[key]||'off';const next=mode==='must'?'prefer':mode==='prefer'?'off':'must';state.filters[key]=next;if(key==='price')state.priceMode=next==='must'?'freeOnly':next==='prefer'?'freePrefer':'includePaid';if(next!=='must')state.relaxed.delete(key);render();}
function unknownName(k){return k==='purchase_required'?'購入不要':ATTRS[k]||k;}
function unknownSummary(spot){const unknown=Object.entries(spot.facts).filter(([k,v])=>k!=='current_available'&&(v===null||v==='UNKNOWN')).map(([k])=>`${unknownName(k)}：未確認`);return unknown.length?`<p class="evidence-unknown">${esc(unknown.join('／'))}</p>`:'';}
function renderHeader(title,backTo=true){return `<header class="top">${backTo?'<button class="icon-btn" data-action="back" aria-label="戻る">←</button>':''}<div><small>みなとみらい · Product Test</small><h1>${title}</h1></div></header>`;}
function renderHome(){return `${renderHeader('今、何したい？',false)}<section class="intro"><p>今いる場所：みなとみらい駅</p><p class="muted">施設入口までの徒歩目安です。館内移動と現在の空き状況は未確認です。</p></section><section class="intent-grid">${Object.entries(INTENTS).map(([id,i])=>`<button class="intent" data-action="intent" data-id="${id}"><span aria-hidden="true">${i.icon}</span><strong>${i.label}</strong><span class="arrow">→</span></button>`).join('')}</section><p class="footnote">公式公開情報を使った検証用試作品。最新の営業状況は現地で確認してください。</p>`;}
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
function evaluateWithRelax(spot,key){const v=condValue(spot,key);if(v==='no')return 'D';for(const [k,mode] of Object.entries(state.filters)){if(mode!=='must'||k===key||state.relaxed.has(k))continue;const other=condValue(spot,k);if(other==='no'||other==='unknown'||other==='conditional')return 'B';}return 'C';}
function renderFilter(){const keys=Object.keys(CONDS).filter(k=>Object.prototype.hasOwnProperty.call(INTENTS[state.intent].conditions,k)||['price','indoor','purchaseNo','seating','walk'].includes(k));return `${renderHeader('条件を選ぶ')}<p class="muted pad">「必須」は確認できた候補を優先します。「できれば」は未確認でも候補に残します。</p><section class="filter-section"><h2>利用料金</h2><div class="radio-row">${[['freeOnly','無料のみ'],['freePrefer','無料優先'],['includePaid','有料も含む']].map(([v,t])=>`<label><input type="radio" name="priceMode" value="${v}" ${state.draft.priceMode===v?'checked':''}>${t}</label>`).join('')}</div><p class="muted">料金不明は「無料」と扱いません。</p></section><section class="filter-section"><h2>条件</h2>${keys.filter(k=>k!=='price').map(k=>`<label class="filter-row"><span>${esc(CONDS[k].label)}</span><select data-filter="${k}"><option value="off" ${state.draft.filters[k]==='off'||!state.draft.filters[k]?'selected':''}>指定しない</option><option value="must" ${state.draft.filters[k]==='must'?'selected':''}>必須</option><option value="prefer" ${state.draft.filters[k]==='prefer'?'selected':''}>できれば</option></select></label>`).join('')}<label class="filter-row"><span>徒歩範囲</span><select id="walkRange">${[5,10,15].map(n=>`<option value="${n}" ${state.draft.walkMinutes===n?'selected':''}>${n}分</option>`).join('')}</select></label></section><div class="sticky"><button class="primary" data-action="applyFilter">この条件で探す</button></div>`;}
function factCopy(k,v){const label=ATTRS[k]||k;if(v===null||v==='UNKNOWN')return `${unknownName(k)}：未確認`;if(v==='FREE')return '無料';if(v==='CONDITIONAL_FREE')return '条件付き無料';if(v==='PAID')return '有料';const yes={seating:'座席あり',free_seating:'無料で座れる',indoor:'屋内',purchase_required:'購入が必要',eating_allowed:'飲食可能',outside_food_allowed:'持込飲食可能',kids_space:'キッズスペースあり',diaper_table:'おむつ交換台あり',male_accessible:'男性も利用可能',nursing_room:'授乳室あり',toilet:'トイレあり',accessible_toilet:'多目的トイレあり'};const no={seating:'座席なし',free_seating:'無料では座れない',indoor:'屋内ではない',purchase_required:'購入不要',eating_allowed:'飲食不可',outside_food_allowed:'持込飲食不可',kids_space:'キッズスペースなし',diaper_table:'おむつ交換台なし',male_accessible:'男性は利用不可',nursing_room:'授乳室なし',toilet:'トイレなし',accessible_toilet:'多目的トイレなし'};return v===true?(yes[k]||`${label}：はい`):(no[k]||`${label}：いいえ`);}
function candidateReasonText(spot,key){
  if(key==='walk')return spot.walk.direct?'駅直結 ✓':`徒歩${state.walkMinutes}分以内 ✓`;
  const labels={toilet:'トイレあり',diaper:'おむつ交換台あり'};
  return `${labels[key]||CONDS[key].label} ✓`;
}
function unknownQuestion(k){
  const questions={free_seating:'無料で座れるか',purchase_required:'購入不要か',eating_allowed:'飲食可能か',outside_food_allowed:'持込飲食可能か',price:'利用料金',age_eligibility:'対象年齢',current_available:'現在の利用可否'};
  return questions[k]||`${unknownName(k)}か`;
}
function renderDetail(){
  const spot=SPOTS.find(s=>s.id===state.spotId);
  if(!spot)return renderResults();
  const e=evaluate(spot);
  const reasons=Object.entries(state.filters).filter(([k,mode])=>mode!=='off'&&condValue(spot,k)==='yes').map(([k])=>candidateReasonText(spot,k));
  const known=Object.entries(spot.facts).filter(([,v])=>v!==null&&v!=='UNKNOWN');
  const unknown=Object.entries(spot.facts).filter(([,v])=>v===null||v==='UNKNOWN').map(([k])=>`${unknownQuestion(k)}：未確認`);
  return `${renderHeader('Spotの詳細')}
    <div class="detail-title"><span class="badge state-${e.kind}">${e.kind==='A'?'条件に一致':e.kind==='B'?'一部条件を確認できません':e.kind==='C'?'条件を広げると候補':'条件外'}</span><h2>${esc(spot.name)}</h2><p>${esc(spot.facility)}</p></div>
    <section><h2>利用条件</h2><div class="status-list">${known.map(([k,v])=>`<div class="status-row"><span class="fact-copy">${esc(factCopy(k,v))}</span></div>`).join('')}</div><p class="muted">${esc(spot.note)}</p></section>
    <section><h2>未確認事項</h2>${unknown.length?`<div class="status-list">${unknown.map(item=>`<div class="status-row"><span class="fact-copy evidence-unknown">${esc(item)}</span></div>`).join('')}</div>`:'<p class="muted">未確認事項はありません。</p>'}<p class="muted">現時点の営業・空き・一時休止は未確認です。</p></section>
    <section><h2>この場所が候補の理由</h2>${reasons.length?`<div class="status-list">${reasons.map(reason=>`<div class="status-row"><strong>${esc(reason)}</strong></div>`).join('')}</div>`:'<p class="muted">今回の条件で確認できた一致項目はありません。</p>'}</section>
    <section><h2>利用時間</h2><p>${esc(spot.hours)}</p><p class="muted">${spot.evidence.hours?'表示した利用時間は公式案内に基づきます。':'このSpotの利用時間は公式根拠で未確認です。'}</p></section>
    <section><h2>情報の根拠</h2><details><summary>情報の根拠を見る</summary><h3>属性別の確認状況</h3>${Object.entries(spot.facts).map(([k,v])=>`<div class="evidence-status"><strong>${esc(ATTRS[k]||k)}：</strong>${spot.evidence[k]&&v!==null&&v!=='UNKNOWN'?'公式情報で確認':'未確認'}${v===null||v==='UNKNOWN'?' — 現地または施設への確認が必要':''}</div>`).join('')}${Object.entries(spot.evidence).map(([k,id])=>{const src=SOURCES[id];return `<div class="source"><strong>${esc(ATTRS[k]||k)}</strong> · ${esc(src.type)}<br><a href="${esc(src.url)}" target="_blank" rel="noopener">公式ページを開く ↗</a><br><span>${esc(src.ref)}</span><br><small>確認日：${esc(src.checked)}</small></div>`}).join('')}<p class="muted">根拠のない属性は「未確認」です。現在の利用可否は未確認です。</p></details></section>
    <section><h2>場所</h2><p>${esc(spot.facility)}／${esc(spot.location)}</p><p>階：${esc(spot.floor)}</p><p>${esc(spot.walk.label)}（施設入口まで。館内移動は含みません）</p></section>
    <div class="sticky"><button class="primary" data-action="goUse">ここへ行く</button></div>`;
}
function microQuestion(){if(state.intent==='eat')return '持参した食べ物を食べられましたか？';if(state.intent==='rest')return '何も買わずに利用できましたか？';if(state.intent==='kids')return '対象年齢の条件を確認できましたか？';if(state.intent==='diaper')return '男性でもおむつ交換場所を使えましたか？';return 'この設備を利用できましたか？';}
function renderConfirm(){const spot=SPOTS.find(s=>s.id===state.spotId);const c=state.confirmation;return `${renderHeader('利用確認')}<section class="confirm"><h2>${esc(spot.name)}</h2><p>${esc(spot.facility)}</p><h2>この場所は使えましたか？</h2><div class="choice"><button data-action="worked">使えた</button><button data-action="different">情報と違った</button></div>${c==='worked'?`<div class="followup"><h3>${microQuestion()}</h3><div class="choice">${['はい','いいえ','わからない'].map(v=>`<button data-action="answer" data-value="${v}">${v}</button>`).join('')}</div></div>`:''}${c==='different'?`<div class="followup"><h3>何が違いましたか？</h3><div class="reason-grid">${['閉まっていた','有料だった','購入が必要だった','持込できなかった','設備がなかった','営業時間が違った','対象条件が違った','その他'].map(v=>`<button data-action="reason" data-value="${v}">${v}</button>`).join('')}</div></div>`:''}${c==='done'?'<div class="done"><h3>回答を確認しました</h3><p>この試作品は回答を保存・送信しません。テスト担当者が別途記録してください。</p></div>':''}</section>`;}
function render(){if(!state.intent&&state.screen!=='home')state.screen='home';app.innerHTML=state.screen==='home'?renderHome():state.screen==='results'?renderResults():state.screen==='filter'?renderFilter():state.screen==='detail'?renderDetail():renderConfirm();window.scrollTo(0,0);}
app.addEventListener('click',ev=>{const btn=ev.target.closest('[data-action]');if(!btn)return;const a=btn.dataset.action;if(a==='intent')return chooseIntent(btn.dataset.id);if(a==='back')return back();if(a==='filter'){state.draft={filters:copy(state.filters),priceMode:state.priceMode,walkMinutes:state.walkMinutes};return enter('filter');}if(a==='applyFilter'){state.draft.priceMode=document.querySelector('input[name="priceMode"]:checked').value;state.draft.walkMinutes=Number(document.getElementById('walkRange').value);document.querySelectorAll('[data-filter]').forEach(el=>state.draft.filters[el.dataset.filter]=el.value);state.filters=state.draft.filters;state.walkMinutes=state.draft.walkMinutes;state.priceMode=state.draft.priceMode;state.filters.price=state.priceMode==='freeOnly'?'must':state.priceMode==='freePrefer'?'prefer':'off';state.relaxed=new Set([...state.relaxed].filter(k=>state.filters[k]==='must'));state.screen='results';state.history.push({screen:'filter',spotId:null});history.pushState({screen:'results'},'','#results');return render();}if(a==='quickCondition')return cycleQuickCondition(btn.dataset.key);if(a==='relax'){state.relaxed.add(btn.dataset.key);return render();}if(a==='downgrade'){state.filters.indoor='prefer';state.relaxed.delete('indoor');return render();}if(a==='walk15'){state.walkMinutes=15;return render();}if(a==='pricePref'){state.priceMode='freePrefer';state.filters.price='prefer';return render();}if(a==='detail'){state.spotId=btn.dataset.id;return enter('detail');}if(a==='goUse'){state.confirmation=null;return enter('confirm');}if(a==='worked'||a==='different'){state.confirmation=a;return render();}if(a==='answer'||a==='reason'){state.confirmation='done';return render();}});
render();
