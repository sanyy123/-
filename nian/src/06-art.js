/* ============================================================================
   Textures —— 原型阶段全部程序化绘制，不依赖外部美术资源
   ============================================================================ */
const Textures = {
  ensure(scene) {
    if (scene.textures.exists('player-gunner-down')) return;
    const C = CONFIG.color;
    const DIR_NAMES = ['down', 'up', 'left', 'right'];

    // 每个角色生成一套贴图，键名是 player-<角色key>-<朝向>。
    // 菜单和游戏里都按角色 key 取图，换角色就是换一套颜色，不用改逻辑
    for (const ch of Object.values(CHARACTERS)) {
      DIR_NAMES.forEach(dir => {
        this.makeChar(scene, 'player-' + ch.key + '-' + dir,
          ch.color.main, ch.color.dark, ch.color.accent, dir, CONFIG.playerRadius);
      });
    }

    for (const t of Object.values(ENEMY_TYPES)) {
      DIR_NAMES.forEach(dir => {
        this.makeChar(scene,
          'enemy-' + t.key + '-' + dir,
          t.color.main, t.color.dark, t.color.accent,
          dir, t.radius);
      });
    }

    this.makeBullet(scene, 'bullet-p', C.bulletP);
    // 巫女的火弹。尺寸必须和普通子弹一样是 16×16 ——
    // 子弹池里两种弹共用同一套物理体偏移，尺寸不一致会有一方判定错位
    this.makeFireBullet(scene, 'bullet-fire');
    // 勇者的剑气。同样保持 16×16，理由和火弹一样
    this.makeSlash(scene, 'bullet-slash');
    // 矮人的两种爆炸物。尺寸也都保持 16×16，共用同一套物理体偏移
    this.makeFirecracker(scene, 'bullet-firecracker');
    this.makeBomb(scene, 'bullet-bomb');
    // 死灵法师的亡灵弹，以及骷髅弓手射出的箭。同样保持 16×16
    this.makeNecroBullet(scene, 'bullet-necro');
    this.makeArrow(scene, 'bullet-arrow');
    // 爆炸环：橙色描边圆，命中触发 AOE 时按半径向外扩散
    this.makeRing(scene, 'explosion-ring', 0xff7a2a);
    this.makeBullet(scene, 'bullet-e', C.bulletE);
    this.makeCrescent(scene, 'bullet-e-crescent', C.bulletCrescent);
    this.makeDot(scene, 'spark', 10, 0xffffff);
    this.makeDot(scene, 'spark-warm', 10, 0xffc860);
    this.makeDot(scene, 'spark-cool', 10, 0x7fd4ff);
    this.makeShadow(scene, 'shadow');
    this.makeLife(scene, 'life', 0xff5c6e);
    this.makeLife(scene, 'life-off', 0x33404f);
    this.makeGlow(scene, 'muzzle', 0xffe066);
    this.makeRing(scene, 'shockring', 0xffffff);
    this.makeVignette(scene, 'vignette', '0,0,0');
    this.makeVignette(scene, 'vignette-red', '255,32,22');
    // BOSS 劈砍打出的砍影
    this.makeBossSlash(scene, 'boss-slash');

    for (const key of Object.keys(POWERUP_TYPES)) {
      this.makePowerup(scene, 'powerup-' + key, POWERUP_TYPES[key].color, key);
    }
  },

  makeChar(scene, key, main, dark, accent, dir, radius = 17) {
    const S = 48, cx = S / 2, cy = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const v = DIRS[dir];
    const dR = radius - 17;

    g.fillStyle(0x101a24, 1); g.fillCircle(cx, cy, 18 + dR);
    g.fillStyle(dark, 1);     g.fillCircle(cx, cy, 16 + dR);
    g.fillStyle(main, 1);     g.fillCircle(cx, cy, 13 + dR);

    g.fillStyle(accent, 1);
    if (v.x !== 0) {
      const startX = cx + (v.x > 0 ? (13 + dR) - 4 : -(13 + dR) - 8);
      g.fillRect(startX, cy - 4, 12, 8);
    } else {
      const startY = cy + (v.y > 0 ? (13 + dR) - 4 : -(13 + dR) - 8);
      g.fillRect(cx - 4, startY, 8, 12);
    }

    const eye = (ex, ey) => {
      g.fillStyle(0xffffff, 1); g.fillCircle(ex, ey, 3.2);
      g.fillStyle(0x101a24, 1); g.fillCircle(ex + v.x * 1.1, ey + v.y * 1.1, 1.7);
    };
    if (dir === 'down')       { eye(cx - 5, cy + 2); eye(cx + 5, cy + 2); }
    else if (dir === 'left')  { eye(cx - 7, cy - 1); }
    else if (dir === 'right') { eye(cx + 7, cy - 1); }

    g.generateTexture(key, S, S);
    g.destroy();
  },

  makeBullet(scene, key, color) {
    const S = 16, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 0.22); g.fillCircle(c, c, 8);
    g.fillStyle(color, 0.60); g.fillCircle(c, c, 5.5);
    g.fillStyle(color, 1);    g.fillCircle(c, c, 4);
    g.fillStyle(0xffffff, 1); g.fillCircle(c, c, 2);
    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* 火弹：外焰 → 主焰 → 弹芯三层同心圆，从橙到米白逐层变亮。
     形状和普通子弹完全一致（同样是 16×16 的圆），只靠配色区分 ——
     在满屏弹幕里，颜色比形状快得多，"这发是我的火弹"一眼就能认出来 */
  makeFireBullet(scene, key) {
    const S = 16, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff5a1a, 0.30); g.fillCircle(c, c, 8);
    g.fillStyle(0xff8a2a, 0.70); g.fillCircle(c, c, 5.5);
    g.fillStyle(0xffc84a, 1);    g.fillCircle(c, c, 4);
    g.fillStyle(0xfff4c2, 1);    g.fillCircle(c, c, 2);
    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* 剑气：横向的梭形（两端收尖、中间厚），三层从外晕到亮芯逐层收窄。
     为什么不用弯月：弯月的"肚子"偏在一侧，飞行时看着像在侧着滑行；
     剑气要的是"笔直劈出去的一道"，所以左右对称、跟着速度方向旋转。
     尺寸同样必须是 16×16 —— 玩家弹池共用同一套物理体偏移 */
  makeSlash(scene, key) {
    const S = 16, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // 外晕：整条梭形，最宽处 ±6
    g.fillStyle(0x5fc8ff, 0.30);
    g.fillTriangle(0.5, c, c, c - 6, c, c + 6);
    g.fillTriangle(S - 0.5, c, c, c - 6, c, c + 6);
    // 主体
    g.fillStyle(0x9fe8ff, 0.85);
    g.fillTriangle(2, c, c, c - 4, c, c + 4);
    g.fillTriangle(S - 2, c, c, c - 4, c, c + 4);
    // 亮芯：一条几乎贴中线的白线，"锋"的感觉全靠它
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(5, c, c, c - 1.8, c, c + 1.8);
    g.fillTriangle(S - 5, c, c, c - 1.8, c, c + 1.8);

    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* 亡灵弹：紫色发光弹。
     为什么用 CanvasTexture 而不是 Graphics —— Graphics 画不出径向渐变，
     只能靠一圈圈同心圆叠透明度来假装辉光，叠出来的边缘是硬环，
     在暗色场地上一眼就看出是"几个圆"。
     Canvas 的 createRadialGradient 是真正的连续衰减，外圈能散得很开，
     这就是"发光"和"紫色圆点"的区别。
     弹芯尺寸和普通子弹一致（半径 4），保证命中判定和视觉对得上。 */
  makeNecroBullet(scene, key) {
    const S = 16, c = S / 2;
    const tex = scene.textures.createCanvas(key, S, S);
    if (!tex) return;
    const ctx = tex.getContext();

    // 外层辉光：从弹芯向外衰减到全透明，半径铺满 8px
    const grd = ctx.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(240,220,255,1)');
    grd.addColorStop(0.22, 'rgba(200,140,255,0.95)');
    grd.addColorStop(0.45, 'rgba(150,80,240,0.55)');
    grd.addColorStop(0.75, 'rgba(110,50,200,0.18)');
    grd.addColorStop(1, 'rgba(90,40,180,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, S, S);

    // 弹芯：一个不透明的小白点，让子弹在辉光里有个明确的中心
    ctx.beginPath();
    ctx.arc(c, c, 2, 0, Math.PI * 2, false);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fill();

    tex.refresh();
  },

  /* 骷髅的箭：朝右的一支小箭（箭杆 + 三角箭头 + 尾羽）。
     和剑气一样按飞行方向 setRotation，所以基准朝右就行。
     配色偏灰白，和玩家的紫色亡灵弹拉开 —— 场上同时有"我的弹"和
     "我的召唤物射的箭"时，颜色不同才不会看串 */
  makeArrow(scene, key) {
    const S = 16, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    // 箭杆：一条横线，从尾巴到箭头
    g.fillStyle(0x6b5a3a, 1);
    g.fillRect(3, c - 1, 8, 2);
    // 箭头：朝右的三角
    g.fillStyle(0xd8d2c0, 1);
    g.fillTriangle(S - 1, c, S - 6, c - 3.2, S - 6, c + 3.2);
    // 尾羽：两片小斜片，让箭在旋转后也能看出头尾
    g.fillStyle(0x9aa4ae, 1);
    g.fillTriangle(1, c - 3.5, 1, c + 3.5, 5, c);

    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* 鞭炮：一颗红色的小鞭炮，顶上有一根黄色引线。
     和火弹、剑气一样，尺寸固定 16×16，共用同一套物理体偏移 */
  makeFirecracker(scene, key) {
    const S = 16, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff3a1a, 0.25); g.fillCircle(c, c, 8);
    g.fillStyle(0xa02020, 1);    g.fillRect(c - 4, c - 3, 8, 7);
    g.fillStyle(0xff5a3a, 1);    g.fillRect(c - 3, c - 2, 6, 4);
    g.fillStyle(0xffd54a, 1);    g.fillRect(c - 1, c - 6, 2, 3);
    g.fillStyle(0xffffff, 1);    g.fillCircle(c, c - 6, 1);
    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* 炸药：比鞭炮更粗的红色包裹，中间缠着两道黑箍。
     同尺寸 16×16，飞出去时看着更"重" */
  makeBomb(scene, key) {
    const S = 16, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff3a1a, 0.25); g.fillCircle(c, c, 8);
    g.fillStyle(0xa02020, 1);    g.fillRect(c - 5, c - 4, 10, 9);
    g.fillStyle(0xff5a3a, 1);    g.fillRect(c - 4, c - 3, 8, 5);
    g.fillStyle(0x101a24, 1);
    g.fillRect(c - 5, c - 3, 10, 1.5);
    g.fillRect(c - 5, c + 1, 10, 1.5);
    g.fillStyle(0xffd54a, 1);    g.fillRect(c - 1, c - 7, 2, 3);
    g.fillStyle(0xffffff, 1);    g.fillCircle(c, c - 7, 1.2);
    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* 月牙弹：三个特殊兵（铁甲兵 / 追踪炮 / 爆裂兵）的专属弹型。
     "外圆挖掉内圆"用 destination-out 做：先 source-over 填外圆（带 shadowBlur 出辉光），
     再切 destination-out 用内圆把它啃掉一块，剩下弯月。
     不用 nonzero 绕数法是因为 ctx.arc(..., true) 画整圆时浏览器行为不一致，
     挖空结果时有时无；destination-out 是明确无歧义的。
     尺寸必须保持 16×16：敌弹池里圆弹和月牙弹共用同一套物理体偏移 */
  makeCrescent(scene, key, color) {
    const S = 16;
    const tex = scene.textures.createCanvas(key, S, S);
    if (!tex) return;
    const ctx = tex.getContext();
    const hex = '#' + color.toString(16).padStart(6, '0');

    // 外圆 (6.4,8) r=7.1，内圆 (3.9,8) r=5.0，两个圆心只错开 2.5px，
    // 剩下"肚子朝右、两只角朝左"的弯月，最厚处约 4.6px。
    // 肚子外缘落在 x≈13.5，和物理体（半径 5 的同心圆，右缘 x=13）几乎齐平，
    // 判定不会掉进月牙中间的空心里
    const O = { x: 6.4, y: 8, r: 7.1 };
    const P = { x: 3.9, y: 8, r: 5.0 };

    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = hex;
    ctx.shadowBlur = 5;
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(O.x, O.y, O.r, 0, Math.PI * 2, false);
    ctx.fill();

    // 挖空：内圆的阴影必须关掉，否则 destination-out 会连阴影一起参与运算
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(P.x, P.y, P.r, 0, Math.PI * 2, false);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
  },

  /* BOSS 的砍影：一道大月牙，朝飞行方向张开。
     为什么不从 boss 图集里把 Attack01 第 3 帧的白月牙抠出来用 ——
     那帧里月牙和角色是叠在一起的，抠出来必然带着半个身子。
     所以照素材的配色（亮白 + 金色外缘）用 Canvas 画一个同风格的大月牙。
     128×128 的画布，外圆 r=52、内圆偏左 24，剩下"肚子朝右"的弯月；
     飞行时 setRotation(角度) 就能让它头朝哪飞哪 */
  makeBossSlash(scene, key) {
    const S = 128;
    const tex = scene.textures.createCanvas(key, S, S);
    if (!tex) return;
    const ctx = tex.getContext();
    const cx = S / 2, cy = S / 2;

    // 外圈金色辉光
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'rgba(255,205,80,0.95)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffcf50';
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, Math.PI * 2, false);
    ctx.fill();

    // 挖空内圆做出月牙。内圆的阴影必须归零，
    // 否则 destination-out 会把阴影也算进去，月牙边缘会糊成一圈灰
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx - 24, cy, 44, 0, Math.PI * 2, false);
    ctx.fill();

    // 再补一层更亮的白芯，让月牙有"能量体"的层次
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx - 22, cy, 42, 0, Math.PI * 2, false);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
  },

  makeDot(scene, key, size, color) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.generateTexture(key, size, size);
    g.destroy();
  },

  makeShadow(scene, key) {
    const W = 38, H = 15;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(W / 2, H / 2, W, H);
    g.generateTexture(key, W, H);
    g.destroy();
  },

  /* 径向柔光：Graphics 画不了渐变，用逐层缩小的低透明度圆叠出近似效果。
     枪口闪光就是靠它，比纯色圆点像"光"得多 */
  makeGlow(scene, key, color) {
    const S = 48, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    for (let i = 8; i >= 1; i--) {
      g.fillStyle(color, 0.13);
      g.fillCircle(c, c, (i / 8) * (S / 2 - 1));
    }
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(c, c, 4);
    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* 冲击波环：纹理保持小尺寸，靠粒子自身的缩放拉到想要的大小 */
  makeRing(scene, key, color) {
    const S = 64, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.lineStyle(7, color, 0.9);
    g.strokeCircle(c, c, S / 2 - 4);
    g.lineStyle(2.5, 0xffffff, 1);
    g.strokeCircle(c, c, S / 2 - 4);
    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* 径向暗角：Graphics 的四角渐变拼不出平滑的径向衰减，直接用 Canvas 画一张。
     color 传 'r,g,b' 字符串 —— 黑色做压力暗角，红色做危险预警 */
  makeVignette(scene, key, color) {
    const W = CONFIG.width, H = CONFIG.height;
    const tex = scene.textures.createCanvas(key, W, H);
    if (!tex) return;
    const ctx = tex.getContext();
    const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.86);
    grd.addColorStop(0, 'rgba(' + color + ',0)');
    grd.addColorStop(0.5, 'rgba(' + color + ',0.38)');
    grd.addColorStop(1, 'rgba(' + color + ',1)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    tex.refresh();
  },

  makeLife(scene, key, color) {
    const S = 24;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x101a24, 1);
    g.fillRoundedRect(1, 1, S - 2, S - 2, 7);
    g.fillStyle(color, 1);
    g.fillRoundedRect(4, 4, S - 8, S - 8, 5);
    g.generateTexture(key, S, S);
    g.destroy();
  },

  makePowerup(scene, key, color, symbol) {
    const S = 32, c = S / 2;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(color, 0.25); g.fillCircle(c, c, 15);
    g.fillStyle(0x101a24, 1); g.fillCircle(c, c, 13);
    g.fillStyle(color, 1);    g.fillCircle(c, c, 11);
    g.fillStyle(0xffffff, 1);

    if (symbol === 'rapid') {
      g.fillTriangle(c - 5, c - 4, c - 5, c + 4, c - 1, c);
      g.fillTriangle(c + 1, c - 4, c + 1, c + 4, c + 5, c);
    } else if (symbol === 'triple') {
      g.fillRect(c - 5, c - 4, 10, 2);
      g.fillRect(c - 5, c - 1, 10, 2);
      g.fillRect(c - 5, c + 2, 10, 2);
    } else if (symbol === 'shield') {
      g.fillTriangle(c, c - 6, c - 5, c, c + 5, c);
      g.fillTriangle(c, c + 6, c - 5, c, c + 5, c);
    } else {
      g.fillTriangle(c, c - 6, c - 4, c, c + 4, c);
      g.fillTriangle(c, c + 6, c - 4, c, c + 4, c);
      g.fillTriangle(c - 6, c, c, c - 4, c, c + 4);
      g.fillTriangle(c + 6, c, c, c - 4, c, c + 4);
    }

    g.generateTexture(key, S, S);
    g.destroy();
  },

  /* ---- 天气贴图：雨丝 / 雪花 ----
     为什么不再每帧用 Graphics 画 40 条雨丝：那是一次 clear + 40 次 fillRect，
     手机上单这一项就要吃掉两三毫秒；而且旧实现的位置用的是 this.time.now ——
     慢动作 / 暂停会把它一起改掉，雨会跟着卡住。
     改成"预渲染一张可平铺的小图 + TileSprite 滚动"之后，每帧只改两个 tilePosition，
     1 个 draw call，位置由累加的 dms 驱动，天然跟着游戏时间一起慢、一起停。

     平铺的接缝处理：雨丝会跨过上下边界，所以每条都在 y、y-H、y+H 各画一遍
     （画布外的那两遍自然被裁掉）。不这么做的话，滚到边界时一条雨丝会
     在上下两处同时断开，看着像"两截雨"。 */
  ensureWeather(scene) {
    if (scene.textures.exists('weather-rain') && scene.textures.exists('weather-snow')) return;

    // ---- 雨：48×192，14 条带倾角的短雨丝 ----
    if (!scene.textures.exists('weather-rain')) {
      const RW = 48, RH = 192;
      const tex = scene.textures.createCanvas('weather-rain', RW, RH);
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, RW, RH);
      ctx.lineCap = 'round';
      // 固定种子的伪随机：每次进游戏雨的长短分布一致，方便肉眼比对改动
      let seed = 20260916;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let i = 0; i < 14; i++) {
        const x = 3 + rnd() * (RW - 6);
        const y = rnd() * RH;
        const len = 16 + rnd() * 26;
        const dx = 2.5 + rnd() * 2.5;          // 倾角：整体向右下，看着像有风
        const alpha = 0.22 + rnd() * 0.4;
        const w = rnd() < 0.25 ? 2 : 1.2;
        ctx.strokeStyle = 'rgba(186,222,255,' + alpha.toFixed(2) + ')';
        ctx.lineWidth = w;
        for (const oy of [-RH, 0, RH]) {
          ctx.beginPath();
          ctx.moveTo(x, y + oy);
          ctx.lineTo(x + dx, y + oy + len);
          ctx.stroke();
        }
      }
      tex.refresh();
    }

    // ---- 雪：64×64，12 片大小不一的雪点 ----
    if (!scene.textures.exists('weather-snow')) {
      const SW = 64, SH = 64;
      const tex = scene.textures.createCanvas('weather-snow', SW, SH);
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, SW, SH);
      let seed = 77001;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let i = 0; i < 12; i++) {
        const x = 4 + rnd() * (SW - 8);
        const y = 4 + rnd() * (SH - 8);
        const r = 1.1 + rnd() * 2.1;
        const a = 0.45 + rnd() * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2, false);
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
        ctx.fill();
        // 大一点的雪片加一圈极淡的辉光，凑近看才分得出层次
        if (r > 2.4) {
          ctx.beginPath();
          ctx.arc(x, y, r * 2.1, 0, Math.PI * 2, false);
          ctx.fillStyle = 'rgba(214,236,255,0.14)';
          ctx.fill();
        }
      }
      tex.refresh();
    }
  },
};

/* ============================================================================
   UI —— 通用按钮
   ============================================================================ */
const UI = {
  FONT: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  MONO: '"Lucida Console", "Courier New", monospace',

  makeButton(scene, x, y, w, h, label, fillColor, hoverColor, onClick, fontSize) {
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    const draw = (fill, hovered) => {
      g.clear();
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(-w/2 + 3, -h/2 + 5, w, h, 14);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-w/2, -h/2, w, h, 14);
      g.fillStyle(0xffffff, hovered ? 0.28 : 0.16);
      g.fillRoundedRect(-w/2 + 4, -h/2 + 4, w - 8, Math.max(6, h/2 - 10), 10);
      g.lineStyle(2.5, 0xffffff, 0.55);
      g.strokeRoundedRect(-w/2, -h/2, w, h, 14);
    };
    draw(fillColor, false);
    container.add(g);

    // fontSize 可选：小卡片上的按钮要塞进 116×34 的格子里，22px 会溢出来
    const text = scene.add.text(0, 0, label, {
      fontFamily: this.FONT, fontSize: fontSize || '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    text.setShadow(0, 2, '#000000', 4, true, true);
    container.add(text);

    const hit = scene.add.rectangle(0, 0, w, h, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(hoverColor, true));
    hit.on('pointerout',  () => draw(fillColor, false));
    hit.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); onClick(); });
    container.add(hit);

    return container;
  },
};

/* ============================================================================
   角色立绘 —— 菜单 / 商城 / 整备三处都要摆角色，统一收在这里
   ----------------------------------------------------------------------------
   程序化角色有 player-<key>-<dir> 这张单帧纹理可以直接用；
   图集角色（巫女）没有它，得取图集的第 0 帧（正好是下方向站姿）。
   缩放也必须分开算：图集帧里角色本体只占 16 px 宽，程序化帧里是 34 px，
   不按 portraitScale 补一次，巫女在界面上会小成一粒芝麻。
   ============================================================================ */
const CharArt = {
  /* 图集没加载成功（丢文件 / 离线）时整体退回程序化角色。
     键名、帧号、缩放三样必须一起换 —— 只换其中一样会得到
     "程序化纹理配图集缩放"这种半降级状态，角色会小得看不见 */
  resolve(scene, ch) {
    // 图集 key 走 charRunSheet：勇者的跑步图集叫 wari-walk，
    // 直接拼 '<sheet>-run' 会拿到不存在的 key，角色在界面上会退回程序化圆球
    const runSheet = ch.sheet ? charRunSheet(ch) : null;
    const ok = !!runSheet && scene.textures.exists(runSheet);
    if (ok) {
      return {
        key: runSheet,
        frame: 0,
        base: ch.portraitScale != null ? ch.portraitScale : 1.3,
      };
    }
    return { key: 'player-' + ch.key + '-down', frame: undefined, base: 1.3 };
  },
  /* scale 传的是"程序化角色摆在这个位置该用多大"（菜单 1.3 / 商城卡片 0.92 /
     整备轮盘 1.8），调用方按原来的习惯写就行。
     图集角色再按 base / 1.3 的比例自动放大一次 —— 图集帧里角色本体只占 16 px 宽，
     程序化帧里是 34 px，不补这一下巫女在界面上会小成一粒芝麻 */
  fit(scene, ch, scale) {
    const r = this.resolve(scene, ch);
    return (scale != null ? scale : 1.3) * (r.base / 1.3);
  },
  add(scene, x, y, ch, scale) {
    const r = this.resolve(scene, ch);
    const img = scene.add.image(x, y, r.key, r.frame);
    img.setScale(this.fit(scene, ch, scale));
    return img;
  },
};
/* ============================================================================
   作弊菜单 —— 全局通用，所有场景按 I 键都能打开
   ----------------------------------------------------------------------------
   无敌开关是 window.__cheatInvincible，跨场景共享（因为每个场景会被销毁重建，
   存在 scene 上一切场景就丢了）。金币和碎片直接走 Storage。
   每个场景的 create 里调一次 CheatMenu.attach(this) 即可。
   ============================================================================ */
const CheatMenu = {
  attach(scene) {
    if (!scene || scene._cheatAttached) return;
    scene._cheatAttached = true;

    const W = CONFIG.width;
    const panelW = 200, panelH = 200;
    const px = W - panelW - 20, py = 160;

    scene._cheatVisible = false;

    const container = scene.add.container(px, py).setDepth(99999).setVisible(false);
    scene._cheatPanel = container;

    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.88).fillRoundedRect(0, 0, panelW, panelH, 12);
    g.lineStyle(2, 0xff00ff, 0.9).strokeRoundedRect(0, 0, panelW, panelH, 12);
    container.add(g);

    container.add(scene.add.text(panelW / 2, 20, '⚡ 作弊菜单 ⚡', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#ff66ff', fontStyle: 'bold',
    }).setOrigin(0.5));

    container.add(scene.add.text(panelW / 2, 40, '（按 I 键开关）', {
      fontFamily: UI.FONT, fontSize: '11px', color: '#8fa3b8',
    }).setOrigin(0.5));

    const invBtn = scene.add.text(panelW / 2, 78, '', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#2a2a4a', padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const refreshInv = () => {
      const on = !!window.__cheatInvincible;
      invBtn.setText('无敌: ' + (on ? '开' : '关'));
      invBtn.setColor(on ? '#7fffa0' : '#ffffff');
    };
    refreshInv();
    invBtn.on('pointerdown', () => {
      window.__cheatInvincible = !window.__cheatInvincible;
      refreshInv();
      try { SoundSys.pickup(); } catch (e) {}
    });
    container.add(invBtn);

    const coinBtn = scene.add.text(panelW / 2, 122, '金币 +100', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#ffd54a', fontStyle: 'bold',
      backgroundColor: '#3a3a1a', padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    coinBtn.on('pointerdown', () => {
      Storage.writeCoins(Storage.readCoins() + 100);
      try { SoundSys.pickup(); } catch (e) {}
    });
    container.add(coinBtn);

    const shardBtn = scene.add.text(panelW / 2, 166, '碎片 +100', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#c98fff', fontStyle: 'bold',
      backgroundColor: '#2a1a3a', padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    shardBtn.on('pointerdown', () => {
      Storage.addSoulShard(100);
      try { SoundSys.pickup(); } catch (e) {}
    });
    container.add(shardBtn);

    CheatMenu._ensureGlobalKey();
  },

  /* 全局只注册一次 I 键监听，用 window 而不是 scene.input.keyboard。
     为什么：场景切换时 Phaser 会重建输入系统，场景级监听会失效；
     而场景实例是复用的，_cheatAttached 挡住重复 attach，新场景就没监听了。
     window 级别只注册一次，永远不会丢。
     按 I 时遍历所有**活跃**场景，找最上面那个带 panel 的切显隐 ——
     用 _cheatPanel.scene === s 兜底：切场景时旧 panel 会被销毁，
     它的 .scene 会变成 undefined，此时跳过它 */
  _ensureGlobalKey() {
    if (CheatMenu._keyBound) return;
    CheatMenu._keyBound = true;

    window.addEventListener('keydown', (e) => {
      if (e.key !== 'i' && e.key !== 'I') return;
      const game = window.__game;
      if (!game || !game.scene || !game.scene.getScenes) return;
      const scenes = game.scene.getScenes(true);
      for (let i = scenes.length - 1; i >= 0; i--) {
        const s = scenes[i];
        if (s._cheatPanel && s._cheatPanel.scene === s) {
          s._cheatVisible = !s._cheatVisible;
          s._cheatPanel.setVisible(s._cheatVisible);
          return;
        }
      }
    });
  },
};

