/**
 * ui.js —— DOM 界面：得分 HUD、开始界面、结算界面、角色选择
 */
(function () {
  SG.UI = function () {
    this.el = {
      hud: document.getElementById('hud'),
      score: document.getElementById('score-value'),
      coins: document.getElementById('coin-value'),
      hudHigh: document.getElementById('hud-highscore'),
      startHigh: document.getElementById('start-highscore'),
      flash: document.getElementById('flash'),
      startScreen: document.getElementById('start-screen'),
      gameoverScreen: document.getElementById('gameover-screen'),
      charSelect: document.getElementById('character-select'),
      startBtn: document.getElementById('start-btn'),
      restartBtn: document.getElementById('restart-btn'),
      homeBtn: document.getElementById('home-btn'),
      finalScore: document.getElementById('final-score'),
      finalCoins: document.getElementById('final-coins'),
      finalHigh: document.getElementById('final-highscore'),
      newRecord: document.getElementById('new-record'),
      toast: document.getElementById('toast')
    };
    this.selectedCharacter = 'xiongda';
    this._lastScore = -1;
    this._lastCoins = -1;
    this._toastTimer = null;
    this.callbacks = {};
    this._bind();
  };

  SG.UI.prototype = {
    _bind() {
      // 角色选择
      const btns = this.el.charSelect.querySelectorAll('.char-btn');
      btns.forEach((btn) => {
        btn.addEventListener('click', () => {
          btns.forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          this.selectedCharacter = btn.dataset.character;
          if (this.callbacks.onCharacterChange) {
            this.callbacks.onCharacterChange(this.selectedCharacter);
          }
        });
      });

      this.el.startBtn.addEventListener('click', () => {
        if (this.callbacks.onStart) this.callbacks.onStart(this.selectedCharacter);
      });
      this.el.restartBtn.addEventListener('click', () => {
        if (this.callbacks.onRestart) this.callbacks.onRestart(this.selectedCharacter);
      });
      this.el.homeBtn.addEventListener('click', () => {
        if (this.callbacks.onHome) this.callbacks.onHome();
      });
    },

    on(name, fn) {
      this.callbacks[name] = fn;
    },

    /* ---------- HUD ---------- */
    setVisibleHud(v) {
      this.el.hud.classList.toggle('hidden', !v);
    },

    setScore(v) {
      v = Math.floor(v);
      if (v === this._lastScore) return;
      this._lastScore = v;
      this.el.score.textContent = v;
    },

    setCoins(v) {
      if (v === this._lastCoins) return;
      this._lastCoins = v;
      this.el.coins.textContent = v;
    },

    setHighScore(v) {
      this.el.hudHigh.textContent = v;
      if (this.el.startHigh) this.el.startHigh.textContent = v;
    },

    /** 撞击闪白 */
    flash() {
      const f = this.el.flash;
      if (!f) return;
      f.classList.add('on');
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(() => f.classList.remove('on'), 90);
    },

    /* ---------- 界面切换 ---------- */
    showStart() {
      this.el.startScreen.classList.remove('hidden');
      this.el.gameoverScreen.classList.add('hidden');
      this.setVisibleHud(false);
    },

    hideStart() {
      this.el.startScreen.classList.add('hidden');
    },

    showGameOver(score, coins, highScore, isNewRecord) {
      this.el.finalScore.textContent = score;
      this.el.finalCoins.textContent = coins;
      this.el.finalHigh.textContent = highScore;
      this.el.newRecord.classList.toggle('hidden', !isNewRecord);
      this.el.gameoverScreen.classList.remove('hidden');
    },

    hideGameOver() {
      this.el.gameoverScreen.classList.add('hidden');
    },

    /* ---------- Toast ---------- */
    toast(text, duration) {
      const t = this.el.toast;
      t.textContent = text;
      t.classList.remove('hidden');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.add('hidden'), duration || 800);
    },

    /** 读取 / 写入最高分 */
    loadHighScore() {
      const raw = localStorage.getItem(SG.CONFIG.STORAGE_KEY);
      const v = parseInt(raw, 10);
      return isNaN(v) ? 0 : v;
    },

    saveHighScore(v) {
      try {
        localStorage.setItem(SG.CONFIG.STORAGE_KEY, String(v));
      } catch (e) {
        console.warn('无法写入 localStorage:', e);
      }
    }
  };
})();
