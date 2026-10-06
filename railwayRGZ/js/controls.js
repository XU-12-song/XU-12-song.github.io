/**
 * controls.js —— 输入控制：键盘方向键 + 触屏滑动
 * 通过回调向游戏逻辑派发事件，不直接操作角色。
 */
(function () {
  SG.Controls = function (handlers) {
    this.handlers = handlers || {};
    this._touchStart = null;
    this.enabled = true;
    this._bind();
  };

  SG.Controls.prototype = {
    _emit(name, arg) {
      if (!this.enabled) return;
      const fn = this.handlers[name];
      if (typeof fn === 'function') fn(arg);
    },

    _bind() {
      // ---------- 键盘 ----------
      window.addEventListener('keydown', (e) => {
        // 阻止方向键滚动页面
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) {
          e.preventDefault();
        }
        if (e.repeat) return; // 长按不重复触发

        switch (e.key) {
          case 'ArrowLeft':
          case 'a':
          case 'A':
            this._emit('lane', -1);
            break;
          case 'ArrowRight':
          case 'd':
          case 'D':
            this._emit('lane', 1);
            break;
          case 'ArrowUp':
          case 'w':
          case 'W':
          case ' ':
            this._emit('jump');
            break;
          case 'ArrowDown':
          case 's':
          case 'S':
            this._emit('roll');
            break;
        }
      });

      // ---------- 触屏 ----------
      const el = document.body;
      el.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length !== 1) return;
          const t = e.touches[0];
          this._touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
        },
        { passive: true }
      );

      el.addEventListener(
        'touchend',
        (e) => {
          if (!this._touchStart) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - this._touchStart.x;
          const dy = t.clientY - this._touchStart.y;
          this._touchStart = null;

          const THRESHOLD = 28;
          if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return; // 视为点击

          if (Math.abs(dx) > Math.abs(dy)) {
            this._emit('lane', dx > 0 ? 1 : -1);
          } else {
            if (dy < 0) this._emit('jump');   // 上滑 = 跳跃
            else this._emit('roll');          // 下滑 = 下滚
          }
        },
        { passive: true }
      );

      // 阻止移动端双击缩放
      el.addEventListener('gesturestart', (e) => e.preventDefault());
    }
  };
})();
