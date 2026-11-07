/* WP8 fixed test fixtures. Facts are official-evidence candidates, not human ground truth. */
const CHECKED_AT = '2026-10-07';
const SOURCES = {
  museumArea: {url:'https://yokohama.art.museum/about/vision/jiyu-area/', type:'施設公式HTML', ref:'「じゆうエリア」内の「まるまるラウンジ」：テーブル・椅子、館内の無料エリア', checked:CHECKED_AT},
  museumRelease: {url:'https://yokohama.art.museum/wp-content/uploads/2025/02/20250207_pressrelease_full-open.pdf', type:'施設公式PDF', ref:'「じゆうエリア」：チケット不要で自由に過ごせる旨', checked:CHECKED_AT},
  museumTips: {url:'https://yokohama.art.museum/visit/tips/', type:'施設公式HTML', ref:'休憩場所での飲み物と展示室の飲食に関する案内。食事・持込可の根拠にはしない', checked:CHECKED_AT},
  museumInfo: {url:'https://yokohama.art.museum/visit/info/', type:'施設公式HTML', ref:'開館時間・休館日案内。訪問前に更新を確認', checked:CHECKED_AT},
  museumAccess: {url:'https://yokohama.art.museum/visit/access/', type:'施設公式HTML', ref:'みなとみらい駅3番出口から美術館まで徒歩約3分', checked:CHECKED_AT},
  markGuide: {url:'https://www.mec-markis.jp/mm/about.html', type:'施設公式HTML', ref:'4Fフードコート、450席以上。購入不要・館外食品の可否は未記載', checked:CHECKED_AT},
  markAccess: {url:'https://www.mec-markis.jp/mm/access.html', type:'施設公式HTML', ref:'みなとみらい駅直結', checked:CHECKED_AT},
  kids: {url:'https://www.mec-markis.jp/mm/shop/detail/?act=8173', type:'施設公式HTML', ref:'3F「あそラボ」無料のキッズスペース、10:00–20:00。対象年齢の明示は確認できず', checked:CHECKED_AT},
  landmarkBaby: {url:'https://yokohama-landmark.jp/kids_baby/', type:'施設公式HTML', ref:'4Fベビールーム。おむつ交換スペースは男女ともに入室可能。授乳室とは場所を分ける', checked:CHECKED_AT},
  landmarkAccess: {url:'https://yokohama-landmark.jp/access/', type:'施設公式HTML', ref:'みなとみらい駅から徒歩約3分', checked:CHECKED_AT},
};
const SPOTS = [
  {id:'museum-lounge', name:'まるまるラウンジ', facility:'横浜美術館', location:'館内・グランドギャラリー前', floor:'階数は公式根拠で未確認', walk:{minutes:3,label:'施設入口まで約3分'}, hours:'10:00–18:00（休館日・変更あり）', facts:{seating:true,free_seating:true,indoor:true,purchase_required:false,eating_allowed:null,outside_food_allowed:null,current_available:null,price:'FREE'}, evidence:{seating:'museumArea',free_seating:'museumArea',indoor:'museumArea',purchase_required:'museumRelease',eating_allowed:'museumTips',outside_food_allowed:'museumTips',price:'museumArea',walk:'museumAccess',hours:'museumInfo'}, note:'飲み物の案内から食事・持込可は推定していません。'},
  {id:'mark-food', name:'4F フードコート', facility:'MARK IS みなとみらい', location:'4F', floor:'4F', walk:{direct:true,label:'駅直結（館内移動は別）'}, hours:'営業時間は今回のSpot根拠では未確認', facts:{seating:true,free_seating:null,indoor:true,purchase_required:null,eating_allowed:true,outside_food_allowed:null,current_available:null,price:'UNKNOWN'}, evidence:{seating:'markGuide',indoor:'markGuide',eating_allowed:'markGuide',walk:'markAccess'}, note:'席の存在や飲食用途から、購入不要・持込可能を推定していません。'},
  {id:'mark-kids', name:'キッズスペース「あそラボ」', facility:'MARK IS みなとみらい', location:'3F', floor:'3F', walk:{direct:true,label:'駅直結（館内移動は別）'}, hours:'10:00–20:00（変更の可能性あり）', facts:{kids_space:true,indoor:true,price:'FREE',purchase_required:null,age_eligibility:null,current_available:null}, evidence:{kids_space:'kids',indoor:'kids',price:'kids',walk:'markAccess',hours:'kids'}, note:'対象年齢は公式根拠で確認できていません。'},
  {id:'landmark-diaper', name:'4F おむつ交換スペース', facility:'ランドマークプラザ', location:'4F ベビールーム内のおむつ交換スペース', floor:'4F', walk:{minutes:3,label:'施設入口まで約3分'}, hours:'9:30–20:30（変更の可能性あり）', facts:{diaper_table:true,male_accessible:true,indoor:true,price:'UNKNOWN',current_available:null}, evidence:{diaper_table:'landmarkBaby',male_accessible:'landmarkBaby',indoor:'landmarkBaby',walk:'landmarkAccess',hours:'landmarkBaby'}, note:'男性入室可の根拠はおむつ交換スペースに限ります。'},
  {id:'landmark-nursing', name:'4F 授乳室', facility:'ランドマークプラザ', location:'4F ベビールーム内の授乳室', floor:'4F', walk:{minutes:3,label:'施設入口まで約3分'}, hours:'9:30–20:30（変更の可能性あり）', facts:{nursing_room:true,indoor:true,price:'UNKNOWN',current_available:null}, evidence:{nursing_room:'landmarkBaby',indoor:'landmarkBaby',walk:'landmarkAccess',hours:'landmarkBaby'}, note:'おむつ交換スペースの男性入室条件を授乳室に転用していません。'},
  {id:'landmark-toilet', name:'4F 多目的トイレ', facility:'ランドマークプラザ', location:'4F 中央エスカレーター付近', floor:'4F', walk:{minutes:3,label:'施設入口まで約3分'}, hours:'今回のSpot根拠では未確認', facts:{toilet:true,accessible_toilet:true,indoor:true,current_available:null}, evidence:{toilet:'landmarkBaby',accessible_toilet:'landmarkBaby',indoor:'landmarkBaby',walk:'landmarkAccess'}, note:'現時点で使用可能かは未確認です。'}
];
