/**
 * Railway Hub Configurations & Event Engine (hub_configs.js)
 * Defines window.HUB_CONFIGS for Beijing-Tianjin (jingjin) and Shanghai (shanghai) hubs,
 * camera presets, key auxiliary posts, corridor annotations, and computeHubEvents() analysis.
 */
(function (root) {
  'use strict';

  const HUB_CONFIGS = {
    // -------------------------------------------------------------------------
    // 1. 京津铁路枢纽 (Beijing-Tianjin Railway Hub)
    // -------------------------------------------------------------------------
    jingjin: {
      id: 'jingjin',
      title: '京津铁路枢纽',
      subtitle: 'BEIJING-TIANJIN RAILWAY HUB',
      summaryStations: '北京南 · 北京西 · 北京 · 丰台 · 朝阳 · 清河 · 天津 · 天津西',
      bbox: [115.85, 38.92, 117.75, 40.25], // [west, south, east, north]
      center: [39.56, 116.75],               // [lat, lon]
      zoom: 9.4,                             // 16:9 main map overview zoom

      majorStations: [
        '北京南', '北京西', '北京', '北京丰台',
        '北京朝阳', '天津', '天津西', '清河'
      ],

      enName: {
        '北京南': 'BEIJING SOUTH',
        '北京西': 'BEIJING WEST',
        '北京': 'BEIJING',
        '北京丰台': 'BEIJING FENGTAI',
        '北京朝阳': 'BEIJING CHAOYANG',
        '天津': 'TIANJIN',
        '天津西': 'TIANJIN WEST',
        '清河': 'QINGHE',
        '北京北': 'BEIJING NORTH',
        '天津南': 'TIANJIN SOUTH',
        '大兴机场': 'DAXING AIRPORT',
        '武清': 'WUQING',
        '廊坊': 'LANGFANG',
        '滨海': 'BINHAI',
        '亦庄': 'YIZHUANG',
        '塘沽': 'TANGGU',
        '滨海西': 'BINHAI WEST',
        '雄安': 'XIONG\'AN',
        '昌平': 'CHANGPING',
        '怀柔南': 'HUAIROU SOUTH',
        '白洋淀': 'BAIYANGDIAN',
        '高碑店东': 'GAOBEIDIAN EAST',
        '涿州东': 'ZHUOZHOU EAST'
      },

      arrivalBoardStations: ['北京南', '北京西', '北京', '天津', '天津西'],
      departureBoardStations: ['北京南', '北京西', '北京丰台', '北京朝阳', '天津'],
      minorStations: ['北京北', '天津南', '大兴机场', '武清', '廊坊', '滨海', '亦庄'],

      // Key aux junctions / posts in Beijing-Tianjin
      keyAuxPosts: [
        '柳村所', '李营所', '杜家坎所', '高辛庄所',
        '北刘各庄所', '南仓所', '京津所', '津沪所', '七间房所'
      ],

      auxCoords: {
        '柳村所': [39.85358, 116.33236],
        '李营所': [39.77580, 116.30751],
        '杜家坎所': [39.83698, 116.20737],
        '高辛庄所': [39.92654, 116.73388],
        '北刘各庄所': [39.93327, 116.76082],
        '南仓所': [39.21045, 117.16879],
        '京津所': [39.18206, 117.04906],
        '津沪所': [39.10966, 117.05820],
        '七间房所': [40.21311, 116.16662]
      },

      // Static map corridor text annotations positioned near tracks
      corridorLabels: [
        { text: '京津城际', lat: 39.58, lon: 116.85, color: '#e8892b', angle: -37 },
        { text: '京沪高铁', lat: 39.25, lon: 116.92, color: '#b0272f', angle: -65 },
        { text: '京广高铁', lat: 39.62, lon: 116.10, color: '#b0272f', angle: -63 },
        { text: '京张高铁', lat: 40.18, lon: 116.18, color: '#b0272f', angle: 52 },
        { text: '京哈高铁', lat: 40.08, lon: 116.68, color: '#b0272f', angle: 38 },
        { text: '京雄城际', lat: 39.38, lon: 116.38, color: '#e8892b', angle: -82 },
        { text: '津秦高铁', lat: 39.18, lon: 117.48, color: '#b0272f', angle: 28 }
      ],

      // 7 Curated camera presets for top-right inset zoom window
      insets: [
        {
          id: 1,
          name: '北京地下直径线 · 北京—北京西—丰台咽喉',
          center: [39.882, 116.355],
          zoom: 12.3,
          scaleLabel: '2 km',
          desc: '穿越前三门地下隧道，直通京广与京哈两大动脉'
        },
        {
          id: 2,
          name: '北京南 · 李营所—柳村所 (京沪/京津/京雄分流)',
          center: [39.825, 116.345],
          zoom: 12.2,
          scaleLabel: '2 km',
          desc: '京津城际、京沪高铁、京雄城际立体交汇咽喉'
        },
        {
          id: 3,
          name: '天津枢纽 · 南仓所—京津所—津沪所—天津西/天津',
          center: [39.155, 117.135],
          zoom: 11.8,
          scaleLabel: '2 km',
          desc: '京津城际联络线与京沪正线、津霸客专立体交织'
        },
        {
          id: 4,
          name: '北京丰台 · 杜家坎所 (京广高铁/京广普速/丰沙交汇)',
          center: [39.848, 116.255],
          zoom: 12.4,
          scaleLabel: '1 km',
          desc: '高架高铁与地面普速立体双层车场入喉分流'
        },
        {
          id: 5,
          name: '北京朝阳 · 高辛庄所—北刘各庄所 (京哈高铁咽喉)',
          center: [39.935, 116.630],
          zoom: 11.8,
          scaleLabel: '2 km',
          desc: '京哈高铁出京跨五环与东北环线编组客货交错'
        },
        {
          id: 6,
          name: '北京北 · 清河—七间房所 (京张高铁出京走廊)',
          center: [40.045, 116.290],
          zoom: 11.5,
          scaleLabel: '3 km',
          desc: '京张高铁与市郊铁路S2线共走廊翻越燕山余脉'
        },
        {
          id: 7,
          name: '滨海走廊 · 天津—塘沽—滨海/滨海西',
          center: [39.045, 117.630],
          zoom: 11.8,
          scaleLabel: '2 km',
          desc: '京津城际滨海延伸线与津秦高铁交汇渤海湾'
        }
      ],

      // Default station sequence for micro time-space diagram
      diagramSection: {
        title: '京津城际·京沪走廊断面',
        stations: ['北京南', '亦庄', '廊坊', '武清', '天津西', '天津', '天津南', '滨海']
      }
    },

    // -------------------------------------------------------------------------
    // 2. 上海铁路枢纽 (Shanghai Railway Hub)
    // -------------------------------------------------------------------------
    shanghai: {
      id: 'shanghai',
      title: '上海铁路枢纽',
      subtitle: 'SHANGHAI RAILWAY HUB',
      summaryStations: '上海虹桥 · 上海南 · 上海松江 · 上海',
      bbox: [120.80, 30.65, 121.95, 31.60], // [west, south, east, north]
      center: [31.18, 121.36],               // [lat, lon]
      zoom: 9.7,                             // 16:9 main map overview zoom

      majorStations: [
        '上海虹桥', '上海', '上海松江', '上海南'
      ],

      enName: {
        '上海虹桥': 'SHANGHAI HONGQIAO',
        '上海': 'SHANGHAI',
        '上海松江': 'SHANGHAI SONGJIANG',
        '上海南': 'SHANGHAI SOUTH',
        '安亭北': 'ANTING NORTH',
        '安亭西': 'ANTING WEST',
        '南翔北': 'NANXIANG NORTH',
        '上海西': 'SHANGHAI WEST',
        '金山北': 'JINSHAN NORTH',
        '莘庄': 'XINZHUANG',
        '练塘': 'LIANTANG',
        '金山卫': 'JINSHANWEI',
        '春申': 'CHUNSHEN',
        '昆山南': 'KUNSHAN SOUTH',
        '嘉善南': 'JIASHAN SOUTH',
        '太仓': 'TAICANG',
        '太仓南': 'TAICANG SOUTH'
      },

      arrivalBoardStations: ['上海虹桥', '上海', '上海松江', '上海南'],
      departureBoardStations: ['上海虹桥', '上海', '上海松江', '上海南'],
      minorStations: ['安亭北', '安亭西', '南翔北', '上海西', '金山北', '莘庄', '练塘'],

      // Key aux junctions / posts in Shanghai
      keyAuxPosts: [
        '黄渡所', '南翔北所', '春申所', '春申南所', '陆渡所'
      ],

      auxCoords: {
        '黄渡所': [31.30048, 121.22840],
        '南翔北所': [31.29179, 121.26449],
        '春申所': [31.08267, 121.35367],
        '春申南所': [31.08145, 121.35134],
        '陆渡所': [31.48160, 121.20800]
      },

      // Static map corridor text annotations positioned near tracks
      corridorLabels: [
        { text: '京沪高铁', lat: 31.28, lon: 121.18, color: '#b0272f', angle: -38 },
        { text: '沪宁城际', lat: 31.32, lon: 121.24, color: '#e8892b', angle: -36 },
        { text: '沪杭高铁', lat: 30.88, lon: 121.02, color: '#b0272f', angle: -42 },
        { text: '沪苏湖高铁', lat: 30.99, lon: 121.12, color: '#b0272f', angle: -3 },
        { text: '金山铁路', lat: 30.85, lon: 121.34, color: '#3a78b5', angle: 82 },
        { text: '沪苏通铁路', lat: 31.38, lon: 121.17, color: '#3a78b5', angle: 72 },
        { text: '京沪普速', lat: 31.26, lon: 121.35, color: '#3f9142', angle: 5 }
      ],

      // 7 Curated camera presets for top-right inset zoom window
      insets: [
        {
          id: 1,
          name: '上海虹桥 · 京沪高铁与沪杭高铁咽喉',
          center: [31.200, 121.315],
          zoom: 12.3,
          scaleLabel: '1 km',
          desc: '中国最繁忙的高铁枢纽超大股道群与动车存车场'
        },
        {
          id: 2,
          name: '上海站咽喉 · 京沪普速/沪宁城际/动车入库',
          center: [31.252, 121.442],
          zoom: 12.5,
          scaleLabel: '1 km',
          desc: '闸北老客站密布道岔群与高架候车大厅咽喉'
        },
        {
          id: 3,
          name: '黄渡—安亭咽喉 · 京沪/沪宁/沪苏通交汇',
          center: [31.305, 121.205],
          zoom: 12.0,
          scaleLabel: '2 km',
          desc: '京沪干线、沪宁城际与沪苏通入沪立体分合流'
        },
        {
          id: 4,
          name: '南翔编组站 / 南翔北 · 沪宁城际联络线',
          center: [31.285, 121.285],
          zoom: 12.2,
          scaleLabel: '2 km',
          desc: '华东特大货运编组场与虹桥动车走行线并行立交'
        },
        {
          id: 5,
          name: '春申咽喉 · 沪昆普速/金山铁路/沪杭客专交汇',
          center: [31.082, 121.352],
          zoom: 12.4,
          scaleLabel: '1 km',
          desc: '上海南站出京沪昆干线与金山铁路支线立交咽喉'
        },
        {
          id: 6,
          name: '上海松江 · 沪苏湖高铁/沪昆高铁交汇枢纽',
          center: [30.985, 121.226],
          zoom: 12.2,
          scaleLabel: '2 km',
          desc: '新晋综合交通枢纽跨线立交，分流长三角西南客流'
        },
        {
          id: 7,
          name: '金山卫走廊 · 市域金山铁路沿海终到',
          center: [30.735, 121.358],
          zoom: 12.0,
          scaleLabel: '2 km',
          desc: '杭州湾沿岸快速市域客车终端站场与折返线'
        }
      ],

      // Default station sequence for micro time-space diagram
      diagramSection: {
        title: '京沪高铁·沪杭走廊断面',
        stations: ['昆山南', '安亭北', '上海虹桥', '上海松江', '金山北', '嘉善南']
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Helper Utilities
  // ---------------------------------------------------------------------------

  /**
   * Format minutes (0..1440) to "HH:MM"
   */
  function formatTime(minutes) {
    if (minutes == null || isNaN(minutes)) return '--:--';
    const m = Math.floor(minutes) % 1440;
    const posM = m < 0 ? m + 1440 : m;
    const hh = String(Math.floor(posM / 60)).padStart(2, '0');
    const mm = String(posM % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Parse "HH:MM" string to minutes (0..1439)
   */
  function parseTime(str) {
    if (!str || typeof str !== 'string') return 0;
    const parts = str.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  /**
   * Resolve station coordinates [lat, lon] from D.stations or hubConfig.auxCoords
   */
  function getHubStationCoord(D, hubConfig, stationName) {
    if (hubConfig && hubConfig.auxCoords && hubConfig.auxCoords[stationName]) {
      return hubConfig.auxCoords[stationName];
    }
    if (D && Array.isArray(D.stations)) {
      for (let i = 0; i < D.stations.length; i++) {
        const item = D.stations[i];
        if (item[0] === stationName) {
          return [item[2], item[1]]; // [lat, lon]
        }
      }
    }
    if (hubConfig && Array.isArray(hubConfig.center)) {
      return hubConfig.center;
    }
    return [39.9, 116.4];
  }

  /**
   * Test if a train touches the hub on this day (0 <= t <= 1440)
   */
  function isTrainInHub(t, D, hubConfig) {
    if (!t || !hubConfig) return false;
    const bbox = hubConfig.bbox;
    const targetStations = new Set([
      ...(hubConfig.majorStations || []),
      ...(hubConfig.minorStations || [])
    ]);

    // Check stops
    if (Array.isArray(t.s)) {
      for (let i = 0; i < t.s.length; i++) {
        const st = t.s[i];
        if (targetStations.has(st[0])) {
          const arr = st[1], dep = st[2];
          const tm = arr != null ? arr : dep;
          if (tm != null && tm >= 0 && tm <= 1440) return true;
          if (dep != null && dep >= 0 && dep <= 1440) return true;
        }
      }
    }

    // Check legs / geoms in bbox
    if (Array.isArray(t.l) && Array.isArray(D.geoms) && bbox) {
      for (let i = 0; i < t.l.length; i++) {
        const leg = t.l[i];
        if (!leg) continue;
        const t0 = leg[1], t1 = leg[2];
        if (t1 < 0 || t0 > 1440) continue;
        const geom = D.geoms[leg[0]];
        if (!geom) continue;
        for (let j = 0; j < geom.length; j++) {
          const p = geom[j];
          const lon = p[1], lat = p[2];
          if (lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // 3. computeHubEvents(D, hubConfig)
  // ---------------------------------------------------------------------------
  /**
   * Pre-scan all trains touching the hub on this day, computing:
   * - totalHubTrains: distinct count of trains touching the hub (0 <= t <= 1440)
   * - achievements: sorted milestone events { t, station, lat, lon, badge, title, detail }
   * - busiestHours: map of busiest 60-min window for each major station
   * - peakActive: peak simultaneous active trains in the hub and timestamp
   */
  function computeHubEvents(D, hubConfig) {
    if (!D || !Array.isArray(D.trains) || !hubConfig) {
      return { totalHubTrains: 0, achievements: [] };
    }

    const bbox = hubConfig.bbox || [115.85, 38.92, 117.75, 40.25];
    const majorStations = hubConfig.majorStations || [];
    const minorStations = hubConfig.minorStations || [];
    const allHubStations = new Set([...majorStations, ...minorStations]);

    // Station coordinates lookup cache [lat, lon]
    const stCoordsMap = Object.create(null);
    if (Array.isArray(D.stations)) {
      for (let i = 0; i < D.stations.length; i++) {
        const item = D.stations[i];
        stCoordsMap[item[0]] = [item[2], item[1]];
      }
    }
    if (hubConfig.auxCoords) {
      for (const k of Object.keys(hubConfig.auxCoords)) {
        stCoordsMap[k] = hubConfig.auxCoords[k];
      }
    }
    const defaultCenter = hubConfig.center || [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2];

    function getCoord(name) {
      return stCoordsMap[name] || defaultCenter;
    }

    // 1. Identify all trains touching the hub
    const hubTrains = [];
    const seenTrainCodes = new Set();

    for (let i = 0; i < D.trains.length; i++) {
      const tr = D.trains[i];
      if (isTrainInHub(tr, D, hubConfig)) {
        hubTrains.push(tr);
        const code0 = tr.c ? tr.c.split('/')[0] : '';
        if (code0) seenTrainCodes.add(code0);
      }
    }

    const totalHubTrains = seenTrainCodes.size;
    const achievements = [];

    // 2. Station-level analysis: arrivals, departures, busiest hour & milestones
    const busiestHours = Object.create(null);
    const stationCounts = Object.create(null);

    for (let si = 0; si < majorStations.length; si++) {
      const stName = majorStations[si];
      const minuteArr = new Uint16Array(1441);
      const minuteDep = new Uint16Array(1441);
      const stTrainEvents = [];

      for (let ti = 0; ti < hubTrains.length; ti++) {
        const tr = hubTrains[ti];
        if (!Array.isArray(tr.s)) continue;

        for (let j = 0; j < tr.s.length; j++) {
          const s = tr.s[j];
          if (s[0] === stName) {
            const arr = s[1], dep = s[2];
            let hasEvent = false;

            if (arr != null && arr >= 0 && arr <= 1440) {
              const mArr = Math.floor(arr);
              minuteArr[mArr]++;
              hasEvent = true;
            }
            if (dep != null && dep >= 0 && dep <= 1440) {
              const mDep = Math.floor(dep);
              minuteDep[mDep]++;
              hasEvent = true;
            }

            if (hasEvent) {
              const tm = arr != null ? arr : dep;
              stTrainEvents.push({
                t: tm,
                code: tr.c,
                arr: arr,
                dep: dep,
                train: tr
              });
            }
            break;
          }
        }
      }

      // Sliding 60-minute window for busiest hour
      let curArr = 0, curDep = 0;
      for (let m = 0; m < 60; m++) {
        curArr += minuteArr[m];
        curDep += minuteDep[m];
      }
      let bestCnt = curArr + curDep;
      let bestT0 = 0;
      let bestArr = curArr, bestDep = curDep;

      for (let t0 = 1; t0 <= 1440 - 60; t0++) {
        curArr += minuteArr[t0 + 59] - minuteArr[t0 - 1];
        curDep += minuteDep[t0 + 59] - minuteDep[t0 - 1];
        const sum = curArr + curDep;
        if (sum > bestCnt) {
          bestCnt = sum;
          bestT0 = t0;
          bestArr = curArr;
          bestDep = curDep;
        }
      }

      busiestHours[stName] = {
        t0: bestT0,
        t1: bestT0 + 60,
        bestCnt: bestCnt,
        arr: bestArr,
        dep: bestDep,
        text: `${formatTime(bestT0)}—${formatTime(bestT0 + 60)} 到 ${bestArr} / 发 ${bestDep} · 共 ${bestCnt} 列`
      };

      const coord = getCoord(stName);

      if (bestCnt > 0) {
        achievements.push({
          t: bestT0 + 60, // triggered at the completion of the peak hour
          station: stName,
          lat: coord[0],
          lon: coord[1],
          badge: '高峰达成',
          title: `${stName} · 本站今日最忙一小时达成`,
          detail: `${formatTime(bestT0)}—${formatTime(bestT0 + 60)} 到 ${bestArr} / 发 ${bestDep} · 累计到发 ${bestCnt} 列`
        });
      }

      // Train arrival/departure milestones (50, 100, 200, 300, 400, 500...)
      stTrainEvents.sort((a, b) => a.t - b.t);
      const seenStationTrains = new Set();
      const uniqueStationTrains = [];
      for (let k = 0; k < stTrainEvents.length; k++) {
        const item = stTrainEvents[k];
        const c0 = item.code.split('/')[0];
        if (!seenStationTrains.has(c0)) {
          seenStationTrains.add(c0);
          uniqueStationTrains.push(item);
        }
      }

      stationCounts[stName] = uniqueStationTrains.length;
      const milestoneThresholds = [50, 100, 200, 300, 400, 500, 600, 700];

      for (let mi = 0; mi < milestoneThresholds.length; mi++) {
        const m = milestoneThresholds[mi];
        if (m <= uniqueStationTrains.length) {
          const item = uniqueStationTrains[m - 1];
          const tVal = Math.round(item.t);
          const cDisp = item.code.split('/')[0];
          const trStops = item.train.s || [];
          const orig = trStops[0] ? trStops[0][0] : '';
          const dest = trStops[trStops.length - 1] ? trStops[trStops.length - 1][0] : '';
          const routeStr = orig && dest ? ` (${orig} → ${dest})` : '';

          achievements.push({
            t: tVal,
            station: stName,
            lat: coord[0],
            lon: coord[1],
            badge: '客流里程碑',
            title: `${stName} · 达成第 ${m} 列到发`,
            detail: `第 ${m} 列 · ${cDisp}${routeStr}`
          });
        }
      }
    }

    // 3. Hub-wide: Early morning first high-speed departure
    const morningDepartures = [];
    for (let ti = 0; ti < hubTrains.length; ti++) {
      const tr = hubTrains[ti];
      if (!Array.isArray(tr.s) || tr.s.length === 0) continue;
      const s0 = tr.s[0];
      if (majorStations.includes(s0[0]) && s0[2] != null && s0[2] >= 300 && s0[2] <= 420) {
        morningDepartures.push({
          t: s0[2],
          code: tr.c,
          station: s0[0],
          dest: tr.s[tr.s.length - 1][0],
          cls: tr.cls || ''
        });
      }
    }

    morningDepartures.sort((a, b) => a.t - b.t);
    if (morningDepartures.length > 0) {
      const firstDep = morningDepartures[0];
      const coord = getCoord(firstDep.station);
      achievements.push({
        t: Math.round(firstDep.t),
        station: firstDep.station,
        lat: coord[0],
        lon: coord[1],
        badge: '首发动车',
        title: `枢纽晨间首班出港 · ${firstDep.code.split('/')[0]}`,
        detail: `${firstDep.station} 始发开往 ${firstDep.dest} (${firstDep.cls || '动车组'})`
      });
    }

    // 4. Hub-wide: Peak simultaneous active trains in hub
    const activeMinute = new Uint16Array(1441);
    for (let ti = 0; ti < hubTrains.length; ti++) {
      const tr = hubTrains[ti];
      const intervals = [];

      // Active during legs within bbox
      if (Array.isArray(tr.l) && Array.isArray(D.geoms)) {
        for (let li = 0; li < tr.l.length; li++) {
          const leg = tr.l[li];
          if (!leg) continue;
          const t0 = leg[1], t1 = leg[2];
          if (t1 < 0 || t0 > 1440) continue;
          const geom = D.geoms[leg[0]];
          if (!geom) continue;

          let touchesBbox = false;
          for (let pi = 0; pi < geom.length; pi++) {
            const lon = geom[pi][1], lat = geom[pi][2];
            if (lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]) {
              touchesBbox = true;
              break;
            }
          }
          if (touchesBbox) {
            intervals.push([Math.max(0, t0), Math.min(1440, t1)]);
          }
        }
      }

      // Active during stop dwell at hub stations
      if (Array.isArray(tr.s)) {
        for (let si = 0; si < tr.s.length; si++) {
          const s = tr.s[si];
          if (allHubStations.has(s[0])) {
            const arr = s[1], dep = s[2];
            if (arr != null && dep != null) {
              intervals.push([Math.max(0, arr), Math.min(1440, dep)]);
            } else if (arr != null) {
              intervals.push([Math.max(0, arr - 5), Math.min(1440, arr + 5)]);
            } else if (dep != null) {
              intervals.push([Math.max(0, dep - 5), Math.min(1440, dep + 5)]);
            }
          }
        }
      }

      if (intervals.length > 0) {
        intervals.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (let ii = 0; ii < intervals.length; ii++) {
          const iv = intervals[ii];
          if (!merged.length || iv[0] > merged[merged.length - 1][1]) {
            merged.push(iv);
          } else {
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
          }
        }
        for (let mi = 0; mi < merged.length; mi++) {
          const startM = Math.floor(merged[mi][0]);
          const endM = Math.min(1440, Math.ceil(merged[mi][1]));
          for (let m = startM; m <= endM; m++) {
            activeMinute[m]++;
          }
        }
      }
    }

    let peakCount = 0;
    let peakMinute = 0;
    for (let m = 0; m <= 1440; m++) {
      if (activeMinute[m] > peakCount) {
        peakCount = activeMinute[m];
        peakMinute = m;
      }
    }

    const peakActive = {
      t: peakMinute,
      count: peakCount,
      timeStr: formatTime(peakMinute)
    };

    if (peakCount > 0) {
      achievements.push({
        t: peakMinute,
        station: '全枢纽',
        lat: defaultCenter[0],
        lon: defaultCenter[1],
        badge: '枢纽峰值',
        title: `枢纽同屏峰值 · ${peakCount} 列同时在途`,
        detail: `${formatTime(peakMinute)} 枢纽路网密度达到今日全天峰值`
      });
    }

    // 5. Cross-hub Iconic Trains
    if (hubConfig.id === 'jingjin') {
      // Beijing underground diameter line traversal (Beijing <-> Beijing West)
      const iconicDiameterCodes = new Set(['G301', 'G107', 'S101', 'G306']);
      for (let ti = 0; ti < hubTrains.length; ti++) {
        const tr = hubTrains[ti];
        const c0 = tr.c ? tr.c.split('/')[0] : '';
        if (iconicDiameterCodes.has(c0) && Array.isArray(tr.s)) {
          const names = tr.s.map(x => x[0]);
          const iBj = names.indexOf('北京');
          const iBjw = names.indexOf('北京西');
          if (iBj >= 0 && iBjw >= 0) {
            const posBj = getCoord('北京');
            const posBjw = getCoord('北京西');
            const midCoord = [(posBj[0] + posBjw[0]) / 2, (posBj[1] + posBjw[1]) / 2];
            const minIdx = Math.min(iBj, iBjw);
            const tm = tr.s[minIdx][2] != null ? tr.s[minIdx][2] : tr.s[Math.max(iBj, iBjw)][1];
            const orig = names[0], dest = names[names.length - 1];

            achievements.push({
              t: Math.round(tm != null ? tm : 420),
              station: '北京地下直径线',
              lat: midCoord[0],
              lon: midCoord[1],
              badge: '地下穿城',
              title: `穿越北京地下直径线 · ${c0}`,
              detail: `前三门地下隧道直通北京—北京西 (${orig} → ${dest})`
            });
          }
        }

        // G1 (Beijing South dep 06:30)
        if (tr.c === 'G1' && Array.isArray(tr.s) && tr.s[0]) {
          const tDep = tr.s[0][2];
          const coord = getCoord('北京南');
          achievements.push({
            t: Math.round(tDep != null ? tDep : 390),
            station: '北京南',
            lat: coord[0],
            lon: coord[1],
            badge: '标杆始发',
            title: '京沪标杆始发 · G1 次',
            detail: '北京南 始发往 上海虹桥 · 复兴号 350 km/h 达速旗舰'
          });
        }

        // G2 (Beijing South arr 11:32)
        if (tr.c === 'G2' && Array.isArray(tr.s) && tr.s.length > 0) {
          const tArr = tr.s[tr.s.length - 1][1];
          const coord = getCoord('北京南');
          achievements.push({
            t: Math.round(tArr != null ? tArr : 692),
            station: '北京南',
            lat: coord[0],
            lon: coord[1],
            badge: '标杆终到',
            title: '京沪标杆终到 · G2 次',
            detail: '上海虹桥 始发终到北京南 · 历时 4 时 29 分贯通千公里'
          });
        }

        // C2001 (Jingjin Intercity first train)
        if (tr.c === 'C2001' && Array.isArray(tr.s) && tr.s[0]) {
          const tDep = tr.s[0][2];
          const coord = getCoord('北京南');
          achievements.push({
            t: Math.round(tDep != null ? tDep : 374),
            station: '北京南',
            lat: coord[0],
            lon: coord[1],
            badge: '城际首发',
            title: '京津城际首班 · C2001 次',
            detail: '北京南 始发往 天津 · 中国首条高密度 350 km/h 城际'
          });
        }
      }
    } else if (hubConfig.id === 'shanghai') {
      for (let ti = 0; ti < hubTrains.length; ti++) {
        const tr = hubTrains[ti];

        // G2 (Shanghai Hongqiao dep 06:43)
        if (tr.c === 'G2' && Array.isArray(tr.s) && tr.s[0]) {
          const tDep = tr.s[0][2];
          const coord = getCoord('上海虹桥');
          achievements.push({
            t: Math.round(tDep != null ? tDep : 403),
            station: '上海虹桥',
            lat: coord[0],
            lon: coord[1],
            badge: '标杆始发',
            title: '京沪标杆始发 · G2 次',
            detail: '上海虹桥 始发往 北京南 · 复兴号 350 km/h 达速旗舰'
          });
        }

        // G1 (Shanghai Hongqiao arr 11:24)
        if (tr.c === 'G1' && Array.isArray(tr.s) && tr.s.length > 0) {
          const tArr = tr.s[tr.s.length - 1][1];
          const coord = getCoord('上海虹桥');
          achievements.push({
            t: Math.round(tArr != null ? tArr : 684),
            station: '上海虹桥',
            lat: coord[0],
            lon: coord[1],
            badge: '标杆终到',
            title: '京沪标杆终到 · G1 次',
            detail: '北京南 始发终到上海虹桥 · 历时 4 时 24 分贯通京沪'
          });
        }

        // S1001 (Jinshan commuter railway first train)
        if (tr.c === 'S1001' && Array.isArray(tr.s) && tr.s[0]) {
          const tDep = tr.s[0][2];
          const coord = getCoord('上海南');
          achievements.push({
            t: Math.round(tDep != null ? tDep : 320),
            station: '上海南',
            lat: coord[0],
            lon: coord[1],
            badge: '市域首发',
            title: '金山铁路早班通勤 · S1001 次',
            detail: '上海南 始发往 金山卫 · 长三角首条快速市域公交化铁路'
          });
        }
      }
    }

    // Sort achievements chronologically by t (0..1440)
    achievements.sort((a, b) => a.t - b.t || a.station.localeCompare(b.station, 'zh'));

    return {
      totalHubTrains,
      achievements,
      busiestHours,
      peakActive,
      stationCounts
    };
  }

  /**
   * Safe getter for hub config by id
   */
  function getHubConfig(hubId) {
    if (hubId && HUB_CONFIGS[hubId]) {
      return HUB_CONFIGS[hubId];
    }
    return HUB_CONFIGS.jingjin;
  }

  // ---------------------------------------------------------------------------
  // Export to global window & CommonJS module
  // ---------------------------------------------------------------------------
  root.HUB_CONFIGS = HUB_CONFIGS;
  root.computeHubEvents = computeHubEvents;
  root.getHubConfig = getHubConfig;
  root.getHubStationCoord = getHubStationCoord;
  root.isTrainInHub = isTrainInHub;
  root.formatTime = formatTime;
  root.parseTime = parseTime;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      HUB_CONFIGS,
      computeHubEvents,
      getHubConfig,
      getHubStationCoord,
      isTrainInHub,
      formatTime,
      parseTime
    };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
