/**
 * textures.js —— 程序化贴图库（用 Canvas 现场绘制，零外部资源）
 * 这样在 file:// 下直接打开也有丰富质感，不依赖任何图片文件。
 */
(function () {
  const U = SG.Utils;

  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function toTex(canvas, repX, repY) {
    const t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    if (repX || repY) t.repeat.set(repX || 1, repY || 1);
    return t;
  }

  /** 在 ctx 上撒随机噪点 */
  function speckle(ctx, w, h, count, palette, maxR) {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      const r = Math.random() * (maxR || 2);
      ctx.fillRect(Math.random() * w, Math.random() * h, r, r);
    }
  }

  const api = {};

  /* ---------- 道砟碎石 ---------- */
  api.gravel = function () {
    const s = 256;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8b857a';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, s, 2600, ['#6f6a60', '#9d978b', '#7d786e', '#a8a294', '#5f5b53', '#938d81'], 3.2);
    // 少量油渍
    for (let i = 0; i < 6; i++) {
      const g = ctx.createRadialGradient(
        Math.random() * s, Math.random() * s, 2,
        Math.random() * s, Math.random() * s, 30
      );
      g.addColorStop(0, 'rgba(40,38,34,0.18)');
      g.addColorStop(1, 'rgba(40,38,34,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    return c;
  };

  /* ---------- 混凝土 / 站台 ---------- */
  api.concrete = function () {
    const s = 256;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cdd1d8';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, s, 1600, ['#c2c6cd', '#d8dce2', '#b9bdc5', '#e0e4e9'], 2.4);
    // 分格缝
    ctx.strokeStyle = 'rgba(140,146,156,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (s / 2) * i);
      ctx.lineTo(s, (s / 2) * i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((s / 2) * i, 0);
      ctx.lineTo((s / 2) * i, s);
      ctx.stroke();
    }
    return c;
  };

  /* ---------- 草地 ---------- */
  api.grass = function () {
    const s = 256;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#74b455';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, s, 3000, ['#65a349', '#86c266', '#5c9642', '#94cd77', '#6fae52'], 2.6);
    return c;
  };

  /* ---------- 楼房外墙（浅底 + 深窗，便于用颜色着色）---------- */
  api.facade = function (variant) {
    const w = 128, h = 256;
    const c = cv(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f6f9';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 500, ['#e9ecf1', '#ffffff'], 2);

    const cols = 4, rows = 9;
    const padX = 10, padY = 12;
    const cw = (w - padX * 2) / cols;
    const ch = (h - padY * 2) / rows;
    const winW = cw * 0.62;
    const winH = ch * 0.55;

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = padX + col * cw + (cw - winW) / 2;
        const y = padY + r * ch + (ch - winH) / 2;
        const k = Math.random();
        let fill;
        if (k < 0.14) fill = '#ffe6a0';        // 亮灯
        else if (k < 0.28) fill = '#9fb0c6';
        else fill = '#6b7c93';
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, winW, winH);
        // 窗框反光
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x, y, winW, 2);
        if (variant === 1) {
          // 阳台栏杆
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(x - 1, y + winH - 3, winW + 2, 2);
        }
      }
      // 楼层分隔线
      ctx.fillStyle = 'rgba(120,130,148,0.18)';
      ctx.fillRect(0, padY + r * ch + ch - 2, w, 2);
    }
    return c;
  };

  /* ---------- 黄黑警示斜纹 ---------- */
  api.hazard = function (a, b) {
    const s = 64;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = a || '#ffc531';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = b || '#2b2b2b';
    ctx.save();
    ctx.translate(0, 0);
    for (let i = -s; i < s * 2; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 12, 0);
      ctx.lineTo(i + 12 - s, s);
      ctx.lineTo(i - s, s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return c;
  };

  /* ---------- 细颗粒（给纯色材质加质感，避免"塑料感"）---------- */
  api.grain = function () {
    const s = 128;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    // 极淡的噪点：整体亮度 0.9~1.0，只破坏"完美平整"的塑料反光
    for (let i = 0; i < 5200; i++) {
      const v = 228 + Math.floor(Math.random() * 27);
      ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.6)';
      const r = 1 + Math.random() * 2.4;
      ctx.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
    // 几道横向浅色拉丝，模拟喷涂/磨损
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.06 + Math.random() * 0.1).toFixed(3) + ')';
      ctx.fillRect(0, Math.random() * s, s, 1 + Math.random() * 2);
    }
    return c;
  };

  /* ---------- 木板 ---------- */
  api.wood = function () {
    const s = 128;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b07a44';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#a5713e' : '#b88049';
      ctx.fillRect(0, i * (s / 4), s, s / 4 - 3);
      ctx.fillStyle = 'rgba(90,60,30,0.45)';
      ctx.fillRect(0, i * (s / 4) + s / 4 - 3, s, 3);
    }
    speckle(ctx, s, s, 700, ['#9b6a3a', '#c08a52', '#8a5c31'], 1.6);
    return c;
  };

  /* ---------- 金属 / 集装箱瓦楞 ---------- */
  api.metal = function () {
    const s = 128;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b9c1cc';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x, 0, 3, s);
      ctx.fillStyle = 'rgba(60,70,88,0.22)';
      ctx.fillRect(x + 5, 0, 3, s);
    }
    speckle(ctx, s, s, 300, ['rgba(120,130,148,0.5)', 'rgba(230,236,244,0.5)'], 1.6);
    return c;
  };

  /* ---------- 拉丝金属（细密方向性划痕 + 竖条高光）---------- */
  api.brushed = function () {
    const s = 256;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c6cedb';
    ctx.fillRect(0, 0, s, s);

    // 竖向拉丝：细长划痕有明有暗，金属的方向感就靠它
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const len = 10 + Math.random() * 52;
      const a = (0.04 + Math.random() * 0.15).toFixed(3);
      ctx.strokeStyle = Math.random() < 0.5
        ? 'rgba(255,255,255,' + a + ')'
        : 'rgba(72,84,104,' + a + ')';
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 3.5, y + len);
      ctx.stroke();
    }

    // 柔和的明暗竖带：模拟金属表面的反射过渡，避免"一片死灰"
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * s;
      const w = 16 + Math.random() * 50;
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,' + (0.09 + Math.random() * 0.17).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - w, 0, w * 2, s);
    }
    // 少量暗部压边
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * s;
      const w = 20 + Math.random() * 60;
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(60,70,88,0)');
      g.addColorStop(0.5, 'rgba(60,70,88,0.11)');
      g.addColorStop(1, 'rgba(60,70,88,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - w, 0, w * 2, s);
    }
    speckle(ctx, s, s, 260, ['rgba(118,130,150,0.32)', 'rgba(232,240,250,0.32)'], 1.6);
    return c;
  };

  /* ---------- 花纹钢板（防滑踏步，菱形凸起交错排布）---------- */
  api.diamond = function () {
    const s = 256;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b4bcc8';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, s, 1100, ['#a8b1bd', '#c2cad6', '#9aa3b0'], 2);

    const step = 32;
    for (let row = 0; row * step < s + step; row++) {
      for (let col = 0; col * step < s + step; col++) {
        const x = col * step + (row % 2 ? step / 2 : 0);
        const y = row * step;
        ctx.save();
        ctx.translate(x + step / 2, y + step / 2);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(92,102,118,0.5)';   // 凸起投影
        ctx.fillRect(-7, -7, 16, 16);
        ctx.fillStyle = 'rgba(238,244,252,0.72)'; // 受光面
        ctx.fillRect(-7, -7, 12.5, 12.5);
        ctx.restore();
      }
    }
    return c;
  };

  /* ---------- 广告牌（多种花色）---------- */
  const ADS = [
    { bg: '#e8453c', main: '#fff3c0', accent: '#ffc531', text: '地铁', sub: 'METRO' },
    { bg: '#3d7ee8', main: '#ffffff', accent: '#7cc4ff', text: '5折', sub: 'SALE 50%' },
    { bg: '#3fae63', main: '#eaffe0', accent: '#ffc531', text: '新鲜', sub: 'FRESH' },
    { bg: '#8a4fd8', main: '#fff0ff', accent: '#ffd23f', text: '乐园', sub: 'FUN PARK' },
    { bg: '#ff8a2b', main: '#3a1c00', accent: '#fff3c0', text: '快跑', sub: 'GO GO GO' }
  ];

  api.billboardCount = ADS.length;

  api.billboard = function (i) {
    const ad = ADS[i % ADS.length];
    const w = 256, h = 128;
    const c = cv(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = ad.bg;
    ctx.fillRect(0, 0, w, h);

    // 装饰圆
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = ad.accent;
    ctx.beginPath();
    ctx.arc(w - 34, 30, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 边框
    ctx.strokeStyle = ad.accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // 文案
    ctx.fillStyle = ad.main;
    ctx.font = 'bold 52px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ad.text, w / 2, h / 2 - 12);

    ctx.fillStyle = ad.accent;
    ctx.font = 'bold 20px "Segoe UI",sans-serif';
    ctx.fillText(ad.sub, w / 2, h / 2 + 34);

    return c;
  };

  /* ---------- 圆形光晕（太阳 / 灯光）---------- */
  api.glow = function (inner, outer, alpha) {
    const s = 128;
    const c = cv(s, s);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner || 'rgba(255,255,255,1)');
    g.addColorStop(0.35, outer || 'rgba(255,240,200,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return c;
  };

  /* ---------- 云朵 ---------- */
  api.cloud = function () {
    const w = 256, h = 128;
    const c = cv(w, h);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const blobs = [
      [80, 78, 46], [130, 62, 54], [180, 80, 42], [110, 88, 40], [155, 92, 36]
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    blobs.forEach(function (b) {
      ctx.beginPath();
      ctx.arc(b[0], b[1], b[2], 0, Math.PI * 2);
      ctx.fill();
    });
    // 底部淡淡阴影
    ctx.fillStyle = 'rgba(190,215,240,0.55)';
    ctx.beginPath();
    ctx.ellipse(130, 104, 92, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    return c;
  };

  /* ---------- 天空渐变（竖直）---------- */
  api.sky = function () {
    const c = cv(16, 512);
    const ctx = c.getContext('2d');
    const P = SG.PALETTE;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0.0, P.skyTop);
    g.addColorStop(0.42, P.skyMid);
    g.addColorStop(0.78, P.skyLow);
    g.addColorStop(1.0, '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 512);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  };

  /* ---------- 站点指示牌文字 ---------- */
  api.station = function (text) {
    const w = 256, h = 64;
    const c = cv(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0e2a4a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#7cc4ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#eaf4ff';
    ctx.font = 'bold 34px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text || '地铁站', w / 2, h / 2 + 2);
    return c;
  };

  /* ============ 生成 THREE.Texture 的包装 ============ */
  let _grainTex = null;
  let _stationCache = {};
  const _canvasCache = {};
  const _texCache = {};

  /** 同一张 canvas 只画一次；贴图按 repeat 值分别缓存（repeat 是贴图对象自己的属性） */
  function cachedTex(name, makeCanvas, rx, ry) {
    if (!_canvasCache[name]) _canvasCache[name] = makeCanvas();
    const k = name + '@' + rx + 'x' + ry;
    if (!_texCache[k]) _texCache[k] = toTex(_canvasCache[name], rx, ry);
    return _texCache[k];
  }

  SG.Tex = {
    /** 共享的细颗粒贴图（只生成一次） */
    grain: function () {
      if (!_grainTex) {
        _grainTex = toTex(api.grain(), 3, 3);
      }
      return _grainTex;
    },
    gravel: function (rx, ry) { return toTex(api.gravel(), rx, ry); },
    concrete: function (rx, ry) { return toTex(api.concrete(), rx, ry); },
    grass: function (rx, ry) { return toTex(api.grass(), rx, ry); },
    facade: function (v, rx, ry) { return toTex(api.facade(v), rx, ry); },
    hazard: function (rx, ry, a, b) { return toTex(api.hazard(a, b), rx, ry); },
    wood: function (rx, ry) { return toTex(api.wood(), rx, ry); },
    metal: function (rx, ry) { return toTex(api.metal(), rx, ry); },
    brushed: function (rx, ry) { return cachedTex('brushed', api.brushed, rx || 1, ry || 1); },
    diamond: function (rx, ry) { return cachedTex('diamond', api.diamond, rx || 1, ry || 1); },
    billboard: function (i) { return toTex(api.billboard(i), 1, 1); },
    station: function (t) {
      if (!_stationCache[t]) _stationCache[t] = toTex(api.station(t), 1, 1);
      return _stationCache[t];
    },
    sky: function () { return api.sky(); },
    glow: function () {
      const t = new THREE.CanvasTexture(api.glow());
      t.encoding = THREE.sRGBEncoding;
      return t;
    },
    cloud: function () {
      const t = new THREE.CanvasTexture(api.cloud());
      t.encoding = THREE.sRGBEncoding;
      return t;
    }
  };

  /* ============ 材质工厂：统一提供"有光泽"的材质 ============
     全场景如果都用 Lambert，看起来就是没有高光的塑料块。
     金属件 / 烤漆件走 Phong，靠 specular + shininess 出高光，
     再叠一层拉丝或花纹贴图，才有"铁皮 / 不锈钢"的质感。

       metal  拉丝金属（不锈钢栏杆、机箱、立柱）
       chrome 抛光金属（钢轨、镀铬件，高光更硬）
       paint  烤漆铁皮（列车车身、油桶，有光泽但不过曝）
       plate  花纹钢板（踏板、检修平台）                        */
  const _matCache = {};

  function matCached(kind, color, rx, ry, make) {
    const k = kind + '_' + color + '_' + rx + 'x' + ry;
    if (!_matCache[k]) _matCache[k] = make();
    return _matCache[k];
  }

  SG.Mat = {
    metal: function (color, rx, ry) {
      color = color === undefined ? 0xaab4c2 : color;
      rx = rx || 1; ry = ry || 1;
      return matCached('metal', color, rx, ry, function () {
        return new THREE.MeshPhongMaterial({
          color: color,
          map: SG.Tex.brushed(rx, ry),
          specular: 0xbdd2ec,
          shininess: 68
        });
      });
    },

    chrome: function (color, rx, ry) {
      color = color === undefined ? 0xdae4f0 : color;
      rx = rx || 1; ry = ry || 1;
      return matCached('chrome', color, rx, ry, function () {
        return new THREE.MeshPhongMaterial({
          color: color,
          map: SG.Tex.brushed(rx, ry),
          specular: 0xffffff,
          shininess: 130
        });
      });
    },

    paint: function (color, rx, ry) {
      rx = rx || 2; ry = ry || 2;
      return matCached('paint', color, rx, ry, function () {
        return new THREE.MeshPhongMaterial({
          color: color,
          map: SG.Tex.grain(),
          specular: 0x6b7c94,
          shininess: 36
        });
      });
    },

    plate: function (color, rx, ry) {
      color = color === undefined ? 0xa8b2c0 : color;
      rx = rx || 1; ry = ry || 1;
      return matCached('plate', color, rx, ry, function () {
        return new THREE.MeshPhongMaterial({
          color: color,
          map: SG.Tex.diamond(rx, ry),
          specular: 0x9fb0c8,
          shininess: 48
        });
      });
    }
  };
})();
