/* 施設写真: Wikimedia Commons の自由ライセンス画像のみ（Wikidata 代表画像 P18 から取得し、
   ライセンスと作者を確認できたものだけ）。写真が無い施設は表示しない。
   取得手順: work/harvest-photos.js（再実行で work/facility-photos.json を更新し、ここへ反映する）。
   ※改善案件 #18（2026-11-10）の教訓により locations.js から分離した専用ファイル。
   座標付けスクリプトは locations.js 全体を書き換えるため、共有ファイルに写真を置かない。 */
const FACILITY_PHOTOS = {
  "MARINE & WALK YOKOHAMA": {file:"MARINE & WALK YOKOHAMA 05.jpg",license:"CC0",credit:"NEO-NEED"},
  "ララガーデン川口": {file:"LaLa garden Kawaguchi 001.JPG",license:"CC BY-SA 3.0",credit:"第四京浜"},
  "大丸東京店": {file:"GranTokyo North Tower.JPG",license:"CC BY-SA 3.0",credit:"Kakidai"},
  "GINZA SIX": {file:"GINZA SIX2a.jpg",license:"CC BY-SA 4.0",credit:"江戸村のとくぞう"},
  "京橋トラストタワー": {file:"京橋トラストタワー.jpg",license:"CC0",credit:"Syced"},
  "松坂屋上野店": {file:"Ueno matsuzakaya 20230127.jpg",license:"CC0",credit:"妖精書士"},
  "MIYASHITA PARK": {file:"MIYASHITA PARK 2025年1月22日の渋谷 202501221309 IMG 2541.jpg",license:"CC BY-SA 4.0",credit:"ウィ貴公子"},
  "ルミネ池袋": {file:"1 Chome Nishiikebukuro, Toshima-ku, Tōkyō-to 171-0021, Japan - panoramio (1).jpg",license:"CC BY 3.0",credit:"運転太郎"},
  "西武池袋本店": {file:"Seibu Ikebukuro Main Store (1).jpg",license:"CC BY-SA 4.0",credit:"Kakidai"},
  "池袋PARCO": {file:"Ikebukuro PARCO 2017-10-26.jpg",license:"CC0",credit:"Asanagi"},
  "北千住マルイ": {file:"Senju mildix I.jpg",license:"CC0",credit:"Saoyagi2"},
  "千住ミルディス": {file:"Senju mildix I.jpg",license:"CC0",credit:"Saoyagi2"},
  "足立区立中央図書館": {file:"Adachi manabi-pia 2.jpg",license:"CC0",credit:"Saoyagi2"},
  "伊勢丹立川店": {file:"Isetan Tachikawa 0804.jpg",license:"CC BY-SA 3.0",credit:"User:ITA-ATU"},
};
