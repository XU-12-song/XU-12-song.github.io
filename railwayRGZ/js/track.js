/**
 * track.js —— 铁道本体：道砟、钢轨、枕木、站台、接触网门架、跨线桥
 *
 * 表现思路：
 *   钢轨 / 电线 / 站台等「沿 z 连续的物体」保持静止，靠贴图滚动体现速度；
 *   枕木、门架、跨线桥等「离散物体」则随世界向 +z 移动并循环回收。
 */
(function () {
  const C = SG.CONFIG;
  const P = SG.PALETTE;
  const U = SG.Utils;

  function lambert(color, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color: color }, opts || {}));
  }

  /* 金属 / 烤漆 / 镀铬 / 花纹钢板：带高光的 Phong，用在钢轨、门架、桥体上 */
  const METAL = function (c, rx, ry) { return SG.Mat.metal(c, rx, ry); };
  const CHROME = function (c, rx, ry) { return SG.Mat.chrome(c, rx, ry); };
  const PAINT = function (c, rx, ry) { return SG.Mat.paint(c, rx, ry); };
  const PLATE = function (c, rx, ry) { return SG.Mat.plate(c, rx, ry); };

  SG.Track = function (scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._layers = [];      // 需要接收阴影的地面
    this._movers = [];      // 需要随世界移动的离散物体
    this._parallax = [];    // 只做视差移动的物体（如电线杆更远的背景）

    this._buildGround();
    this._buildTrackEdge();
    this._buildRails();
    this._buildSleepers();
    this._buildGantries();
    this._buildBridges();
    this._buildStationSigns();
  };

  SG.Track.prototype = {
    /* ================= 地面分层 ================= */
    _buildGround() {
      const L = C.TRACK_LENGTH;
      const groundZ = -L / 2 + C.DESPAWN_Z + 6;

      // 道砟（碎石）
      this.gravelTile = 3.5;
      this.gravelTex = SG.Tex.gravel(3, Math.round(L / this.gravelTile));
      const ballast = new THREE.Mesh(
        new THREE.PlaneGeometry(9.2, L),
        new THREE.MeshLambertMaterial({ map: this.gravelTex })
      );
      ballast.rotation.x = -Math.PI / 2;
      ballast.position.set(0, 0, groundZ);
      ballast.receiveShadow = true;
      this.group.add(ballast);
      this._layers.push(ballast);

      // 两侧人行道 / 站台
      this.concreteTile = 4;
      this.concreteTex = SG.Tex.concrete(2, Math.round(L / this.concreteTile));
      const shoulderGeo = new THREE.PlaneGeometry(7.6, L);
      for (const sx of [-1, 1]) {
        const sh = new THREE.Mesh(shoulderGeo, new THREE.MeshLambertMaterial({ map: this.concreteTex }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.set(sx * (4.6 + 3.8), 0.3, groundZ);
        sh.receiveShadow = true;
        this.group.add(sh);
        this._layers.push(sh);

        // 路缘石
        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, L), lambert(P.curb));
        curb.position.set(sx * 4.72, 0.17, groundZ);
        this.group.add(curb);
        this._layers.push(curb);
      }

      // 更外侧的草地（大幅加宽，避免两侧露出空白）
      this.grassTile = 6;
      this.grassTex = SG.Tex.grass(8, Math.round(L / this.grassTile));
      const grassGeo = new THREE.PlaneGeometry(60, L);
      for (const sx of [-1, 1]) {
        const gr = new THREE.Mesh(grassGeo, new THREE.MeshLambertMaterial({ map: this.grassTex }));
        gr.rotation.x = -Math.PI / 2;
        gr.position.set(sx * (8.4 + 30), 0.28, groundZ);
        gr.receiveShadow = true;
        this.group.add(gr);
      }

      // 兜底大地面：远到雾里都不断，彻底消除“旁边穿帮”
      const baseGeo = new THREE.PlaneGeometry(900, L + 900);
      const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0x9aa7b5 }));
      base.rotation.x = -Math.PI / 2;
      base.position.set(0, -0.02, groundZ - 300);
      this.group.add(base);
    },

    /* ================= 轨道边界：挡墙 + 安全线，强化主体 ================= */
    _buildTrackEdge() {
      const L = C.TRACK_LENGTH;
      const z = -L / 2 + C.DESPAWN_Z + 6;

      // 两侧矮挡墙（把跑道从城市地面里“框”出来）
      const wallMat = new THREE.MeshLambertMaterial({ color: 0xa8adb6 });
      const capMat = new THREE.MeshLambertMaterial({ color: 0xdadde3 });
      for (const sx of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, L), wallMat);
        wall.position.set(sx * 4.95, 0.42, z);
        wall.receiveShadow = true;
        this.group.add(wall);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, L), capMat);
        cap.position.set(sx * 4.95, 0.88, z);
        this.group.add(cap);
      }

      // 站台内侧的黄色安全线（静止长条，靠贴图滚动体现速度）
      this.safetyTile = 4;
      this.safetyTex = SG.Tex.hazard(1, Math.round(L / this.safetyTile));
      const lineGeo = new THREE.PlaneGeometry(0.44, L);
      for (const sx of [-1, 1]) {
        const line = new THREE.Mesh(
          lineGeo,
          new THREE.MeshLambertMaterial({ map: this.safetyTex })
        );
        line.rotation.x = -Math.PI / 2;
        line.position.set(sx * 4.42, 0.31, z);
        this.group.add(line);
      }
    },

    /* ================= 钢轨（静止长条） ================= */
    _buildRails() {
      const L = C.TRACK_LENGTH;
      const z = -L / 2 + C.DESPAWN_Z + 6;
      const railMat = new THREE.MeshPhongMaterial({
        color: P.rail,
        shininess: 90,
        specular: 0xffffff
      });
      const footMat = METAL(0x8f97a3, 1, Math.round(L / 8));

      this.rails = [];
      C.LANE_X.forEach(function (lx) {
        [-C.RAIL_OFFSET, C.RAIL_OFFSET].forEach(function (off) {
          // 轨底
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, L), footMat);
          foot.position.set(lx + off, 0.24, z);
          // 轨头（有高光的亮面，让铁轨一眼可见）
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, L), railMat);
          head.position.set(lx + off, 0.36, z);
          this.group.add(foot, head);
          this.rails.push(head);
        }, this);
      }, this);
    },

    /* ================= 枕木（实例化 + 循环滚动） ================= */
    _buildSleepers() {
      this.sleeperSpacing = 1.5;
      this.sleeperRows = 140;
      this.sleeperSpan = this.sleeperRows * this.sleeperSpacing;
      this.sleeperOffset = 0;

      const count = this.sleeperRows * C.LANE_X.length;
      const geo = new THREE.BoxGeometry(1.9, 0.17, 0.28);
      const mat = new THREE.MeshLambertMaterial({ color: P.sleeper });
      this.sleepers = new THREE.InstancedMesh(geo, mat, count);
      this.sleepers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.sleepers.castShadow = false;
      this.sleepers.receiveShadow = true;
      this.scene.add(this.sleepers);

      this._dummy = new THREE.Object3D();
      this._writeSleepers();
    },

    _writeSleepers() {
      const d = this._dummy;
      const span = this.sleeperSpan;
      let i = 0;
      for (let r = 0; r < this.sleeperRows; r++) {
        const z = C.DESPAWN_Z - (((r * this.sleeperSpacing + this.sleeperOffset) % span + span) % span);
        for (let l = 0; l < C.LANE_X.length; l++) {
          d.position.set(C.LANE_X[l], 0.14, z);
          d.rotation.set(0, 0, 0);
          d.scale.set(1, 1, 1);
          d.updateMatrix();
          this.sleepers.setMatrixAt(i++, d.matrix);
        }
      }
      this.sleepers.instanceMatrix.needsUpdate = true;
    },

    /* ================= 接触网门架（横跨三条轨道） ================= */
    _buildGantries() {
      this.gantryGap = 26;
      this.gantryCount = 9;
      this.gantryTravel = 0;

      this.gantryPool = [];
      const poleGeo = new THREE.BoxGeometry(0.36, 8.6, 0.36);
      const beamGeo = new THREE.BoxGeometry(12.4, 0.34, 0.34);
      const armGeo = new THREE.BoxGeometry(0.2, 0.2, 0.9);

      for (let i = 0; i < this.gantryCount; i++) {
        const g = new THREE.Group();
        const mat = METAL(P.metal, 1, 8);
        for (const sx of [-1, 1]) {
          const pole = new THREE.Mesh(poleGeo, mat);
          pole.position.set(sx * 6.1, 4.3, 0);
          pole.castShadow = true;
          g.add(pole);
          const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), PLATE(P.concrete, 1, 1));
          base.position.set(sx * 6.1, 0.6, 0);
          g.add(base);
        }
        const beam = new THREE.Mesh(beamGeo, METAL(0x8e97a4, 2, 1));
        beam.position.y = 8.3;
        beam.castShadow = true;
        g.add(beam);

        // 悬垂定位器
        for (let l = 0; l < C.LANE_X.length; l++) {
          const arm = new THREE.Mesh(armGeo, METAL(P.metal, 1, 1));
          arm.position.set(C.LANE_X[l], 7.7, 0);
          g.add(arm);
        }
        this.scene.add(g);
        this.gantryPool.push(g);
      }
    },

    /* ================= 跨线桥（制造景深与节奏感） ================= */
    _buildBridges() {
      this.bridgeGap = 130;
      this.bridgeCount = 3;
      this.bridgeTravel = -60;

      this.bridgePool = [];
      const deckGeo = new THREE.BoxGeometry(17, 1.3, 4.2);
      const railGeo = new THREE.BoxGeometry(17, 0.55, 0.24);
      const pillarGeo = new THREE.BoxGeometry(1.1, 8.2, 1.1);
      const deckMat = METAL(0xa9aeb8, 4, 2);
      const railMat = CHROME(0xc4cfdd, 6, 1);
      const pillarMat = METAL(0x9aa0aa, 1, 8);

      for (let i = 0; i < this.bridgeCount; i++) {
        const b = new THREE.Group();
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.y = 8.9;
        deck.castShadow = true;
        b.add(deck);

        for (const dz of [-2.1, 2.1]) {
          const rail = new THREE.Mesh(railGeo, railMat);
          rail.position.set(0, 9.8, dz);
          b.add(rail);
        }
        for (const sx of [-1, 1]) {
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(sx * 6.6, 4.1, 0);
          pillar.castShadow = true;
          b.add(pillar);
        }
        // 桥面下的横梁
        const girder = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 4.4), METAL(0x7f858f, 4, 1));
        girder.position.y = 8.2;
        b.add(girder);

        this.scene.add(b);
        this.bridgePool.push(b);
      }
    },

    /* ================= 站牌 ================= */
    _buildStationSigns() {
      this.signGap = 95;
      this.signCount = 2;
      this.signPool = [];
      const postGeo = new THREE.BoxGeometry(0.16, 3.2, 0.16);
      const postMat = METAL(P.metal, 1, 4);

      const names = ['中央车站', '跑酷站', '快乐广场'];
      for (let i = 0; i < this.signCount; i++) {
        const g = new THREE.Group();
        const board = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 0.7, 0.12),
          [
            PAINT(0x123049), PAINT(0x123049), PAINT(0x123049),
            PAINT(0x123049), new THREE.MeshLambertMaterial({ map: SG.Tex.station(names[i % names.length]) }), PAINT(0x0e2a4a)
          ]
        );
        board.position.y = 2.6;
        g.add(board);
        for (const sx of [-1, 1]) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(sx * 1.0, 1.6, 0);
          post.castShadow = true;
          g.add(post);
        }
        this.scene.add(g);
        this.signPool.push(g);
      }
    },

    /* ================= 每帧更新 ================= */
    update(dt, speed) {
      const move = speed * dt;

      // 贴图滚动（+v 方向对应向 +z 流动）
      this.gravelTex.offset.y += move / this.gravelTile;
      this.concreteTex.offset.y += move / this.concreteTile;
      this.grassTex.offset.y += move / this.grassTile;
      this.safetyTex.offset.y += move / this.safetyTile;

      // 枕木循环
      this.sleeperOffset += move;
      this._writeSleepers();

      // 门架循环
      this.gantryTravel += move;
      if (this.gantryTravel >= this.gantryGap) {
        this.gantryTravel -= this.gantryGap;
      }
      const gSpan = this.gantryGap * this.gantryCount;
      for (let i = 0; i < this.gantryPool.length; i++) {
        const z = C.DESPAWN_Z - ((((i * this.gantryGap - this.gantryTravel) % gSpan) + gSpan) % gSpan);
        this.gantryPool[i].position.set(0, 0, z);
      }

      // 跨线桥循环
      this.bridgeTravel += move;
      const bSpan = this.bridgeGap * this.bridgeCount;
      for (let i = 0; i < this.bridgePool.length; i++) {
        const z = C.DESPAWN_Z - ((((i * this.bridgeGap - this.bridgeTravel) % bSpan) + bSpan) % bSpan);
        this.bridgePool[i].position.set(0, 0, z);
      }

      // 站牌循环
      const sSpan = this.signGap * this.signCount;
      this.signTravel = (this.signTravel || 0) + move;
      for (let i = 0; i < this.signPool.length; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const z = C.DESPAWN_Z - ((((i * this.signGap - this.signTravel) % sSpan) + sSpan) % sSpan);
        this.signPool[i].position.set(side * 7.4, 0.3, z);
      }
    },

    reset() {
      this.gravelTex.offset.y = 0;
      this.concreteTex.offset.y = 0;
      this.grassTex.offset.y = 0;
      this.safetyTex.offset.y = 0;
      this.sleeperOffset = 0;
      this.gantryTravel = 0;
      this.bridgeTravel = -60;
      this.signTravel = 0;
      this._writeSleepers();
    }
  };
})();
