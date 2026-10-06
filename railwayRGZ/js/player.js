/**
 * player.js —— 角色建模（熊大 / 奶龙）与角色控制（变道 / 跳跃 / 下滚）
 */
(function () {
  const C = SG.CONFIG;
  const U = SG.Utils;

  /* =========================================================
   *  角色外观定义
   *  —— 换自己的贴图：把图片放到 assets/ 目录（或用 upload.html 传），
   *     文件名见 config.js 的 SG.CONFIG.TEXTURES。
   *     有图时角色会整体换成一张「没有厚度」的平面贴图，按原图比例铺满；
   *     没有图时用下面这套内置的 3D 造型兜底。
   * ========================================================= */
  const SKINS = {
    xiongda: {
      // 熊大：棕色的熊
      body: 0x9c6136,
      belly: 0xd8b184,
      head: 0xa96f3f,
      ear: 0x6f4423,
      limb: 0x8a5530,
      muzzle: 0xe6c9a3,
      nose: 0x2b1a10,
      eye: 0xffffff,
      pupil: 0x1b1b1b,
      tailColor: 0x8a5530
    },
    nailong: {
      // 奶龙：奶黄色皮肤、圆圆的大脑袋
      body: 0xf7dc86,
      belly: 0xfff3c8,
      head: 0xfbe79c,
      ear: 0xf2c94c,
      limb: 0xf3d375,
      muzzle: 0xfff6d8,
      nose: 0xe08a4a,
      eye: 0xffffff,
      pupil: 0x202020,
      tailColor: 0xf2c94c
    }
  };

  function mat(color) {
    return new THREE.MeshLambertMaterial({ color: color });
  }

  function box(w, h, d, color) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  }

  function sphere(r, color, seg) {
    return new THREE.Mesh(new THREE.SphereGeometry(r, seg || 16, seg || 14), mat(color));
  }

  /* =========================================================
   *  buildCharacter —— 用基础几何体拼一个卡通角色
   *  返回 { group, solid, plane, parts }
   *    solid：内置 3D 造型（没贴图时用）
   *    plane：一张没有厚度的平面贴图（有贴图时用，按原图比例显示）
   * ========================================================= */
  SG.buildCharacter = function (type) {
    const s = SKINS[type] || SKINS.xiongda;
    const group = new THREE.Group();
    const parts = {};

    // 内置 3D 造型单独放一个子组：一旦有贴图就整体隐藏，换成平面贴图
    const solid = new THREE.Group();
    group.add(solid);

    // 躯干
    const body = box(0.86, 0.86, 0.62, s.body);
    body.position.y = 0.98;
    solid.add(body);
    parts.body = body;

    // 肚子（前胸浅色块）
    const belly = box(0.5, 0.56, 0.08, s.belly);
    belly.position.set(0, 0.96, 0.33);
    solid.add(belly);

    // 头
    const head = sphere(0.5, s.head, 18);
    head.position.y = 1.75;
    if (type === 'nailong') head.scale.set(1.12, 1.02, 1.05); // 奶龙脑袋更圆更大
    solid.add(head);
    parts.head = head;

    // 耳朵 / 角
    if (type === 'nailong') {
      // 奶龙：头顶两只小黄角
      for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 10), mat(s.ear));
        horn.position.set(0.22 * sx, 2.24, -0.02);
        horn.rotation.z = -0.25 * sx;
        solid.add(horn);
      }
    } else {
      // 熊大：两只圆耳朵
      for (const sx of [-1, 1]) {
        const ear = sphere(0.17, s.ear, 12);
        ear.position.set(0.36 * sx, 2.08, 0.02);
        ear.scale.z = 0.6;
        solid.add(ear);
      }
    }

    // 口鼻
    const muzzle = sphere(0.22, s.muzzle, 14);
    muzzle.position.set(0, 1.6, 0.42);
    muzzle.scale.set(1.15, 0.85, 0.9);
    solid.add(muzzle);

    const nose = sphere(0.09, s.nose, 10);
    nose.position.set(0, 1.66, 0.61);
    nose.scale.z = 0.7;
    solid.add(nose);

    // 眼睛
    for (const sx of [-1, 1]) {
      const eye = sphere(0.1, s.eye, 12);
      eye.position.set(0.18 * sx, 1.9, 0.4);
      solid.add(eye);
      const pupil = sphere(0.05, s.pupil, 10);
      pupil.position.set(0.19 * sx, 1.9, 0.47);
      solid.add(pupil);
    }

    // 手臂
    const arms = [];
    for (const sx of [-1, 1]) {
      const arm = box(0.24, 0.62, 0.24, s.limb);
      arm.position.set(0.58 * sx, 1.0, 0);
      arm.geometry.translate(0, -0.31, 0); // 让旋转轴位于肩膀
      arm.position.y = 1.3;
      solid.add(arm);
      arms.push(arm);
    }
    parts.arms = arms;

    // 腿
    const legs = [];
    for (const sx of [-1, 1]) {
      const leg = box(0.26, 0.6, 0.26, s.limb);
      leg.geometry.translate(0, -0.3, 0);
      leg.position.set(0.22 * sx, 0.62, 0);
      solid.add(leg);
      legs.push(leg);
    }
    parts.legs = legs;

    // 尾巴（奶龙 / 熊都来一小撮，增加辨识度）
    const tail = sphere(0.16, s.tailColor, 12);
    tail.position.set(0, 1.05, -0.38);
    solid.add(tail);

    // ---- 平面贴图（没有厚度的一张画）：有贴图时用它替代 3D 造型 ----
    // 用 MeshBasicMaterial：图片原样显示，不再被立方体/球面的 UV 挤压变形。
    const planeMat = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      depthWrite: true
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), planeMat);
    plane.position.set(0, C.PLAYER_PLANE_HEIGHT / 2, 0.001);
    plane.castShadow = true;
    plane.visible = false;
    group.add(plane);

    return { group, solid, plane, parts };
  };

  /* =========================================================
   *  尝试加载角色贴图（如果存在就切成「平面人物」）
   *  有图：隐藏 3D 造型，显示一张按原图比例、没有厚度的平面贴图。
   *  没图：静默保留内置纯色造型。
   * ========================================================= */
  SG.applyCharacterTexture = function (type, built) {
    const path = C.TEXTURES[type];
    if (!path) return;
    const loader = new THREE.TextureLoader();
    loader.load(
      path,
      function (tex) {
        tex.encoding = THREE.sRGBEncoding;
        tex.minFilter = THREE.LinearFilter;   // 避免非 2 次幂尺寸被缩放

        const img = tex.image || {};
        const ratio = (img.width && img.height) ? (img.width / img.height) : 1;

        const h = C.PLAYER_PLANE_HEIGHT;
        const w = h * ratio;
        built.plane.material.map = tex;
        built.plane.material.needsUpdate = true;
        built.plane.scale.set(w, h, 1);
        built.plane.position.set(0, h / 2, 0.001);
        built.plane.visible = true;

        built.solid.visible = false;
        built.group.userData.planeMode = true;

        console.log('[角色贴图] 已加载: ' + path + '（平面模式 ' +
                    (img.width || '?') + '×' + (img.height || '?') + '）');
      },
      undefined,
      function () {
        console.log('[角色贴图] 未找到 ' + path + '，使用内置纯色造型。');
      }
    );
  };

  /* =========================================================
   *  Player —— 角色控制器
   *  坐标约定：角色长期停在 z = 0，世界向 +z 移动。
   * ========================================================= */
  SG.Player = function (scene, type) {
    this.scene = scene;
    this.type = type || 'xiongda';

    const built = SG.buildCharacter(this.type);
    this.group = built.group;
    this.parts = built.parts;
    SG.applyCharacterTexture(this.type, built);

    this.group.position.set(0, 0, 0);
    scene.add(this.group);

    this.lane = 1;            // 0 左 / 1 中 / 2 右
    this.x = 0;
    this.y = 0;               // 脚底高度
    this.vy = 0;
    this.onGround = true;
    this.rolling = false;
    this.rollTimer = 0;
    this.runTime = 0;         // 用于跑步摆臂动画
    this.alive = true;
    this._jumpBuf = 0;        // 输入缓冲：稍早按下也能生效
    this._rollBuf = 0;
  };

  SG.Player.prototype = {
    /** 切换车道，dir = -1 左 / +1 右 */
    changeLane(dir) {
      if (!this.alive) return;
      const next = U.clamp(this.lane + dir, 0, C.LANE_X.length - 1);
      this.lane = next;
    },

    jump() {
      if (!this.alive) return;
      if (this.onGround) {
        this.vy = C.JUMP_VELOCITY;
        this.onGround = false;
        this._jumpBuf = 0;
        // 跳跃时取消下滚
        if (this.rolling) this._endRoll();
      } else {
        // 空中按下：记进缓冲，落地瞬间自动起跳，避免"按了没反应"
        this._jumpBuf = C.INPUT_BUFFER;
      }
    },

    roll() {
      if (!this.alive) return;
      if (this.onGround && !this.rolling) {
        this.rolling = true;
        this.rollTimer = C.ROLL_DURATION;
      } else if (!this.onGround) {
        // 在空中按下滚：加速下落，落地后自动进入下滚
        this.vy = Math.min(this.vy, -14);
        this.rolling = true;
        this.rollTimer = C.ROLL_DURATION;
      } else {
        // 正在下滚时再按：结束后接续一次，长障碍也不怕
        this._rollBuf = C.INPUT_BUFFER;
      }
    },

    _endRoll() {
      this.rolling = false;
      this.rollTimer = 0;
      this.group.scale.set(1, 1, 1);
      this.group.rotation.x = 0;
    },

    /** 当前碰撞盒高度 */
    getHeight() {
      return this.rolling ? C.ROLL_HEIGHT : C.PLAYER_HEIGHT;
    },

    /** 是否处于无敌 / 死亡状态（供外部判断） */
    isAlive() {
      return this.alive;
    },

    kill() {
      this.alive = false;
      this._endRoll();
      this.group.rotation.z = 0.9; // 倒地效果
    },

    reset(type) {
      this.type = type || this.type;
      // 重建外观（角色可能被切换）
      this.scene.remove(this.group);
      const built = SG.buildCharacter(this.type);
      this.group = built.group;
      this.parts = built.parts;
      SG.applyCharacterTexture(this.type, built);
      this.scene.add(this.group);

      this.lane = 1;
      this.x = 0;
      this.y = 0;
      this.vy = 0;
      this.onGround = true;
      this.alive = true;
      this._jumpBuf = 0;
      this._rollBuf = 0;
      this.group.rotation.set(0, 0, 0);
      this.group.scale.set(1, 1, 1);
      this._endRoll();
      this.group.position.set(0, 0, 0);
    },

    update(dt) {
      if (!this.alive) {
        // 死亡后轻微前倾倒地的余韵
        this.group.rotation.z += (1.35 - this.group.rotation.z) * Math.min(1, dt * 6);
        return;
      }

      // ---- 输入缓冲倒计时 ----
      if (this._jumpBuf > 0) this._jumpBuf -= dt;
      if (this._rollBuf > 0) this._rollBuf -= dt;

      // ---- 横向变道（平滑插值）----
      const targetX = C.LANE_X[this.lane];
      const dx = targetX - this.x;
      const step = C.LANE_CHANGE_SPEED * dt;
      if (Math.abs(dx) <= step) this.x = targetX;
      else this.x += Math.sign(dx) * step;

      // ---- 纵向跳跃（重力）----
      if (!this.onGround || this.vy !== 0) {
        this.vy -= C.GRAVITY * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.onGround = true;
          // 落地瞬间消费缓冲的输入，手感更跟手
          if (this._jumpBuf > 0) {
            this._jumpBuf = 0;
            this.vy = C.JUMP_VELOCITY;
            this.onGround = false;
          } else if (this._rollBuf > 0) {
            this._rollBuf = 0;
            this.rolling = true;
            this.rollTimer = C.ROLL_DURATION;
          }
        }
      }

      // ---- 下滚计时 ----
      if (this.rolling) {
        this.rollTimer -= dt;
        if (this.rollTimer <= 0) {
          this._endRoll();
          if (this._rollBuf > 0) {
            this._rollBuf = 0;
            this.rolling = true;
            this.rollTimer = C.ROLL_DURATION;
          }
        }
      }

      // ---- 应用位置 ----
      this.group.position.set(this.x, this.y, 0);

      // ---- 变道时身体侧倾，让操作"看得见" ----
      const lean = U.clamp(-dx * 0.16, -0.24, 0.24);
      this.group.rotation.z += (lean - this.group.rotation.z) * Math.min(1, dt * 20);

      // ---- 姿态动画 ----
      const planeMode = !!this.group.userData.planeMode;
      this.runTime += dt * 12;
      if (this.rolling) {
        if (planeMode) {
          // 平面贴图：不压扁，整体以脚为轴向前倾，读起来像「贴地滚过去」
          this.group.scale.set(1, 1, 1);
          this.group.rotation.x += (-1.15 - this.group.rotation.x) * Math.min(1, dt * 14);
        } else {
          // 缩成一团 + 向前翻滚
          this.group.scale.set(1.05, C.ROLL_HEIGHT / C.PLAYER_HEIGHT, 1.05);
          this.group.rotation.x -= dt * 16;
        }
      } else {
        this.group.scale.set(1, 1, 1);
        this.group.rotation.x += (0 - this.group.rotation.x) * Math.min(1, dt * 18);
        if (!planeMode) {
          const swing = Math.sin(this.runTime) * 0.7;
          if (this.parts.arms) {
            this.parts.arms[0].rotation.x = swing;
            this.parts.arms[1].rotation.x = -swing;
          }
          if (this.parts.legs) {
            this.parts.legs[0].rotation.x = -swing;
            this.parts.legs[1].rotation.x = swing;
          }
          // 空中时手臂上举
          if (!this.onGround) {
            if (this.parts.arms) {
              this.parts.arms[0].rotation.x = -1.9;
              this.parts.arms[1].rotation.x = -1.9;
            }
          }
        }
      }
    }
  };
})();
