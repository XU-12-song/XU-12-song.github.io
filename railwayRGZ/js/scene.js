/**
 * scene.js —— 场景 / 摄像机 / 渲染器 / 光照 / 天空 / 云朵
 */
(function () {
  const P = SG.PALETTE;
  const U = SG.Utils;

  // 移动端关闭阴影以保帧率
  const IS_MOBILE = ('ontouchstart' in window) && Math.min(window.innerWidth, window.innerHeight) < 820;

  SG.SceneManager = function (container) {
    this.container = container;

    // ---- 场景 & 雾 ----
    this.scene = new THREE.Scene();
    this.scene.background = SG.Tex.sky();
    this.scene.fog = new THREE.Fog(P.fog, 110, 300);

    // ---- 摄像机（第三人称追尾，略微俯视）----
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 6.0, 10.6);
    this.camera.lookAt(0, 1.7, -9);

    // ---- 渲染器 ----
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    if (!IS_MOBILE) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(this.renderer.domElement);

    this._buildLights();
    this._buildSky();
    this._buildClouds();

    this._camX = 0;
    this._camY = 6.0;
    this._shake = 0;
    this._tilt = 0;

    window.addEventListener('resize', this.onResize.bind(this));
  };

  SG.SceneManager.prototype = {
    /* ---------- 光照 ----------
       参考三点布光：主光（暖阳，投影）+ 半球环境光 + 冷色补光。
       环境光压得比较低，让物件靠明暗交界线读出体积，避免"平光塑料感"。 */
    _buildLights() {
      // 半球光：天空冷、地面暖，给暗部一点环境色而不是死黑
      const hemi = new THREE.HemisphereLight(0xbcdcff, 0x9a7f57, 0.5);
      this.scene.add(hemi);

      // 环境光只做最低限度的托底
      this.scene.add(new THREE.AmbientLight(0xdfe9f5, 0.2));

      // 主光（午后偏斜的暖阳）
      const dir = new THREE.DirectionalLight(0xfff1d4, 1.35);
      dir.position.set(-26, 30, 18);
      dir.target.position.set(0, 0, -12);
      this.scene.add(dir);
      this.scene.add(dir.target);

      // 冷色补光（从另一侧打，勾出侧面轮廓，无阴影）
      const fill = new THREE.DirectionalLight(0x9dc2ff, 0.35);
      fill.position.set(24, 10, -20);
      fill.target.position.set(0, 1, -8);
      this.scene.add(fill);
      this.scene.add(fill.target);

      // 地面反弹的微弱暖光，托一下阴影里的底部
      const bounce = new THREE.DirectionalLight(0xffd9a8, 0.16);
      bounce.position.set(4, -14, 8);
      this.scene.add(bounce);

      if (this.renderer.shadowMap.enabled) {
        dir.castShadow = true;
        dir.shadow.mapSize.set(2048, 2048);
        const sc = dir.shadow.camera;
        sc.left = -30;
        sc.right = 30;
        sc.top = 44;
        sc.bottom = -44;
        sc.near = 1;
        sc.far = 150;
        dir.shadow.bias = -0.0006;
        dir.shadow.normalBias = 0.028;
        sc.updateProjectionMatrix();
      }
      this.sunLight = dir;
    },

    /* ---------- 天空：太阳光晕 ---------- */
    _buildSky() {
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({
        map: SG.Tex.glow(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.95
      }));
      sun.position.set(120, 96, -430);
      sun.scale.set(260, 260, 1);
      this.scene.add(sun);
    },

    /* ---------- 云朵（精灵，缓慢视差漂移）---------- */
    _buildClouds() {
      const tex = SG.Tex.cloud();
      this.clouds = [];
      for (let i = 0; i < 16; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          opacity: 0.85
        }));
        this._placeCloud(sp, U.rand(-460, 20));
        this.scene.add(sp);
        this.clouds.push(sp);
      }
    },

    _placeCloud(sp, z) {
      const s = U.rand(70, 170);
      sp.scale.set(s, s * 0.5, 1);
      sp.position.set(U.rand(-260, 260), U.rand(48, 110), z);
      sp.material.opacity = U.rand(0.55, 0.92);
    },

    /* ---------- 摄像机跟随 ---------- */
    updateCamera(dt, playerX, playerY, speed) {
      const k = 1 - Math.pow(0.0015, dt);
      const targetX = playerX * 0.4;
      const targetY = 6.0 + playerY * 0.22 + (speed || 0) * 0.006;
      this._camX += (targetX - this._camX) * k;
      this._camY += (targetY - this._camY) * k;

      let sx = 0, sy = 0;
      if (this._shake > 0.0015) {
        sx = U.rand(-1, 1) * this._shake;
        sy = U.rand(-1, 1) * this._shake;
        this._shake *= Math.pow(0.0006, dt);   // 快速收敛，短促而不晃眼
      } else {
        this._shake = 0;
      }

      // 变道侧倾回正
      this._tilt += (0 - this._tilt) * Math.min(1, dt * 9);

      this.camera.position.set(this._camX + sx, this._camY + sy, 10.6);
      this.camera.lookAt(this._camX * 0.7, 1.7 + playerY * 0.16, -9);
      this.camera.rotateZ(this._tilt);
    },

    /** 震动强度：以最大振幅（世界单位）传入，取较大值而非累加，避免连续触发时越晃越猛 */
    shake(amount) {
      this._shake = Math.max(this._shake, Math.min(amount, 0.2));
    },

    /** 变道时镜头侧倾，增强操作反馈 */
    tilt(amount) {
      this._tilt = U.clamp(this._tilt + amount, -0.05, 0.05);
    },

    /* ---------- 云朵漂移 ---------- */
    updateClouds(dt, move, preview) {
      const m = (preview ? move : move * 0.22);
      for (let i = 0; i < this.clouds.length; i++) {
        const c = this.clouds[i];
        c.position.z += m;
        if (c.position.z > 80) this._placeCloud(c, -480);
      }
    },

    onResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    render() {
      this.renderer.render(this.scene, this.camera);
    },

    reset() {
      this._camX = 0;
      this._camY = 6.0;
      this._shake = 0;
      this.clouds.forEach((c) => this._placeCloud(c, U.rand(-480, 20)));
    }
  };
})();
