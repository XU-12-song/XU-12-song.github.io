/**
 * decor.js —— 路边装饰系统
 *   · 近景楼房（带窗户贴图 + 楼顶设备）
 *   · 远景天际线（InstancedMesh，一次 draw call）
 *   · 街道道具（路灯 / 树 / 广告牌 / 信号灯 / 围栏 / 锥桶 / 长椅 …）
 * 全部对象池化，跑出视野后回收复用。
 */
(function () {
  const C = SG.CONFIG;
  const P = SG.PALETTE;
  const U = SG.Utils;

  /* ---------- 共享几何 / 材质缓存 ---------- */
  const geoCache = {};
  const matCache = {};

  function geo(key, make) {
    if (!geoCache[key]) geoCache[key] = make();
    return geoCache[key];
  }
  function matOf(color) {
    const k = 'c' + color;
    if (!matCache[k]) {
      // 叠一层极淡的颗粒贴图：打破纯色塑料感，让表面有"漆面/材质"的细节
      matCache[k] = new THREE.MeshLambertMaterial({ color: color, map: SG.Tex.grain() });
    }
    return matCache[k];
  }

  /* 金属 / 烤漆 / 花纹钢板 / 镀铬：带高光的 Phong，用在灯杆、护栏、设备上 */
  const METAL = function (c, rx, ry) { return SG.Mat.metal(c, rx, ry); };
  const CHROME = function (c, rx, ry) { return SG.Mat.chrome(c, rx, ry); };
  const PAINT = function (c, rx, ry) { return SG.Mat.paint(c, rx, ry); };
  const PLATE = function (c, rx, ry) { return SG.Mat.plate(c, rx, ry); };

  const BOX = function () { return new THREE.BoxGeometry(1, 1, 1); };

  function bx(w, h, d, color) {
    const m = new THREE.Mesh(geo('box', BOX), typeof color === 'object' ? color : matOf(color));
    m.scale.set(w, h, d);
    return m;
  }
  function cyl(rt, rb, h, seg, color) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, h, seg || 10),
      typeof color === 'object' ? color : matOf(color)
    );
    return m;
  }
  function ico(r, color) {
    return new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), matOf(color));
  }
  function sph(r, color, seg) {
    return new THREE.Mesh(new THREE.SphereGeometry(r, seg || 10, seg || 8), matOf(color));
  }

  const GREENS = [0x4f9e3f, 0x59ab46, 0x66bb52, 0x489336];

  /* 遮阳棚配色（[亮色, 间隔色]） */
  const CANOPY = [
    ['#e8453c', '#f2f5f9'], ['#3d7ee8', '#f2f5f9'],
    ['#ffc531', '#2b2b2b'], ['#3fae63', '#fff3c0'],
    ['#ff8a2b', '#3a1c00']
  ];

  /* =========================================================
   *  街道道具定义
   * ========================================================= */
  const PROP_DEFS = {
    /* 路灯 */
    lamp() {
      const g = new THREE.Group();
      const pole = cyl(0.11, 0.14, 5.2, 8, METAL(P.metal, 1, 6));
      pole.position.y = 2.6;
      pole.castShadow = true;
      g.add(pole);
      const arm = bx(1.5, 0.14, 0.14, METAL(P.metal, 1, 1));
      arm.position.set(-0.7, 5.1, 0);
      g.add(arm);
      const head = bx(0.7, 0.22, 0.4, new THREE.MeshPhongMaterial({ color: 0xd8dee8, emissive: 0xffe9a8, emissiveIntensity: 0.55, specular: 0xffffff, shininess: 90 }));
      head.position.set(-1.35, 5.0, 0);
      g.add(head);
      const base = cyl(0.28, 0.34, 0.5, 8, METAL(0x8b93a0, 1, 1));
      base.position.y = 0.25;
      g.add(base);
      return g;
    },

    /* 行道树 */
    tree() {
      const g = new THREE.Group();
      const s = U.rand(0.85, 1.35);
      const trunk = cyl(0.16, 0.24, 1.7, 7, 0x7a5230);
      trunk.position.y = 0.85;
      trunk.castShadow = true;
      g.add(trunk);
      const c = U.pick(GREENS);
      const blobs = [
        [0, 2.5, 0, 1.15], [0.55, 2.15, 0.2, 0.8], [-0.5, 2.2, -0.15, 0.85], [0.1, 3.15, 0, 0.75]
      ];
      blobs.forEach(function (b) {
        const f = ico(b[3], c);
        f.position.set(b[0], b[1], b[2]);
        f.rotation.set(U.rand(0, 3), U.rand(0, 3), U.rand(0, 3));
        f.castShadow = true;
        g.add(f);
      });
      g.scale.setScalar(s);
      return g;
    },

    /* 灌木丛 */
    bush() {
      const g = new THREE.Group();
      const c = U.pick(GREENS);
      for (let i = 0; i < 3; i++) {
        const b = ico(U.rand(0.4, 0.7), i === 1 ? 0x3f8a33 : c);
        b.position.set(U.rand(-0.5, 0.5), U.rand(0.3, 0.6), U.rand(-0.4, 0.4));
        b.castShadow = true;
        g.add(b);
      }
      return g;
    },

    /* 广告牌 */
    billboard() {
      const g = new THREE.Group();
      const postMat = METAL(P.metal, 1, 5);
      for (const sx of [-1, 1]) {
        const p = bx(0.18, 4.4, 0.18, postMat);
        p.position.set(sx * 1.5, 2.2, 0);
        p.castShadow = true;
        g.add(p);
      }
      const idx = U.randInt(0, SG.Tex && 4);
      const panel = new THREE.Mesh(
        geo('box', BOX),
        [
          METAL(0x3a4350, 1, 1), METAL(0x3a4350, 1, 1), METAL(0x3a4350, 1, 1), METAL(0x3a4350, 1, 1),
          new THREE.MeshLambertMaterial({ map: SG.Tex.billboard(idx) }),
          PAINT(0x2c3340)
        ]
      );
      panel.scale.set(3.4, 1.8, 0.18);
      panel.position.y = 4.6;
      panel.castShadow = true;
      g.add(panel);
      return g;
    },

    /* 铁路信号灯 */
    signal() {
      const g = new THREE.Group();
      const pole = cyl(0.1, 0.12, 3.6, 8, METAL(0x59616e, 1, 4));
      pole.position.y = 1.8;
      pole.castShadow = true;
      g.add(pole);
      const box2 = bx(0.44, 1.15, 0.36, PAINT(0x2c3340));
      box2.position.y = 3.3;
      g.add(box2);
      const colors = [0xff3b30, 0xffc531, 0x34c759];
      const lit = U.randInt(0, 2);
      colors.forEach(function (col, i) {
        const on = i === lit;
        const lampMesh = sph(0.13, 0x1b1f26, 8);
        lampMesh.position.set(0, 3.72 - i * 0.36, 0.2);
        if (on) {
          lampMesh.material = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.72 });
        }
        g.add(lampMesh);
      });
      return g;
    },

    /* 围栏段 */
    fence() {
      const g = new THREE.Group();
      const len = 5;
      const mat = METAL(U.pick([0x8b93a0, 0x4f7f5a, 0x9c5a4a, 0x4a6b8a, 0xb9a06a]), 1, 2);
      for (let i = 0; i <= 4; i++) {
        const p = bx(0.1, 1.1, 0.1, mat);
        p.position.set(-len / 2 + (len / 4) * i, 0.55, 0);
        g.add(p);
      }
      for (const y of [0.45, 0.9]) {
        const r = bx(len, 0.08, 0.06, mat);
        r.position.set(0, y, 0);
        g.add(r);
      }
      return g;
    },

    /* 锥桶 */
    cone() {
      const g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 12), PAINT(P.orange));
      c.position.y = 0.42;
      c.castShadow = true;
      g.add(c);
      const band = cyl(0.22, 0.26, 0.14, 12, METAL(P.white, 1, 1));
      band.position.y = 0.42;
      g.add(band);
      const base = bx(0.6, 0.06, 0.6, PAINT(P.orange));
      base.position.y = 0.03;
      g.add(base);
      return g;
    },

    /* 施工油桶 */
    barrel() {
      const g = new THREE.Group();
      const b = cyl(0.36, 0.36, 1.0, 12, PAINT(P.orange, 1, 2));
      b.position.y = 0.5;
      b.castShadow = true;
      g.add(b);
      for (const y of [0.35, 0.7]) {
        const band = cyl(0.375, 0.375, 0.1, 12, METAL(P.white, 1, 1));
        band.position.y = y;
        g.add(band);
      }
      return g;
    },

    /* 长椅 */
    bench() {
      const g = new THREE.Group();
      const woodMat = new THREE.MeshLambertMaterial({ map: SG.Tex.wood(1, 1) });
      const seat = new THREE.Mesh(geo('box', BOX), woodMat);
      seat.scale.set(1.9, 0.12, 0.6);
      seat.position.y = 0.55;
      g.add(seat);
      const back = new THREE.Mesh(geo('box', BOX), woodMat);
      back.scale.set(1.9, 0.5, 0.1);
      back.position.set(0, 0.85, -0.26);
      g.add(back);
      const legMat = METAL(0x59616e, 1, 1);
      for (const sx of [-1, 1]) {
        const leg = bx(0.1, 0.5, 0.5, legMat);
        leg.position.set(sx * 0.8, 0.27, 0);
        g.add(leg);
      }
      return g;
    },

    /* 垃圾桶 */
    bin() {
      const g = new THREE.Group();
      const c = U.pick([0x2f6b45, 0x3a5b7a, 0x8a4a3a, 0x4a4f58]);
      const body = cyl(0.4, 0.34, 0.95, 12, PAINT(c, 1, 2));
      body.position.y = 0.48;
      body.castShadow = true;
      g.add(body);
      const lid = cyl(0.44, 0.44, 0.1, 12, METAL(0x2a2f38, 1, 1));
      lid.position.y = 0.99;
      g.add(lid);
      return g;
    },

    /* 电线杆 */
    powerPole() {
      const g = new THREE.Group();
      const pole = cyl(0.14, 0.2, 8.5, 8, 0x8a7256);
      pole.position.y = 4.25;
      pole.castShadow = true;
      g.add(pole);
      const armMat = matOf(0x6f5c46);
      for (const y of [7.0, 7.7]) {
        const arm = bx(2.2, 0.14, 0.14, armMat);
        arm.position.y = y;
        g.add(arm);
        for (const sx of [-1, 1]) {
          const ins = cyl(0.06, 0.06, 0.18, 6, CHROME(0x9aa7bd));
          ins.position.set(sx * 0.95, y + 0.16, 0);
          g.add(ins);
        }
      }
      return g;
    },

    /* 花坛 */
    planter() {
      const g = new THREE.Group();
      const base = bx(1.6, 0.5, 0.9, matOf(P.concrete));
      base.position.y = 0.25;
      base.castShadow = true;
      g.add(base);
      const soil = bx(1.45, 0.12, 0.75, matOf(0x5a3f28));
      soil.position.y = 0.5;
      g.add(soil);
      const c = U.pick(GREENS);
      for (let i = 0; i < 5; i++) {
        const f = ico(U.rand(0.16, 0.26), c);
        f.position.set(U.rand(-0.55, 0.55), U.rand(0.58, 0.78), U.rand(-0.25, 0.25));
        g.add(f);
      }
      return g;
    },

    /* 消防栓 */
    hydrant() {
      const g = new THREE.Group();
      const body = cyl(0.15, 0.18, 0.7, 10, PAINT(P.red, 1, 1));
      body.position.y = 0.35;
      g.add(body);
      const cap = sph(0.16, P.red, 10);
      cap.position.y = 0.72;
      g.add(cap);
      for (const sx of [-1, 1]) {
        const nub = bx(0.24, 0.12, 0.12, 0xc23a32);
        nub.position.set(sx * 0.18, 0.5, 0);
        g.add(nub);
      }
      return g;
    },

    /* 公交候车亭（大型，稀有） */
    shelter() {
      const g = new THREE.Group();
      const mat = METAL(0x6d7684, 1, 4);
      for (const sx of [-1, 1]) {
        const p = bx(0.16, 2.6, 0.16, mat);
        p.position.set(sx * 1.6, 1.3, 0);
        p.castShadow = true;
        g.add(p);
      }
      const roof = bx(3.7, 0.14, 1.5, PAINT(0x3d6cff, 1, 2));
      roof.position.y = 2.65;
      roof.castShadow = true;
      g.add(roof);
      const glass = bx(3.0, 1.8, 0.06, new THREE.MeshLambertMaterial({
        color: 0xa8d8ff, transparent: true, opacity: 0.45
      }));
      glass.position.set(0, 1.4, -0.55);
      g.add(glass);
      const seat = bx(2.2, 0.12, 0.5, matOf(0xb0b7c2));
      seat.position.set(0, 0.55, -0.35);
      g.add(seat);
      return g;
    },

    /* 修剪整齐的绿篱 */
    hedge() {
      const g = new THREE.Group();
      const mat = matOf(U.pick(GREENS));
      const body = bx(4.4, 0.85, 0.95, mat);
      body.position.y = 0.45;
      body.castShadow = true;
      g.add(body);
      const top = bx(4.5, 0.3, 1.0, matOf(U.pick([0x5aa845, 0x66bb52, 0x4f9e3f])));
      top.position.y = 0.95;
      g.add(top);
      return g;
    },

    /* 景观石堆 */
    rocks() {
      const g = new THREE.Group();
      const cols = [0x9aa0a6, 0x878e95, 0xb0b6bb, 0x7d848b];
      for (let i = 0; i < 4; i++) {
        const r = ico(U.rand(0.3, 0.62), U.pick(cols));
        r.position.set(U.rand(-0.7, 0.7), U.rand(0.2, 0.4), U.rand(-0.5, 0.5));
        r.rotation.set(U.rand(0, 3), U.rand(0, 3), U.rand(0, 3));
        r.scale.y = U.rand(0.6, 0.9);
        r.castShadow = true;
        g.add(r);
      }
      return g;
    },

    /* 花丛（给路边补一点亮色） */
    flowers() {
      const g = new THREE.Group();
      const leaf = matOf(0x4f9e3f);
      for (let i = 0; i < 6; i++) {
        const stem = cyl(0.03, 0.04, U.rand(0.35, 0.6), 5, leaf);
        stem.position.set(U.rand(-0.6, 0.6), 0.3, U.rand(-0.5, 0.5));
        g.add(stem);
        const bloom = sph(U.rand(0.1, 0.16), U.pick([0xff6b8a, 0xffd23f, 0xff8a2b, 0xb56cff, 0xff4d6d, 0xffffff]), 8);
        bloom.position.copy(stem.position);
        bloom.position.y += 0.3;
        g.add(bloom);
      }
      const bed = bx(1.5, 0.16, 1.2, matOf(0x5a3f28));
      bed.position.y = 0.08;
      g.add(bed);
      return g;
    },

    /* 木箱堆 */
    crates() {
      const g = new THREE.Group();
      const woodMat = new THREE.MeshLambertMaterial({ map: SG.Tex.wood(1, 1) });
      const layout = [[-0.4, 0.28], [0.4, 0.28], [0, 0.83]];
      layout.forEach(function (p, i) {
        const s = i === 2 ? 0.88 : 0.84;
        const c = bx(s, 0.55, s, woodMat);
        c.position.set(p[0], p[1], 0);
        c.rotation.y = U.rand(-0.3, 0.3);
        c.castShadow = true;
        g.add(c);
      });
      return g;
    },

    /* 街边小摊（条纹顶棚） */
    stall() {
      const g = new THREE.Group();
      const mat = matOf(0x8a7256);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const p = bx(0.1, 2.0, 0.1, mat);
          p.position.set(sx * 0.9, 1.0, sz * 0.7);
          g.add(p);
        }
      }
      const cp = U.pick(CANOPY);
      const topMat = new THREE.MeshLambertMaterial({ map: SG.Tex.hazard(1, 3, cp[0], cp[1]) });
      const roof = bx(2.3, 0.12, 1.8, topMat);
      roof.position.y = 2.05;
      roof.rotation.x = -0.12;
      roof.castShadow = true;
      g.add(roof);
      const counter = bx(2.1, 0.8, 1.5, matOf(0xc9a06a));
      counter.position.y = 0.4;
      g.add(counter);
      const goods = bx(1.8, 0.3, 1.2, matOf(U.pick([0xe8453c, 0x3d7ee8, 0x3fae63, 0xff8a2b])));
      goods.position.y = 0.9;
      g.add(goods);
      return g;
    },

    /* 邮筒 */
    mailbox() {
      const g = new THREE.Group();
      const box2 = cyl(0.26, 0.26, 0.9, 12, PAINT(U.pick([0xff3b2f, 0xffc400, 0x2b74ff]), 1, 2));
      box2.position.y = 0.45;
      box2.castShadow = true;
      g.add(box2);
      const lid = sph(0.26, 0x2c3340, 12);
      lid.position.y = 0.92;
      g.add(lid);
      const slot = bx(0.3, 0.06, 0.06, 0x1b1f26);
      slot.position.set(0, 0.6, 0.26);
      g.add(slot);
      const base = cyl(0.32, 0.32, 0.1, 12, METAL(0x59616e, 1, 1));
      base.position.y = 0.05;
      g.add(base);
      return g;
    }
  };

  /* 内侧（靠近铁道）：市政设施为主 */
  const INNER_TYPES = [
    { w: 3, v: 'lamp' }, { w: 2, v: 'signal' }, { w: 3, v: 'fence' },
    { w: 2, v: 'cone' }, { w: 2, v: 'barrel' }, { w: 2, v: 'planter' },
    { w: 2, v: 'bin' }, { w: 2, v: 'bench' }, { w: 1, v: 'hydrant' },
    { w: 2, v: 'bush' }, { w: 2, v: 'hedge' }, { w: 1, v: 'rocks' },
    { w: 1, v: 'flowers' }, { w: 1, v: 'mailbox' }, { w: 1, v: 'crates' }
  ];
  /* 外侧（人行道/绿地）：绿化与商业为主 */
  const OUTER_TYPES = [
    { w: 5, v: 'tree' }, { w: 3, v: 'bush' }, { w: 2, v: 'lamp' },
    { w: 2, v: 'billboard' }, { w: 2, v: 'bench' }, { w: 1, v: 'bin' },
    { w: 2, v: 'powerPole' }, { w: 1, v: 'shelter' }, { w: 2, v: 'fence' },
    { w: 2, v: 'hedge' }, { w: 1, v: 'rocks' }, { w: 1, v: 'stall' },
    { w: 2, v: 'flowers' }, { w: 1, v: 'crates' }
  ];

  /* =========================================================
   *  Decor
   * ========================================================= */
  SG.Decor = function (scene) {
    this.scene = scene;
    this.pools = {};       // type -> [group...]
    this.active = [];      // 当前激活道具
    this.propTravel = 0;
    this.propGap = 5.5;    // 越小越密

    // 近景楼房
    this.buildings = [];
    this._buildFacades();
    this._buildBuildings();
    this._buildSkyline();

    // 预建少量道具，减少运行中卡顿
    Object.keys(PROP_DEFS).forEach((t) => {
      this.pools[t] = [];
      for (let i = 0; i < 3; i++) this.pools[t].push(this._createProp(t));
    });

    this._buildPuffs();
  };

  SG.Decor.prototype = {
    /* ---------- 尘埃粒子（起跳 / 落地 / 拾取反馈）---------- */
    _buildPuffs() {
    const tex = SG.Tex.glow('rgba(255,255,255,0.95)', 'rgba(206,200,188,0.5)');
    this.puffs = [];
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, opacity: 0
      }));
      sp.visible = false;
      this.scene.add(sp);
      this.puffs.push({ sp: sp, life: 0, max: 0, vx: 0, vy: 0, vz: 0, size: 1 });
    }
  },

  /** 在 (x, y) 处喷一小团尘 */
  puff(x, y, count) {
    const n = count || 8;
    let spawned = 0;
    for (let i = 0; i < this.puffs.length && spawned < n; i++) {
      const p = this.puffs[i];
      if (p.life > 0) continue;
      p.max = U.rand(0.32, 0.55);
      p.life = p.max;
      p.size = U.rand(0.5, 1.1);
      p.vx = U.rand(-2.2, 2.2);
      p.vy = U.rand(1.2, 3.0);
      p.vz = U.rand(-1.0, 2.0);
      p.sp.position.set(x + U.rand(-0.35, 0.35), y + U.rand(0.05, 0.4), U.rand(-0.3, 0.3));
      p.sp.material.color.setHex(U.pick([0xd8d2c6, 0xc7c0b4, 0xe6e0d4]));
      p.sp.visible = true;
      spawned++;
    }
  },

  _updatePuffs(dt, move) {
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      const t = 1 - p.life / p.max;
      p.sp.position.x += p.vx * dt;
      p.sp.position.y += p.vy * dt;
      p.sp.position.z += p.vz * dt + move;
      p.vy -= 4.5 * dt;
      const s = p.size * (0.5 + t * 1.3);
      p.sp.scale.set(s, s, 1);
      p.sp.material.opacity = (1 - t) * 0.8;
      if (p.life <= 0) {
        p.sp.visible = false;
        p.sp.material.opacity = 0;
      }
      }
    },

    /* ---------- 道具对象池 ---------- */
    _createProp(type) {
      const g = PROP_DEFS[type]();
      g.visible = false;
      this.scene.add(g);
      if (!this.pools[type]) this.pools[type] = [];
      return g;
    },

    _acquire(type) {
      const pool = this.pools[type];
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].visible) return pool[i];
      }
      const g = this._createProp(type);
      pool.push(g);
      return g;
    },

    _spawnProp(type, side, z) {
      const g = this._acquire(type);
      const inner = U.rand(0, 1) < 0.55;
      const x = inner ? side * U.rand(5.4, 7.6) : side * U.rand(8.4, 12.5);
      g.position.set(x, 0.3, z);
      // 让路灯 / 广告牌朝向铁道
      g.rotation.y = side > 0 ? Math.PI : 0;
      g.visible = true;
      g.userData.type = type;
      this.active.push(g);
      return g;
    },

    /* ---------- 楼房：外墙贴图变体 ---------- */
    _buildFacades() {
      this.facadeTex = [];
      const sizes = [[2, 2], [2, 3], [3, 3], [3, 4], [4, 5], [2, 4]];
      for (let v = 0; v < 2; v++) {
        sizes.forEach((s) => {
          this.facadeTex.push(SG.Tex.facade(v, s[0], s[1]));
        });
      }
    },

    _buildBuildings() {
      const count = 46;
      for (let i = 0; i < count; i++) {
        const g = new THREE.Group();
        const m = new THREE.MeshLambertMaterial({
          map: U.pick(this.facadeTex),
          color: U.pick(P.buildingColors)
        });
        const body = new THREE.Mesh(geo('box', BOX), m);
        g.add(body);

        // 楼顶：女儿墙
        const cap = new THREE.Mesh(geo('box', BOX), matOf(0xb9bcc4));
        cap.scale.set(1.06, 0.14, 1.06);
        g.add(cap);

        // 楼顶设备（随机显隐）
        const ac = bx(2.2, 1.0, 1.6, PLATE(0x9aa2ad, 2, 1));
        ac.position.set(1.6, 0.6, 0.8);
        g.add(ac);

        const antenna = new THREE.Group();
        const mast = cyl(0.06, 0.08, 3.2, 6, METAL(0x8f97a3, 1, 5));
        mast.position.y = 1.6;
        antenna.add(mast);
        const tip = sph(0.16, P.red, 8);
        tip.position.y = 3.3;
        antenna.add(tip);
        antenna.position.set(-1.4, 0.1, -1.0);
        g.add(antenna);

        const tank = new THREE.Group();
        const drum = cyl(1.0, 1.0, 1.6, 10, PAINT(0xa8927a, 2, 1));
        drum.position.y = 1.9;
        tank.add(drum);
        for (const sx of [-1, 1]) {
          const leg = bx(0.14, 1.1, 0.14, METAL(0x6f5c46, 1, 2));
          leg.position.set(sx * 0.7, 0.55, 0);
          tank.add(leg);
        }
        tank.position.set(0.4, 0.1, 0.2);
        g.add(tank);

        g.userData = { body: body, cap: cap, ac: ac, antenna: antenna, tank: tank };

        this.scene.add(g);
        this.buildings.push(g);
        this._respawnBuilding(g, -U.rand(10, 330));
      }
    },

    _respawnBuilding(g, zPos) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const w = U.rand(4, 9);
      const h = U.rand(7, 34);
      const d = U.rand(4, 9);
      const ud = g.userData;

      ud.body.scale.set(w, h, d);
      ud.body.position.y = h / 2;
      ud.cap.scale.set(w * 1.06, 0.5, d * 1.06);
      ud.cap.position.y = h;

      // 外墙贴图按楼体尺寸换个重复度，窗户比例才自然
      ud.body.material.map = U.pick(this.facadeTex);
      ud.body.material.color.set(U.pick(P.buildingColors));

      // 楼顶设备随机显隐，避免每栋都一样
      ud.ac.visible = Math.random() < 0.7;
      ud.antenna.visible = Math.random() < 0.45;
      ud.tank.visible = Math.random() < 0.3;
      ud.ac.position.set(w * 0.22, h + 0.5, d * 0.2);
      ud.antenna.position.set(-w * 0.2, h, -d * 0.18);
      ud.tank.position.set(w * 0.08, h, d * 0.06);

      const dist = U.rand(15, 40);
      g.position.set(side * dist, 0.3, zPos);
      g.rotation.y = U.rand(-0.16, 0.16);
    },

    /* ---------- 远景天际线（一次 draw call） ---------- */
    _buildSkyline() {
      const count = 64;
      const mesh = new THREE.InstancedMesh(
        geo('box', BOX),
        new THREE.MeshLambertMaterial({ color: 0xffffff }),
        count
      );
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.scene.add(mesh);

      this._skySpan = 460;
      this._skyData = [];
      this._skyDummy = new THREE.Object3D();
      const col = new THREE.Color();

      for (let i = 0; i < count; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const d = {
          x: side * U.rand(32, 150),
          w: U.rand(8, 24),
          h: U.rand(14, 62),
          dep: U.rand(8, 24),
          z: -U.rand(0, this._skySpan)
        };
        this._skyData.push(d);
        mesh.setColorAt(i, col.set(U.pick([0x9dc4ea, 0x84b2e0, 0xafcff0, 0x76a6d6])));
      }
      mesh.instanceColor.needsUpdate = true;
      this.skyline = mesh;
      this._writeSkyline();
    },

    _writeSkyline() {
      const d = this._skyDummy;
      for (let i = 0; i < this._skyData.length; i++) {
        const s = this._skyData[i];
        d.position.set(s.x, s.h / 2, s.z);
        d.scale.set(s.w, s.h, s.dep);
        d.updateMatrix();
        this.skyline.setMatrixAt(i, d.matrix);
      }
      this.skyline.instanceMatrix.needsUpdate = true;
    },

    /* ---------- 每帧更新 ---------- */
    update(dt, speed) {
      const move = speed * dt;

      // 近景楼房
      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        b.position.z += move;
        if (b.position.z > 26) this._respawnBuilding(b, -U.rand(260, 400));
      }

      // 远景天际线
      for (let i = 0; i < this._skyData.length; i++) {
        const s = this._skyData[i];
        s.z += move * 0.75;
        if (s.z > 60) {
          s.z -= this._skySpan;
          s.h = U.rand(14, 62);
          s.w = U.rand(8, 24);
        }
      }
      this._writeSkyline();

      // 街道道具（两侧各来一件，偶尔再补一件远景，填满空旷）
      this.propTravel += move;
      if (this.propTravel >= this.propGap) {
        this.propTravel -= this.propGap;
        for (const side of [-1, 1]) {
          const pool = U.rand(0, 1) < 0.5 ? INNER_TYPES : OUTER_TYPES;
          this._spawnProp(U.weighted(pool), side, C.SPAWN_Z);
          if (Math.random() < 0.45) {
            this._spawnProp(U.weighted(OUTER_TYPES), side, C.SPAWN_Z - U.rand(2.5, 5));
          }
        }
      }

      // 尘粒
      this._updatePuffs(dt, move);

      // 回收
      for (let i = this.active.length - 1; i >= 0; i--) {
        const g = this.active[i];
        g.position.z += move;
        if (g.position.z > C.DESPAWN_Z + 6) {
          g.visible = false;
          this.active.splice(i, 1);
        }
      }
    },

    reset() {
      this.active.forEach((g) => (g.visible = false));
      this.active.length = 0;
      this.propTravel = 0;
      this.puffs.forEach((p) => { p.life = 0; p.sp.visible = false; });
      this.buildings.forEach((b) => this._respawnBuilding(b, -U.rand(10, 340)));
      this._skyData.forEach((s) => { s.z = -U.rand(0, this._skySpan); });
      this._writeSkyline();
    }
  };
})();
