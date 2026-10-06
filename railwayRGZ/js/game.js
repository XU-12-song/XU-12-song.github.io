/**
 * game.js —— 游戏主控：状态管理、主循环、生成逻辑、计分、存档
 *
 * 状态机：ready（首页预览） -> playing（进行中） -> dying（死亡演出） -> over（结算）
 */
(function () {
  const C = SG.CONFIG;
  const U = SG.Utils;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  SG.Game = function () {
    const container = document.getElementById('game-container');

    // Three.js 加载失败兜底提示
    if (typeof THREE === 'undefined') {
      container.innerHTML =
        '<div style="display:flex;height:100%;align-items:center;justify-content:center;' +
        'text-align:center;padding:24px;font-size:16px;line-height:1.8;color:#fff">' +
        '无法加载 Three.js。<br>请确认网络可访问 cdnjs.cloudflare.com，<br>' +
        '或把 three.min.js 下载到本地并修改 index.html 的引用路径。</div>';
      return;
    }

    this.sm = new SG.SceneManager(container);
    this.track = new SG.Track(this.sm.scene);
    this.decor = new SG.Decor(this.sm.scene);
    this.obstacles = new SG.ObstacleManager(this.sm.scene);
    this.coins = new SG.CoinManager(this.sm.scene);
    this.player = new SG.Player(this.sm.scene, 'xiongda');
    this.ui = new SG.UI();

    // ---- 运行状态 ----
    this.state = 'ready';
    this.speed = C.SPEED_START;
    this.distance = 0;
    this.coinCount = 0;
    this.score = 0;
    this.highScore = this.ui.loadHighScore();
    this.character = 'xiongda';

    // ---- 生成器游标 ----
    this.rowTravel = -18;   // 负数 = 开局给一点缓冲距离
    this.rowGap = C.ROW_GAP_START;
    this.coinTravel = 0;

    this._lastTime = 0;
    this._dyingTimer = 0;

    this._bindUI();
    this._bindControls();

    this.ui.setHighScore(this.highScore);
    this.ui.showStart();
    this.ui.setScore(0);
    this.ui.setCoins(0);

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  };

  SG.Game.prototype = {
    /* ================= 绑定 ================= */
    _bindUI() {
      this.ui.on('onCharacterChange', (type) => {
        this.character = type;
        this.player.reset(type);
        this.player.group.position.set(0, 0, 0);
      });
      this.ui.on('onStart', (type) => this.start(type));
      this.ui.on('onRestart', (type) => this.start(type));
      this.ui.on('onHome', () => this.backHome());
    },

    _bindControls() {
      this.controls = new SG.Controls({
        lane: (dir) => {
          if (this.state !== 'playing') return;
          this.player.changeLane(dir);
          this.sm.tilt(-dir * 0.022);   // 变道时镜头微微侧倾
        },
        jump: () => {
          if (this.state !== 'playing') return;
          this.player.jump();
          this.sm.shake(0.028);
          this.decor.puff(this.player.x, this.player.y, 6);
        },
        roll: () => {
          if (this.state !== 'playing') return;
          this.player.roll();
          this.sm.shake(0.022);
          this.decor.puff(this.player.x, this.player.y, 5);
        }
      });
      this.controls.enabled = false;
    },

    /* ================= 状态切换 ================= */
    start(type) {
      this.character = type || this.character;

      // 重置世界
      this.obstacles.clear();
      this.coins.clear();
      this.track.reset();
      this.decor.reset();
      this.player.reset(this.character);

      this.speed = C.SPEED_START;
      this.distance = 0;
      this.coinCount = 0;
      this.score = 0;
      this.rowTravel = -18;
      this.rowGap = C.ROW_GAP_START;
      this.coinTravel = 0;

      this.ui.setScore(0);
      this.ui.setCoins(0);
      this.ui.setHighScore(this.highScore);
      this.ui.hideStart();
      this.ui.hideGameOver();
      this.ui.setVisibleHud(true);
      this.ui.toast('GO!', 800);

      this.state = 'playing';
      this.controls.enabled = true;
    },

    gameOver() {
      if (this.state !== 'playing') return;
      this.state = 'dying';
      this._dyingTimer = 0.75;
      this.player.kill();
      this.controls.enabled = false;
      this.sm.shake(0.17);
      this.ui.flash();

      // 结算
      const isRecord = this.score > this.highScore;
      if (isRecord) {
        this.highScore = this.score;
        this.ui.saveHighScore(this.highScore);
      }
      this._pendingResult = {
        score: this.score,
        coins: this.coinCount,
        high: this.highScore,
        record: isRecord
      };
    },

    backHome() {
      this.obstacles.clear();
      this.coins.clear();
      this.track.reset();
      this.decor.reset();
      this.player.reset(this.character);
      this.state = 'ready';
      this.controls.enabled = false;
      this.ui.hideGameOver();
      this.ui.showStart();
      this.ui.setHighScore(this.highScore);
    },

    /* ================= 主循环 ================= */
    _loop(now) {
      requestAnimationFrame(this._loop);

      if (!this._lastTime) this._lastTime = now;
      let dt = (now - this._lastTime) / 1000;
      this._lastTime = now;
      dt = U.clamp(dt, 0, 0.05); // 防止切后台回来时出现巨大步长

      if (this.state === 'ready') {
        this._simulate(dt, true);
      } else if (this.state === 'playing') {
        this._simulate(dt, false);
      } else if (this.state === 'dying') {
        this._simulate(dt, false, true);
        this._dyingTimer -= dt;
        if (this._dyingTimer <= 0) {
          this.state = 'over';
          const r = this._pendingResult;
          this.ui.showGameOver(r.score, r.coins, r.high, r.record);
        }
      } else {
        // over：世界静止，仅保持渲染
        this.player.update(dt);
      }

      this.sm.render();
    },

    /* ================= 每帧模拟 ================= */
    _simulate(dt, preview, dying) {
      // 1) 速度
      if (!preview) {
        this.speed = Math.min(C.SPEED_MAX, C.SPEED_START + this.distance * C.SPEED_ACCEL);
        if (!dying) this.distance += this.speed * dt;
      }
      const speed = preview ? C.SPEED_START * 0.55 : this.speed;
      const move = speed * dt;

      // 2) 世界滚动
      this.track.update(dt, speed);
      this.decor.update(dt, speed);
      this.obstacles.update(dt, speed);
      this.coins.update(dt, speed);
      this.sm.updateClouds(dt, move, preview);

      // 3) 角色与镜头
      this._prevOnGround = this.player.onGround;
      this.player.update(dt);
      // 落地反馈：轻微震动 + 扬尘
      if (!this._prevOnGround && this.player.onGround && !preview && !dying) {
        this.sm.shake(0.035);
        this.decor.puff(this.player.x, 0, 6);
      }
      this.sm.updateCamera(dt, this.player.x, this.player.y, speed);

      if (preview || dying) return;

      // 4) 障碍生成
      this.rowTravel += move;
      if (this.rowTravel >= this.rowGap) {
        this.rowTravel = 0;
        const difficulty = U.clamp(this.distance / C.DIFFICULTY_DISTANCE, 0, 1);
        const res = this.obstacles.spawnRow(difficulty, this.distance);
        this.rowGap =
          lerp(C.ROW_GAP_START, C.ROW_GAP_MIN, difficulty) +
          res.extraGap +
          U.rand(0, 5);
        this._spawnCoins(res.freeLanes);
      }

      // 5) 行间补充金币
      this.coinTravel += move;
      if (this.coinTravel >= 20) {
        this.coinTravel = 0;
        this._spawnAmbientCoins();
      }

      // 6) 碰撞（传入本帧位移做扫掠判定）
      const hit = SG.Collision.checkObstacles(this.player, this.obstacles, move);
      if (hit) {
        this.gameOver();
        return;
      }
      const got = SG.Collision.checkCoins(this.player, this.coins, move);
      if (got > 0) {
        this.coinCount += got;
        this.ui.setCoins(this.coinCount);
        this.ui.toast('+' + got, 450);
        this.decor.puff(this.player.x, 1.0, Math.min(8, got + 2));
        this.sm.shake(0.012);
      }

      // 7) 计分
      this.score = Math.floor(this.distance * C.DISTANCE_SCORE_RATE) + this.coinCount * C.COIN_SCORE;
      this.ui.setScore(this.score);
    },

    /* ================= 金币生成 ================= */
    _spawnCoins(freeLanes) {
      freeLanes.forEach((lane) => {
        if (Math.random() > 0.58) return;
        if (Math.random() < 0.28) {
          this.coins.spawnArc(lane, C.SPAWN_Z - 3, U.randInt(4, 5));
        } else {
          this.coins.spawnLine(lane, C.SPAWN_Z - 3, U.randInt(3, 5));
        }
      });
    },

    _spawnAmbientCoins() {
      const lane = U.randInt(0, 2);
      const z = C.SPAWN_Z + 10;
      if (this._laneBlockedNear(lane, z - 14, z + 6)) return;
      this.coins.spawnLine(lane, z, U.randInt(3, 5));
    },

    /** 判断某车道在 [minZ, maxZ] 范围内是否已有障碍物（避免金币生成在障碍里） */
    _laneBlockedNear(lane, minZ, maxZ) {
      const list = this.obstacles.getActive();
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const d = o.userData;
        if (d.lane !== lane) continue;
        const oMin = o.position.z - d.halfD;
        const oMax = o.position.z + d.halfD;
        if (oMin < maxZ && oMax > minZ) return true;
      }
      return false;
    }
  };

  /* ================= 启动 ================= */
  window.addEventListener('load', function () {
    window.game = new SG.Game();
  });
})();
