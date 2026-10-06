/**
 * collision.js —— 碰撞检测（AABB）
 * 玩家固定在 z = 0，因此障碍物只需判断是否与 z 轴原点附近的玩家盒相交。
 */
(function () {
  const C = SG.CONFIG;

  SG.Collision = {
    /** 一维区间是否重叠 */
    overlap(minA, maxA, minB, maxB) {
      return minA < maxB && maxA > minB;
    },

    /** 玩家当前的 AABB */
    playerBox(player) {
      const h = player.getHeight();
      return {
        minX: player.x - C.PLAYER_HALF_WIDTH,
        maxX: player.x + C.PLAYER_HALF_WIDTH,
        minY: player.y,
        maxY: player.y + h,
        minZ: -C.PLAYER_HALF_DEPTH,
        maxZ: C.PLAYER_HALF_DEPTH
      };
    },

    /**
     * 障碍物 AABB
     * @param {number} sweep 本帧障碍物沿 +z 移动的距离，用于把碰撞盒沿运动方向“拉长”，
     *                       避免高速度 / 低帧率下穿过薄障碍物（隧穿）
     */
    obstacleBox(o, sweep) {
      const d = o.userData;
      return {
        minX: o.position.x - d.halfW,
        maxX: o.position.x + d.halfW,
        minY: d.bottom,
        maxY: d.top,
        // 本帧的扫掠体积：从「上一帧的位置」到「当前位置」的并集
        minZ: o.position.z - d.halfD - sweep,
        maxZ: o.position.z + d.halfD
      };
    },

    /**
     * 检测玩家是否撞到任意障碍物
     * @param {number} sweep 本帧世界移动距离
     * @returns {THREE.Object3D|null} 撞到的障碍物
     */
    checkObstacles(player, obstacles, sweep) {
      if (!player.isAlive()) return null;
      const p = this.playerBox(player);
      const list = obstacles.getActive();
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const b = this.obstacleBox(o, sweep || 0);
        if (
          this.overlap(p.minX, p.maxX, b.minX, b.maxX) &&
          this.overlap(p.minY, p.maxY, b.minY, b.maxY) &&
          this.overlap(p.minZ, p.maxZ, b.minZ, b.maxZ)
        ) {
          return o;
        }
      }
      return null;
    },

    /**
     * 检测并回收被拾取的金币
     * @param {number} sweep 本帧世界移动距离（同样做扫掠判定，防止高速度漏拾取）
     * @returns {number} 本次拾取数量
     */
    checkCoins(player, coins, sweep) {
      let got = 0;
      const zRange = 0.95 + (sweep || 0);
      const list = coins.getActive();
      // 倒序遍历，因为 collect 会从数组中删除元素
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        if (
          Math.abs(c.position.x - player.x) < 0.95 &&
          Math.abs(c.position.z) < zRange &&
          c.position.y < player.y + player.getHeight() + 0.6 &&
          c.position.y > player.y - 0.6
        ) {
          coins.collect(c);
          got++;
        }
      }
      return got;
    }
  };
})();
