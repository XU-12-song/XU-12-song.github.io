/**
 * config.js —— 全局配置、配色、工具函数
 * 所有模块挂在 window.SG 命名空间下，通过普通 <script> 标签加载，无需打包工具。
 */
window.SG = window.SG || {};

/* ============ 美术配色（卡通明亮风 · 高饱和）============ */
SG.PALETTE = {
  skyTop: '#0f7dff',
  skyMid: '#5cb4ff',
  skyLow: '#cfeaff',
  fog: 0xbfe0ff,

  ballast: 0x8a8069,      // 道砟
  sleeper: 0x6d4526,      // 枕木
  rail: 0xd6dee8,         // 钢轨
  concrete: 0xcdd2da,     // 站台 / 人行道
  grass: 0x5cc23c,        // 草地
  curb: 0xb6bcc6,

  buildingColors: [
    // 浅调（打底，但不再是灰扑扑的）
    0xf5ead0, 0xc3d8f7, 0xc6e8bd, 0xecdcc2, 0xb6e2cd, 0xafc9f0,
    // 暖色（砖红 / 沙 / 蜜橘）
    0xe87c43, 0xd8503a, 0xf5a94a, 0xf0c875, 0xd07020, 0xffc08a,
    // 冷色（湖蓝 / 薄荷 / 青灰）
    0x3d9fe0, 0x5ccfb0, 0x66d8e2, 0x5c86bb, 0x7fb8f5, 0x2f8fc0,
    // 高饱和点缀（香芋紫 / 粉 / 鹅黄 / 橄榄）
    0xa87df5, 0xff8fa6, 0xffcb3d, 0x9dc42e, 0xff8a5c, 0x76e39b,
    // 深色压边（避免整套偏白）
    0x8a6446, 0x4f6d94, 0x9a7c3d, 0xa8516f
  ],
  skyline: 0xa6c8ee,

  // 道具常用色
  red: 0xff3b2f,
  yellow: 0xffc400,
  blue: 0x2b74ff,
  green: 0x1fb85c,
  orange: 0xff7a00,
  white: 0xf4f8ff,
  dark: 0x2c3340,
  metal: 0x9fadbe
};

SG.CONFIG = {
  // ---- 赛道 ----
  LANE_X: [-2.2, 0, 2.2],          // 左 / 中 / 右 三条车道中心 x
  LANE_WIDTH: 2.2,
  RAIL_OFFSET: 0.62,               // 每条车道两根钢轨相对中心的偏移
  TRACK_LENGTH: 460,               // 地面平面总长度
  SPAWN_Z: -175,                   // 障碍物 / 金币生成的前方 z
  DESPAWN_Z: 14,                   // 越过此 z 即回收

  // ---- 速度 ----
  SPEED_START: 14,
  SPEED_MAX: 34,
  SPEED_ACCEL: 0.16,
  LANE_CHANGE_SPEED: 21,      // 变道位移速度，越大越跟手

  // ---- 手感 ----
  INPUT_BUFFER: 0.16,         // 提前按下也能记住的缓冲窗口（秒）

  // ---- 角色动作（不改动角色外观，仅保留操作参数）----
  GRAVITY: 34,
  JUMP_VELOCITY: 11.5,
  PLAYER_HEIGHT: 1.8,
  ROLL_HEIGHT: 0.8,
  ROLL_DURATION: 0.55,
  PLAYER_HALF_WIDTH: 0.36,
  PLAYER_HALF_DEPTH: 0.36,
  PLAYER_PLANE_HEIGHT: 1.9,   // 贴图模式下人物的显示高度（宽度按原图比例）

  // ---- 难度 ----
  DIFFICULTY_DISTANCE: 1800,
  ROW_GAP_START: 27,
  ROW_GAP_MIN: 16,

  // ---- 计分 ----
  COIN_SCORE: 10,
  DISTANCE_SCORE_RATE: 1,

  // ---- 存储 ----
  STORAGE_KEY: 'subwayRunnerHighScore',

  // ---- 角色贴图（可选）----
  // 把图片放到 railwayRGZ/assets/ 下，文件名一致即自动套用；
  // 文件不存在时会静默回退到内置纯色造型。
  TEXTURES: {
    xiongda: 'assets/xiongda.png',
    nailong: 'assets/nailong.png'
  }
};

/* ============ 工具函数 ============ */
SG.Utils = {
  rand(min, max) {
    return min + Math.random() * (max - min);
  },
  randInt(min, max) {
    return Math.floor(SG.Utils.rand(min, max + 1));
  },
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  },
  /** 按权重挑选：items = [{w: 3, v: 'tree'}, ...] */
  weighted(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) total += items[i].w;
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= items[i].w;
      if (r <= 0) return items[i].v;
    }
    return items[items.length - 1].v;
  }
};
