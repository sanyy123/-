/* ============================================================================
   主菜单
   ============================================================================ */
class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  /* 主菜单负责**全部**图集的加载。
     以前这里只加载"敌人 + 角色 + 特效"，BOSS 那 26 张留给 GameScene.preload ——
     结果是每次点"开始游戏"都要现拉一批文件，正好卡在玩家最急的那一刻。
     现在一次性加载完（2 张图集大图 + goblin-wave，共 3 个请求），进游戏是瞬时的。
     后面三个场景的 preload 仍然会调 loadSheetAtlas，纹理已在缓存里会被跳过 */
  preload() {
    this.buildLoadingUI();
    loadSheetAtlas(this);
  }

  /* 加载页。手机端首屏原本是一片纯黑（引擎 1.1MB + 图集 560KB 都要等），
     有进度条玩家才知道"在动"，这是最便宜的体感优化 */
  buildLoadingUI() {
    const W = CONFIG.width, H = CONFIG.height;
    const cy = H / 2;

    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x060b12, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x101c2a, 1); bg.fillCircle(W / 2, cy - 40, 400);
    bg.fillStyle(0x16263a, 1); bg.fillCircle(W / 2, cy - 40, 280);
    bg.fillStyle(0x1d304a, 1); bg.fillCircle(W / 2, cy - 40, 170);

    const title = this.add.text(W / 2, cy - 84, '棋 盘 枪 手', {
      fontFamily: UI.FONT, fontSize: '56px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2);
    title.setShadow(0, 4, '#000000', 10, true, true);

    const sub = this.add.text(W / 2, cy - 34, 'BOARD SHOOTER', {
      fontFamily: UI.MONO, fontSize: '15px', color: '#5f7891',
    }).setOrigin(0.5).setDepth(2);

    // 进度条：外框 + 内条 + 百分比。内条用 setDisplaySize 拉宽（origin 在左端）
    const BW = 420, BH = 12, BX = W / 2 - BW / 2, BY = cy + 34;
    const frame = this.add.graphics().setDepth(2);
    frame.fillStyle(0x0d1622, 1); frame.fillRect(BX - 3, BY - 3, BW + 6, BH + 6);
    frame.lineStyle(2, 0x2b4a6b, 1); frame.strokeRect(BX - 3, BY - 3, BW + 6, BH + 6);

    const bar = this.add.rectangle(BX, BY, BW, BH, 0x4a90d9, 1)
      .setOrigin(0, 0).setDepth(3).setDisplaySize(1, BH);

    const pct = this.add.text(W / 2, BY + 30, '0%', {
      fontFamily: UI.MONO, fontSize: '18px', color: '#8fa3b8',
    }).setOrigin(0.5).setDepth(2);

    const tip = this.add.text(W / 2, cy + 116, '', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#6f88a3',
    }).setOrigin(0.5).setDepth(2);

    const TIPS = ['正在铺开棋盘…', '正在擦亮枪管…', '正在给骷髅王称重…', '正在叫醒巫妖王…'];

    this._loadingUI = [bg, title, sub, frame, bar, pct, tip];

    // 进度事件里顺手把提示语换掉 —— preload 阶段场景的 update / time 都不跑，
    // 用定时器切文案是切不动的，只能挂在进度回调上
    const onProgress = (v) => {
      bar.setDisplaySize(Math.max(1, BW * v), BH);
      pct.setText(Math.round(v * 100) + '%');
      tip.setText(TIPS[Math.min(TIPS.length - 1, Math.floor(v * TIPS.length))]);
    };
    this.load.on('progress', onProgress);
    this.load.once('complete', () => {
      pct.setText('100%');
      // 只摘自己那一个：off('progress') 会把别人挂的进度回调一起摘掉
      this.load.off('progress', onProgress);
    });
  }

  create() {
    // 加载页用完就拆，不然会盖在菜单上
    if (this._loadingUI) {
      for (const o of this._loadingUI) o.destroy();
      this._loadingUI = null;
    }
    Textures.ensure(this);
    buildSheetTextures(this);
    const W = CONFIG.width, H = CONFIG.height;
    SoundSys.setMuted(Storage.readMute());

    const bg = this.add.graphics().setDepth(-100);
    bg.fillStyle(0x060b12, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x101c2a, 1); bg.fillCircle(W/2, H/2 - 50, 480);
    bg.fillStyle(0x16263a, 1); bg.fillCircle(W/2, H/2 - 50, 340);
    bg.fillStyle(0x1d304a, 1); bg.fillCircle(W/2, H/2 - 50, 220);

    this.drawDecoBoard();
    this.drawDecoDots();

    const title = this.add.text(W/2, 126, '棋 盘 枪 手', {
      fontFamily: UI.FONT, fontSize: '78px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 8, '#000000', 16, true, true);

    this.add.text(W/2, 198, 'B O A R D   S H O O T E R', {
      fontFamily: UI.MONO, fontSize: '16px', color: '#8fa3b8', letterSpacing: 8,
    }).setOrigin(0.5);

    this.drawCenterShowcase();

    this.add.text(W/2, 402, '你被钉在场地中央，四面楚歌 —— 能撑多久？', {
      fontFamily: UI.FONT, fontSize: '18px', color: '#8fa3b8',
    }).setOrigin(0.5);

    // 当前整备状态直接摆在主菜单上，省得每次都要点进装备界面确认自己带的是什么
    const load = Storage.readLoadout();
    const charDef = CHARACTERS[load.character] || CHARACTERS.gunner;
    const weaponDef = WEAPONS[load.weapon] || WEAPONS.pistol;
    const skillNames = load.skills
      .filter(k => k && SKILLS[k])
      .map(k => SKILLS[k].name)
      .join(' / ') || '无';
    this.add.text(W/2, 432, '当前：' + charDef.name + ' · ' + weaponDef.name + ' · 技能 ' + skillNames, {
      fontFamily: UI.FONT, fontSize: '14px', color: '#7fffa0',
    }).setOrigin(0.5);

    this.add.text(W/2, 464, '金币  ' + Storage.readCoins(), {
      fontFamily: UI.MONO, fontSize: '19px', color: '#ffd54a', fontStyle: 'bold',
    }).setOrigin(0.5);

    /* 棋盘皮肤切换按钮。放在右上角，跟左上的"历史战绩"对称。
       皮肤键存在 BOARD_SKINS_ORDER 数组里，按一下往前走一格。
       当前皮肤的名称作为按钮文字的一部分显示出来，让玩家点之前就知道会改成什么。
       按钮文字存在 boardSkinBtnText 里，cycleBoardSkin() 会更新它。
       ⚠️ UI.makeButton 创建的子对象顺序是 [graphics, text, hit]，
       直接按 list[1] 取最稳；Phaser 的 Text 对象有 .text 属性（字符串 getter），
       Graphics / Rectangle 没有这个属性，用特征判定更可靠 */
    this.boardSkinBtn = UI.makeButton(this, W - 100, 40, 160, 48, this.boardSkinBtnLabel(),
      0x4a3a8b, 0x7a5acb, () => { this.cycleBoardSkin(); }, '15px');
    this.boardSkinBtnText = this.boardSkinBtn.list[1];

    /* 六个按钮排一行：无尽 / 肉鸽 / 双人 / 商城 / 装备 / 指南。
       从五个加到六个，单按钮宽度收到 146（6×146 + 5×12 = 936 < 960）才排得下。
       「双人模式」用青蓝色单独标出来 —— 它是新玩法入口，混在同色系里太容易漏看 */
    const btnY = H - 76;
    const bw = 146, gap = 12;
    const total = 6 * bw + 5 * gap;
    const first = (W - total) / 2 + bw / 2;

    UI.makeButton(this, first + 0 * (bw + gap), btnY, bw, 62, '无 尽 围 城',
      0x4a90d9, 0x5fa8f0, () => { this.scene.start('Game'); }, '17px');
    UI.makeButton(this, first + 1 * (bw + gap), btnY, bw, 62, '三 劫 试 炼',
      0xa8392f, 0xd95a4a, () => { this.scene.start('Game', { mode: 'rogue' }); }, '17px');
    UI.makeButton(this, first + 2 * (bw + gap), btnY, bw, 62, '双 人 模 式',
      0x1f7a72, 0x35b8ab, () => { this.scene.start('TwoPlayer'); }, '17px');
    UI.makeButton(this, first + 3 * (bw + gap), btnY, bw, 62, '商 城',
      0x8b6a3f, 0xb08a55, () => { this.scene.start('Shop'); }, '17px');
    UI.makeButton(this, first + 4 * (bw + gap), btnY, bw, 62, '装 备',
      0x2a6b94, 0x4ac2ff, () => { this.scene.start('Loadout'); }, '17px');
    UI.makeButton(this, first + 5 * (bw + gap), btnY, bw, 62, '指 南',
      0x3a5230, 0x577346, () => { this.showGuide(); }, '17px');

    UI.makeButton(this, 100, 40, 140, 48, '历 史 战 绩', 0x3a5230, 0x577346, () => {
      this.showHistory();
    }, '17px');

    this.guideOpen = false;
    this.input.keyboard.on('keydown-SPACE', () => { if (!this.guideOpen) this.scene.start('Game'); });
    this.input.keyboard.on('keydown-ENTER', () => { if (!this.guideOpen) this.scene.start('Game'); });

    this.buildGuide();

    CheatMenu.attach(this);
  }

  drawDecoBoard() {
    const g = this.add.graphics().setDepth(-50);
    const cell = 28, cols = 5, rows = 4;
    const startX = CONFIG.width - cols * cell - 40;
    const startY = 40;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle(0x4a90d9, ((r + c) % 2 === 0) ? 0.10 : 0.03);
        g.fillRect(startX + c * cell, startY + r * cell, cell - 2, cell - 2);
      }
    }
  }

  drawDecoDots() {
    const g = this.add.graphics().setDepth(-50);
    g.fillStyle(0xd94a4a, 0.18);
    for (let i = 0; i < 8; i++) g.fillCircle(80 + i * 22, CONFIG.height - 60, 6);
  }

  drawCenterShowcase() {
    const cx = CONFIG.width / 2, cy = 300;
    // 展示当前装备的角色，换角色后主菜单立刻能看出区别
    const load = Storage.readLoadout();
    const ch = CHARACTERS[load.character] || CHARACTERS.gunner;
    const base = CharArt.fit(this, ch, 1.3);
    const player = CharArt.add(this, cx, cy, ch);
    // 呼吸幅度按立绘大小算：写死 ±0.05 的话，2.6 倍的大立绘上几乎看不出在动
    this.tweens.add({
      targets: player, scale: { from: base * 0.96, to: base * 1.04 },
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // 四个敌人立绘。以前这里用的是 enemy-<兵种>-<朝向> 程序化纹理，
    // 所以菜单上一直显示成几个彩色圆球；改成取图集里对应朝向的第一帧，
    // 和游戏里看到的是同一批精灵
    this.addEnemyPortrait(cx - 90, cy - 50, 'infantry', 'right');
    this.addEnemyPortrait(cx + 90, cy - 50, 'rusher', 'left');
    this.addEnemyPortrait(cx - 110, cy + 50, 'shotgunner', 'up');
    this.addEnemyPortrait(cx + 110, cy + 50, 'armored', 'down');
  }

  /* 敌人立绘：取图集里该方向的第一帧。
     缩放用兵种自己的 sheetScale 再乘 1.15 —— 铁甲兵在游戏里就比步兵大一圈，
     菜单里保持同样的比例，玩家一眼就能看出"这个更壮"；
     多出来的 15% 是因为图集帧里角色本体的占比比程序化纹理小，
     照抄游戏内缩放会让立绘比原来那几个圆球小一截。
     图集没加载成功时退回程序化纹理，和游戏里用的是同一套降级策略 */
  addEnemyPortrait(x, y, typeKey, dir) {
    const def = ENEMY_TYPES[typeKey];
    const sheet = (def && def.sheet && this.textures.exists(def.sheet)) ? def.sheet : null;
    const d = dir || 'down';

    let img;
    let scale;
    if (sheet) {
      // 帧号 = 行号 × 每向帧数。行序固定是 下 / 上 / 左 / 右，
      // 每向帧数不能写死 8 —— 追踪炮和爆裂兵每向只有 6 帧
      const step = SHEET_FRAMES_PER_DIR[sheet] || 8;
      const row = { down: 0, up: 1, left: 2, right: 3 }[d] || 0;
      img = this.add.image(x, y, sheet, row * step);
      scale = (def.sheetScale != null ? def.sheetScale : CONFIG.sheetScale) * 1.15;
    } else {
      img = this.add.image(x, y, 'enemy-' + typeKey + '-' + d);
      scale = 1.05;
    }

    img.setScale(scale).setAlpha(0.9);
    return img;
  }

  /* ======================= 棋盘皮肤 =======================
     主菜单顶部按钮 + 循环切换器。
     数据走 BOARD_SKINS / BOARD_SKINS_ORDER，存档在 loadout.boardSkin。
     按一下按钮 → 取下一格 → 写存档 → 刷新按钮文字。下一帧进游戏时会读到新值。
     不在这里直接改 GameScene，免得菜单场景被 GameScene 的引用绑定（GameScene
     会被销毁重建，留引用等于留内存泄漏） */

  /* 按钮文字：前缀"皮 肤" + 当前皮肤名。两个空格分开方便对齐。
     用方法而不是 inline 函数是因为 makeButton 拿不到未创建的 text 引用，
     只能先算一遍初始 label、create 完再 setText 接管后续更新 */
  boardSkinBtnLabel() {
    const cur = this.currentBoardSkin();
    const def = BOARD_SKINS[cur] || BOARD_SKINS[DEFAULT_BOARD_SKIN];
    return '皮 肤 · ' + def.name;
  }

  currentBoardSkin() {
    const load = Storage.readLoadout();
    return (load && load.boardSkin && BOARD_SKINS[load.boardSkin])
      ? load.boardSkin
      : DEFAULT_BOARD_SKIN;
  }

  cycleBoardSkin() {
    const cur = this.currentBoardSkin();
    const idx = BOARD_SKINS_ORDER.indexOf(cur);
    const next = BOARD_SKINS_ORDER[(idx + 1) % BOARD_SKINS_ORDER.length];
    const load = Storage.readLoadout();
    load.boardSkin = next;
    Storage.writeLoadout(load);
    // setText 必须传字符串，不能传函数；这里算一次新文字立刻写
    const newLabel = this.boardSkinBtnLabel();
    if (this.boardSkinBtnText && typeof this.boardSkinBtnText.setText === 'function') {
      this.boardSkinBtnText.setText(newLabel);
    }
  }

  /* ======================= 指南 ======================= */

  buildGuide() {
    const W = CONFIG.width, H = CONFIG.height;
    this.guideContainer = this.add.container(0, 0).setDepth(10000).setVisible(false);

    const mask = this.add.rectangle(0, 0, W, H, 0x060b12, 0.92).setOrigin(0, 0);
    mask.setInteractive();
    this.guideContainer.add(mask);

    const panelW = 880, panelH = 520;
    const px = (W - panelW) / 2, py = (H - panelH) / 2;

    // 面板本体：外金内暗的双层描边。
    // 单层描边在深色背景上偏平，加一层内衬之后"这是一张卷轴"的感觉就出来了
    const panel = this.add.graphics();
    panel.fillStyle(0x152130, 1);
    panel.fillRoundedRect(px, py, panelW, panelH, 20);
    panel.lineStyle(3, 0x8b6a3f, 0.9);
    panel.strokeRoundedRect(px, py, panelW, panelH, 20);
    panel.lineStyle(1.5, 0x4a5a6d, 0.55);
    panel.strokeRoundedRect(px + 5, py + 5, panelW - 10, panelH - 10, 16);
    this.guideContainer.add(panel);

    // 左上角的一小段金色装饰：和标题的黄色呼应，空面板的角落不显得秃
    const corner = this.add.graphics();
    corner.lineStyle(3, 0xffd54a, 0.6);
    corner.beginPath();
    corner.moveTo(px + 18, py + 60);
    corner.lineTo(px + 18, py + 18);
    corner.lineTo(px + 60, py + 18);
    corner.strokePath();
    this.guideContainer.add(corner);

    const divider = this.add.graphics();
    divider.lineStyle(1.5, 0x33404f, 1);
    divider.lineBetween(px + 190, py + 70, px + 190, py + panelH - 20);
    this.guideContainer.add(divider);

    const title = this.add.text(px + 30, py + 28, '游 戏 指 南', {
      fontFamily: UI.FONT, fontSize: '22px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0, 0);
    this.guideContainer.add(title);

    const closeBtn = this.add.text(px + panelW - 32, py + 32, '✕', {
      fontFamily: UI.FONT, fontSize: '24px', color: '#8fa3b8', fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#8fa3b8'));
    closeBtn.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); this.hideGuide(); });
    this.guideContainer.add(closeBtn);

    this.guideContentLayer = this.add.container(0, 0);
    this.guideContainer.add(this.guideContentLayer);

    // 内容区域：使用遮罩实现滚动
    this.guideContentX = px + 210;
    this.guideContentY = py + 80;
    this.guideContentW = panelW - 240;
    this.guideContentH = panelH - 110;

    this.scrollContainer = this.add.container(this.guideContentX, this.guideContentY);
    this.guideContentLayer.add(this.scrollContainer);

        // 遮罩图形（不可见，只用于裁剪）
        const maskShape = this.make.graphics();
        maskShape.fillRect(this.guideContentX, this.guideContentY, this.guideContentW, this.guideContentH);
        const contentMask = maskShape.createGeometryMask(); // <--- 改名
        this.scrollContainer.setMask(contentMask);           // <--- 改名

    // 滚动状态
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.isDragging = false;
    this.dragStartY = 0;
    this.dragStartScrollY = 0;

    // 拖动区域（覆盖整个内容区域，拦截交互）
    const dragArea = this.add.rectangle(
      this.guideContentX + this.guideContentW / 2,
      this.guideContentY + this.guideContentH / 2,
      this.guideContentW, this.guideContentH, 0x000000, 0
    ).setInteractive();
    this.guideContentLayer.add(dragArea);

    dragArea.on('pointerdown', (pointer) => {
      if (!this.guideOpen) return;
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.scrollY;
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.isDragging || !this.guideOpen) return;
      const dy = pointer.y - this.dragStartY;
      this.scrollY = this.dragStartScrollY - dy;
      this.clampGuideScroll();
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // 鼠标滚轮支持
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.guideOpen) return;
      this.scrollY += deltaY * 0.5;
      this.clampGuideScroll();
    });

    const tabDefs = [
      { key: 'controls',   label: '操作' },
      { key: 'combat',     label: '战斗' },
      { key: 'enemies',    label: '敌人' },
      { key: 'powerups',   label: '道具' },
      { key: 'combo',      label: '连击' },
      { key: 'difficulty', label: '难度' },
      { key: 'rogue',      label: '肉鸽' },
      { key: 'growth',     label: '成长' },
      { key: 'talent',     label: '天赋' },
      { key: 'feedback',   label: '反馈' },
      { key: 'tips',       label: '技巧' },
    ];

    this.guideTabs = {};
    // 10 个标签要塞进 520 高的面板里：行高 38 → 36、间距保持 4，
    // 这样最后一个标签底边落在 py+480，离面板底还有 40px。
    // 行高回到 38 的话底边会到 500，只剩 20px，看着就贴边了
    // 11 个标签要塞进 520 高的面板：行高 36 → 32，间距 4 → 3，
    // 最后一个底边落在 py+470 左右，不会贴边
    const tabX = px + 30, tabW = 140, tabH = 32, tabStartY = py + 80, tabGap = 3;

    tabDefs.forEach((tab, i) => {
      const tx = tabX + tabW / 2;
      const ty = tabStartY + i * (tabH + tabGap) + tabH / 2;
      const tabObj = this.makeGuideTab(tx, ty, tabW, tabH, tab.label, () => {
        this.selectGuideTab(tab.key);
      });
      this.guideTabs[tab.key] = tabObj;
      this.guideContainer.add(tabObj.container);
    });

    this.selectGuideTab('controls');
  }

  clampGuideScroll() {
    // 内容高度 = 当前 scrollContainer 的内部高度（通过实际渲染内容计算）
    // 我们无法直接获取 Container 的内容高度，因此用 maxScrollY 来控制。
    // maxScrollY 在 renderGuideContent 中根据 ly 计算并设置。
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, Math.max(0, this.maxScrollY));
    this.scrollContainer.y = this.guideContentY - this.scrollY;
  }

  makeGuideTab(cx, cy, w, h, label, onClick) {
    const container = this.add.container(cx, cy);
    const g = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: UI.FONT, fontSize: '16px', color: '#8fa3b8', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add([g, text]);

    const self = {
      container, g, text,
      _active: false,
      setActive: (active) => {
        self._active = active;
        g.clear();
        if (active) {
          g.fillStyle(0x4a90d9, 1);
          g.fillRoundedRect(-w/2, -h/2, w, h, 10);
          g.fillStyle(0xffffff, 0.22);
          g.fillRoundedRect(-w/2 + 3, -h/2 + 3, w - 6, h/2 - 5, 8);
          g.lineStyle(2, 0xffffff, 0.7);
          g.strokeRoundedRect(-w/2, -h/2, w, h, 10);
          text.setColor('#ffffff');
        } else {
          g.fillStyle(0x0b1520, 0.6);
          g.fillRoundedRect(-w/2, -h/2, w, h, 10);
          g.lineStyle(1.5, 0x33404f, 1);
          g.strokeRoundedRect(-w/2, -h/2, w, h, 10);
          text.setColor('#8fa3b8');
        }
      },
      setHover: (hovered) => {
        if (self._active) return;
        text.setColor(hovered ? '#ffffff' : '#8fa3b8');
      },
    };

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => self.setHover(true));
    hit.on('pointerout',  () => self.setHover(false));
    hit.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); onClick(); });
    container.add(hit);

    return self;
  }

  selectGuideTab(key) {
    for (const k in this.guideTabs) this.guideTabs[k].setActive(k === key);
    this.scrollContainer.removeAll(true);
    this.scrollY = 0;
    this.scrollContainer.y = this.guideContentY;
    const data = GUIDE_DATA[key];
    if (data) this.renderGuideContent(data);
  }

  renderGuideContent(data) {
    const x = 0; // 相对于 scrollContainer 的局部坐标
    const y = 0;
    const w = this.guideContentW;

    const title = this.add.text(x, y, data.title, {
      fontFamily: UI.FONT, fontSize: '20px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0, 0);
    this.scrollContainer.add(title);

    const sep = this.add.graphics();
    sep.lineStyle(1.5, 0x4a90d9, 0.5);
    sep.lineBetween(x, y + 34, x + w, y + 34);
    this.scrollContainer.add(sep);

    let ly = y + 52;

    for (const [k, v] of data.lines) {
      if (k === '') { ly += 10; continue; }

      if (k.startsWith('# ')) {
        const st = this.add.text(x, ly, k.substring(2), {
          fontFamily: UI.FONT, fontSize: '14px', color: '#7fffa0', fontStyle: 'bold',
        }).setOrigin(0, 0);
        this.scrollContainer.add(st);
        ly += 26;
        continue;
      }

      // key 列宽从 130 加到 150：中文 key 最长 4 个字（"固定循环""随机位置"），
      // 加上「大月牙 → 三段劈斩」这种长 key，130 会贴到 value 起点上
      const keyText = this.add.text(x, ly, k, {
        fontFamily: UI.FONT, fontSize: '13px', color: '#a9bdd0',
      }).setOrigin(0, 0);
      const valText = this.add.text(x + 150, ly, v, {
        fontFamily: UI.FONT, fontSize: '13px', color: '#e0e8f0',
        wordWrap: { width: w - 160, useAdvancedWrap: true },
      }).setOrigin(0, 0);

      this.scrollContainer.add([keyText, valText]);
      // 行高必须按 value 的**实际渲染高度**推进。固定 +22 的话，
      // 长文本换行成两行时下一行的 key 会叠在换行后的第二行上 ——
      // 用户截图里"落雷 / 血量"那一片的重叠就是这么来的。
      // valText.height 是 Phaser 在 setText 之后立刻算好的最终高度，
      // 加 6px 作为行距。取 max(22, ...) 是防"极短文本反而行距过窄"
      ly += Math.max(22, valText.height + 6);
    }

    // 计算最大滚动距离
    // ly 是内容的底部 y 坐标（相对于 scrollContainer 局部坐标）
    // 可视高度是 this.guideContentH
    this.maxScrollY = Math.max(0, ly - this.guideContentH + 20);
    this.clampGuideScroll();
  }

  showGuide() { this.guideOpen = true; this.guideContainer.setVisible(true); }
  hideGuide() { this.guideOpen = false; this.guideContainer.setVisible(false); }

  /* ======================= 历史战绩 ======================= */

  showHistory() {
    if (this.historyPanel) return;

    const W = CONFIG.width, H = CONFIG.height;
    const list = Storage.readHistory();

    this.historyPanel = this.add.container(0, 0).setDepth(10100);

    const mask = this.add.rectangle(0, 0, W, H, 0x060b12, 0.9).setOrigin(0, 0);
    mask.setInteractive();
    this.historyPanel.add(mask);

    const panelW = 460, panelH = 420;
    const px = (W - panelW) / 2, py = (H - panelH) / 2;

    const panel = this.add.graphics();
    panel.fillStyle(0x152130, 1);
    panel.fillRoundedRect(px, py, panelW, panelH, 20);
    panel.lineStyle(3, 0x4a90d9, 0.7);
    panel.strokeRoundedRect(px, py, panelW, panelH, 20);
    this.historyPanel.add(panel);

    const title = this.add.text(W/2, py + 40, '历 史 战 绩', {
      fontFamily: UI.FONT, fontSize: '26px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.historyPanel.add(title);

    const sub = this.add.text(W/2, py + 72, '最近 ' + Storage.HISTORY_MAX + ' 局', {
      fontFamily: UI.FONT, fontSize: '13px', color: '#8fa3b8',
    }).setOrigin(0.5);
    this.historyPanel.add(sub);

    if (list.length === 0) {
      const empty = this.add.text(W/2, py + panelH/2, '还没有记录，快去玩一局吧！', {
        fontFamily: UI.FONT, fontSize: '16px', color: '#55697d',
      }).setOrigin(0.5);
      this.historyPanel.add(empty);
    } else {
      list.forEach((entry, i) => {
        const y = py + 110 + i * 52;

        const bg = this.add.graphics();
        bg.fillStyle(0x0b1520, 0.6);
        bg.fillRoundedRect(px + 30, y - 18, panelW - 60, 42, 10);
        this.historyPanel.add(bg);

        const rank = this.add.text(px + 50, y, '#' + (i + 1), {
          fontFamily: UI.MONO, fontSize: '16px', color: '#8fa3b8',
        }).setOrigin(0, 0.5);
        this.historyPanel.add(rank);

        const score = this.add.text(px + 110, y, '得分 ' + entry.score, {
          fontFamily: UI.FONT, fontSize: '16px', color: '#ffe066', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.historyPanel.add(score);

        const diffLabel = entry.difficulty >= CONFIG.maxDifficulty + 1
          ? '难度 MAX'
          : '难度 ' + entry.difficulty;
        const diff = this.add.text(px + panelW - 50, y, diffLabel, {
          fontFamily: UI.FONT, fontSize: '14px', color: '#7fffa0',
        }).setOrigin(1, 0.5);
        this.historyPanel.add(diff);
      });
    }

    const closeBtn = UI.makeButton(this, W/2, py + panelH + 40, 240, 68, '关 闭', 0x5d452a, 0x8b6a3f, () => {
      this.historyPanel.destroy();
      this.historyPanel = null;
    });
    this.historyPanel.add(closeBtn);
  }
}

/* ============================================================================
   双人模式整备
   ----------------------------------------------------------------------------
   两步走：
     ① 选玩法（无尽 / 肉鸽）—— 右下角「下 一 步」
     ② 分别给 P1 / P2 配角色 / 武器 / 技能 —— 点槽位弹出面板，面板里带说明

   ⚠️ 这一屏**不写存档**。单人整备（LoadoutScene）改的是 Storage 里的 loadout，
   双人配置只活在场景内，开局时作为 data 传给 GameScene。
   两边共用一个存档的话，配完双人再回去打单人会发现自己的配置被改掉了。

   ⚠️ 两人的技能数组必须各拷一份。共享同一个数组的话，给 P1 换技能会把
   P2 的也一起改掉 —— 而需求是"技能不共享，各自计算"。
   ============================================================================ */
class TwoPlayerScene extends Phaser.Scene {
  constructor() { super('TwoPlayer'); }

  preload() { loadSheetAtlas(this); }

  create() {
    buildSheetTextures(this);
    Textures.ensure(this);
    SoundSys.setMuted(Storage.readMute());

    const load = Storage.readLoadout();
    this.owned = load.owned;

    // 两人的配置，初值取当前单人整备 —— 配过的东西不用重新点一遍
    this.picks = [
      { character: load.character, weapon: load.weapon, skills: load.skills.slice() },
      { character: load.character, weapon: load.weapon, skills: load.skills.slice() },
    ];
    // 买过第二个角色就让 P2 默认站另一个 —— 一进界面就能看出"这是两个人"
    const ownedChars = this.owned.character;
    if (ownedChars.length > 1) {
      const i = ownedChars.indexOf(this.picks[0].character);
      this.picks[1].character = ownedChars[(i + 1) % ownedChars.length];
    }

    // 槽位定义和单人整备完全一致：武器 / 专属 / 技能槽 1 / 技能槽 2
    this.slotDefs = [
      { kind: 'weapon', label: '武 器' },
      { kind: 'innate', label: '专属技能' },
      { kind: 'skill',  label: '技能槽 1', idx: 0 },
      { kind: 'skill',  label: '技能槽 2', idx: 1 },
    ];

    this.mode = 'endless';      // 默认无尽，和主菜单第一颗按钮一致
    this.phase = '';
    this.picker = null;         // 当前打开的槽位面板
    this.phaseRoot = null;      // 当前阶段的根容器（切阶段时整体销毁）
    this.panels = [null, null]; // P1 / P2 各自的子容器（换角色时只重建一个）
    this.playerViews = [null, null];

    const W = CONFIG.width, H = CONFIG.height;
    const bg = this.add.graphics().setDepth(-100);
    bg.fillStyle(0x060b12, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x101c2a, 1); bg.fillCircle(W / 2, H / 2 - 40, 520);
    bg.fillStyle(0x16263a, 1); bg.fillCircle(W / 2, H / 2 - 40, 380);

    this.buildModePhase();

    // ESC 逐层退回：面板 → 玩法选择 → 主菜单
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.picker) this.closePicker();
      else if (this.phase === 'loadout') this.buildModePhase();
      else this.scene.start('Menu');
    });

    CheatMenu.attach(this);
  }

  /* ======================= 第一步：选玩法 ======================= */

  buildModePhase() {
    this.phase = 'mode';
    this.closePicker();
    this.clearPhase();

    const root = this.add.container(0, 0).setDepth(100);
    this.phaseRoot = root;
    const W = CONFIG.width, H = CONFIG.height;

    const title = this.add.text(W / 2, 58, '双 人 模 式', {
      fontFamily: UI.FONT, fontSize: '44px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 6, '#000000', 12, true, true);
    root.add(title);

    root.add(this.add.text(W / 2, 104, 'T W O   P L A Y E R', {
      fontFamily: UI.MONO, fontSize: '14px', color: '#8fa3b8', letterSpacing: 8,
    }).setOrigin(0.5));

    root.add(this.add.text(W / 2, 142, '仅限电脑端  ·  共享生命  ·  技能 / Buff / 增幅各自计算', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#7fffa0',
    }).setOrigin(0.5));

    this.modeCards = [];
    const defs = [
      { key: 'endless', name: '无 尽 围 城', sub: 'ENDLESS',
        desc: '一波接一波，没有尽头。\n活到第几波就是你的成绩。',
        color: 0x4a90d9, hover: 0x5fa8f0 },
      { key: 'rogue', name: '三 劫 试 炼', sub: 'ROGUE',
        desc: '三张地图、三个 BOSS。\n每跨过一道积分线就各抽一次增幅。',
        color: 0xa8392f, hover: 0xd95a4a },
    ];
    defs.forEach((d, i) => {
      const cx = W / 2 + (i === 0 ? -190 : 190);
      const cy = 340;
      const c = this.add.container(cx, cy);
      root.add(c);

      const g = this.add.graphics();
      c.add(g);

      const nameT = this.add.text(0, -62, d.name, {
        fontFamily: UI.FONT, fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      c.add(nameT);

      c.add(this.add.text(0, -28, d.sub, {
        fontFamily: UI.MONO, fontSize: '11px', color: '#8fa3b8', letterSpacing: 5,
      }).setOrigin(0.5));

      c.add(this.add.text(0, 18, d.desc, {
        fontFamily: UI.FONT, fontSize: '14px', color: '#8fa3b8',
        align: 'center', lineSpacing: 8,
      }).setOrigin(0.5));

      // 选中标记：右上角一个对勾圆章，未选中时隐藏
      const check = this.add.text(112, -82, '✓', {
        fontFamily: UI.FONT, fontSize: '20px', color: '#0b1520', fontStyle: 'bold',
      }).setOrigin(0.5);
      const checkBg = this.add.circle(112, -82, 16, 0x7fffa0, 1);
      c.add(checkBg); c.add(check);

      const view = { key: d.key, g, check, checkBg, hovered: false };
      const draw = () => {
        const sel = this.mode === d.key;
        g.clear();
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(-147, -117, 300, 240, 20);
        /* 选中态用"亮边框 + 对勾 + 顶部色条"，底色仍是深色。
           选中就直接把底色换成主题亮色的话，卡里那两行灰字会糊成一片看不清 */
        g.fillStyle(sel ? 0x1d304a : (view.hovered ? 0x1a2a3c : 0x152130), 1);
        g.fillRoundedRect(-150, -120, 300, 240, 20);
        g.lineStyle(sel ? 4 : 2.5, sel ? 0x7fffa0 : 0x33404f, 1);
        g.strokeRoundedRect(-150, -120, 300, 240, 20);
        // 顶部一条主题色横杠，两张卡一眼分得开
        g.fillStyle(d.color, sel ? 1 : 0.75);
        g.fillRoundedRect(-150, -120, 300, 10, 5);
        checkBg.setVisible(sel);
        check.setVisible(sel);
      };
      view.draw = draw;
      draw();

      const hit = this.add.rectangle(0, 0, 300, 240, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { view.hovered = true; draw(); });
      hit.on('pointerout',  () => { view.hovered = false; draw(); });
      hit.on('pointerdown', () => {
        SoundSys.unlock(); SoundSys.uiClick();
        this.mode = d.key;
        this.modeCards.forEach(m => m.draw());
      });
      c.add(hit);

      this.modeCards.push(view);
    });

    root.add(UI.makeButton(this, 170, H - 62, 220, 56, '返 回 主 菜 单',
      0x5d452a, 0x8b6a3f, () => this.scene.start('Menu'), '19px'));
    root.add(UI.makeButton(this, W - 170, H - 62, 220, 56, '下 一 步',
      0x2a6b94, 0x4ac2ff, () => this.buildLoadoutPhase(), '19px'));
  }

  /* ======================= 第二步：两人整备 ======================= */

  buildLoadoutPhase() {
    this.phase = 'loadout';
    this.closePicker();
    this.clearPhase();

    const root = this.add.container(0, 0).setDepth(100);
    this.phaseRoot = root;
    const W = CONFIG.width, H = CONFIG.height;

    const modeName = this.mode === 'rogue' ? '三 劫 试 炼' : '无 尽 围 城';
    root.add(this.add.text(W / 2, 34, '双 人 整 备  ·  ' + modeName, {
      fontFamily: UI.FONT, fontSize: '26px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5));

    // 中间分隔线：两个人的配置左右分开摆，谁是谁一眼看清
    const div = this.add.graphics();
    div.lineStyle(2, 0x33404f, 0.85);
    div.lineBetween(W / 2, 62, W / 2, 486);
    root.add(div);

    for (let pi = 0; pi < 2; pi++) this.buildPanel(pi);

    root.add(this.add.text(W / 2, 482, this.sharedHint(), {
      fontFamily: UI.FONT, fontSize: '14px', color: '#7fffa0',
    }).setOrigin(0.5));

    root.add(UI.makeButton(this, 170, H - 46, 220, 52, '返 回 主 菜 单',
      0x5d452a, 0x8b6a3f, () => this.scene.start('Menu'), '18px'));
    root.add(UI.makeButton(this, 400, H - 46, 180, 52, '上 一 步',
      0x2a6b94, 0x4ac2ff, () => this.buildModePhase(), '18px'));
    root.add(UI.makeButton(this, W - 190, H - 46, 300, 52, '开 始 游 戏',
      0x2a7a3a, 0x4ad97a, () => this.startGame(), '20px'));
  }

  /* 单个玩家的整块面板。换角色时整块重建 —— 立绘 / 名称 / 描述 / 槽位
     全都跟着角色变，逐项刷新反而容易漏掉一处 */
  buildPanel(pi) {
    if (this.panels[pi]) { this.panels[pi].destroy(); this.panels[pi] = null; }

    const c = this.add.container(0, 0);
    this.phaseRoot.add(c);
    this.panels[pi] = c;

    const cx = pi === 0 ? 240 : CONFIG.width - 240;
    const isP2 = pi === 1;
    const pick = this.picks[pi];
    const ch = CHARACTERS[pick.character] || CHARACTERS.gunner;

    c.add(this.add.text(cx, 78, isP2 ? 'P2' : 'P1', {
      fontFamily: UI.MONO, fontSize: '22px',
      color: isP2 ? '#7fd4ff' : '#ffd54a', fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, 104,
      isP2 ? '方向键移动  ·  小键盘 1 / 2 技能' : 'WASD 移动  ·  J / K 技能', {
        fontFamily: UI.FONT, fontSize: '13px', color: '#8fa3b8',
      }).setOrigin(0.5));

    // 立绘 + 左右箭头。只有一个已购角色时箭头压暗，提示"没得换"
    const canCycle = this.owned.character.length > 1;
    const p = CharArt.add(this, cx, 178, ch, 1.15);
    c.add(p);
    const al = this.makeArrow(cx - 122, 178, -1, canCycle, () => this.cycleChar(pi, -1));
    const ar = this.makeArrow(cx + 122, 178, 1, canCycle, () => this.cycleChar(pi, 1));
    c.add(al); c.add(ar);

    c.add(this.add.text(cx, 230, ch.name, {
      fontFamily: UI.FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, 256, ch.desc, {
      fontFamily: UI.FONT, fontSize: '12px', color: '#8fa3b8',
      align: 'center', wordWrap: { width: 400, useAdvancedWrap: true },
    }).setOrigin(0.5, 0));

    // 四个槽位
    const bw = 100, bh = 92, gap = 8;
    const total = 4 * bw + 3 * gap;             // 424
    const startX = cx - total / 2 + bw / 2;
    const slotY = 344;
    const views = [];
    this.slotDefs.forEach((def, i) => {
      views.push(this.buildSlot(c, startX + i * (bw + gap), slotY, bw, bh, def, pi));
    });
    this.playerViews[pi] = views;

    c.add(this.add.text(cx, 410, this.statLine(pi), {
      fontFamily: UI.FONT, fontSize: '12px', color: '#8fa3b8',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, 434, '点 击 槽 位 更 换（有详细说明）', {
      fontFamily: UI.FONT, fontSize: '12px', color: '#55697d',
    }).setOrigin(0.5));

    this.refreshPanel(pi);
  }

  /* 只按"当前玩家的角色"重画槽位内容，不重建整块面板 */
  refreshPanel(pi) {
    const views = this.playerViews[pi];
    if (!views) return;
    const pick = this.picks[pi];
    const ch = CHARACTERS[pick.character] || CHARACTERS.gunner;
    const innates = (ch.skills || []).map(k => SKILLS[k]).filter(Boolean);

    // 角色锁武器时（巫女 / 勇者 / 矮人 / 亡灵法师）武器槽显示真正生效的那把并标注，
    // 否则玩家看着自己装的枪、进去打出来却是别的，只会以为是 bug
    const lock = ch.weaponLock ? (WEAPONS[ch.weaponLock] || null) : null;
    const wp = lock || WEAPONS[pick.weapon] || WEAPONS.pistol;
    const s0 = pick.skills[0] ? SKILLS[pick.skills[0]] : null;
    const s1 = pick.skills[1] ? SKILLS[pick.skills[1]] : null;

    const items = [
      { icon: 'weapon', def: wp, name: wp.name + (lock ? ' ·锁定' : ''), color: wp.color },
      { icon: 'skill', def: innates[0] || null,
        name: innates.map(s => s.name).join(' / ') || '无',
        color: innates[0] ? innates[0].color : 0x33404f },
      { icon: 'skill', def: s0, name: s0 ? s0.name : '空', color: s0 ? s0.color : 0x33404f },
      { icon: 'skill', def: s1, name: s1 ? s1.name : '空', color: s1 ? s1.color : 0x33404f },
    ];
    views.forEach((v, i) => v.update(items[i]));
  }

  buildSlot(parent, cx, cy, w, h, def, pi) {
    const c = this.add.container(cx, cy);
    parent.add(c);
    const g = this.add.graphics();
    c.add(g);

    /* 三行自上而下：标签 / 图标 / 名称。
       行高是算好的 —— 槽位 92 高时标签占 -46~-34、图标圆占 -22~18、名称占 23~37，
       三块互不重叠。之前图标放 -6、标签放 -27，圆的上沿直接盖在标签上 */
    c.add(this.add.text(0, -h / 2 + 12, def.label, {
      fontFamily: UI.FONT, fontSize: '11px', color: '#8fa3b8', fontStyle: 'bold',
    }).setOrigin(0.5));

    const iconC = this.add.container(0, -2);
    c.add(iconC);

    const nameText = this.add.text(0, h / 2 - 15, '', {
      fontFamily: UI.FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(nameText);

    const view = { container: c, g, iconC, nameText, _hover: false };

    const draw = () => {
      g.clear();
      const hovered = view._hover;
      g.fillStyle(hovered ? 0x1a2a3c : 0x152130, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      g.lineStyle(2, hovered ? 0x4ac2ff : 0x33404f, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    };
    view.draw = draw;
    draw();

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { view._hover = true; draw(); });
    hit.on('pointerout',  () => { view._hover = false; draw(); });
    hit.on('pointerdown', () => {
      SoundSys.unlock(); SoundSys.uiClick();
      this.openPicker(pi, this.slotDefs.indexOf(def));
    });
    c.add(hit);

    // 图标区整体重建。只有 4 个槽位，比维护一堆引用省心
    view.update = (item) => {
      iconC.removeAll(true);
      if (item.icon === 'weapon') {
        iconC.add(this.add.circle(0, 0, 20, 0x0b1520, 1).setStrokeStyle(2, 0x33404f, 1));
        iconC.add(this.add.image(0, 0, 'bullet-p').setScale(1.5).setTint(item.color));
      } else if (item.def) {
        iconC.add(this.add.circle(0, 0, 20, item.color, 1));
        iconC.add(this.add.text(0, 0, item.def.name.charAt(0), {
          fontFamily: UI.FONT, fontSize: '17px', color: '#0b1520', fontStyle: 'bold',
        }).setOrigin(0.5));
      } else {
        iconC.add(this.add.circle(0, 0, 20, 0x0b1520, 1).setStrokeStyle(2, 0x33404f, 1));
        iconC.add(this.add.text(0, 0, '空', {
          fontFamily: UI.FONT, fontSize: '13px', color: '#55697d',
        }).setOrigin(0.5));
      }
      // 槽宽只有 100，"逆反结界 / 堕天形态" 这种两段拼接的名字会溢出去压到隔壁，
      // 名字长了就自动降一档字号
      const long = item.name.length > 6;
      nameText.setFontSize(long ? 10 : 13);
      nameText.setText(item.name);
      nameText.setColor(item.def ? '#ffffff' : '#55697d');
    };

    return view;
  }

  makeArrow(x, y, dir, enabled, onClick) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const draw = (hovered) => {
      g.clear();
      g.fillStyle(0x0b1520, hovered && enabled ? 0.95 : 0.72);
      g.fillCircle(0, 0, 22);
      g.lineStyle(2, hovered && enabled ? 0xffffff : 0x8fa3b8, enabled ? 0.9 : 0.35);
      g.strokeCircle(0, 0, 22);
      g.fillStyle(0xffffff, enabled ? 1 : 0.3);
      if (dir < 0) g.fillTriangle(7, -10, 7, 10, -7, 0);
      else         g.fillTriangle(-7, -10, -7, 10, 7, 0);
    };
    draw(false);
    c.add(g);

    const hit = this.add.circle(0, 0, 26, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', () => {
      SoundSys.unlock();
      if (enabled) onClick();
    });
    c.add(hit);
    return c;
  }

  /* 在"已拥有"的角色里循环。没买到的角色不进轮盘 ——
     放进去只会让玩家以为能直接用，点下去才发现是锁的 */
  cycleChar(pi, dir) {
    const owned = this.owned.character;
    if (owned.length < 2) return;

    let i = owned.indexOf(this.picks[pi].character);
    if (i < 0) i = 0;
    const nextKey = owned[(i + dir + owned.length) % owned.length];
    if (nextKey === this.picks[pi].character) return;

    this.picks[pi].character = nextKey;
    SoundSys.uiClick();
    this.closePicker();
    this.buildPanel(pi);
  }

  /* ======================= 槽位选择面板 ======================= */

  openPicker(pi, slotIndex) {
    // 再点同一个槽位就收起，等于一个开关
    if (this.picker && this.picker.pi === pi && this.picker.slotIndex === slotIndex) {
      this.closePicker();
      return;
    }
    this.closePicker();

    const def = this.slotDefs[slotIndex];
    const pick = this.picks[pi];
    const ch = CHARACTERS[pick.character] || CHARACTERS.gunner;
    const tag = 'P' + (pi + 1);
    let title, options;

    if (def.kind === 'weapon') {
      const lock = ch.weaponLock ? (WEAPONS[ch.weaponLock] || null) : null;
      if (lock) {
        // 锁武器的角色没有可选列表，直接把"为什么换不了"和这把武器的说明摆出来
        title = tag + ' · 武器（角色锁定）';
        options = [{ kind: 'info', def: lock, name: lock.name }];
      } else {
        title = tag + ' · 更换武器';
        options = this.owned.weapon.map(k => ({
          kind: 'weapon', key: k, def: WEAPONS[k], equipped: pick.weapon === k,
        }));
      }
    } else if (def.kind === 'innate') {
      title = tag + ' · 专属技能（跟随角色）';
      options = (ch.skills || []).map(k => SKILLS[k]).filter(Boolean)
        .map(s => ({ kind: 'info', def: s, name: s.name }));
    } else {
      title = tag + ' · 技能槽 ' + (def.idx + 1);
      options = this.owned.skill
        .filter(k => SKILLS[k] && !SKILLS[k].innate)
        .map(k => ({
          kind: 'skill', key: k, def: SKILLS[k],
          equipped: pick.skills[def.idx] === k,
        }));
      // 末尾永远给一个"卸下"，否则装上了就再也换不下来
      options.push({
        kind: 'skill', key: null, def: null, name: '卸下当前技能',
        equipped: !pick.skills[def.idx],
      });
    }

    const W = CONFIG.width, H = CONFIG.height;
    const popW = 680;
    const headH = 46;
    const rowH = 58;
    const popH = headH + options.length * rowH + 14;
    const popX = (W - popW) / 2;
    const popY = Math.max(14, (H - popH) / 2);

    const layer = this.add.container(0, 0).setDepth(20000);

    // 全屏遮罩：点空白处关闭
    const mask = this.add.rectangle(0, 0, W, H, 0x060b12, 0.78)
      .setOrigin(0, 0).setInteractive();
    mask.on('pointerdown', () => this.closePicker());
    layer.add(mask);

    const g = this.add.graphics();
    g.fillStyle(0x0b1520, 0.98);
    g.fillRoundedRect(popX, popY, popW, popH, 16);
    g.lineStyle(2.5, 0x4a90d9, 0.9);
    g.strokeRoundedRect(popX, popY, popW, popH, 16);
    layer.add(g);

    layer.add(this.add.text(popX + 22, popY + 23, title, {
      fontFamily: UI.FONT, fontSize: '17px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const closeBtn = this.add.text(popX + popW - 26, popY + 23, '✕', {
      fontFamily: UI.FONT, fontSize: '18px', color: '#8fa3b8', fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#8fa3b8'));
    closeBtn.on('pointerdown', () => {
      SoundSys.unlock(); SoundSys.uiClick(); this.closePicker();
    });
    layer.add(closeBtn);

    options.forEach((opt, i) => {
      const rowY = popY + headH + i * rowH;
      layer.add(this.buildPickerRow(popX + 12, rowY, popW - 24, rowH - 6, opt, pi, slotIndex));
    });

    this.picker = { pi, slotIndex, layer };
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 120 });
  }

  buildPickerRow(x, y, w, h, opt, pi, slotIndex) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    c.add(g);

    const info = opt.kind === 'info';          // 只展示、不可选（锁定武器 / 专属技能）
    const isNone = !info && !opt.key;          // "卸下"那一行
    const equipped = !!opt.equipped;

    const draw = (hovered) => {
      g.clear();
      g.fillStyle(equipped ? 0x1c3a28 : (hovered && !info ? 0x1d304a : 0x152130), 1);
      g.fillRoundedRect(0, 0, w, h, 10);
      g.lineStyle(equipped ? 2 : 1.5, equipped ? 0x7fffa0 : 0x33404f, 1);
      g.strokeRoundedRect(0, 0, w, h, 10);
    };
    draw(false);

    const iconX = 32, iconY = h / 2;
    if (isNone) {
      c.add(this.add.circle(iconX, iconY, 15, 0x2a3442, 1).setStrokeStyle(1.5, 0x44505f, 1));
      c.add(this.add.text(iconX, iconY, '空', {
        fontFamily: UI.FONT, fontSize: '12px', color: '#8fa3b8',
      }).setOrigin(0.5));
    } else if (opt.kind === 'weapon') {
      c.add(this.add.circle(iconX, iconY, 16, 0x0b1520, 1).setStrokeStyle(2, 0x33404f, 1));
      c.add(this.add.image(iconX, iconY, 'bullet-p').setScale(1.4).setTint(opt.def.color));
    } else {
      c.add(this.add.circle(iconX, iconY, 16, opt.def.color, 1));
      c.add(this.add.text(iconX, iconY, opt.def.name.charAt(0), {
        fontFamily: UI.FONT, fontSize: '14px', color: '#0b1520', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    c.add(this.add.text(60, iconY - 12, isNone ? '卸下当前技能' : opt.def.name, {
      fontFamily: UI.FONT, fontSize: '15px',
      color: equipped ? '#7fffa0' : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    // 说明文字。技能描述里带冒号的句子较长，宽度给足并允许折行
    c.add(this.add.text(60, iconY + 10, isNone ? '空出这个技能槽' : opt.def.desc, {
      fontFamily: UI.FONT, fontSize: '11px', color: '#8fa3b8',
      wordWrap: { width: w - 190, useAdvancedWrap: true },
    }).setOrigin(0, 0.5));

    // 右侧状态字。info 行不写"点击更换"，否则玩家会以为能点
    let right;
    if (info) right = opt.kind === 'info' && slotIndex === 0 ? '角色锁定' : '跟随角色';
    else right = equipped ? '使用中' : '点击更换';
    c.add(this.add.text(w - 16, iconY, right, {
      fontFamily: UI.FONT, fontSize: '12px',
      color: equipped ? '#7fffa0' : '#55697d', fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    if (!info) {
      const hit = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => draw(true));
      hit.on('pointerout',  () => draw(false));
      hit.on('pointerdown', () => {
        SoundSys.unlock(); SoundSys.uiClick();
        this.applyPick(pi, slotIndex, opt);
      });
      c.add(hit);
    }

    return c;
  }

  applyPick(pi, slotIndex, opt) {
    const def = this.slotDefs[slotIndex];
    const pick = this.picks[pi];

    if (def.kind === 'weapon') {
      pick.weapon = opt.key;
    } else {
      // 同一个技能不能同时占两个槽：先把它从另一个槽里摘掉
      if (opt.key) {
        const other = def.idx === 0 ? 1 : 0;
        if (pick.skills[other] === opt.key) pick.skills[other] = null;
      }
      pick.skills[def.idx] = opt.key;
    }

    SoundSys.pickup();
    this.closePicker();
    this.refreshPanel(pi);
  }

  closePicker() {
    if (!this.picker) return;
    const layer = this.picker.layer;
    this.picker = null;
    this.tweens.killTweensOf(layer);
    layer.destroy();
  }

  /* ======================= 收尾 ======================= */

  clearPhase() {
    if (this.phaseRoot) { this.phaseRoot.destroy(); this.phaseRoot = null; }
    this.panels = [null, null];
    this.playerViews = [null, null];
  }

  /* 共享生命 = 两人生命上限之和，和 GameScene.create 里的算法必须完全一致 ——
     这里多算少算，玩家进游戏第一眼就会发现对不上 */
  sharedHint() {
    const talents = Storage.readTalents();
    let total = 0;
    for (let i = 0; i < 2; i++) {
      const ch = CHARACTERS[this.picks[i].character] || CHARACTERS.gunner;
      const t = talents[ch.key] || {};
      total += ch.lives + (t.toughness ? 1 : 0) + (t.lifeforce ? 1 : 0);
    }
    return '共享生命  ' + total + '  ·  敌人更多更快  ·  掉落翻倍（各自吃各自的）';
  }

  statLine(pi) {
    const pick = this.picks[pi];
    const ch = CHARACTERS[pick.character] || CHARACTERS.gunner;
    const wp = ch.weaponLock
      ? (WEAPONS[ch.weaponLock] || WEAPONS.pistol)
      : (WEAPONS[pick.weapon] || WEAPONS.pistol);
    return '生命 ' + ch.lives
      + '   ·   移速 ×' + ch.speedMul.toFixed(2)
      + '   ·   射速 ×' + (1 / (ch.fireIntervalMul * (wp.interval / WEAPONS.pistol.interval))).toFixed(2);
  }

  startGame() {
    SoundSys.uiClick();
    const pack = i => ({
      character: this.picks[i].character,
      weapon: this.picks[i].weapon,
      skills: this.picks[i].skills.slice(),
    });
    this.scene.start('Game', {
      twoPlayer: true,
      mode: this.mode === 'rogue' ? 'rogue' : 'endless',
      p1: pack(0),
      p2: pack(1),
    });
  }
}

/* ============================================================================
   商城 —— 只负责"买"
   ----------------------------------------------------------------------------
   三个页签（角色 / 武器 / 技能）共用同一套卡片渲染，靠 SHOP_CATEGORIES 分派数据表。
   已拥有的东西在这里显示为"已拥有"，装备请到 LoadoutScene。
   ============================================================================ */
class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  /* 角色卡片要摆立绘。图集在 MenuScene 已经加载过，这里只是兜底 */
  preload() {
    loadSheetAtlas(this);
  }

  create() {
    buildSheetTextures(this);
    Textures.ensure(this);
    SoundSys.setMuted(Storage.readMute());

    this.loadout = Storage.readLoadout();
    this.tab = 'character';
    // 每个分类独立记页码：从"角色第 2 页"切到"技能"再切回来，
    // 应该回到角色第 2 页，而不是被重置到第一页。
    // 用对象而不是数组，键直接是 tab key，切 tab 时不用查下标
    this.page = { character: 0, weapon: 0, skill: 0 };

    const W = CONFIG.width, H = CONFIG.height;

    const bg = this.add.graphics().setDepth(-100);
    bg.fillStyle(0x060b12, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x101c2a, 1); bg.fillCircle(W/2, H/2 - 40, 520);
    bg.fillStyle(0x16263a, 1); bg.fillCircle(W/2, H/2 - 40, 380);

    this.add.text(40, 32, '商 城', {
      fontFamily: UI.FONT, fontSize: '30px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0, 0);

    this.add.text(42, 74, 'S H O P', {
      fontFamily: UI.MONO, fontSize: '12px', color: '#55697d', letterSpacing: 6,
    }).setOrigin(0, 0);

    this.coinText = this.add.text(W - 40, 48, '', {
      fontFamily: UI.MONO, fontSize: '26px', color: '#ffd54a', fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    this.buildTabs();

    // 顶部提示：说清楚"这里只负责买"，以及钱从哪来
    this.add.text(W / 2, 142, '金币来自击杀敌人（普通 1 / 特殊 2） · 买完请到「装备」界面装上', {
      fontFamily: UI.FONT, fontSize: '14px', color: '#7fffa0',
    }).setOrigin(0.5);

    this.contentLayer = this.add.container(0, 0);
    this.buildPager();

    UI.makeButton(this, W / 2 - 140, H - 46, 220, 56, '返 回 主 菜 单', 0x5d452a, 0x8b6a3f, () => {
      this.scene.start('Menu');
    }, '19px');
    UI.makeButton(this, W / 2 + 140, H - 46, 220, 56, '去 装 备', 0x2a6b94, 0x4ac2ff, () => {
      this.scene.start('Loadout');
    }, '19px');

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    // 左右方向键翻页：和点箭头按钮完全等价，桌面端操作更顺手
    this.input.keyboard.on('keydown-LEFT',  () => this.turnPage(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.turnPage(1));

    this.refresh();

    CheatMenu.attach(this);
  }

  buildTabs() {
    const W = CONFIG.width;
    const defs = [
      { key: 'character', label: '角 色' },
      { key: 'weapon',    label: '武 器' },
      { key: 'skill',     label: '技 能' },
    ];

    this.tabButtons = {};
    const w = 170, h = 44, y = 102;

    defs.forEach((d, i) => {
      const x = W / 2 + (i - 1) * 190;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      const t = this.add.text(0, 0, d.label, {
        fontFamily: UI.FONT, fontSize: '18px', color: '#8fa3b8', fontStyle: 'bold',
      }).setOrigin(0.5);
      c.add([g, t]);

      const self = {
        draw: (active, hovered) => {
          g.clear();
          g.fillStyle(active ? 0x4a90d9 : (hovered ? 0x1d304a : 0x0b1520), active ? 1 : 0.85);
          g.fillRoundedRect(-w/2, -h/2, w, h, 12);
          g.lineStyle(2, active ? 0xffffff : 0x33404f, active ? 0.8 : 1);
          g.strokeRoundedRect(-w/2, -h/2, w, h, 12);
          t.setColor(active ? '#ffffff' : '#8fa3b8');
        },
      };
      this.tabButtons[d.key] = self;

      const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { if (this.tab !== d.key) self.draw(false, true); });
      hit.on('pointerout',  () => { if (this.tab !== d.key) self.draw(false, false); });
      hit.on('pointerdown', () => {
        SoundSys.unlock(); SoundSys.uiClick();
        this.tab = d.key;
        this.refresh();
      });
      c.add(hit);
    });
  }

  /* 整个界面只有这一个重绘入口：买完就调它，
     避免出现"卡片状态更新了但顶部金币没更新"这类局部刷新漏掉的地方 */
  refresh() {
    this.coinText.setText('金币  ' + Storage.readCoins());

    for (const k in this.tabButtons) this.tabButtons[k].draw(k === this.tab, false);

    this.contentLayer.removeAll(true);

    // 过滤规则统一走 currentList（见那里），refresh 和 turnPage 共用一份 ——
    // 复制成两份迟早出现"翻到最后一页是空的"
    const list = this.currentList();
    const perPage = 6;
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));

    // 页码越界兜底：切 tab 后分类里的条目数变了，上一页记的页码可能超出新的总页数。
    // 不夹的话会渲染出一个空白页 —— 不报错、不崩溃，只是"这个分类打不开"
    let page = this.page[this.tab] || 0;
    page = Phaser.Math.Clamp(page, 0, totalPages - 1);
    this.page[this.tab] = page;

    // 卡片尺寸 256×168、行距 183（245 → 428）：
    // 行与行之间留出 15px 空隙，不再互相压边。
    // colX 间距 288，比卡片宽 32px，三张并排也不贴。
    // 翻页控件在 535、底部按钮在 594，三段互不重叠
    const slice = list.slice(page * perPage, (page + 1) * perPage);
    const colX = [192, 480, 768];
    const rowY = [245, 428];
    slice.forEach((def, i) => {
      this.contentLayer.add(
        this.buildCard(colX[i % 3], rowY[Math.floor(i / 3)], this.tab, def));
    });

    this.updatePager(page, totalPages);
  }

  buildCard(cx, cy, kind, def) {
    // 卡片尺寸从 268×180 收到 256×168：
    //   宽度收窄给三张并排留出 32px 间隙，视觉上不再贴在一起
    //   高度降到 168 配合下面的新行距（245 / 428），行与行之间留出 15px
    const w = 256, h = 168;
    const owned = this.isOwned(kind, def.key);
    const c = this.add.container(cx, cy);

    const g = this.add.graphics();
    g.fillStyle(0x152130, 1);
    g.fillRoundedRect(-w/2, -h/2, w, h, 14);
    // 已拥有的卡片边框换成暗绿，一眼就能扫出"这些不用再看了"
    g.lineStyle(2, owned ? 0x3d6b4a : 0x33404f, 1);
    g.strokeRoundedRect(-w/2, -h/2, w, h, 14);
    c.add(g);

    // 左侧图标：角色直接摆它的立绘，武器和技能用符号，扫一眼就能分类。
    // 卡片变矮之后图标也跟着往上挪一点，保证竖直居中
    if (kind === 'character') {
      c.add(CharArt.add(this, -90, 0, def, 0.88));
    } else if (kind === 'weapon') {
      c.add(this.add.circle(-90, 0, 22, 0x0b1520, 1).setStrokeStyle(2, 0x33404f, 1));
      c.add(this.add.image(-90, 0, 'bullet-p').setScale(1.7).setTint(def.color));
    } else {
      c.add(this.add.circle(-90, 0, 22, 0x0b1520, 1).setStrokeStyle(2, 0x33404f, 1));
      c.add(this.add.circle(-90, 0, 15, def.color, 1));
      c.add(this.add.text(-90, 0, def.name.charAt(0), {
        fontFamily: UI.FONT, fontSize: '15px', color: '#0b1520', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    c.add(this.add.text(-56, -70, def.name, {
      fontFamily: UI.FONT, fontSize: '18px',
      color: owned ? '#8fa3b8' : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0));

    // 描述：useAdvancedWrap 必须开，否则中文整行没有空格，
    // Phaser 的基础换行会把整段当成一个"词"，直接溢出卡片
    let desc = def.desc;
    if (kind === 'character') {
      // 专属技能可能有不止一个（巫女有两个），卡片这里只列名字：
      // 两段长描述叠上去会把这 180 px 高的卡片撑爆，详细说明留给整备界面的轮盘
      const innates = (def.skills || []).map(k => SKILLS[k]).filter(Boolean);
      desc += '\n' + innates.map(s => '专属 ' + s.name).join(' · ');
    }
    c.add(this.add.text(-56, -42, desc, {
      fontFamily: UI.FONT, fontSize: '11px', color: '#a9bdd0',
      wordWrap: { width: 162, useAdvancedWrap: true }, lineSpacing: 2,
    }).setOrigin(0, 0));

    c.add(this.add.text(-56, 12, this.cardStats(kind, def), {
      fontFamily: UI.FONT, fontSize: '12px', color: '#7fffa0',
    }).setOrigin(0, 0));

    // 右下角动作按钮：未拥有→购买，已拥有→置灰
    let label = '购买 ' + def.cost;
    let enabled = true;
    let fill = 0x8b6a3f, hover = 0xb08a55;
    let action = () => this.buy(kind, def);

    if (owned) {
      label = '已 拥 有';
      enabled = false;
      action = () => {};
    } else {
      enabled = Storage.readCoins() >= def.cost;
    }

    c.add(this.makeCardButton(58, 56, label, enabled, fill, hover, action));
    return c;
  }

  cardStats(kind, def) {
    if (kind === 'character') {
      return '生命 ' + def.lives + ' · 移速 ×' + def.speedMul.toFixed(2);
    }
    if (kind === 'weapon') {
      const pellets = def.pattern === 'spread' ? 3 : 1;
      const dps = (def.damage * pellets / (def.interval / 1000)).toFixed(1);
      return '射速 ' + def.interval + 'ms · 伤害 ' + def.damage + ' · ' + dps + ' DPS';
    }
    return def.cooldown > 0 ? '冷却 ' + (def.cooldown / 1000) + ' 秒' : '常驻生效';
  }

  isOwned(kind, key) { return this.loadout.owned[kind].indexOf(key) >= 0; }

  /* 分页控件：左右箭头 + 页码。
     三个分类共用一套（页面内容变了，控件位置不变），
     位置钉在卡片区域下方、底部按钮上方 —— 卡片行 y 已经同步上调过，
     不是"硬塞进去"的。 */
  buildPager() {
    const W = CONFIG.width, cx = W / 2, cy = 535;

    const makeArrow = (x, dir) => {
      const c = this.add.container(x, cy);
      const g = this.add.graphics();
      // enabled 是"这个方向还能不能翻"，由 updatePager 每帧刷。
      // 用容器上的属性而不是闭包变量：updatePager 需要从外面改它
      c._enabled = true;

      c._draw = (hovered, enabled) => {
        g.clear();
        const a = enabled ? (hovered ? 1 : 0.85) : 0.28;
        g.fillStyle(0x0b1520, 0.9 * a);
        g.fillCircle(0, 0, 22);
        g.lineStyle(2, enabled ? 0xffffff : 0x55697d, a);
        g.strokeCircle(0, 0, 22);
        g.fillStyle(enabled ? 0xffffff : 0x55697d, a);
        if (dir < 0) g.fillTriangle(8, -11, 8, 11, -8, 0);
        else         g.fillTriangle(-8, -11, -8, 11, 8, 0);
      };
      c._draw(false, true);
      c.add(g);

      const hit = this.add.circle(0, 0, 26, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => c._draw(true,  c._enabled));
      hit.on('pointerout',  () => c._draw(false, c._enabled));
      hit.on('pointerdown', () => {
        if (!c._enabled) return;
        SoundSys.unlock(); SoundSys.uiClick();
        this.turnPage(dir);
      });
      c.add(hit);

      return c;
    };

    this.pagerLeft  = makeArrow(cx - 92, -1);
    this.pagerRight = makeArrow(cx + 92,  1);

    this.pagerText = this.add.text(cx, cy, '1 / 1', {
      fontFamily: UI.MONO, fontSize: '17px', color: '#8fa3b8', fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  /* 页码变化时更新控件：箭头压暗 / 亮起，文字换新。
     只在 refresh 末尾调一次，不做"局部刷新"—— 分页状态只在这两个方法里被读，
     多一处写就多一处不同步的风险 */
  updatePager(page, totalPages) {
    if (this.pagerText) {
      this.pagerText.setText((page + 1) + ' / ' + totalPages);
      // 只有一页时把页码压暗，明确告诉玩家"这里没有更多了"。
      // 不然玩家会以为箭头坏了
      this.pagerText.setColor(totalPages > 1 ? '#8fa3b8' : '#3d4a58');
    }
    if (this.pagerLeft) {
      this.pagerLeft._enabled = page > 0;
      this.pagerLeft._draw(false, this.pagerLeft._enabled);
    }
    if (this.pagerRight) {
      this.pagerRight._enabled = page < totalPages - 1;
      this.pagerRight._draw(false, this.pagerRight._enabled);
    }
  }

  /* 翻页。dir = -1 上一页，+1 下一页。越界直接忽略 ——
     调用方（箭头、键盘）已经拦过一遍，这里是双保险 */
  turnPage(dir) {
    const list = this.currentList();
    const perPage = 6;
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));
    const cur = this.page[this.tab] || 0;
    const next = Phaser.Math.Clamp(cur + dir, 0, totalPages - 1);
    if (next === cur) return;
    this.page[this.tab] = next;
    this.refresh();
  }

  /* 当前分类"过滤之后"的列表。refresh 和 turnPage 共用一份过滤规则 ——
     之前过滤逻辑只写在 refresh 里，turnPage 要算总页数就得复制一遍，
     迟早出现"翻到最后一页是空的"（两边过滤结果不一致） */
  currentList() {
    const table = SHOP_CATEGORIES[this.tab].table;
    return Object.values(table).filter(def => {
      if (this.tab === 'skill') return !def.innate;
      if (this.tab === 'weapon') return !def.exclusive;
      return true;
    });
  }

  buy(kind, def) {
    const coins = Storage.readCoins();
    if (coins < def.cost) { this.flashCoins(); return; }

    Storage.writeCoins(coins - def.cost);
    if (this.loadout.owned[kind].indexOf(def.key) < 0) this.loadout.owned[kind].push(def.key);
    Storage.writeLoadout(this.loadout);

    SoundSys.pickup();
    this.showToast('已解锁  ' + def.name);
    this.refresh();
  }

  makeCardButton(cx, cy, label, enabled, fill, hover, onClick) {
    const c = this.add.container(cx, cy);
    const w = 116, h = 36;
    const g = this.add.graphics();

    const draw = (hovered) => {
      g.clear();
      const base = enabled ? (hovered ? hover : fill) : 0x2a3442;
      g.fillStyle(0x000000, 0.3);
      g.fillRoundedRect(-w/2 + 2, -h/2 + 3, w, h, 10);
      g.fillStyle(base, 1);
      g.fillRoundedRect(-w/2, -h/2, w, h, 10);
      g.lineStyle(2, enabled ? 0xffffff : 0x44505f, enabled ? 0.45 : 0.6);
      g.strokeRoundedRect(-w/2, -h/2, w, h, 10);
    };
    draw(false);
    c.add(g);

    c.add(this.add.text(0, 0, label, {
      fontFamily: UI.FONT, fontSize: '15px', fontStyle: 'bold',
      color: enabled ? '#ffffff' : '#8fa3b8',
    }).setOrigin(0.5));

    if (enabled) {
      const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => draw(true));
      hit.on('pointerout',  () => draw(false));
      hit.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); onClick(); });
      c.add(hit);
    }
    return c;
  }

  flashCoins() {
    SoundSys.comboBreak();
    const t = this.add.text(CONFIG.width - 40, 78, '金币不够', {
      fontFamily: UI.FONT, fontSize: '14px', color: '#ff7a7a', fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.tweens.add({
      targets: t, y: 62, alpha: 0, duration: 700, ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  showToast(msg) {
    const t = this.add.text(CONFIG.width / 2, CONFIG.height - 118, msg, {
      fontFamily: UI.FONT, fontSize: '20px', color: '#ffe066', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6000);
    t.setScale(0.7);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t, alpha: 0, y: t.y - 24, delay: 520, duration: 520,
      onComplete: () => t.destroy(),
    });
  }
}

/* ============================================================================
   装备 —— 只负责"换"
   ----------------------------------------------------------------------------
   上面是角色轮盘（左右箭头循环切换已拥有的角色），
   下面四个槽位：武器 / 专属技能 / 技能槽 1 / 技能槽 2。
   点槽位会在它上方弹出一张小卡片列表，点选项就直接换上。
   ============================================================================ */
class LoadoutScene extends Phaser.Scene {
  constructor() { super('Loadout'); }

  /* 角色轮盘要摆立绘。图集在 MenuScene 已经加载过，这里只是兜底 */
  preload() {
    loadSheetAtlas(this);
  }

  create() {
    buildSheetTextures(this);
    Textures.ensure(this);
    SoundSys.setMuted(Storage.readMute());

    this.loadout = Storage.readLoadout();
    this.popup = null;
    this._slideTween = null;
    this.talentPopup = null; // 天赋树弹窗

    const W = CONFIG.width, H = CONFIG.height;

    const bg = this.add.graphics().setDepth(-100);
    bg.fillStyle(0x060b12, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x101c2a, 1); bg.fillCircle(W/2, H/2 - 40, 520);
    bg.fillStyle(0x16263a, 1); bg.fillCircle(W/2, H/2 - 40, 380);

    this.add.text(40, 32, '装 备', {
      fontFamily: UI.FONT, fontSize: '30px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0, 0);

    this.add.text(42, 74, 'L O A D O U T', {
      fontFamily: UI.MONO, fontSize: '12px', color: '#55697d', letterSpacing: 6,
    }).setOrigin(0, 0);

    this.coinText = this.add.text(W - 40, 48, '', {
      fontFamily: UI.MONO, fontSize: '22px', color: '#ffd54a', fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // 灵魂碎片显示
    this.shardText = this.add.text(W - 40, 78, '', {
      fontFamily: UI.MONO, fontSize: '18px', color: '#c98fff', fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    // 天赋树按钮
    this.talentBtn = UI.makeButton(this, W - 90, 115, 140, 40, '天 赋 树', 0x4a3a8b, 0x7a5acb, () => {
      this.showTalentTree();
    }, '16px');

    this.buildCarousel();
    this.buildSlots();

    UI.makeButton(this, W / 2 - 140, H - 44, 220, 54, '返 回 主 菜 单', 0x5d452a, 0x8b6a3f, () => {
      this.scene.start('Menu');
    }, '19px');
    UI.makeButton(this, W / 2 + 140, H - 44, 220, 54, '去 商 城', 0x8b6a3f, 0xb08a55, () => {
      this.scene.start('Shop');
    }, '19px');

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.talentPopup) this.closeTalentTree();
      else if (this.popup) this.closePopup();
      else this.scene.start('Menu');
    });

    this.refresh();

    CheatMenu.attach(this);
  }

  /* ======================= 角色轮盘 ======================= */

  buildCarousel() {
    const W = CONFIG.width;
    this.carouselY = 205;

    this.arrowLeft  = this.makeArrow(W / 2 - 168, this.carouselY, -1);
    this.arrowRight = this.makeArrow(W / 2 + 168, this.carouselY,  1);

    // 轮盘上的立绘比商城卡片大一档，所以额外乘一个系数；
    // 存成成员变量，换角色时重设缩放要用同一个值
    this.carouselMul = 1.4;
    this.charSprite = CharArt.add(this, W / 2, this.carouselY,
      CHARACTERS.gunner, this.carouselMul);

    this.charName = this.add.text(W / 2, this.carouselY + 78, '', {
      fontFamily: UI.FONT, fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.charDesc = this.add.text(W / 2, this.carouselY + 108, '', {
      fontFamily: UI.FONT, fontSize: '13px', color: '#8fa3b8',
    }).setOrigin(0.5);

    // 专属技能可能不止一条（巫女有两条），所以这里要允许换行并居中对齐
    this.charSkill = this.add.text(W / 2, this.carouselY + 126, '', {
      fontFamily: UI.FONT, fontSize: '12px', color: '#7fffa0',
      align: 'center', lineSpacing: 4,
      // ⚠️ useAdvancedWrap 必须开：中文整行没空格，Phaser 默认换行会把
      // 整段当成一个"词"，直接横向溢出屏幕（就是上一版第三张图的问题）
      wordWrap: { width: W - 220, useAdvancedWrap: true },
    }).setOrigin(0.5);
  }

  makeArrow(x, y, dir) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();

    const draw = (hovered) => {
      g.clear();
      g.fillStyle(0x0b1520, hovered ? 0.95 : 0.72);
      g.fillCircle(0, 0, 26);
      g.lineStyle(2, hovered ? 0xffffff : 0x8fa3b8, 0.9);
      g.strokeCircle(0, 0, 26);
      g.fillStyle(0xffffff, 1);
      if (dir < 0) g.fillTriangle(9, -13, 9, 13, -9, 0);
      else         g.fillTriangle(-9, -13, -9, 13, 9, 0);
    };
    draw(false);
    c.add(g);

    const hit = this.add.circle(0, 0, 30, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', () => {
      SoundSys.unlock(); SoundSys.uiClick();
      this.changeChar(dir);
    });
    c.add(hit);
    return c;
  }

  /* 只在"已拥有的角色"之间循环。没买到的角色不能装，
     放进轮盘只会让玩家以为能直接用，点下去才发现是锁的 */
  changeChar(dir) {
    const owned = this.loadout.owned.character;
    if (owned.length < 2) return;

    let i = owned.indexOf(this.loadout.character);
    if (i < 0) i = 0;
    const ni = (i + dir + owned.length) % owned.length;
    const nextKey = owned[ni];
    if (nextKey === this.loadout.character) return;

    this.loadout.character = nextKey;
    Storage.writeLoadout(this.loadout);

    const W = CONFIG.width;
    const old = this.charSprite;
    const incoming = CharArt.add(this, W / 2 + dir * 170, this.carouselY,
      CHARACTERS[nextKey], this.carouselMul);
    incoming.setAlpha(0);

    this.tweens.killTweensOf(old);
    this.tweens.add({
      targets: old, x: W / 2 - dir * 170, alpha: 0, duration: 200, ease: 'Quad.easeIn',
      onComplete: () => old.destroy(),
    });
    this.tweens.add({
      targets: incoming, x: W / 2, alpha: 1, duration: 240, ease: 'Quad.easeOut',
    });
    this.charSprite = incoming;

    SoundSys.uiClick();
    this.closePopup();
    this.refresh();
  }

  /* ======================= 四个槽位 ======================= */

  buildSlots() {
    const W = CONFIG.width;
    const bw = 182, bh = 142, gap = 20;
    const total = 4 * bw + 3 * gap;
    const startX = (W - total) / 2;
    this.slotY = 442;

    this.slotDefs = [
      { kind: 'weapon', label: '武 器' },
      { kind: 'innate', label: '专属技能' },
      { kind: 'skill',  label: '技能槽 1', idx: 0 },
      { kind: 'skill',  label: '技能槽 2', idx: 1 },
    ];

    this.slotViews = this.slotDefs.map((def, i) => {
      const cx = startX + bw / 2 + i * (bw + gap);
      return this.buildSlot(cx, this.slotY, bw, bh, def, i);
    });
  }

  buildSlot(cx, cy, w, h, def, index) {
    const container = this.add.container(cx, cy);
    const g = this.add.graphics();
    container.add(g);

    const labelText = this.add.text(0, -h / 2 + 18, def.label, {
      fontFamily: UI.FONT, fontSize: '13px', color: '#8fa3b8', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(labelText);

    const iconC = this.add.container(0, -8);
    container.add(iconC);

    const nameText = this.add.text(0, h / 2 - 24, '', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(nameText);

    const view = {
      container, g, iconC, nameText, index, def, _hover: false,
    };

    const draw = () => {
      g.clear();
      const hovered = view._hover;
      g.fillStyle(hovered ? 0x1a2a3c : 0x152130, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
      g.lineStyle(2.5, hovered ? 0x4ac2ff : 0x33404f, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    };
    view.draw = draw;
    draw();

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { view._hover = true; draw(); });
    hit.on('pointerout',  () => { view._hover = false; draw(); });
    hit.on('pointerdown', () => {
      SoundSys.unlock(); SoundSys.uiClick();
      this.onSlotClick(index);
    });
    container.add(hit);

    // 图标区更新：清空重建，比维护一堆对象引用的显隐简单，也只有 4 个槽位
    view.update = (item) => {
      iconC.removeAll(true);
      if (item.icon === 'weapon') {
        iconC.add(this.add.circle(0, 0, 30, 0x0b1520, 1).setStrokeStyle(2, 0x33404f, 1));
        iconC.add(this.add.image(0, 0, 'bullet-p').setScale(2.2).setTint(item.color));
      } else if (item.def) {
        iconC.add(this.add.circle(0, 0, 30, item.color, 1));
        iconC.add(this.add.text(0, 0, item.def.name.charAt(0), {
          fontFamily: UI.FONT, fontSize: '24px', color: '#0b1520', fontStyle: 'bold',
        }).setOrigin(0.5));
      } else {
        iconC.add(this.add.circle(0, 0, 30, 0x0b1520, 1).setStrokeStyle(2, 0x33404f, 1));
        iconC.add(this.add.text(0, 0, '空', {
          fontFamily: UI.FONT, fontSize: '18px', color: '#55697d',
        }).setOrigin(0.5));
      }
      nameText.setText(item.name);
      nameText.setColor(item.def ? '#ffffff' : '#55697d');
    };

    return view;
  }

  /* ======================= 弹窗 ======================= */

  onSlotClick(index) {
    const def = this.slotDefs[index];

    if (def.kind === 'innate') {
      this.showToast('专属技能跟随角色，无法更换');
      return;
    }
    // 锁武器的角色（巫女）点武器槽直接说明原因，
    // 别让玩家翻完整个武器列表才发现一把都换不了
    if (def.kind === 'weapon' && this.lockInfo) {
      this.showToast('当前角色锁定「' + this.lockInfo.name + '」，无法更换武器');
      return;
    }
    // 再点同一个槽位就收起，等于一个开关
    if (this.popup && this.popup.slotIndex === index) {
      this.closePopup();
      return;
    }
    this.openPopup(index);
  }

  openPopup(slotIndex) {
    this.closePopup();

    const def = this.slotDefs[slotIndex];
    const slotView = this.slotViews[slotIndex];
    const W = CONFIG.width;

    // 组装这个槽位能选的东西
    let options = [];
    if (def.kind === 'weapon') {
      options = this.loadout.owned.weapon.map(k => ({
        key: k, kind: 'weapon', def: WEAPONS[k],
        equipped: this.loadout.weapon === k,
      }));
    } else {
      options = this.loadout.owned.skill
        .filter(k => SKILLS[k] && !SKILLS[k].innate)
        .map(k => ({
          key: k, kind: 'skill', def: SKILLS[k],
          equipped: this.loadout.skills[def.idx] === k,
        }));
      // 末尾永远给一个"卸下"，否则装上了就再也换不下来了
      options.push({
        key: null, kind: 'skill', def: null,
        equipped: !this.loadout.skills[def.idx],
      });
    }

    const popW = 500;
    const headH = 42;
    const rowH = 54;
    const popH = headH + options.length * rowH + 12;

    let popX = slotView.container.x - popW / 2;
    popX = Phaser.Math.Clamp(popX, 16, W - popW - 16);
    // 优先贴在槽位上方；放不下（选项太多）就顶到画布顶端，宁可盖住角色也不能跑出屏幕
    let popY = slotView.container.y - 71 - popH - 14;
    popY = Math.max(14, popY);

    const layer = this.add.container(0, 0).setDepth(5000);

    const g = this.add.graphics();
    g.fillStyle(0x0b1520, 0.98);
    g.fillRoundedRect(popX, popY, popW, popH, 16);
    g.lineStyle(2.5, 0x4a90d9, 0.9);
    g.strokeRoundedRect(popX, popY, popW, popH, 16);
    layer.add(g);

    const title = this.add.text(popX + 20, popY + 22, '更换 · ' + def.label, {
      fontFamily: UI.FONT, fontSize: '16px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    layer.add(title);

    const closeBtn = this.add.text(popX + popW - 24, popY + 22, '✕', {
      fontFamily: UI.FONT, fontSize: '18px', color: '#8fa3b8', fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#8fa3b8'));
    closeBtn.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); this.closePopup(); });
    layer.add(closeBtn);

    options.forEach((opt, i) => {
      const rowY = popY + headH + i * rowH;
      layer.add(this.buildPopupRow(popX + 10, rowY, popW - 20, rowH - 6, opt, slotIndex));
    });

    this.popup = { slotIndex, layer, x: popX, y: popY, w: popW, h: popH };
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 120 });
  }

  buildPopupRow(x, y, w, h, opt, slotIndex) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    c.add(g);

    const isNone = !opt.key;
    const equipped = opt.equipped;

    const draw = (hovered) => {
      g.clear();
      g.fillStyle(equipped ? 0x1c3a28 : (hovered ? 0x1d304a : 0x152130), 1);
      g.fillRoundedRect(0, 0, w, h, 10);
      g.lineStyle(equipped ? 2 : 1.5, equipped ? 0x7fffa0 : 0x33404f, 1);
      g.strokeRoundedRect(0, 0, w, h, 10);
    };
    draw(false);

    const iconX = 34, iconY = h / 2;

    if (isNone) {
      c.add(this.add.circle(iconX, iconY, 16, 0x2a3442, 1).setStrokeStyle(1.5, 0x44505f, 1));
      c.add(this.add.text(iconX, iconY, '空', {
        fontFamily: UI.FONT, fontSize: '12px', color: '#8fa3b8',
      }).setOrigin(0.5));
    } else if (opt.kind === 'weapon') {
      c.add(this.add.circle(iconX, iconY, 17, 0x0b1520, 1).setStrokeStyle(2, 0x33404f, 1));
      c.add(this.add.image(iconX, iconY, 'bullet-p').setScale(1.5).setTint(opt.def.color));
    } else {
      c.add(this.add.circle(iconX, iconY, 17, opt.def.color, 1));
      c.add(this.add.text(iconX, iconY, opt.def.name.charAt(0), {
        fontFamily: UI.FONT, fontSize: '15px', color: '#0b1520', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    c.add(this.add.text(62, iconY - 11, isNone ? '卸下当前技能' : opt.def.name, {
      fontFamily: UI.FONT, fontSize: '15px',
      color: equipped ? '#7fffa0' : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const desc = isNone ? '空出这个技能槽' : opt.def.desc;
    c.add(this.add.text(62, iconY + 11, desc, {
      fontFamily: UI.FONT, fontSize: '11px', color: '#8fa3b8',
      wordWrap: { width: w - 190, useAdvancedWrap: true },
    }).setOrigin(0, 0.5));

    c.add(this.add.text(w - 14, iconY, equipped ? '使用中' : '点击更换', {
      fontFamily: UI.FONT, fontSize: '12px',
      color: equipped ? '#7fffa0' : '#55697d', fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    const hit = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', () => {
      SoundSys.unlock(); SoundSys.uiClick();
      this.applySlotChoice(slotIndex, opt);
    });
    c.add(hit);

    return c;
  }

  applySlotChoice(slotIndex, opt) {
    const def = this.slotDefs[slotIndex];

    if (def.kind === 'weapon') {
      this.loadout.weapon = opt.key;
    } else {
      // 同一个技能不能同时占两个槽：先把它从另一个槽里摘掉
      if (opt.key) {
        const other = def.idx === 0 ? 1 : 0;
        if (this.loadout.skills[other] === opt.key) this.loadout.skills[other] = null;
      }
      this.loadout.skills[def.idx] = opt.key;
    }

    Storage.writeLoadout(this.loadout);
    SoundSys.pickup();
    this.closePopup();
    this.refresh();
    this.showToast(opt.key ? '已装备  ' + opt.def.name : '已卸下');
  }

  closePopup() {
    if (!this.popup) return;
    const layer = this.popup.layer;
    this.popup = null;
    this.tweens.killTweensOf(layer);
    layer.destroy();
  }

  /* ======================= 天赋树 ======================= */

  showTalentTree() {
    if (this.talentPopup) this.closeTalentTree();

    const ch = CHARACTERS[this.loadout.character] || CHARACTERS.gunner;
    const treeData = TALENTS[ch.key];
    if (!treeData) {
      this.showToast('该角色暂未开放天赋树');
      return;
    }

    const W = CONFIG.width, H = CONFIG.height;
    const px = (W - 820) / 2, py = (H - 520) / 2;

    this.talentPopup = this.add.container(0, 0).setDepth(20000);
    const mask = this.add.rectangle(0, 0, W, H, 0x060b12, 0.92).setOrigin(0, 0).setInteractive();
    this.talentPopup.add(mask);

    const panel = this.add.graphics();
    panel.fillStyle(0x152130, 1).fillRoundedRect(px, py, 820, 520, 20);
    panel.lineStyle(3, 0x8b6a3f, 0.9).strokeRoundedRect(px, py, 820, 520, 20);
    this.talentPopup.add(panel);

    this.talentPopup.add(this.add.text(W/2, py + 30, ch.name + ' · 天 赋 树', {
      fontFamily: UI.FONT, fontSize: '24px', color: '#ffe066', fontStyle: 'bold'
    }).setOrigin(0.5));

    // 当前碎片
    const currentShard = Storage.readSoulShard();
    this.talentPopup.add(this.add.text(W/2, py + 60, '灵魂碎片: ' + currentShard, {
      fontFamily: UI.MONO, fontSize: '16px', color: '#c98fff'
    }).setOrigin(0.5));

    const colW = 240, colGap = 20;
    const startX = px + (820 - (3 * colW + 2 * colGap)) / 2 + colW / 2;

    const branches = [
      { key: 'atk', label: '进 攻 线', color: 0xff6a2a },
      { key: 'def', label: '防 御 线', color: 0x4ac2ff },
      { key: 'util', label: '机 制 线', color: 0x7fffa0 }
    ];

    const talents = Storage.readTalents();
    const chTalents = talents[ch.key] || {};

    branches.forEach((branch, bIdx) => {
      const cx = startX + bIdx * (colW + colGap);
      const cy = py + 110;

      this.talentPopup.add(this.add.text(cx, cy, branch.label, {
        fontFamily: UI.FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5));

      treeData[branch.key].forEach((node, nIdx) => {
        const ny = cy + 60 + nIdx * 108;
        const isUnlocked = chTalents[node.key] > 0;
        const canBuy = currentShard >= node.cost && !isUnlocked;

        const btn = this.add.container(cx, ny);
        const g = this.add.graphics();

        const draw = (hovered) => {
          g.clear();
          const fill = isUnlocked ? 0x2a4a3a : (canBuy ? (hovered ? 0x3a2a5a : 0x2a1f4a) : 0x1a1a2a);
          const border = isUnlocked ? 0x7fffa0 : (canBuy ? (hovered ? 0xc98fff : 0x8b6a3f) : 0x33404f);
          g.fillStyle(fill, 1).fillRoundedRect(-colW / 2, -48, colW, 96, 12);
          g.lineStyle(2, border, 1).strokeRoundedRect(-colW / 2, -48, colW, 96, 12);
        };
        draw(false);
        btn.add(g);

        btn.add(this.add.text(0, -20, node.name + (isUnlocked ? ' ✓' : ''), {
          fontFamily: UI.FONT, fontSize: '15px', color: isUnlocked ? '#7fffa0' : '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));

        btn.add(this.add.text(0, 4, node.desc, {
          fontFamily: UI.FONT, fontSize: '11px', color: '#a9bdd0',
          align: 'center',
          wordWrap: { width: colW - 16, useAdvancedWrap: true },
          lineSpacing: 2,
        }).setOrigin(0.5, 0.5));

        btn.add(this.add.text(0, 34, isUnlocked ? '已激活' : ('消耗 ' + node.cost + ' 碎片'), {
          fontFamily: UI.MONO, fontSize: '12px', color: isUnlocked ? '#55697d' : (canBuy ? '#ffd54a' : '#55697d')
        }).setOrigin(0.5));

        const hit = this.add.rectangle(0, 0, colW, 80, 0x000000, 0).setInteractive({ useHandCursor: canBuy });
        hit.on('pointerover', () => { if (canBuy) draw(true); });
        hit.on('pointerout', () => draw(false));
        hit.on('pointerdown', () => {
          if (!canBuy) return;
          SoundSys.unlock(); SoundSys.uiClick();
          // 扣碎片、存数据
          Storage.addSoulShard(-node.cost);
          if (!talents[ch.key]) talents[ch.key] = {};
          talents[ch.key][node.key] = 1;
          Storage.writeTalents(talents);
          this.showToast('已激活 ' + node.name);
          this.closeTalentTree();
          this.showTalentTree(); // 刷新界面
          this.refresh();
        });
        btn.add(hit);

        this.talentPopup.add(btn);
      });
    });

    // 关闭按钮
    const closeBtn = this.add.text(px + 800, py + 20, '✕', {
      fontFamily: UI.FONT, fontSize: '24px', color: '#8fa3b8', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); this.closeTalentTree(); });
    this.talentPopup.add(closeBtn);
  }

  closeTalentTree() {
    if (this.talentPopup) {
      this.talentPopup.destroy();
      this.talentPopup = null;
    }
  }

  /* ======================= 重绘 ======================= */

  refresh() {
    this.coinText.setText('金币  ' + Storage.readCoins());
    this.shardText.setText('碎片  ' + Storage.readSoulShard());

    const ch = CHARACTERS[this.loadout.character] || CHARACTERS.gunner;
    const innates = (ch.skills || []).map(k => SKILLS[k]).filter(Boolean);

    // 图集角色换的是"图集名 + 帧号"，程序化角色换的是纹理名，两边判断条件不同
    const art = CharArt.resolve(this, ch);
    if (this.charSprite.texture.key !== art.key) {
      this.charSprite.setTexture(art.key, art.frame);
    }
    this.charSprite.setScale(CharArt.fit(this, ch, this.carouselMul));

    this.charName.setText(ch.name);
    this.charDesc.setText(ch.desc);
    // 专属技能可能有两个，一行拼起来会顶到画面边缘，分行写
    this.charSkill.setText(innates.map(s => '专属 ' + s.name + ' · ' + s.desc).join('\n'));

    // 只有一个角色时箭头没意义，压暗提示"没得换"
    const canCycle = this.loadout.owned.character.length > 1;
    this.arrowLeft.setAlpha(canCycle ? 1 : 0.3);
    this.arrowRight.setAlpha(canCycle ? 1 : 0.3);

    // 角色锁武器时（巫女），武器槽要显示真正生效的那把并标注"锁定"：
    // 否则玩家看着自己装的手枪、进去打出来却是火弹，只会以为是 bug
    this.lockInfo = ch.weaponLock ? (WEAPONS[ch.weaponLock] || null) : null;
    const wp = this.lockInfo || WEAPONS[this.loadout.weapon] || WEAPONS.pistol;

    const s0 = this.loadout.skills[0] ? SKILLS[this.loadout.skills[0]] : null;
    const s1 = this.loadout.skills[1] ? SKILLS[this.loadout.skills[1]] : null;
    // 专属技能槽只有一个格子，有两个专属时把名字并排塞进去
    const innateName = innates.map(s => s.name).join(' / ') || '无';

    const items = [
      { icon: 'weapon', def: wp, name: wp.name + (this.lockInfo ? ' ·锁定' : ''), color: wp.color },
      { icon: 'skill',  def: innates[0] || null, name: innateName,
        color: innates[0] ? innates[0].color : 0x33404f },
      { icon: 'skill',  def: s0,     name: s0 ? s0.name : '空', color: s0 ? s0.color : 0x33404f },
      { icon: 'skill',  def: s1,     name: s1 ? s1.name : '空', color: s1 ? s1.color : 0x33404f },
    ];

    this.slotViews.forEach((v, i) => v.update(items[i]));
  }

  showToast(msg) {
    const t = this.add.text(CONFIG.width / 2, CONFIG.height - 92, msg, {
      fontFamily: UI.FONT, fontSize: '18px', color: '#ffe066', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6000);
    t.setScale(0.7);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t, alpha: 0, y: t.y - 22, delay: 520, duration: 520,
      onComplete: () => t.destroy(),
    });
  }
}