/**
 * obstacles.js —— 障碍物与金币
 *
 * 障碍类型与应对方式：
 *   low   矮障碍（栏杆/木箱/油桶）  → 跳跃
 *   high  高悬挂（闸门/管线/脚手架）→ 下滚
 *   train 列车/集装箱              → 只能换道躲避
 *
 * 每种类型都有多种外观变体，池内对象在创建时随机分配，保证画面不单调。
 */
(function () {
  const C = SG.CONFIG;
  const P = SG.PALETTE;
  const U = SG.Utils;

  /* 碰撞盒定义（相对 group 原点，原点在轨道面上）
     scale 会把整套外观等比放大，碰撞尺寸已按 scale 换算好
     low   → 跳    high → 滚    train → 换道    pillar → 换道（短而高） */
  const DEFS = {
    low: { halfW: 1.02, halfD: 0.44, bottom: 0.0, top: 1.24, gapAfter: 0, scale: 1.18 },
    high: { halfW: 1.12, halfD: 0.40, bottom: 1.32, top: 3.34, gapAfter: 0, scale: 1.15 },
    train: { halfW: 1.06, halfD: 5.00, bottom: 0.0, top: 3.20, gapAfter: 18, scale: 1.13 },
    pillar: { halfW: 1.00, halfD: 0.75, bottom: 0.0, top: 3.60, gapAfter: 9, scale: 1.12 }
  };

  const matCache = {};
  function matOf(color, opts) {
    const k = 'c' + color;
    if (!matCache[k]) {
      // 叠一层细颗粒，避免大面积纯色看起来像塑料
      matCache[k] = new THREE.MeshLambertMaterial(
        Object.assign({ color: color, map: SG.Tex.grain() }, opts || {})
      );
    }
    return matCache[k];
  }
  function emissive(color, intensity) {
    return new THREE.MeshLambertMaterial({
      color: color, emissive: color, emissiveIntensity: intensity || 0.55
    });
  }

  /* 金属 / 烤漆 / 花纹钢板：走 SG.Mat，带高光，避免"塑料块"观感 */
  const METAL = function (c, rx, ry) { return SG.Mat.metal(c, rx, ry); };
  const PAINT = function (c, rx, ry) { return SG.Mat.paint(c, rx, ry); };
  const CHROME = function (c, rx, ry) { return SG.Mat.chrome(c, rx, ry); };
  const PLATE = function (c, rx, ry) { return SG.Mat.plate(c, rx, ry); };

  /* 警示条纹配色：不止黄黑，还有红白 / 蓝白 / 橙黑 */
  const STRIPES = [
    ['#ffc531', '#2b2b2b'],
    ['#ffc531', '#2b2b2b'],
    ['#e8453c', '#f2f5f9'],
    ['#3d7ee8', '#f2f5f9'],
    ['#ff8a2b', '#2c3340']
  ];
  const HAZARD = function (rx, ry) {
    const s = U.pick(STRIPES);
    return new THREE.MeshLambertMaterial({ map: SG.Tex.hazard(rx, ry, s[0], s[1]) });
  };
  const WOOD = function () { return new THREE.MeshLambertMaterial({ map: SG.Tex.wood(1, 1) }); };

  function bx(w, h, d, material) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, typeof material === 'object' ? material : matOf(material));
    m.castShadow = true;
    return m;
  }
  function cylMesh(rt, rb, h, seg, material) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, h, seg),
      typeof material === 'object' ? material : matOf(material)
    );
    m.castShadow = true;
    return m;
  }

  /* =========================================================
   *  矮障碍（跳）
   * ========================================================= */
  function buildLow() {
    const g = new THREE.Group();
    const variant = U.randInt(0, 4);

    if (variant === 0) {
      /* A 字施工护栏 + 锥桶 */
      const haz = HAZARD(2, 1);
      for (const sx of [-1, 1]) {
        const frame = bx(0.1, 1.0, 0.62, PAINT(P.orange));
        frame.position.set(sx * 0.8, 0.5, 0);
        frame.rotation.x = 0.12;
        g.add(frame);
        const foot = bx(0.3, 0.09, 0.62, METAL(P.dark));
        foot.position.set(sx * 0.8, 0.05, 0);
        g.add(foot);
      }
      const plank = bx(1.7, 0.28, 0.1, haz);
      plank.position.y = 0.86;
      g.add(plank);
      const plank2 = bx(1.7, 0.16, 0.08, haz);
      plank2.position.y = 0.5;
      g.add(plank2);

      const cone = cylMesh(0.02, 0.2, 0.42, 10, PAINT(P.orange));
      cone.position.set(0.1, 1.21, 0);
      g.add(cone);

    } else if (variant === 1) {
      /* 木箱堆 */
      const wood = WOOD();
      const positions = [
        [-0.42, 0.26, 0], [0.42, 0.26, 0], [0, 0.78, 0]
      ];
      const sizes = [[0.8, 0.52, 0.8], [0.8, 0.52, 0.8], [0.84, 0.52, 0.84]];
      positions.forEach(function (p, i) {
        const c = bx(sizes[i][0], sizes[i][1], sizes[i][2], wood);
        c.position.set(p[0], p[1], p[2]);
        g.add(c);
        // 箱角加固条
        for (const sx of [-1, 1]) {
          const edge = bx(sizes[i][0] * 0.1, sizes[i][1] * 1.02, sizes[i][2] * 1.04, 0x8a5c31);
          edge.position.set(p[0] + sx * sizes[i][0] * 0.46, p[1], p[2]);
          g.add(edge);
        }
      });

    } else if (variant === 2) {
      /* 三只施工油桶 */
      const xs = [-0.62, 0, 0.62];
      xs.forEach(function (x, i) {
        const h = i === 1 ? 0.92 : 0.8;
        const b = cylMesh(0.34, 0.34, h, 12, PAINT(i === 1 ? P.orange : 0xff8c1a));
        b.position.set(x, h / 2, 0);
        b.rotation.y = U.rand(0, 1);
        g.add(b);
        for (const y of [h * 0.32, h * 0.7]) {
          const band = cylMesh(0.35, 0.35, 0.09, 12, METAL(P.white));
          band.position.set(x, y, 0);
          g.add(band);
        }
      });

    } else if (variant === 3) {
      /* 混凝土隔离墩（新泽西护栏），墩身带反光条 + 花纹钢踏板 */
      const bodyMat = matOf(0xcdd2da);
      const base = bx(2.05, 0.34, 0.72, bodyMat);
      base.position.y = 0.17;
      g.add(base);
      const top = bx(2.05, 0.62, 0.34, bodyMat);
      top.position.y = 0.62;
      g.add(top);
      // 墩顶花纹钢踏板（金属质感）
      const tread = bx(1.9, 0.05, 0.34, PLATE(0xa8b2c0, 2, 1));
      tread.position.y = 0.62 + 0.33;
      g.add(tread);
      // 墩顶反光条
      for (const x of [-0.68, 0, 0.68]) {
        const refl = bx(0.42, 0.3, 0.03, emissive(0xfff4c8, 0.5));
        refl.position.set(x, 0.64, 0.19);
        g.add(refl);
      }
      // 两端警示小旗
      for (const sx of [-1, 1]) {
        const pole = cylMesh(0.035, 0.035, 1.0, 6, CHROME(0xdae4f0));
        pole.position.set(sx * 1.02, 0.8, 0);
        g.add(pole);
        const flag = bx(0.02, 0.5, 0.3, HAZARD(1, 2));
        flag.position.set(sx * 1.02, 1.05, 0);
        g.add(flag);
      }

    } else {
      /* 密集锥桶阵 + 施工牌 */
      const xs = [-0.78, -0.26, 0.26, 0.78];
      xs.forEach(function (x) {
        const c = cylMesh(0.02, 0.21, 0.62, 10, PAINT(P.orange));
        c.position.set(x, 0.31, U.rand(-0.16, 0.16));
        g.add(c);
        const band = cylMesh(0.13, 0.155, 0.12, 10, METAL(P.white));
        band.position.set(c.position.x, 0.33, c.position.z);
        g.add(band);
        const foot = bx(0.42, 0.05, 0.42, PLATE(0x8b93a0, 1, 1));
        foot.position.set(x, 0.025, c.position.z);
        g.add(foot);
      });
      const sign = bx(1.1, 0.7, 0.08, HAZARD(2, 1));
      sign.position.set(0, 1.0, -0.1);
      sign.rotation.x = -0.08;
      g.add(sign);
      for (const sx of [-1, 1]) {
        const leg = bx(0.09, 0.72, 0.09, METAL(0x8b93a0));
        leg.position.set(sx * 0.42, 0.36, -0.1);
        g.add(leg);
      }
    }
    return g;
  }

  /* =========================================================
   *  高悬挂（下滚）
   * ========================================================= */
  function buildHigh() {
    const g = new THREE.Group();
    const variant = U.randInt(0, 4);

    if (variant === 0) {
      /* 限高闸门：两侧立柱 + 顶部横梁 + 悬挂警示牌 */
      for (const sx of [-1, 1]) {
        const post = bx(0.22, 3.0, 0.22, PAINT(0x2b74ff));
        post.position.set(sx * 0.95, 1.5, 0);
        g.add(post);
        const foot = bx(0.5, 0.14, 0.6, METAL(P.dark));
        foot.position.set(sx * 0.95, 0.07, 0);
        g.add(foot);
      }
      const beam = bx(2.1, 0.5, 0.3, HAZARD(4, 1));
      beam.position.y = 2.75;
      g.add(beam);

      // 悬挂的软性挡帘（下滚可从下方通过）
      const curtain = bx(1.85, 1.0, 0.1, new THREE.MeshLambertMaterial({
        color: 0xffcb3d, emissive: 0x3a2a00, side: THREE.DoubleSide
      }));
      curtain.position.y = 1.75;
      g.add(curtain);
      for (let i = -2; i <= 2; i++) {
        const strip = bx(0.28, 0.95, 0.06, new THREE.MeshLambertMaterial({
          color: i % 2 ? 0x2c3340 : 0xffcb3d, side: THREE.DoubleSide
        }));
        strip.position.set(i * 0.36, 1.72, 0.09);
        g.add(strip);
      }

    } else if (variant === 1) {
      /* 悬空管线 */
      const pipe = cylMesh(0.24, 0.24, 2.4, 12, CHROME(0xb6c3d4, 1, 2));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.y = 1.85;
      g.add(pipe);
      for (const x of [-0.9, 0, 0.9]) {
        const flange = cylMesh(0.31, 0.31, 0.12, 12, METAL(0x6d7684));
        flange.rotation.z = Math.PI / 2;
        flange.position.set(x, 1.85, 0);
        g.add(flange);
      }
      // 两侧支撑
      for (const sx of [-1, 1]) {
        const support = bx(0.18, 3.1, 0.18, METAL(0x8892a0, 1, 3));
        support.position.set(sx * 1.05, 1.55, 0);
        g.add(support);
        const brace = bx(0.5, 0.12, 0.12, METAL(0x6d7684));
        brace.position.set(sx * 0.82, 1.62, 0);
        brace.rotation.z = sx * 0.7;
        g.add(brace);
      }
      // 警示标志
      const sign = bx(0.9, 0.36, 0.06, new THREE.MeshLambertMaterial({
        color: 0xff3b30, emissive: 0x400000
      }));
      sign.position.set(0, 1.32, 0.1);
      g.add(sign);

    } else if (variant === 2) {
      /* 低矮脚手架横杆（镀锌钢管） */
      const pipeMat = CHROME(0xc4cfdd, 1, 2);
      for (const sx of [-1, 1]) {
        const post = bx(0.16, 3.0, 0.16, pipeMat);
        post.position.set(sx * 1.0, 1.5, 0);
        g.add(post);
        for (const y of [1.35, 2.6]) {
          const bar = bx(2.2, 0.12, 0.12, pipeMat);
          bar.position.set(0, y, 0);
          g.add(bar);
        }
        // 斜撑
        const diag = bx(0.1, 1.5, 0.1, pipeMat);
        diag.position.set(sx * 0.55, 1.95, 0);
        diag.rotation.z = sx * 0.9;
        g.add(diag);
      }
      // 脚手板（花纹钢板）
      const deck = bx(2.2, 0.07, 0.7, PLATE(0x9fa8b6, 2, 1));
      deck.position.set(0, 1.4, 0);
      g.add(deck);
      const board = bx(2.0, 0.5, 0.1, HAZARD(4, 1));
      board.position.y = 1.9;
      g.add(board);

    } else if (variant === 3) {
      /* 悬吊的电缆束（从上方垂下来，下滚可过） */
      for (const sx of [-1, 1]) {
        const mast = bx(0.2, 3.6, 0.2, METAL(0x8892a0, 1, 4));
        mast.position.set(sx * 1.08, 1.8, 0);
        g.add(mast);
        const foot = bx(0.55, 0.16, 0.7, METAL(P.dark));
        foot.position.set(sx * 1.08, 0.08, 0);
        g.add(foot);
      }
      const cross = bx(2.36, 0.16, 0.16, METAL(0x8892a0));
      cross.position.y = 3.5;
      g.add(cross);
      // 下垂的电缆（用细圆柱 + 弧度近似）
      for (let i = -2; i <= 2; i++) {
        const x = i * 0.4;
        const sag = 0.35 - Math.abs(i) * 0.06;
        const cable = cylMesh(0.055, 0.055, 1.9 + sag, 8, PAINT(i % 2 ? 0x2c3340 : 0x3f4a5a));
        cable.position.set(x, 2.75, 0);
        cable.rotation.z = i * 0.04;
        g.add(cable);
      }
      const sign = bx(1.0, 0.8, 0.06, HAZARD(2, 2));
      sign.position.set(0, 1.55, 0.12);
      g.add(sign);

    } else {
      /* 悬吊集装箱（吊在半空，只能下滚通过） */
      const liv = U.pick(LIVERIES);
      const body = bx(2.0, 1.4, 1.1, PAINT(liv.body));
      body.position.y = 2.05;
      g.add(body);
      // 瓦楞边条
      for (const sx of [-1, 1]) {
        const corr = bx(0.1, 1.42, 1.14, PAINT(liv.stripe));
        corr.position.set(sx * 1.0, 2.05, 0);
        g.add(corr);
      }
      // 吊索（镀锌钢丝绳）
      for (const sx of [-1, 1]) {
        const rope = cylMesh(0.035, 0.035, 1.5, 6, CHROME(0xc4cfdd, 1, 3));
        rope.position.set(sx * 0.8, 3.5, 0);
        g.add(rope);
      }
      const beam = bx(2.2, 0.2, 0.24, METAL(0xd8b23c, 1, 2));
      beam.position.y = 4.3;
      g.add(beam);
      // 底部警示灯
      const lamp = cylMesh(0.1, 0.1, 0.14, 8, emissive(0xff5a3c, 0.85));
      lamp.position.set(0, 1.28, 0);
      g.add(lamp);
    }
    return g;
  }

  /* =========================================================
   *  列车 / 集装箱（换道）
   * ========================================================= */
  const LIVERIES = [
    { body: 0xe8453c, stripe: 0xffd23f },
    { body: 0x3d7ee8, stripe: 0xf2f5f9 },
    { body: 0x39a86b, stripe: 0xffd23f },
    { body: 0xf2a33c, stripe: 0x2c3340 },
    { body: 0x8a4fd8, stripe: 0xffffff }
  ];

  function buildTrain() {
    const g = new THREE.Group();
    const liv = U.pick(LIVERIES);
    const LEN = 8.8;

    // 车厢主体（烤漆铁皮，带高光）
    const body = bx(1.84, 2.3, LEN, PAINT(liv.body, 2, 6));
    body.position.y = 1.55;
    g.add(body);

    // 底部裙板（不锈钢）
    const skirt = bx(1.7, 0.5, LEN, METAL(0x4a5260, 1, 8));
    skirt.position.y = 0.42;
    g.add(skirt);

    // 车窗带（深色玻璃）
    const glass = bx(1.88, 0.72, LEN - 0.6, new THREE.MeshPhongMaterial({
      color: 0x8fd0ff, emissive: 0x0d2b45, specular: 0xffffff, shininess: 140
    }));
    glass.position.y = 2.0;
    g.add(glass);
    // 窗框分隔
    for (let z = -3.2; z <= 3.2; z += 1.6) {
      const div = bx(1.9, 0.8, 0.12, METAL(0x3a4350));
      div.position.set(0, 2.0, z);
      g.add(div);
    }

    // 车门
    for (const dz of [-2.0, 2.0]) {
      for (const sx of [-1, 1]) {
        const door = bx(0.06, 1.7, 1.0, METAL(0x3a4350));
        door.position.set(sx * 0.93, 1.35, dz);
        g.add(door);
      }
    }

    // 腰线
    const stripe = bx(1.88, 0.24, LEN + 0.05, PAINT(liv.stripe, 1, 8));
    stripe.position.y = 0.95;
    g.add(stripe);

    // 车顶
    const roof = bx(1.7, 0.22, LEN - 0.2, METAL(0xa4acb8, 1, 8));
    roof.position.y = 2.8;
    g.add(roof);
    for (const dz of [-2.4, 1.6]) {
      const ac = bx(1.1, 0.34, 1.4, METAL(0x8a929d));
      ac.position.set(0, 3.0, dz);
      g.add(ac);
    }

    // 车头（面向玩家的一侧）
    const cab = bx(1.84, 1.9, 0.5, PAINT(0x3a4350));
    cab.position.set(0, 1.5, LEN / 2 + 0.2);
    g.add(cab);
    const windshield = bx(1.5, 1.0, 0.12, new THREE.MeshPhongMaterial({
      color: 0x8fd0ff, emissive: 0x0d2b45, specular: 0xffffff, shininess: 140
    }));
    windshield.position.set(0, 2.15, LEN / 2 + 0.46);
    g.add(windshield);
    for (const sx of [-1, 1]) {
      const light = cylMesh(0.16, 0.16, 0.14, 10, emissive(0xfff2b0, 0.7));
      light.rotation.x = Math.PI / 2;
      light.position.set(sx * 0.6, 1.0, LEN / 2 + 0.48);
      g.add(light);
    }
    const bumper = bx(1.9, 0.3, 0.3, METAL(0x3a4350));
    bumper.position.set(0, 0.55, LEN / 2 + 0.4);
    g.add(bumper);

    // 转向架 / 车轮
    for (const dz of [-3.0, 3.0]) {
      const bogie = bx(1.5, 0.5, 1.6, METAL(0x3a4350));
      bogie.position.set(0, 0.5, dz);
      g.add(bogie);
      for (const sx of [-1, 1]) {
        const wheel = cylMesh(0.28, 0.28, 0.14, 12, CHROME(0x9aa4b2));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * 0.75, 0.3, dz);
        g.add(wheel);
      }
    }

    // 侧面涂装编号
    for (const sx of [-1, 1]) {
      const num = bx(0.04, 0.3, 0.5, PAINT(liv.stripe));
      num.position.set(sx * 0.93, 1.6, 3.4);
      g.add(num);
    }

    return g;
  }

  /* =========================================================
   *  立柱 / 桥墩（短而高，只能换道躲）
   * ========================================================= */
  function buildPillar() {
    const g = new THREE.Group();
    const variant = U.randInt(0, 2);

    if (variant === 0) {
      /* 混凝土桥墩：下粗上细，带检修爬梯和警示条 */
      const bodyMat = METAL(0xbcc2c9, 1, 3);
      const base = bx(1.7, 0.5, 1.3, METAL(0x9aa1a9, 1, 1));
      base.position.y = 0.25;
      g.add(base);
      const shaft = bx(1.28, 2.9, 0.94, bodyMat);
      shaft.position.y = 1.95;
      g.add(shaft);
      const cap = bx(1.7, 0.5, 1.2, METAL(0x9aa1a9, 1, 1));
      cap.position.y = 3.62;
      g.add(cap);
      // 顶部承台
      for (const sz of [-1, 1]) {
        const pad = cylMesh(0.16, 0.16, 0.3, 8, CHROME(0x8b93a0));
        pad.position.set(0, 3.9, sz * 0.35);
        g.add(pad);
      }
      // 警示条纹腰带
      const band = bx(1.3, 0.5, 0.98, HAZARD(2, 1));
      band.position.y = 0.75;
      g.add(band);
      // 爬梯
      for (let y = 0.9; y <= 3.2; y += 0.34) {
        const rung = bx(0.5, 0.05, 0.06, METAL(0x6d7684, 1, 1));
        rung.position.set(0, y, 0.5);
        g.add(rung);
      }
      for (const sx of [-1, 1]) {
        const rail = bx(0.05, 2.6, 0.05, METAL(0x6d7684, 1, 4));
        rail.position.set(sx * 0.24, 2.05, 0.5);
        g.add(rail);
      }

    } else if (variant === 1) {
      /* 立式集装箱 / 货柜树 */
      const liv = U.pick(LIVERIES);
      const body = bx(1.7, 2.7, 1.15, PAINT(liv.body, 2, 3));
      body.position.y = 1.7;
      g.add(body);
      // 瓦楞竖条
      for (let x = -0.7; x <= 0.7; x += 0.28) {
        const corr = bx(0.05, 2.6, 1.19, PAINT(liv.stripe, 1, 3));
        corr.position.set(x, 1.7, 0);
        g.add(corr);
      }
      // 角柱
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const post = bx(0.16, 2.85, 0.16, METAL(0x2a2f38, 1, 4));
          post.position.set(sx * 0.8, 1.72, sz * 0.53);
          g.add(post);
        }
      }
      const roof = bx(1.8, 0.16, 1.25, METAL(0x2a2f38, 1, 1));
      roof.position.y = 3.12;
      g.add(roof);
      const foot = bx(1.9, 0.24, 1.35, METAL(0x3a4049, 1, 1));
      foot.position.y = 0.12;
      g.add(foot);

    } else {
      /* 桥墩 + 悬臂信号杆（高而窄） */
      const shaft = bx(1.0, 3.4, 0.8, METAL(0xa8b0b8, 1, 4));
      shaft.position.y = 1.7;
      g.add(shaft);
      const base = bx(1.5, 0.34, 1.2, METAL(0x8b93a0, 1, 1));
      base.position.y = 0.17;
      g.add(base);
      const band = bx(1.02, 0.44, 0.82, HAZARD(1, 2));
      band.position.y = 2.7;
      g.add(band);
      // 侧面信号灯箱
      const box = bx(0.5, 0.9, 0.36, PAINT(0x2c3340));
      box.position.set(0, 3.55, 0.3);
      g.add(box);
      const lens = cylMesh(0.13, 0.13, 0.08, 10, emissive(0xff4a3c, 0.9));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 3.75, 0.5);
      g.add(lens);
      const lens2 = cylMesh(0.13, 0.13, 0.08, 10, emissive(0x3cff88, 0.75));
      lens2.rotation.x = Math.PI / 2;
      lens2.position.set(0, 3.35, 0.5);
      g.add(lens2);
    }
    return g;
  }

  const BUILDERS = { low: buildLow, high: buildHigh, train: buildTrain, pillar: buildPillar };

  /* =========================================================
   *  ObstacleManager
   * ========================================================= */
  SG.ObstacleManager = function (scene) {
    this.scene = scene;
    this.pools = { low: [], high: [], train: [], pillar: [] };
    this.active = [];
    this.prewarm();
  };

  SG.ObstacleManager.prototype = {
    prewarm() {
      const counts = { low: 9, high: 9, train: 4, pillar: 4 };
      Object.keys(counts).forEach((type) => {
        for (let i = 0; i < counts[type]; i++) {
          const g = BUILDERS[type]();
          g.visible = false;
          this.scene.add(g);
          this.pools[type].push(g);
        }
      });
    },

    _acquire(type) {
      const pool = this.pools[type];
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].visible) return pool[i];
      }
      const g = BUILDERS[type]();
      this.scene.add(g);
      pool.push(g);
      return g;
    },

    _spawn(type, laneIndex, z) {
      const def = DEFS[type];
      const g = this._acquire(type);
      g.visible = true;
      g.scale.setScalar(def.scale);
      g.position.set(C.LANE_X[laneIndex], 0, z);
      g.userData = {
        type: type,
        lane: laneIndex,
        halfW: def.halfW,
        halfD: def.halfD,
        bottom: def.bottom,
        top: def.top,
        gapAfter: def.gapAfter
      };
      this.active.push(g);
      return g;
    },

    /** 生成一行障碍，保证至少一条车道可通过 */
    spawnRow(difficulty, distance) {
      const lanes = U.shuffle([0, 1, 2]);
      const maxBlocked = distance < 260 ? 1 : (Math.random() < 0.22 + 0.45 * difficulty ? 2 : 1);
      const blockedCount = U.randInt(1, maxBlocked);
      const blocked = lanes.slice(0, blockedCount);
      const free = lanes.slice(blockedCount);

      let extraGap = 0;
      for (let i = 0; i < blocked.length; i++) {
        const r = Math.random();
        const type = r < 0.34 ? 'low' : (r < 0.62 ? 'high' : (r < 0.86 ? 'train' : 'pillar'));
        const g = this._spawn(type, blocked[i], C.SPAWN_Z);
        extraGap = Math.max(extraGap, g.userData.gapAfter);
      }
      return { freeLanes: free, extraGap: extraGap };
    },

    update(dt, speed) {
      const move = speed * dt;
      for (let i = this.active.length - 1; i >= 0; i--) {
        const o = this.active[i];
        o.position.z += move;
        if (o.position.z - o.userData.halfD > C.DESPAWN_Z) {
          o.visible = false;
          this.active.splice(i, 1);
        }
      }
    },

    getActive() {
      return this.active;
    },

    clear() {
      this.active.forEach((o) => (o.visible = false));
      this.active.length = 0;
    }
  };

  /* =========================================================
   *  CoinManager
   * ========================================================= */
  SG.CoinManager = function (scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this._t = 0;

    // 共享几何 / 材质，减少开销
    this._geoBody = new THREE.CylinderGeometry(0.36, 0.36, 0.1, 20);
    this._geoRing = new THREE.TorusGeometry(0.36, 0.055, 8, 20);
    this._geoStar = new THREE.BoxGeometry(0.22, 0.22, 0.14);
    this._matBody = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x6b4b00 });
    this._matRing = new THREE.MeshLambertMaterial({ color: 0xffe98a, emissive: 0x6b4b00 });
    this._matStar = new THREE.MeshLambertMaterial({ color: 0xfff6cf, emissive: 0x4a3400 });

    this._prewarm(44);
  };

  SG.CoinManager.prototype = {
    _makeCoin() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(this._geoBody, this._matBody);
      body.rotation.x = Math.PI / 2;
      g.add(body);
      const ring = new THREE.Mesh(this._geoRing, this._matRing);
      g.add(ring);
      const star = new THREE.Mesh(this._geoStar, this._matStar);
      star.rotation.z = Math.PI / 4;
      g.add(star);
      g.visible = false;
      this.scene.add(g);
      return g;
    },

    _prewarm(n) {
      for (let i = 0; i < n; i++) this.pool.push(this._makeCoin());
    },

    _acquire() {
      for (let i = 0; i < this.pool.length; i++) {
        if (!this.pool[i].visible) return this.pool[i];
      }
      const c = this._makeCoin();
      this.pool.push(c);
      return c;
    },

    _place(laneIndex, z, y) {
      const g = this._acquire();
      g.visible = true;
      g.position.set(C.LANE_X[laneIndex], y, z);
      g.userData = { lane: laneIndex };
      this.active.push(g);
      return g;
    },

    spawnLine(laneIndex, startZ, count, y) {
      const cy = y || 1.0;
      for (let i = 0; i < count; i++) {
        this._place(laneIndex, startZ - i * 1.5 - 1.5, cy);
      }
    },

    spawnArc(laneIndex, startZ, count) {
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        this._place(laneIndex, startZ - i * 1.4, 1.0 + Math.sin(t * Math.PI) * 1.5);
      }
    },

    update(dt, speed) {
      const move = speed * dt;
      this._t += dt;
      const spin = this._t * 3.5;
      for (let i = this.active.length - 1; i >= 0; i--) {
        const c = this.active[i];
        c.position.z += move;
        c.rotation.y = spin;
        if (c.position.z > C.DESPAWN_Z) {
          c.visible = false;
          this.active.splice(i, 1);
        }
      }
    },

    collect(coin) {
      coin.visible = false;
      const idx = this.active.indexOf(coin);
      if (idx >= 0) this.active.splice(idx, 1);
    },

    getActive() {
      return this.active;
    },

    clear() {
      this.active.forEach((c) => (c.visible = false));
      this.active.length = 0;
    }
  };
})();
