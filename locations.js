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
  },
  '横浜ワールドポーターズ': {
    lat: 35.4536963, lon: 139.6400763, kind: 'FACILITY_ENTRANCE',
    precision: 'OSM entrance=yes (building east side); building way 72665070',
    sourceUrl: 'https://www.openstreetmap.org/node/5151493694',
    buildingUrl: 'https://www.openstreetmap.org/way/72665070',
    officialAccessUrl: 'https://www.yim.co.jp/static-pages/access', checkedAt: '2026-11-07'
  }
};
const UNRESOLVED_ENTRANCES = {
  'MARK IS みなとみらい': '公式アクセスページは施設を示すが入口座標は示さず、OSM建物 way 226663233 に入口タグ付きノードを確認できなかった。建物中心を入口に転用しない。',
  'クイーンズスクエア横浜': '公式アクセスページでは「みなとみらい駅」直結と分かるが入口座標は示されず、OSMで入口タグ付きノードを照合できなかった（2026-11-07）。建物中心を入口に転用しない。',
  'パシフィコ横浜': '公式アクセスページでは最寄り駅からの経路は分かるが入口座標は示されず、OSMで入口タグ付きノードを照合できなかった（2026-11-07）。建物中心を入口に転用しない。',
  'コレットマーレ': '公式アクセスページでは桜木町駅北改札直結と分かるが入口座標は示されず、OSM建物 way 72657833 の外周ノード全件に入口タグ付きノードがなかった（2026-11-07）。建物中心を入口に転用しない。'
};
const MANUAL_PRESETS = [
  {label:'横浜美術館 入口', facility:'横浜美術館'},
  {label:'ランドマークプラザ 歩行者入口（地上階ではありません）', facility:'ランドマークプラザ'},
  {label:'横浜ワールドポーターズ 入口（東側）', facility:'横浜ワールドポーターズ'}
];
const MAP_CONFIG = {
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
};
