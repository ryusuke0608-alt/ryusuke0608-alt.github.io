/* OSM entrance nodes checked 2026-10-08. These are facility entrances, never Spot positions. */
const FACILITY_ENTRANCES = {
  '横浜美術館': {
    lat: 35.4572137, lon: 139.6308379, kind: 'FACILITY_ENTRANCE',
    precision: 'OSM entrance=main; building way 36213480',
    sourceUrl: 'https://www.openstreetmap.org/node/3731208821',
    buildingUrl: 'https://www.openstreetmap.org/way/36213480',
    officialAccessUrl: 'https://yokohama.art.museum/visit/access/', checkedAt: '2026-10-08'
  },
  'ランドマークプラザ': {
    lat: 35.4546616, lon: 139.6305033, kind: 'FACILITY_ENTRANCE',
    precision: 'OSM entrance=yes, level=1 (elevated pedestrian access); building way 45537790',
    sourceUrl: 'https://www.openstreetmap.org/node/2592725913',
    buildingUrl: 'https://www.openstreetmap.org/way/45537790',
    officialAccessUrl: 'https://yokohama-landmark.jp/access/', checkedAt: '2026-10-08'
  }
};
const UNRESOLVED_ENTRANCES = {
  'MARK IS みなとみらい': '公式アクセスページは施設を示すが入口座標は示さず、OSM建物 way 226663233 に入口タグ付きノードを確認できなかった。建物中心を入口に転用しない。'
};
const MANUAL_PRESETS = [
  {label:'横浜美術館 入口', facility:'横浜美術館'},
  {label:'ランドマークプラザ 歩行者入口（地上階ではありません）', facility:'ランドマークプラザ'}
];
const MAP_CONFIG = {
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
};
