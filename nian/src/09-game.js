/* ============================================================================
   游戏场景
   ============================================================================ */
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  /* 图集在 MenuScene 就全部加载完了，这里通常什么都不用做。
     保留这个 preload 是为了"直接以 Game 场景启动"（调试 / 自动化测试）时不至于裸奔 */
  preload() {
    loadSheetAtlas(this);
  }

  create(data) {
    buildSheetTextures(this);
    Textures.ensure(this);

    // 模式开关：主菜单点"肉鸽模式"时传 { mode:'rogue' }，其余都是原来的无限模式。
    // 两个模式共用同一个 GameScene —— 刷怪 / 难度 / 技能那一整套完全一样，
    // 只有"阶段推进 + 增幅三选一 + BOSS"是肉鸽独有的，用这个开关隔开
    this.rogueMode = !!(data && data.mode === 'rogue');

    /* 双人开关。主菜单的「双 人 模 式」会先走 TwoPlayer 整备场景，
       把两人的角色 / 武器 / 技能打包成 { twoPlayer:true, p1:{...}, p2:{...} } 传进来。
       ⚠️ 单人局 players 长度恒为 1，所有"按玩家循环"的地方都以这个长度为准，
       不要写死 2 —— 写死的话单人局会平白多出一个看不见的玩家 */
    this.twoPlayer = !!(data && data.twoPlayer);
    this.playerCfgs = this.twoPlayer ? [data.p1 || {}, data.p2 || {}] : [null];

    this.state = 'playing';
    this.score = 0;
    this.best = Storage.readBest();
    SoundSys.setMuted(Storage.readMute());

    /* ---- 玩家上下文 ----
       每个玩家一份**独立**的：角色 / 武器 / 技能表 / Buff / 无敌 / 朝向 /
       开火计时 / 施法锁 / 冲锋 / 冲击波 / 肉鸽增幅。

       生命（lives / maxLives）刻意**不**放进来 —— 需求是"生命共享，
       把两个角色的生命加起来"，共享生命清零才结束。

       ⚠️ 下面这些 this.xxx 全是"转发到当前玩家"的访问器（见下面的
       playerCtx 代理区）。写 this.player / this.buffs 时它们会自动落到
       this.P 上，所以原有那几百处代码一行都不用动。
       this.pIndex 就是"现在在处理哪个玩家"，由 update 的玩家循环、
       以及各种碰撞回调（usePlayer）切换 */
    this.pIndex = 0;
    this.players = this.playerCfgs.map((cfg, i) => this.makePlayerCtx(i, cfg));

    // 共享生命 = 两人生命上限之和（各自的天赋加成已经算在 P.maxLives 里）。
    // 单人局就是 1 个玩家，和以前完全一致
    this.maxLives = this.players.reduce((n, P) => n + P.maxLives, 0);
    this.lives = this.maxLives;
    this.heartbeatTimer = 0;

    this.coins = Storage.readCoins();
    this.coinsEarned = 0;
    this._lastCoinSave = 0;

    // 勇者·裂地斩的冲击波绘制层。列表本身在各自的 P.shockwaves 上，
    // 所有玩家的圈都画在这一张 Graphics 上（见 updateShockwaves）
    this.shockwaveFX = this.add.graphics().setDepth(7100);

    // ⚠️ 主动技能按钮的引用必须显式清空。
    // Phaser 的 Scene 实例在整个游戏期间是复用的，restart / 切换场景
    // 只是重新跑 create()，实例属性不会自动清空。
    // 如果上一局用的是死灵法师（两个主动技能），activeBtns 里已经装了两个对象；
    // 这局换成枪手（没有主动技能），buildActiveSkillButton 提前 return，
    // 数组就残留成上一局的，而 activeSkills 是空的，
    // updateActiveSkillFX 里读 s.key 直接抛异常，游戏进不去
    // （双人局的按钮列表在各自的 P.activeBtns 上，见 makePlayerCtx）
    this.activeBtns = [];

    this.elapsed = 0;
    this.spawnAccum = 0;
    this.fireAccum = 0;
    this.gameOverAt = 0;
    this._lastLevelText = '';

    this.difficultyLevel = 0;
    this.nextLevelAt = CONFIG.diffIntervalBase;

    this.comboCount = 0;
    this.comboTimer = 0;

    /* 道具 buff（rapid / triple / shield）的状态在各自的 P.buffs 上，
       见 makePlayerCtx —— 需求是"谁吃到算谁的"，两个人各吃各的。
       这里只留屏幕上的摇杆状态。 */

    // 虚拟摇杆（只驱动 P1）。双人模式本来就限定电脑端，触屏摇杆用不上，
    // 但单人局手机玩家还得靠它，所以保留
    this.touchAnchor = null;   // 摇杆锚点：按下那一刻定住，不再跟着手指跑
    this.touchKnob = null;     // 摇杆头当前位置（纯视觉）
    this.touchIsTouch = false; // 只有触摸才画摇杆，鼠标拖不画
    this._joyDrawn = false;
    this.isSpawning = false;
    this._noInfantryStreak = 0;
    this._spawnWatchdog = 0;
    this._slowMoTimer = null;
    // 用 performance.now() 记时间：time.now 会被慢动作 / 暂停改掉，不能用来做冷却
    this._shakeUntil = 0;
    this._grazeReady = 0;
    this.resetTimeScale();   // 场景重启时保证时间缩放归位

    // 图集没加载成功（离线 / 丢文件）时，对应兵种退回矢量贴图而不是报错。
    // 帧数阈值必须按图集自己的规格算，写死 32 会让 24 帧的新图集被判成"没加载成功"
    this.sheetReady = {};
    for (const key of SHEET_KEYS) {
      this.sheetReady[key] = this.hasSheet(key, SHEET_FRAMES_PER_DIR[key] * 4);
    }

    // ---- 天气系统 ----
    // 分五层，深度从下到上。**静态和动态必须分开** ——
    // 旧实现是每帧 clear 一遍同一个 Graphics 再重画所有洼地，而洼地一动不动，
    // 纯属白烧：手机上单这一项就要两三毫秒。现在只有涟漪 / 闪电 / 雨雪是每帧动的
    this.weather = {
      current: 'sunny',
      timer: CONFIG.weatherDuration,
      puddles: [],
      thunderBolts: [],
      thunderTimer: 0,
      t: 0,          // 天气特效自己的时间（累加 dms）。不用 this.time.now ——
                     // 那个会被慢动作 / 暂停改掉，涟漪会跟着卡住
      fade: 1,       // 切天气后的淡入进度 0→1
      flash: 0,      // 全屏雷光强度 0→1
      wind: 0,       // 本次天气的风力（影响雨丝倾斜 / 雪花横漂）
    };
    this._ditchCooldown = 0;

    Textures.ensureWeather(this);
    // 静态地形：洼地 / 水沟 / 雪地覆盖 / 雷天压暗。只在切天气时重画
    this.weatherGroundFX = this.add.graphics().setDepth(-900);
    // 水面涟漪。只有下雨天才画，一圈两三个椭圆
    this.weatherWaterFX = this.add.graphics().setDepth(-899);
    // 雨 / 雪：TileSprite 滚动，每帧只改 tilePosition
    this.weatherRain = this.add.tileSprite(0, 0, CONFIG.width, CONFIG.height, 'weather-rain')
      .setOrigin(0, 0).setDepth(-881).setVisible(false);
    this.weatherSnow = this.add.tileSprite(0, 0, CONFIG.width, CONFIG.height, 'weather-snow')
      .setOrigin(0, 0).setDepth(-880).setVisible(false);
    // 闪电本体画在角色**之上**（它是从天上下来的），落点标记则留在静态层
    this.weatherSkyFX = this.add.graphics().setDepth(8860);
    this.weatherFlashRect = this.add.rectangle(0, 0, CONFIG.width, CONFIG.height, 0xcfe6ff, 1)
      .setOrigin(0, 0).setDepth(8865).setAlpha(0);

    this.changeWeather('sunny'); // 开局天气

    /* ---- 肉鸽状态（**共享**的那部分）----
       两个人推进同一张图、同一套阶段和积分。增幅（mods）不在这里 ——
       它跟着玩家走，见 makePlayerCtx 里的 P.mods，
       这样"谁选到的卡只对谁生效"，符合"不共享增幅，各自计算"。 */
    this.rogue = {
      map: 0,
      phase: 'wave',                       // wave → bossIntro → boss → （下一张图）wave
      waveLeft: ROGUE.waveMs[0],
      nextBuffAt: this.buffStepBase(),     // 第 1 张卡的阈值（双人模式下更贵）
      curStep: this.buffStepBase(),        // 当前这一段的宽度（HUD 进度条要用）
      buffsTaken: 0,                       // 已经跨过几条积分线，决定下一段阈值有多宽
      pendingBuffs: 0,                     // 攒着还没弹的三选一次数
      picks: [],
      killCount: 0,
    };
    // 双人模式下"两个人都要各选一张"，待选队列见 enqueueBuffChoices
    this.buffQueue = [];
    this.boss = null;
    // 本场 BOSS 是哪一只：'skull'（骷髅王）/ 'goblin'（哥布林飞骑）/ 'lich'（巫妖王）。
    // 三只 BOSS 共用 bossState / bossT / bossTune / 血条 / 死亡结算这套外壳，
    // 只有"出场方式 + 固定攻击流程 + 动画表 + 体型"按它分流
    this.bossKind = 'skull';
    this.bossState = 'none';
    this.bossT = 0;
    this.bossCue = null;
    this.bossHp = 0;
    this.bossHpMax = 0;
    this.bossFacing = 'down';
    this.bossShocks = [];
    this.bossSlashDir = 0;
    this.bossSlashFired = 0;
    this.bossSlashRewound = false;   // 第二轮四刀是否已经提前重播过起手动画
    this.bossSpinFired = 0;
    this.bossAnimKey = '';
    this.bossNext = 'spin';
    this.bossPauseMs = BOSS.idleMs;
    // 本场 BOSS 的缠斗时长，喂给狂暴系数（每张图重新计时）
    this.bossFightMs = 0;
    // 当前该用哪一档 BOSS 节奏，由 refreshBossTune() 每帧刷新
    this.bossTune = null;
    this.bossJumpFrom = null;
    this.bossJumpTo = null;
    // ---- 哥布林飞骑专用 ----
    this.goblinDashLeft = 0;     // 本段还剩几次猛冲
    this.goblinWaveLeft = 0;     // 本段还剩几发月牙
    this.goblinDashDir = 'down'; // 本次猛冲锁定的方向（四方向之一）
    this.goblinDashTo = null;    // 本次猛冲的终点（棋盘边缘上的停靠点）
    this.goblinWaveFired = false;// 这一发月牙是否已经甩出去
    this.bossFlyFrom = null;     // 飞上棋盘的起点（屏幕外）
    this.bossFlyMs = 0;          // 本场进场的时长（按距离算出来的）
    this.bossAnimAct = '';       // 当前状态该播的动作名（受伤闪完还原用）
    this.bossFlinchMs = 0;       // 受伤动作的剩余时长
    this._goblinFlinchAt = 0;    // 上次受伤动作的时间戳（节流）
    this._dashFxMs = 0;          // 猛冲掠影的粒子节流

    // ---- 巫妖王专用 ----
    this.lichGroundY = 0;        // 地面线的屏幕 y（= 落点格子的中心）。漂浮是相对它算的
    this.lichFloat = 0;          // 当前离地高度（屏幕像素），0 = 站在地面线上
    this.lichBobMs = 0;          // 漂浮起伏的相位累加器。用累加而不是 bossT ——
                                 // bossT 每次换状态都归零，起伏会一顿一顿的
    this.lichStep = 0;           // 固定攻击顺序走到第几段：0 大月牙 / 1 三段劈 / 2 召唤
    this.lichSmashFired = false; // 出场砸地的冲击波是否已放
    this.lichWaveFired = 0;      // A 段已经甩出几道大月牙
    this.lichSlashFired = 0;     // B 段已经劈出几道竖月牙
    this.lichSlashRewound = false; // B 段第二轮是否已提前重播起手动画
    this.lichLandShocked = false;  // B 段收尾落地的冲击波是否已放
    this.lichSummoned = false;   // C 段的小巫妖是否已召唤
    this.lichBoltFired = 0;      // C 段已经放了几道落雷
    this.lichBolts = [];         // 落雷：预警中 / 刚劈下的那些
    this._lichFlinchAt = 0;      // 上次受伤动作的时间戳（节流）
    this._bossFlashAt = 0;
    this._boomDepth = 0;
    // 三选一当前待选的卡。场景实例会复用，这里不清的话，
    // 上一局没选完的卡会被下一局的数字键重新选中
    this._buffChoice = null;
    // BOSS 结算被暂停/选卡推迟时挂在这里，回到 playing 由 updateRogue 补跑
    this._bossDefeatPending = false;

    // 注册动画放在 buildBackground 之前：buildBackground 里要立刻拿到 board-xxx
    // 动画 key 去 play()，setupAnimations 之后调会让 sprite 创建出来但动画还没
    // 注册，frame 停在第 0 帧不动，看起来像闪图。其它走图集的子模块（角色/敌人/BOSS）
    // 也是同样原因，统一前置
    this.setupAnimations();

    this.buildBackground();
    this.buildAmbientFX();
    this.buildPools();
    // 每个玩家各建一份精灵 / 阴影 / 叠加层。单人局就是循环一次，和以前一致
    for (let i = 0; i < this.players.length; i++) this.buildPlayerAt(i);
    /* 循环结束时 pIndex 停在最后一个玩家上，这里显式收回 0。
       不变式：**只要不在 update 的玩家循环 / 碰撞回调里，代理就指向 P1** ——
       下面那一串 buildXxx 会读 this.charDef / this.activeSkills 这类代理字段，
       不收回去的话双人局会拿 P2 的角色表去建 HUD */
    this.pIndex = 0;
    this.buildParticles();
    this.buildFX();
    this.buildHUD();
    this.buildPauseButton();
    this.buildShieldFX();
    this.buildJoystickFX();
    this.buildPowerupRing();
    this.buildBossLayer();

    // 肉鸽模式要在屏幕上方腾出 BOSS 血条的位置（y 46~76），
    // 连击条原本贴在 y=84，会跟血条边框压在一起，整体往下挪一档
    if (this.rogueMode) this.comboContainer.setY(112);

    this.overlay = this.add.container(0, 0).setDepth(9500);

    this.setupInput();
    this.setupCollisions();
    this.setupLifecycle();

    /* GameScene 会被主菜单重复进入，Phaser 默认走 sleep + wake 而不是销毁重建。
       唤醒时重新读 loadout —— loadout.boardSkin 可能在菜单里被切换过，
       不重读的话切换无效，玩家改完了进游戏却看不到变化。
       ⚠️ 只刷新 loadout 引用，不动 charDef / 技能表 —— 那些是在 create 里
       一次性建好的，wake 中途换角色会让贴图和技能表对不上 */
    this.events.on('wake', () => {
      const load = Storage.readLoadout();
      for (const P of this.players) P.loadout = load;
      this.applyBoardSkin();
    });

    SoundSys.start();

    // 全局作弊菜单（按 I 键）
    CheatMenu.attach(this);
  }

  /* ==========================================================================
     玩家上下文
     --------------------------------------------------------------------------
     单人局只有 1 个，双人局 2 个（P1 / P2）。这里只建**数据**，
     精灵由 buildPlayerAt(i) 按顺序创建 —— 拆成两步是因为 create 里要先
     拿到各人的 maxLives 才能算共享生命，而共享生命必须在建精灵之前定下来
     （HUD 的生命图标数量按它建）。
     ========================================================================== */
  makePlayerCtx(i, cfg) {
    const load = Storage.readLoadout();

    // 角色：双人整备界面传进来的优先，缺字段就退回存档里的整备
    const charKey = (cfg && CHARACTERS[cfg.character]) ? cfg.character : load.character;
    const charDef = CHARACTERS[charKey] || CHARACTERS.gunner;

    // 角色锁武器时（巫女 / 勇者 / 矮人 / 亡灵法师）直接无视选的武器 ——
    // 这是角色机制，不是漏判
    const weaponKey = (cfg && WEAPONS[cfg.weapon]) ? cfg.weapon : load.weapon;
    const weaponDef = charDef.weaponLock
      ? (WEAPONS[charDef.weaponLock] || WEAPONS.pistol)
      : (WEAPONS[weaponKey] || WEAPONS.pistol);

    // 专属技能是数组：多数角色 1 个，巫女 2 个。槽位里是买来的技能，
    // 专属技能不占槽，两者拼成真正生效的技能列表
    const innateSkills = (charDef.skills || []).map(k => SKILLS[k]).filter(Boolean);
    const slotKeys = (cfg && Array.isArray(cfg.skills)) ? cfg.skills : load.skills;
    const equippedSkills = (slotKeys || [])
      .filter(k => k && SKILLS[k] && !SKILLS[k].innate)
      .map(k => SKILLS[k]);
    const allSkills = innateSkills.concat(equippedSkills);

    // 天赋按角色读：双人局两人可能是不同角色，各自的树要分开算
    const talents = Storage.readTalents()[charDef.key] || {};

    // 天赋：生命上限 +1（勇者【健壮】、亡灵法师【生机】）
    const maxLives = charDef.lives
      + (talents.toughness ? 1 : 0)
      + (talents.lifeforce ? 1 : 0);

    const P = {
      index: i,
      loadout: load,
      charDef, weaponDef,
      innateSkills, equippedSkills, allSkills,
      // 主动技能不参与自动冷却，走按钮 + 次数 / 动态冷却。
      // 左下角技能栏只画被动技能，否则同一个技能会在屏幕上出现两遍。
      // ⚠️ 用数组而不是单个值：死灵法师有两个主动技能（召唤 / 转化），
      // 写成 find() 只取第一个的话第二个技能在界面上永远点不到
      activeSkills: allSkills.filter(s => s.active),
      hudSkills: allSkills.filter(s => !s.active),
      talents,
      maxLives,

      // P2 打一层浅蓝染色，方便一眼分清谁是谁。
      // 0xffffff 是 Phaser 的"不染色"等价值，所以 P1 走同一条 setTint 路径
      tint: i === 1 ? 0xa8dcff : 0xffffff,

      // ---- 精灵 / 叠加层（buildPlayerAt 里填）----
      sprite: null, shadow: null, overlay: null, overlayKey: '', animKey: '',
      shadowDY: 15,
      keys: [],           // 这个玩家吃的键位组（见 setupInput）

      // ---- 每玩家独立的计时 / 状态 ----
      fireAccum: 0,
      hurtMs: 0,
      castLockMs: 0, castAct: '', castFrames: 0, castAnimMul: 0,
      skillAnimMs: 0,
      darkTinted: false,
      invToken: 0,
      wardBuffMs: 0,
      ditchCooldown: 0,
      chargeDir: null, chargeSpeed: 0, chargeHitSet: null,
      shockwaves: [],
      touchDir: null,
      lastHorizPress: 0,
      lastVertPress: 0,
      buffSig: '',
      healAccum: 0,
      healCount: 0,
      reviveUsed: false,
      lastResortUsed: false,
      soulChainUsed: false,

      // ---- 道具 buff ----
      // rapid / triple 都拆成"层数 + 剩余时间"：Stacks 决定强度
      // （射速 ×0.5^Stacks，三连发加 N 倍弹道数），Ms 是剩余时间，每次吃重置到满。
      // 层数有上限（CONFIG.rapidMaxStack / tripleMaxStack），到顶后只刷新时间
      buffs: { rapidStacks: 0, rapidMs: 0, tripleStacks: 0, tripleMs: 0, shield: false },

      // ---- 肉鸽增幅（**不共享**，各自计算）----
      // 在无限模式下也会建出来（全是默认值），
      // 这样 fireVolley / updatePlayer 里读修正的地方不用到处判空
      mods: {
        dmgMul: 1, intervalMul: 1, moveMul: 1, bspeedMul: 1, scoreMul: 1,
        bossDmgMul: 1, invMul: 1,
        pierceAdd: 0, multiShot: 0,
        healEvery: 0, boomChance: 0, critChance: 0, critMul: 2.5,
      },

      // ---- 主动技能按钮（buildActiveSkillButton 里填）----
      activeBtns: [],
      // ---- 左下 / 右下技能栏的排版（buildSkillHUD 里填）----
      skillIconX: 46, skillIconStep: 52, skillIconY: CONFIG.height - 46,
      buffText: null,
    };

    // 技能计时用"每帧累加 dms"而不是 Phaser 定时器：
    // 暂停和慢动作会改掉 Phaser 时钟，累加 dms 则天然跟着游戏一起停、一起慢。
    // 首次触发只等 55% 冷却，让玩家开局没多久就能看到自己的技能
    P.skillTimer = {};
    P.skillActive = {};
    P.skillCharges = {};
    // 主动技能有两种限制方式，状态表分开存：
    //   skillCharges      —— 次数模式（巫女的堕天形态、勇者的冲锋），用光就整局没了
    //   skillCooldownLeft —— 动态冷却模式（矮人的炸药投掷），用一次冷却长一截
    //   skillCooldownTotal—— 本次冷却的总时长，画按钮外圈进度弧用
    //   skillCooldownUse  —— 已经用了几次，用来算下一次冷却有多长
    P.skillCooldownLeft = {};
    P.skillCooldownTotal = {};
    P.skillCooldownUse = {};
    // 死灵法师·击杀恢复次数：累计击杀达到 chargesFromKills 就自动 +1 次召唤。
    // 按技能 key 分别记进度（不是全局一个计数器）——
    // 以后如果加第二个"击杀恢复"类技能，两个技能不会互相吃掉对方的进度
    P.skillKillProgress = {};
    for (const s of allSkills) {
      P.skillTimer[s.key] = s.cooldown > 0 ? s.cooldown * 0.55 : 0;
      P.skillActive[s.key] = 0;
      // 次数模式技能的每局次数；冷却模式 / 被动技能用不到，给 0 就行
      P.skillCharges[s.key] = s.charges || 0;
      // 天赋【双重冲锋】：冲锋次数 +1
      if (s.key === 'charge' && talents.doublecharge) P.skillCharges[s.key] += 1;
      P.skillCooldownLeft[s.key] = 0;
      P.skillCooldownTotal[s.key] = 0;
      P.skillCooldownUse[s.key] = 0;
    }

    return P;
  }

  /* 当前正在处理的玩家。所有"每玩家字段"的代理都经过它 ——
     pIndex 由 update 的玩家循环、以及各种碰撞回调（usePlayer）切换 */
  get P() {
    const list = this.players;
    if (!list || !list.length) return null;
    return list[this.pIndex] || list[0];
  }

  /* 把"当前玩家"切到某个精灵所属的那位。
     碰撞回调拿到的第一个参数就是撞上的那个精灵，用它反查是 P1 还是 P2 ——
     比给每条判定各写一份回调干净得多 */
  usePlayer(sprite) {
    if (sprite && sprite.ownerP != null) this.pIndex = sprite.ownerP;
    return this.pIndex;
  }

  /* 离 (x, y) 最近的活着的玩家。敌人瞄准 / BOSS 攻击 / 落雷都用它 ——
     固定盯着 P1 的话，P2 可以站在旁边白嫖输出，双人协作就没了 */
  targetPlayer(x, y) {
    let best = null, bd = Infinity;
    for (const P of this.players) {
      const s = P.sprite;
      if (!s || !s.visible || !s.body || !s.body.enable) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best || (this.players[0] && this.players[0].sprite) || null;
  }

  /* 所有玩家的格子坐标。出生点 / BOSS 落点这类"要躲开玩家"的算法统一用它 */
  playerCells() {
    const cols = [], rows = [];
    for (const P of this.players) {
      const s = P.sprite;
      if (!s) continue;
      cols.push(Phaser.Math.Clamp(
        Math.floor((s.x - BOARD.x) / CONFIG.cell), 0, CONFIG.cols - 1));
      rows.push(Phaser.Math.Clamp(
        Math.floor((s.y - BOARD.y) / CONFIG.cell), 0, CONFIG.rows - 1));
    }
    if (!cols.length) { cols.push(0); rows.push(0); }
    return { cols, rows };
  }

  /* 肉鸽抽卡阈值的两个端点。双人模式整体乘一个系数 ——
     两人击杀速度约为单人的 1.6 倍，阈值不动的话一局下来卡会多到刷不完 */
  buffStepBase() {
    const mul = (this.players && this.players.length > 1) ? TWO_PLAYER.buffStepMul : 1;
    return Math.round(ROGUE.buffStepBase * mul);
  }
  buffStepMax() {
    const mul = (this.players && this.players.length > 1) ? TWO_PLAYER.buffStepMul : 1;
    return Math.round(ROGUE.buffStepMax * mul);
  }

  /* ==========================================================================
     每玩家字段代理
     --------------------------------------------------------------------------
     需求是"各自独立无敌 / 朝向 / 开火计时，不共享技能 / Buff / 增幅"。
     如果把这些字段全部改名成 this.P.xxx，09-game.js 里几百处引用都要改，
     漏一处就是"P2 的技能影响了 P1"这类极难查的 bug。
     这里改用访问器：字段名一个不变，读写在内部自动落到 this.P（当前玩家）上。

     ⚠️ 只有**每玩家**的字段才能进这里。共享的（score / lives / maxLives /
        rogue 的阶段进度 / 天气 / 敌人池 / 分数）必须留在 GameScene 上，
        否则两个人会互相偷对方的血和技能。
     ========================================================================== */
  get loadout() { return this.P.loadout; }
  get charDef() { return this.P.charDef; }
  get weaponDef() { return this.P.weaponDef; }
  get innateSkills() { return this.P.innateSkills; }
  get equippedSkills() { return this.P.equippedSkills; }
  get allSkills() { return this.P.allSkills; }
  get activeSkills() { return this.P.activeSkills; }
  get hudSkills() { return this.P.hudSkills; }
  get talents() { return this.P.talents; }
  get mods() { return this.P.mods; }

  get player() { return this.P.sprite; }
  get playerShadow() { return this.P.shadow; }
  get shadowDY() { return this.P.shadowDY; }
  set shadowDY(v) { this.P.shadowDY = v; }

  get playerOverlay() { return this.P.overlay; }
  set playerOverlay(v) { this.P.overlay = v; }
  get playerOverlayKey() { return this.P.overlayKey; }
  set playerOverlayKey(v) { this.P.overlayKey = v; }
  get playerAnimKey() { return this.P.animKey; }
  set playerAnimKey(v) { this.P.animKey = v; }
  get playerHurtMs() { return this.P.hurtMs; }
  set playerHurtMs(v) { this.P.hurtMs = v; }

  get fireAccum() { return this.P.fireAccum; }
  set fireAccum(v) { this.P.fireAccum = v; }
  get castLockMs() { return this.P.castLockMs; }
  set castLockMs(v) { this.P.castLockMs = v; }
  get castAct() { return this.P.castAct; }
  set castAct(v) { this.P.castAct = v; }
  get castFrames() { return this.P.castFrames; }
  set castFrames(v) { this.P.castFrames = v; }
  get castAnimMul() { return this.P.castAnimMul; }
  set castAnimMul(v) { this.P.castAnimMul = v; }
  get skillAnimMs() { return this.P.skillAnimMs; }
  set skillAnimMs(v) { this.P.skillAnimMs = v; }
  get _darkTinted() { return this.P.darkTinted; }
  set _darkTinted(v) { this.P.darkTinted = v; }
  get _invToken() { return this.P.invToken; }
  set _invToken(v) { this.P.invToken = v; }
  get _wardBuffMs() { return this.P.wardBuffMs; }
  set _wardBuffMs(v) { this.P.wardBuffMs = v; }
  get _ditchCooldown() { return this.P.ditchCooldown; }
  set _ditchCooldown(v) { this.P.ditchCooldown = v; }
  get _chargeHitSet() { return this.P.chargeHitSet; }
  set _chargeHitSet(v) { this.P.chargeHitSet = v; }
  get chargeDir() { return this.P.chargeDir; }
  set chargeDir(v) { this.P.chargeDir = v; }
  get chargeSpeed() { return this.P.chargeSpeed; }
  set chargeSpeed(v) { this.P.chargeSpeed = v; }
  get shockwaves() { return this.P.shockwaves; }
  get touchDir() { return this.P.touchDir; }
  set touchDir(v) { this.P.touchDir = v; }
  get lastHorizPress() { return this.P.lastHorizPress; }
  set lastHorizPress(v) { this.P.lastHorizPress = v; }
  get lastVertPress() { return this.P.lastVertPress; }
  set lastVertPress(v) { this.P.lastVertPress = v; }

  get buffs() { return this.P.buffs; }
  get _buffSig() { return this.P.buffSig; }
  set _buffSig(v) { this.P.buffSig = v; }
  get buffText() { return this.P.buffText; }

  get skillTimer() { return this.P.skillTimer; }
  get skillActive() { return this.P.skillActive; }
  get skillCharges() { return this.P.skillCharges; }
  get skillCooldownLeft() { return this.P.skillCooldownLeft; }
  get skillCooldownTotal() { return this.P.skillCooldownTotal; }
  get skillCooldownUse() { return this.P.skillCooldownUse; }
  get skillKillProgress() { return this.P.skillKillProgress; }

  get _healAccum() { return this.P.healAccum; }
  set _healAccum(v) { this.P.healAccum = v; }
  get _lastResortUsed() { return this.P.lastResortUsed; }
  set _lastResortUsed(v) { this.P.lastResortUsed = v; }
  get _soulChainUsed() { return this.P.soulChainUsed; }
  set _soulChainUsed(v) { this.P.soulChainUsed = v; }
  get reviveUsed() { return this.P.reviveUsed; }
  set reviveUsed(v) { this.P.reviveUsed = v; }

  /* 图集帧数足够才启用动画，否则 generateFrameNumbers 会产出空帧序列 */
  hasSheet(key, frames) {
    if (!this.textures.exists(key)) return false;
    const tex = this.textures.get(key);
    return (tex.frameTotal - 1) >= frames;
  }

  setupAnimations() {
    // 图集朝向按行排列：第 1 行下、第 2 行上、第 3 行左、第 4 行右。
    // 每向帧数从 SHEET_FRAMES_PER_DIR 取，不能写死 8 —— 有两张图集每向只有 6 帧
    for (const sheet of SHEET_KEYS) {
      if (!this.sheetReady[sheet]) continue;

      const step = SHEET_FRAMES_PER_DIR[sheet];
      const dirs = [
        ['down',  0,             step - 1],
        ['up',    step,          step * 2 - 1],
        ['left',  step * 2,      step * 3 - 1],
        ['right', step * 3,      step * 4 - 1],
      ];

      for (const [dir, start, end] of dirs) {
        const key = sheet + '-walk-' + dir;
        // 场景可被重启，动画注册在全局 AnimationManager 上，重复创建只会刷警告
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(sheet, { start, end }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }

    // 可玩角色：一张图集只装一个动作，行顺序同样是 下 / 上 / 左 / 右。
    // 帧号区间按 CHAR_ANIMS 里写死的列数算，思路和上面敌人那套完全一样
    const DIR_ROWS = ['down', 'up', 'left', 'right'];
    for (const [charKey, anims] of Object.entries(CHAR_ANIMS)) {
      for (const [act, def] of Object.entries(anims)) {
        if (!this.hasSheet(def.file, def.frames * 4)) continue;

        DIR_ROWS.forEach((dir, row) => {
          const key = charKey + '-' + act + '-' + dir;
          if (this.anims.exists(key)) return;

          const frames = this.anims.generateFrameNumbers(def.file,
            { start: row * def.frames, end: (row + 1) * def.frames - 1 });

          this.anims.create({
            key,
            // reverse：这套图集的帧序是倒的（作者把"完成态"画在了最左边那一帧），
            // 把帧数组直接翻过来，播出来就是"从右往左"
            frames: def.reverse ? frames.reverse() : frames,
            frameRate: def.rate,
            repeat: def.repeat,
          });
        });
      }
    }

    // "边攻击边移动"的叠加层：帧数、帧率、行排布都和对应角色的 run 完全一样，
    // 只是像素被裁成了下半身。动画 key 是 <角色>-run-lo-<朝向>。
    // 必须单独注册 —— CHAR_ANIMS 里没有它（它不是一个独立动作），
    // 上面那个遍历扫不到，不注册的话 updatePlayerOverlay 会找不到动画、
    // 叠加层永远是不可见的，功能静默失效
    for (const key of CHAR_OVERLAY_SHEETS) {
      const base = key.replace('-run-lo', '');
      const runDef = CHAR_ANIMS[base] ? CHAR_ANIMS[base].run : null;
      if (!runDef) continue;
      if (!this.hasSheet(key, runDef.frames * 4)) continue;

      DIR_ROWS.forEach((dir, row) => {
        const k = key + '-' + dir;
        if (this.anims.exists(k)) return;
        this.anims.create({
          key: k,
          frames: this.anims.generateFrameNumbers(key,
            { start: row * runDef.frames, end: (row + 1) * runDef.frames - 1 }),
          // 帧率和主 run 保持一致：两层要同步迈步，差一点就会出现
          // "上半身在打、下半身在滑"的割裂感
          frameRate: runDef.rate,
          repeat: -1,
        });
      });
    }

    // BOSS：一张图集一个动作，行顺序同样是 下 / 上 / 左 / 右。
    // 注意每张图集的单帧尺寸不一样（48 / 64 / 128），帧号区间必须按各自的列数算 ——
    // 用同一套数字去切，48 的图会切出半个身子、128 的图会切进相邻帧
    for (const [act, def] of Object.entries(BOSS_ANIMS)) {
      if (!this.hasSheet(def.file, def.frames * 4)) continue;

      DIR_ROWS.forEach((dir, row) => {
        const key = 'boss-' + act + '-' + dir;
        if (this.anims.exists(key)) return;

        const frames = this.anims.generateFrameNumbers(def.file,
          { start: row * def.frames, end: (row + 1) * def.frames - 1 });

        this.anims.create({
          key,
          // 跳起/落地这套素材是"从地面 → 腾空"画的，boss 要从天上砸下来，
          // 所以跳跃动画倒着播：腾空那帧当起点，落地那帧当终点
          frames: act === 'jump' ? frames.reverse() : frames,
          frameRate: def.rate,
          repeat: def.repeat,
        });
      });
    }

    // 哥布林飞骑：同一套"方向按行"，但帧区间用 from / to 表达 ——
    // 猛冲要拆成"前摇（慢）"和"俯冲（快）"两段，这两段的帧率差一倍，
    // 只靠 frames 数切不开，必须能单独指定区间
    for (const [act, def] of Object.entries(GOBLIN_ANIMS)) {
      const cols = GOBLIN_SHEET_COLS[def.file];
      if (!this.hasSheet(def.file, cols * 4)) continue;

      DIR_ROWS.forEach((dir, row) => {
        const key = 'gob-' + act + '-' + dir;
        if (this.anims.exists(key)) return;

        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(def.file,
            { start: row * cols + def.from, end: row * cols + def.to }),
          frameRate: def.rate,
          repeat: def.repeat,
        });
      });
    }

    // 巫妖王：帧区间同样用 from / to。多一个 reverse ——
    // 素材的 Jump 是"离地 → 腾空"画的，出场要倒着播才是"从天而降"，
    // 而同一个动作正向播就是"飘起来"，一张图集演两个相反的位移。
    // 帧序必须在这里就翻好：靠 sprite.setScale(-1) 翻是不行的，
    // Arcade 的物理体会跟着镜像，判定圈的位置会跑到另一侧
    for (const [act, def] of Object.entries(LICH_ANIMS)) {
      const cols = LICH_SHEET_COLS[def.file];
      if (!this.hasSheet(def.file, cols * 4)) continue;

      DIR_ROWS.forEach((dir, row) => {
        const key = 'lich-' + act + '-' + dir;
        if (this.anims.exists(key)) return;

        const frames = this.anims.generateFrameNumbers(def.file,
          { start: row * cols + def.from, end: row * cols + def.to });

        this.anims.create({
          key,
          frames: def.reverse ? frames.reverse() : frames,
          frameRate: def.rate,
          repeat: def.repeat,
        });
      });
    }

    /* 棋盘皮肤：每个有 sprite sheet 的皮肤注册一个无限循环动画。
       这样 buildBackground 里只要 skin.sheet 存在就能 play()，不用关心帧细节。
       帧率由 BOARD_SKINS.rate 控制 —— 改这里不会改骨，屏内的"电光流动"节奏。
       hasSheet 用 frameTotal - 1 >= frames 判断：sprite sheet 的 frameTotal
       = 帧数 + 1（含 __BASE），所以 4 帧的图集 frameTotal 是 5 */
    for (const skin of Object.values(BOARD_SKINS)) {
      if (!skin.sheet) continue;
      const animKey = 'board-' + skin.key;
      if (this.anims.exists(animKey)) continue;
      if (!this.hasSheet(skin.sheet, skin.frames)) continue;
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(skin.sheet, { start: 0, end: skin.frames - 1 }),
        frameRate: skin.rate,
        repeat: -1,
      });
    }
  }

  /* 场景底图。整块只画一次（Graphics 是静态的，不进每帧循环），
     所以这里的"画得细"是免费的 —— 代价只有进入场景那一下。
     构图从上到下：场外暗底 → 木质围栏 → 草地 → 棋盘纹理 → 光影 → 皮肤覆盖层 */
  buildBackground() {
    const C = CONFIG.color;
    const g = this.add.graphics().setDepth(-1000);
    const W = CONFIG.width, H = CONFIG.height;

    // ---- 场外：竖直渐变（上面深、下面略亮）+ 一圈暗角 ----
    g.fillStyle(0x050a11, 1);
    g.fillRect(0, 0, W, H);
    g.fillGradientStyle(0x0d1a28, 0x0d1a28, 0x05090f, 0x05090f, 1, 1, 1, 1);
    g.fillRect(0, 0, W, H);

    // ---- 围栏：外框木板 + 四角包边 + 等距木桩 ----
    const fx = BOARD.x, fy = BOARD.y, fw = BOARD.w, fh = BOARD.h;
    g.fillStyle(C.fenceDark, 1);
    g.fillRect(fx - 16, fy - 16, fw + 32, fh + 32);
    g.fillStyle(C.fence, 1);
    g.fillRect(fx - 9, fy - 9, fw + 18, fh + 18);
    // 木纹：在围栏上压几条深浅不一的横/竖线
    g.lineStyle(1, 0x4a3420, 0.5);
    for (let i = 0; i < 4; i++) {
      g.lineBetween(fx - 16, fy - 12 + i * 7, fx + fw + 16, fy - 12 + i * 7);
      g.lineBetween(fx - 16, fy + fh + 12 - i * 7, fx + fw + 16, fy + fh + 12 - i * 7);
      g.lineBetween(fx - 12 + i * 7, fy - 16, fx - 12 + i * 7, fy + fh + 16);
      g.lineBetween(fx + fw + 12 - i * 7, fy - 16, fx + fw + 12 - i * 7, fy + fh + 16);
    }
    // 四角包边：小方块，让围栏有"榫接"的结构感
    g.fillStyle(0x6b4f2e, 1);
    for (const [cx, cy] of [[fx - 16, fy - 16], [fx + fw + 4, fy - 16],
                            [fx - 16, fy + fh + 4], [fx + fw + 4, fy + fh + 4]]) {
      g.fillRect(cx, cy, 12, 12);
    }
    // 木桩：沿着上下边等距钉一圈，间距 4 格
    g.fillStyle(0x5d452a, 0.85);
    for (let c = 1; c < CONFIG.cols; c += 4) {
      const px = fx + c * CONFIG.cell - 3;
      g.fillRect(px, fy - 15, 6, 8);
      g.fillRect(px, fy + fh + 7, 6, 8);
    }

    // ---- 草地底色 ----
    g.fillStyle(C.ground, 1);
    g.fillRect(fx, fy, fw, fh);

    // 固定种子的斑块：每次进游戏纹理一致，方便比对改动前后
    const rnd = new Phaser.Math.RandomDataGenerator(['board-shooter-ground']);
    for (let i = 0, n = Math.round(300 * PERF.deco); i < n; i++) {
      const px = fx + rnd.between(4, fw - 4);
      const py = fy + rnd.between(4, fh - 4);
      const r = rnd.between(3, 10);
      g.fillStyle(rnd.pick([C.groundDark, C.groundLight, C.groundDark]), rnd.realInRange(0.18, 0.42));
      g.fillEllipse(px, py, r * 2.3, r * 1.25);
    }
    // 细一点的草叶：短线段，比斑块更能撑出"草地"的质感
    g.lineStyle(1, C.groundLight, 0.3);
    for (let i = 0, n = Math.round(190 * PERF.deco); i < n; i++) {
      const px = fx + rnd.between(6, fw - 6);
      const py = fy + rnd.between(6, fh - 6);
      const h = rnd.between(3, 7);
      const lean = rnd.realInRange(-2, 2);
      g.lineBetween(px, py, px + lean, py - h);
    }

    /* 棋盘纹理：隔一格压一点点亮色。
       刻意做得极淡（0.035）—— 它是"棋盘枪手"的视觉主题，
       同时给玩家一个判断行 / 列的参照（敌人只沿行或列直线走），
       但压得太实就变成格子线，会盖过角色 */
    g.fillStyle(0xffffff, 0.035);
    for (let c = 0; c < CONFIG.cols; c++) {
      for (let r = 0; r < CONFIG.rows; r++) {
        if ((c + r) % 2 !== 0) continue;
        g.fillRect(fx + c * CONFIG.cell, fy + r * CONFIG.cell, CONFIG.cell, CONFIG.cell);
      }
    }

    // ---- 光影：上边一条内阴影，左边一条更淡的 ----
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.32, 0.32, 0, 0);
    g.fillRect(fx, fy, fw, 16);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.22, 0, 0.22, 0);
    g.fillRect(fx, fy, 14, fh);
    // 下边和右边一点点回光，让场地看起来是"凹进去的"
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.16, 0.16);
    g.fillRect(fx, fy + fh - 12, fw, 12);

    g.lineStyle(2, 0x000000, 0.22);
    g.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2);

    /* ---- 棋盘皮肤覆盖层 ----
       程序化背景画完之后，根据 loadout.boardSkin 决定要不要在 BOARD 矩形上
       叠一张 sprite sheet。默认的 'grass' 跳过这步，所以原本的样子一点不变。
       ⚠️ depth 必须高于 g（-1000）但低于玩家和敌人 —— 这里给 -990：
       玩家 shadow 是 depth=1、玩家 sprite 是默认 0（高于 -990），所以覆盖层
       不会压到角色和阴影，但会盖在草地 / 木栅栏之上，符合"覆盖"的语义。
       ⚠️ 图集加载失败时静默跳过 —— 没必要为了一个装饰让游戏起不来 */
    this.applyBoardSkin();
  }

  /* 棋盘皮肤覆盖层单独提一个方法。
     原因是 Phaser 的 scene.start('Game') 在 GameScene 已经在 map 里时不会销毁重建，
     而是 sleep + wake —— 上一次的 boardSkinSprite 会留在场上，而 loadout 可能已经
     变了。必须把销毁 + 创建合并到一个方法里，在 create 和 wake 都跑一遍 */
  applyBoardSkin() {
    if (this.boardSkinSprite) {
      this.boardSkinSprite.destroy();
      this.boardSkinSprite = null;
    }
    const skin = BOARD_SKINS[this.loadout.boardSkin] || BOARD_SKINS[DEFAULT_BOARD_SKIN];
    if (skin && skin.sheet && this.textures.exists(skin.sheet)) {
      this.boardSkinSprite = this.add.sprite(BOARD.x, BOARD.y, skin.sheet, 0)
        .setOrigin(0, 0)
        .setDepth(-990)
        .setAlpha(skin.alpha);
      if (this.anims && this.anims.exists('board-' + skin.key)) {
        this.boardSkinSprite.play('board-' + skin.key);
      }
    }
  }

  /* 环境浮尘：场地上方缓缓上飘的暖色小点，给静止的草地一点"空气感"。
     纯装饰且和玩法无关 —— 低配机直接不开，不值得为它牺牲帧率 */
  buildAmbientFX() {
    if (!PERF.ambient) return;
    this.dust = this.add.particles(0, 0, 'spark-warm', {
      x: { min: BOARD.x + 10, max: BOARD.x + BOARD.w - 10 },
      y: { min: BOARD.y + 10, max: BOARD.y + BOARD.h - 10 },
      lifespan: { min: 4200, max: 9000 },
      speedX: { min: -7, max: 7 },
      speedY: { min: -15, max: -4 },
      scale: { min: 0.08, max: 0.26 },
      alpha: { start: 0.3, end: 0 },
      blendMode: 'ADD',
      frequency: 460,
      quantity: 1,
      maxAliveParticles: 24,
    }).setDepth(-950);
  }

  buildPools() {
    // 玩家子弹用 Sprite 而不是 Image：鞭炮 / 炸药的贴图是 3×3 的图集，
    // Image 会取整张图（__BASE）显示成一大片色块，Sprite 才能指定取第 0 帧
    this.playerBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: CONFIG.poolPlayerBullets });
    this.enemyBullets  = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: CONFIG.poolEnemyBullets });
    this.enemies       = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: CONFIG.poolEnemies });
    this.powerups      = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: CONFIG.poolPowerups });
    // 死灵法师的召唤物：骷髅弓手和它们射出的箭。
    // 都是 Sprite 而不是 Image —— 骷髅要播图集动画，箭要跟着飞行方向旋转
    this.skeletons      = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: CONFIG.poolSkeletons });
    this.skeletonArrows = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: CONFIG.poolSkeletonArrows });
  }

  /* 出生格。单人站棋盘正中（和以前完全一样）；
     双人分别落在中间行的左右两侧，相隔 6 格 —— 开局不会贴在一起，
     也都在场地内，不会一出生就被判定出界 */
  playerSpawn(i) {
    const row = Math.floor(CONFIG.rows / 2);
    if (this.players.length < 2) return { col: Math.floor(CONFIG.cols / 2), row };
    // 13 列：P1 在 col 3、P2 在 col 9
    return { col: i === 0 ? 3 : CONFIG.cols - 4, row };
  }

  /* 建第 i 个玩家的精灵 / 阴影 / 叠加层。
     单人局只会被调一次，行为与拆分前完全一致 */
  buildPlayerAt(i) {
    const P = this.players[i];
    // 后面这一整段读的全是 this.charDef / this.player 这类代理字段，
    // 必须先把 pIndex 指到这一位，否则会拿 P1 的角色表去建 P2 的贴图
    this.pIndex = i;

    const sp = this.playerSpawn(i);
    const sc = sp.col, sr = sp.row;

    // 物理半径可以按角色覆盖：图集角色视觉上比程序化角色瘦一圈，
    // 还按 17 算会出现"看着没碰到却被判定命中"，这是最招人烦的一类手感问题。
    // 这里的 pr 是"屏幕上的半径"，不是 setCircle 的参数 —— 两者差一个缩放，见下面
    const pr = this.charDef.bodyRadius != null ? this.charDef.bodyRadius : CONFIG.playerRadius;
    const r = pr + 4;
    // 世界边界是全局的，两个玩家共用一份。取各自算出来的值即可 ——
    // 半径只差几个像素，取谁都不会出现"被墙卡住"
    this.physics.world.setBounds(BOARD.x + r, BOARD.y + r, BOARD.w - 2 * r, BOARD.h - 2 * r);

    // 阴影距离也跟角色走：图集角色的脚底在帧内更靠下，写死 +15 会让影子盖在小腿上
    this.shadowDY = this.charDef.shadowOffsetY != null ? this.charDef.shadowOffsetY : 15;
    P.shadow = this.add.image(Utils.colCenter(sc), Utils.rowCenter(sr) + this.shadowDY,
      'shadow').setDepth(1);

    // 图集没加载成功就退回程序化纹理（和敌人图集同一个降级策略）——
    // 不能因为丢了一张图让人物在场上变成透明
    // 跑步图集的 key 必须问 charRunSheet，不能拼 '<sheet>-run' ——
    // 勇者那张图集叫 wari-walk，拼错了会静默退回程序化纹理，角色变回一个球
    const runSheet = this.charDef.sheet ? charRunSheet(this.charDef) : null;
    const sheetOk = !!runSheet && this.textures.exists(runSheet);
    const spriteScale = sheetOk
      ? (this.charDef.sheetScale != null ? this.charDef.sheetScale : 2.0)
      : 1;
    const texKey = sheetOk ? runSheet : ('player-' + this.charDef.key + '-down');
    const sprite = this.physics.add.sprite(Utils.colCenter(sc), Utils.rowCenter(sr), texKey);
    P.sprite = sprite;
    // 让碰撞回调能反查"撞上的是哪位"（见 usePlayer）。
    // 挂在自己的精灵上而不是数组下标上，是因为回调只拿得到精灵
    sprite.ownerP = i;
    // P2 打一层浅蓝染色。P1 的 tint 是 0xffffff，等价于不染色 ——
    // 两边走同一条路径，省得在 updatePlayerVisual 里写分支
    sprite.setTint(P.tint);

    if (sheetOk) {
      sprite.setScale(spriteScale);
      const startKey = this.charDef.sheet + '-run-down';
      if (this.anims.exists(startKey)) {
        sprite.anims.play(startKey, true);
        this.playerAnimKey = startKey;
      }
    }

    // 两个坑叠在一起，必须同时绕开：
    // 1) Phaser 内部算的是 halfWidth = floor(radius * scaleX)，也就是 setCircle 的半径
    //    会被 sprite 缩放再乘一次。图集角色的 sprite 放大过，所以要先除掉缩放 ——
    //    直接传 pr 的话巫女的物理半径会变成 15 × 1.7 = 25.5，视觉上没碰到却被打中。
    // 2) offset = 帧宽/2 - 半径（这里的半径是未缩放的）时物理体才与精灵同心。
    //    因为 offset 和 origin 会被一起乘缩放、正好抵消，这条式子在任意缩放下都成立。
    const bodyR = pr / spriteScale;
    sprite.body.setCircle(bodyR, 24 - bodyR, 24 - bodyR);
    sprite.setCollideWorldBounds(true);
    sprite.facing = 'down';
    sprite.invincible = false;

    this.buildPlayerOverlay();
  }

  /* ---- "边攻击边移动"的叠加层 ----
     需求是"攻击的同时还在走路"。这套素材里 run 和 atk1 是两个独立图集，
     没有现成的"边走边打"动作，所以用两层精灵叠出来：
       底图（主精灵） 播攻击动画 → 上半身挥杖 / 拉弓，法术红光完整保留
       叠加层         播只有下半身的走路图 → 迈步、长袍摆动
     叠加层的图是离线裁好的（necro-run-lo / skel-run-lo，腰部横切），
     不放进 CHAR_ANIMS，因为它只是 run 的裁剪版，不是一个独立动作。

     为什么切"走路的下半身"而不是"攻击的上半身"：
     死灵法师的法术红光出现在身体中段，横切会把它切掉一半；
     而走路图的下半身只有长袍下摆和腿，切掉上面不留任何特效残骸。

     已知限制：法杖是竖着贯穿全身的，在切割线上会有一点点错位 ——
     这是素材的固有限制，横切无法消除。因为长袍是深色、
     错位只有几个像素，在实际游戏尺寸（1.6 倍缩放）下看不出来。 */
  buildPlayerOverlay() {
    const key = this.charDef.sheet ? (this.charDef.sheet + '-run-lo') : null;
    if (!key || !this.textures.exists(key)) return;

    // 重建前先销毁旧的。buildPlayer 目前只在 create 里调一次，
    // 但复活 / 换角色这类流程以后很可能复用它 ——
    // 那时不销毁就会留下一个不再同步的"影子精灵"钉在场上
    if (this.playerOverlay) { this.playerOverlay.destroy(); this.playerOverlay = null; }

    this.playerOverlay = this.add.sprite(this.player.x, this.player.y, key)
      .setScale(this.player.scaleX)
      .setVisible(false);
    this.playerOverlayKey = '';
  }

  /* 叠加层的动画切换。移动时显示并播走路，站定时藏起来 ——
     站定时主精灵的 atk1 本身就是完整动作，再叠一层下半身反而是双重影像 */
  updatePlayerOverlay(moving) {
    const o = this.playerOverlay;
    if (!o) return;

    if (!moving) {
      if (o.visible) o.setVisible(false);
      return;
    }

    const key = this.charDef.sheet + '-run-lo-' + this.player.facing;
    if (!this.anims.exists(key)) { o.setVisible(false); return; }
    if (!o.visible) o.setVisible(true);
    if (this.playerOverlayKey === key) return;
    this.playerOverlayKey = key;
    o.play(key, true);
  }

  hidePlayerOverlay() {
    if (this.playerOverlay && this.playerOverlay.visible) {
      this.playerOverlay.setVisible(false);
    }
  }

  /* 叠加层的每帧同步：位置、深度、透明度全部跟着主精灵走。
     漏掉任何一项都会露馅 —— 位置不跟会拖影，深度不跟会被场景里的东西挡住，
     透明度不跟会在无敌闪烁时变成一个不闪的实心影子。
     深度用 +0.5：updateDepth 是按 y 排的，同一 y 上加 0.5 保证压在主精灵上面，
     又不会跨到下一段 y 的遮挡关系里 */
  syncPlayerOverlay() {
    const o = this.playerOverlay;
    if (!o || !o.visible) return;
    const p = this.player;
    o.setPosition(p.x, p.y);
    o.setAlpha(p.alpha);
    o.setDepth(p.depth + 0.5);
    // 染色也要跟。堕天形态会给主精灵打一层暖色（见 updatePlayerVisual），
    // 叠加层不跟的话上半身橙、下半身原色，腰部切割线上会出现一条横向色差。
    // tintTopLeft 在"没染色"时是 0xffffff，setTint(白) 等价于不染色，
    // 所以不需要额外记录开关状态
    o.setTint(p.tintTopLeft);
  }

  buildParticles() {
    // 击杀 / 爆炸的火花。优先用 fx-sparks（2 帧的小图），
    // 图集没加载成功时退回程序化的 spark-warm，保证视觉不缺失
    const sparkTex = this.textures.exists('fx-sparks') ? 'fx-sparks' : 'spark-warm';
    this.burstKill = this.add.particles(0, 0, sparkTex, {
      speed: { min: 70, max: 280 }, lifespan: { min: 200, max: 480 },
      scale: { start: 1.2, end: 0 }, alpha: { start: 1, end: 0 },
      blendMode: 'ADD', emitting: false,
    }).setDepth(8000);

    this.burstHit = this.add.particles(0, 0, 'spark-cool', {
      speed: { min: 90, max: 340 }, lifespan: { min: 260, max: 620 },
      scale: { start: 1.5, end: 0 }, alpha: { start: 1, end: 0 },
      blendMode: 'ADD', emitting: false,
    }).setDepth(8000);

    // 子弹拖尾走粒子池：之前是每 50ms 新建一个 Image + 一个 Tween，
    // 三连发时每秒能造出上百个临时对象，是最大的 GC 抖动来源
    this.bulletTrail = this.add.particles(0, 0, 'spark-warm', {
      lifespan: 220,
      scale: { start: 0.75, end: 0.15 },
      alpha: { start: 0.5, end: 0 },
      blendMode: 'ADD', emitting: false,
    }).setDepth(6999);

    // 枪口闪光：每发点一次。开火间隔 290ms、闪光寿命 90ms，
    // 同时最多两三个存活，粒子池扛得住，不用再搭一套 Image 池
    this.muzzleFlash = this.add.particles(0, 0, 'muzzle', {
      lifespan: CONFIG.muzzleFlashMs,
      speed: 0,
      scale: { start: CONFIG.muzzleFlashScale, end: CONFIG.muzzleFlashScale * 0.2 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD', emitting: false,
    }).setDepth(7001);

    // 击杀冲击波：向外扩散的圆环，是"这一下打爆了"最直观的视觉
    this.shockRing = this.add.particles(0, 0, 'shockring', {
      lifespan: 300,
      speed: 0,
      scale: { start: 0.2, end: 1.15 },
      alpha: { start: 0.9, end: 0 },
      blendMode: 'ADD', emitting: false,
    }).setDepth(7999);

    /* 低配机把火花数量打对折。
       全场景有 30 多处 burstKill.explode(n, x, y) 调用点，一个个改成
       explode(n * PERF.particles) 既啰嗦又必漏；在发射器实例上包一层，
       一处生效、行为完全一致（实例属性会遮蔽原型方法，Phaser 内部
       不会自己调 explode，所以没有副作用）。
       Math.max(1, ...) 是必须的：数量被压成 0 的话，"打中了"这件事
       就没有任何视觉反馈了 —— 那比掉几帧更伤手感 */
    if (PERF.particles < 1) {
      for (const em of [this.burstKill, this.burstHit]) {
        const raw = em.explode.bind(em);
        em.explode = (count, x, y) => raw(Math.max(1, Math.round(count * PERF.particles)), x, y);
      }
    }
  }

  buildFX() {
    const W = CONFIG.width, H = CONFIG.height;

    this.redVignette = this.add.rectangle(0, 0, W, H, 0xff2030, 1)
      .setOrigin(0, 0).setDepth(8880).setAlpha(0);

    // 压力暗角：同屏敌人越多四周越暗。贴图是径向渐变，只改 alpha 就能控制强弱，
    // 比每帧重画一遍 Graphics 便宜得多
    this.pressureVignette = this.add.image(W / 2, H / 2, 'vignette')
      .setDepth(8870).setAlpha(0);

    // 危险预警：敌人贴脸时从画面四周渗进来的红光。用径向渐变而不是整屏红矩形，
    // 中心视野不会被染色，玩家还能看清该往哪躲
    this.dangerGlow = this.add.image(W / 2, H / 2, 'vignette-red')
      .setDepth(8885).setAlpha(0);

    // 注意：矩形第 5 个参数是 fillAlpha。填 0 会让这个矩形永远画不出来，
    // 后面 setAlpha 调多高都没用。所以 fillAlpha 给 1，用对象 alpha 控制显隐。
    this.flashWhite = this.add.rectangle(0, 0, W, H, 0xffffff, 1)
      .setOrigin(0, 0).setDepth(8990).setAlpha(0);

    // 受击红闪：叠在白闪之上。白闪给"亮"，红闪给"痛"，两层一起打才有分量
    this.flashRed = this.add.rectangle(0, 0, W, H, 0xff1a30, 1)
      .setOrigin(0, 0).setDepth(8995).setAlpha(0);
  }

  buildShieldFX() {
    // 护盾光环：每帧在 updateShieldFX() 里 clear + 重绘，位置跟着玩家走
    this.shieldFX = this.add.graphics().setDepth(8500);
  }

  buildJoystickFX() {
    // 虚拟摇杆。深度压在 HUD(9000) 之下、角色之上 ——
    // 摇杆是操作提示，不该盖住分数 / 生命 / 暂停键
    this.joystickFX = this.add.graphics().setDepth(8600);
  }

  buildPowerupRing() {
    // 道具倒计时环：画在道具本体（depth 7500）上面
    this.powerupRing = this.add.graphics().setDepth(7501);
  }

  buildHUD() {
    this.scoreText = this.add.text(48, 22, '0', {
      fontFamily: UI.MONO, fontSize: '46px', color: '#ffe066', fontStyle: 'bold',
    }).setDepth(9000).setOrigin(0, 0);

    this.bestText = this.add.text(50, 74, '最高 ' + this.best, {
      fontFamily: UI.MONO, fontSize: '16px', color: '#8fa3b8',
    }).setDepth(9000);

    this.levelText = this.add.text(CONFIG.width / 2, 32, '难度 1', {
      fontFamily: UI.MONO, fontSize: '17px', color: '#8fa3b8',
    }).setDepth(9000).setOrigin(0.5, 0.5);

    this.comboContainer = this.add.container(CONFIG.width / 2, 84).setDepth(9000).setVisible(false);
    const comboBg = this.add.rectangle(0, 0, 200, 36, 0x0b1520, 0.72)
      .setStrokeStyle(1.5, 0xffe066, 0.75);
    this.comboText = this.add.text(0, -3, '', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    const barBg = this.add.rectangle(-88, 13, 176, 3, 0x33404f, 1).setOrigin(0, 0.5);
    this.comboBar = this.add.rectangle(-88, 13, 176, 3, 0xffe066, 1).setOrigin(0, 0.5);
    this.comboContainer.add([comboBg, this.comboText, barBg, this.comboBar]);

    /* Buff 文字：**每人一条**。
       单人局在原位（左下角）；双人局 P1 靠左、P2 靠右，各显示各的
       连射 / 三连发 / 护盾 —— 需求是"不共享 Buff，谁吃到算谁的" */
    for (let pi = 0; pi < this.players.length; pi++) {
      const P = this.players[pi];
      const right = this.players.length > 1 && pi === 1;
      P.buffText = this.add.text(
        right ? CONFIG.width - 40 : 40, CONFIG.height - 100, '', {
          fontFamily: UI.FONT, fontSize: '14px', color: '#7fffa0', fontStyle: 'bold',
        }).setDepth(9000).setOrigin(right ? 1 : 0, 0.5);
    }

    /* 底部提示文案。
       单人局跟着角色走：只有带主动技能的角色才需要知道按键，
       键位按 activeSkills 的顺序分配 J、K，和那排按钮一一对应
       （死灵法师有两个技能，只写 J 的话玩家永远发现不了第二个）。
       双人局直接把两个人的键位分工写清楚 —— 这是开局最需要知道的一件事 */
    let hint;
    if (this.players.length > 1) {
      /* 双人局的底部文案必须**短**：左右两侧要留给两个人的被动技能图标
         （P1 从 x=46 往右、P2 从 W-46 往左，最多各三个 + 名字）。
         写成完整句子的话中间那行会横跨到两侧图标底下 */
      hint = 'P1  WASD + J/K          P2  方向键 + 小键盘 1/2          空格 暂停';
    } else {
      const skillHint = this.activeSkills
        .map((s, i) => (i === 0 ? 'J ' : 'K ') + s.name)
        .join('    ·    ');
      hint = '方向键 / WASD 移动    ·    手机按住拖动（出现摇杆）    ·    空格 暂停'
        + (skillHint ? '    ·    ' + skillHint : '');
    }
    this.hintText = this.add.text(CONFIG.width / 2, BOARD.y + BOARD.h + 28,
      hint, {
      fontFamily: UI.FONT, fontSize: this.players.length > 1 ? '14px' : '15px',
      color: '#55697d',
    }).setDepth(9000).setOrigin(0.5, 0.5);

    this.buildLivesHUD();

    // 金币：击杀即时到账，攒着去商城解锁东西
    this.coinText = this.add.text(CONFIG.width - 40, 82, '', {
      fontFamily: UI.MONO, fontSize: '18px', color: '#ffd54a', fontStyle: 'bold',
    }).setDepth(9000).setOrigin(1, 0.5);
    this.updateCoinText();

    this.buildSkillHUD();
    this.buildActiveSkillButton();

    /* 静音按钮。单人局贴右下角；双人局往左挪 210px ——
       右下角那一片要留给 P2 的被动技能图标（从 x = W-46 往左排，最多三个，
       最左到 W-46-2*52-21 = W-171），不挪的话图标会压在"音效 开"上 */
    this.muteBtn = this.add.text(
      this.players.length > 1 ? CONFIG.width - 210 : CONFIG.width - 40,
      CONFIG.height - 30,
      SoundSys.isMuted() ? '音效 关' : '音效 开', {
        fontFamily: UI.MONO, fontSize: '15px',
        color: SoundSys.isMuted() ? '#55697d' : '#7fffa0',
      }).setDepth(9000).setOrigin(1, 0.5);
    this.muteBtn.setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => { SoundSys.unlock(); this.toggleMute(); });
  }

  buildLivesHUD() {
    /* 图标只创建一次，之后只换贴图 —— 之前每次受伤都销毁重建 3 个 Image。
       双人局是**共享生命**，上限是两个角色之和（最极端 4 + 4 + 2 = 10 个），
       所以超过 5 个就把间距从 34 收到 26、图标缩到 0.78 ——
       10 × 26 = 260px，从右往左排不会压到中间的难度文字 */
    this._lifeStep = this.maxLives > 5 ? 26 : 34;
    this._lifeScale = this.maxLives > 5 ? 0.78 : 1;
    this.lifeIcons = [];
    for (let i = 0; i < this.maxLives; i++) {
      const icon = this.add.image(CONFIG.width - 90 - i * this._lifeStep, 44, 'life')
        .setDepth(9000);
      if (this._lifeScale !== 1) icon.setScale(this._lifeScale);
      this.lifeIcons.push(icon);
    }
    this.updateLivesHUD();
  }

  updateLivesHUD() {
    this.lifeIcons.forEach((icon, i) => {
      icon.setTexture(i < this.lives ? 'life' : 'life-off');
    });
  }

  /* 技能栏：一排小圆标，外圈是冷却进度环，持续型技能触发时整圈亮起。
     这里只画被动技能（自动触发的那种），主动技能单独占一个按钮 ——
     同一个技能在屏幕上出现两遍，玩家会以为是两个不同的东西。

     单人局完全保持原样：从 x=46 往右排。
     双人局改成"一人一半"：P1 靠左、P2 靠右，各画各的技能 ——
     技能**不共享**，两个人的冷却进度是分开的，混在一排会分不清谁的好了 */
  buildSkillHUD() {
    this.skillIconY = CONFIG.height - 46;
    this.skillLabels = [];
    this.skillFX = this.add.graphics().setDepth(9001);

    for (let pi = 0; pi < this.players.length; pi++) {
      const P = this.players[pi];
      const right = this.players.length > 1 && pi === 1;
      P.skillIconX = right ? CONFIG.width - 46 : 46;
      P.skillIconStep = right ? -52 : 52;
      P.skillIconY = this.skillIconY;

      for (let i = 0; i < P.hudSkills.length; i++) {
        this.skillLabels.push(this.add.text(
          P.skillIconX + i * P.skillIconStep, CONFIG.height - 20, P.hudSkills[i].name, {
            fontFamily: UI.FONT, fontSize: '11px', color: '#8fa3b8',
          }).setDepth(9000).setOrigin(0.5, 0.5));
      }
    }
  }

  /* 主动技能按钮：右下角一排圆钮，点它或按 J / K 都能开。
     没有主动技能的角色（枪手 / 重装兵 / 游侠 / 炮手）这里什么都不创建。

     为什么是一排而不是一个：死灵法师有两个主动技能（召唤 / 转化），
     做成"一个按钮 + 切换"会把"我现在按的是哪个技能"变得不明确，
     施法期间又刚好不能动，玩家没有余裕去确认当前选中的是哪个。
     一个技能一个钮，键位按顺序分配 J、K，和按钮位置一一对应。
     点按钮不会误触发滑动移动：滑动要位移超过 24px 才算数，点一下不算 */
  buildActiveSkillButton() {
    // P1 的键位是 J / K；P2 是小键盘 1 / 2（需求原文）。
    // 小键盘没法用一个字符表示清楚，用"小1 / 小2"这种最不容易误读的写法
    const KEY_LABELS = [['J', 'K'], ['小1', '小2']];

    for (let pi = 0; pi < this.players.length; pi++) {
      const P = this.players[pi];
      if (!P.activeSkills.length) continue;

      /* 单人局：和以前完全一样 —— 摆在场地下沿之外（场地底边 y=560，
         按钮中心 y=600、半径 36），从右往左排，躲开 y=610 的静音按钮。
         双人局：P1 挪到场地**左侧**中部、P2 留在右侧中部，纵向排列 ——
         底部那一条要留给两个人的被动技能图标和 Buff 文字，塞不下四个圆钮 */
      const multi = this.players.length > 1;
      // 双人时按钮摆在场地下沿之外的**两侧**（场地横向 64~896，两侧留白够放），
      // 纵向排开。边距取 42 而不是 32 —— 按钮半径 34，贴边 32 会让右边缘
      // 溢出画布 2px，描边被裁掉一条
      const y = multi ? 260 : CONFIG.height - 40;
      const gap = multi ? 92 : 92;
      const labels = KEY_LABELS[pi] || KEY_LABELS[0];

      P.activeSkills.forEach((s, i) => {
        let x;
        if (!multi) x = CONFIG.width - 158 - i * gap;      // 右下角，从右往左
        else x = pi === 0 ? 42 : CONFIG.width - 42;        // 两侧贴边
        const by = multi ? y + i * gap : y;
        const keyLabel = labels[i] || labels[0];

        const g = this.add.graphics().setDepth(9000);
        const text = this.add.text(x, by, keyLabel, {
          fontFamily: UI.FONT, fontSize: multi ? '19px' : '24px',
          color: '#ffffff', fontStyle: 'bold',
        }).setDepth(9001).setOrigin(0.5);
        // 名字放按钮上方：按钮本身已经贴着画面底边，放下面会被裁掉
        const label = this.add.text(x, by - (multi ? 42 : 50), '', {
          fontFamily: UI.FONT, fontSize: '12px', color: '#8fa3b8',
        }).setDepth(9000).setOrigin(0.5);

        const hit = this.add.circle(x, by, multi ? 34 : 40, 0x000000, 0)
          .setDepth(9002).setInteractive({ useHandCursor: true });
        // 索引跟着按钮走：点第二个钮开的必须是第二个技能。
        // pIndex 也要一起切 —— 不切的话点 P2 的按钮会去开 P1 的技能
        hit.on('pointerdown', () => {
          SoundSys.unlock();
          this.pIndex = pi;
          this.tryActiveSkill(i);
        });

        P.activeBtns.push({ s, x, y: by, g, text, label, keyLabel, radius: multi ? 30 : 36 });
      });
    }

    this.updateActiveSkillFX();
  }

  /* 主动技能按钮的每帧重绘：次数用尽压暗，持续中亮起并显示剩余秒数。
     和 updateSkillFX 一样每帧重画 Graphics，比维护一堆 Image + Tween 便宜，
     也不会漏销毁。一次遍历把所有按钮都刷一遍 */
  updateActiveSkillFX() {
    // 逐玩家画：次数 / 冷却 / 施法锁定全是**各人自己的**，
    // 共享一份状态的话会出现"P1 施法把 P2 的技能也锁住"
    for (const P of this.players) {
      if (!P.activeBtns || !P.activeBtns.length) continue;

      for (const b of P.activeBtns) {
        const s = b.s, g = b.g, x = b.x, y = b.y;
        const R = b.radius || 36;

        const remain = P.skillActive[s.key] || 0;
        const active = remain > 0;
        const hasCharges = s.charges != null;
        const hasDynCd = !!s.cooldownDynamic;
        const charges = P.skillCharges[s.key] || 0;
        const dynLeft = P.skillCooldownLeft[s.key] || 0;
        const dynTotal = P.skillCooldownTotal[s.key] || 1;
        // 施法锁定是**这位玩家自己的**：他正在施法时，他自己的其它主动技能
        // 也点不动（不统一禁掉的话，玩家能在施法动画里插队开第二个技能），
        // 但另一位玩家的技能照常可用
        const casting = P.castLockMs > 0;

        // 能不能点，三种模式判断方式不同
        const usable = (active || casting) ? false
          : hasCharges ? charges > 0
          : hasDynCd ? dynLeft <= 0
          : true;

        g.clear();
        g.fillStyle(0x0b1520, 0.78);
        g.fillCircle(x, y, R);
        g.lineStyle(3, usable ? s.color : 0x33404f, usable ? 1 : 0.75);
        g.strokeCircle(x, y, R);

        if (active || (hasDynCd && dynLeft > 0)) {
          // 外圈进度弧：持续中画剩余 duration，冷却中画剩余冷却。
          // 两者都用 ratio=1 到 0 表示"快好了"，玩家不用记具体数字
          const ratio = active
            ? Phaser.Math.Clamp(remain / s.duration, 0, 1)
            : Phaser.Math.Clamp(1 - dynLeft / dynTotal, 0, 1);
          g.lineStyle(4, s.color, 1);
          g.beginPath();
          g.arc(x, y, R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
          g.strokePath();
        } else if (hasCharges && s.chargesFromKills && charges < s.charges) {
          // 击杀恢复类技能：外圈画恢复进度。
          // 不画的话玩家不知道"还要杀几个才能再用一次"，
          // 会以为次数用完这个技能就彻底废了
          const ratio = Phaser.Math.Clamp(
            (P.skillKillProgress[s.key] || 0) / s.chargesFromKills, 0, 1);
          g.lineStyle(4, s.color, 0.85);
          g.beginPath();
          g.arc(x, y, R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
          g.strokePath();
        }

        // 大字：可用时是按键提示，持续中显示剩余时长，冷却中显示倒计时，用尽显示叉
        let big;
        if (active) big = (remain / 1000).toFixed(1);
        else if (hasCharges) big = charges > 0 ? b.keyLabel : '×';
        else if (hasDynCd) big = dynLeft > 0 ? (dynLeft / 1000).toFixed(1) : b.keyLabel;
        else big = b.keyLabel;
        if (b.text.text !== big) b.text.setText(big);
        b.text.setColor(active ? '#ffd0b0' : (usable ? '#ffffff' : '#55697d'));

        // 按钮上方的说明。次数用尽且能靠击杀恢复时，换成恢复进度 ——
        // 这时候玩家最关心的是"怎么才能再用一次"，而不是"我没次数了"
        let label;
        if (hasCharges) {
          if (charges <= 0 && s.chargesFromKills) {
            label = s.name + ' 击杀 ' + (P.skillKillProgress[s.key] || 0) + '/' + s.chargesFromKills;
          } else {
            label = s.name + '  ' + charges + ' 次';
          }
        } else if (hasDynCd) {
          label = s.name + '  冷却 ' + (dynTotal / 1000).toFixed(1) + 's';
        } else {
          label = s.name;
        }
        if (b.label.text !== label) b.label.setText(label);
        b.label.setColor(active ? '#ffb08a' : (usable ? '#8fa3b8' : '#55697d'));
      }
    }
  }

  updateCoinText() {
    this.coinText.setText('金币 ' + this.coins);
  }

  buildPauseButton() {
    const btn = this.add.container(CONFIG.width - 40, 40).setDepth(9000);
    const g = this.add.graphics();
    const draw = (hovered) => {
      g.clear();
      g.fillStyle(0x0b1520, hovered ? 0.9 : 0.7);
      g.fillCircle(0, 0, 22);
      g.lineStyle(2, 0x8fa3b8, 0.9);
      g.strokeCircle(0, 0, 22);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-7, -9, 5, 18);
      g.fillRect(2, -9, 5, 18);
    };
    draw(false);
    btn.add(g);

    const hit = this.add.circle(0, 0, 26, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout',  () => draw(false));
    hit.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); this.pauseGame(); });
    btn.add(hit);

    this.pauseBtn = btn;
  }

  toggleMute() {
    const m = !SoundSys.isMuted();
    SoundSys.setMuted(m);
    Storage.writeMute(m);
    this.muteBtn.setText(m ? '音效 关' : '音效 开');
    this.muteBtn.setColor(m ? '#55697d' : '#7fffa0');
  }

  setupInput() {
    /* 键位分工（需求原文）：
         P1 —— WASD 移动，J / K 放主动技能
         P2 —— 方向键移动，小键盘 1 / 2 放主动技能
       单人局为了让老玩家不用改习惯，P1 同时吃 WASD 和方向键两套 ——
       players[0].keys 里塞两个 Key 对象，updatePlayer 一起读，行为与以前一致。
       双人局严格分开：P1 只认 WASD，P2 只认方向键 */
    const kb = this.input.keyboard;
    const wasd = kb.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });
    const cursors = kb.createCursorKeys();
    this.players[0].keys = this.players.length > 1 ? [wasd] : [wasd, cursors];
    if (this.players.length > 1) this.players[1].keys = [cursors];

    kb.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);

    kb.on('keydown', (e) => {
      const t = this.time.now;
      // 斜向按键只保留最后按下的那个轴。这个时间戳是**每玩家**的 ——
      // 双人时两个人各按各的，共用一个时间戳会让"P2 按上"把"P1 按左"顶掉
      const mark = (pi, horiz) => {
        const P = this.players[pi];
        if (!P) return;
        if (horiz) P.lastHorizPress = t; else P.lastVertPress = t;
      };
      // 方向键归谁：双人时是 P2 的移动键，单人时是 P1 的第二套键
      const arrowPi = this.players.length > 1 ? 1 : 0;

      switch (e.code) {
        case 'KeyA': case 'KeyD':
          mark(0, true); break;
        case 'KeyW': case 'KeyS':
          mark(0, false); break;
        case 'ArrowLeft': case 'ArrowRight':
          mark(arrowPi, true); break;
        case 'ArrowUp': case 'ArrowDown':
          mark(arrowPi, false); break;
        case 'KeyR':
          // 重开要把模式带回去，否则肉鸽局一按 R 就变成无限模式
          if (this.state === 'gameover') this.scene.restart(this.modeData());
          break;
        case 'KeyJ':
          // P1 的主动技能：桌面端按 J，手机端点圆钮。
          // 带两个主动技能的角色（死灵法师）第二个走 K 键，
          // 键位顺序和那排按钮的左右顺序一致
          this.pIndex = 0;
          this.tryActiveSkill(0);
          break;
        case 'KeyK':
          this.pIndex = 0;
          this.tryActiveSkill(1);
          break;
        /* P2 的技能键（小键盘 1 / 2）。
           ⚠️ 这两个键在三选一面板下仍然是"选第 1 / 2 张卡"——
           选卡时 state 是 choosing，tryActiveSkill 会直接 return，
           所以按状态分流最干净，不会互相抢键 */
        case 'Numpad1':
          if (this.state === 'choosing') { this.pickBuff(0); break; }
          if (this.players[1]) { this.pIndex = 1; this.tryActiveSkill(0); }
          break;
        case 'Numpad2':
          if (this.state === 'choosing') { this.pickBuff(1); break; }
          if (this.players[1]) { this.pIndex = 1; this.tryActiveSkill(1); }
          break;
        // 三选一的键盘快捷方式。手机端点卡片，桌面端按数字键，
        // 两条路都走同一个 pickBuff，不会出现"点了没反应"的分支
        case 'Digit1':
          if (this.state === 'choosing') this.pickBuff(0);
          break;
        case 'Digit2':
          if (this.state === 'choosing') this.pickBuff(1);
          break;
        case 'Digit3': case 'Numpad3':
          if (this.state === 'choosing') this.pickBuff(2);
          break;
        case 'Space': case 'Enter': case 'Escape':
          if (this.state === 'playing') this.pauseGame();
          else if (this.state === 'paused') this.resumeGame();
          else if (this.state === 'gameover' && e.code !== 'Escape') this.scene.restart(this.modeData());
          break;
      }
    });

    /* 虚拟摇杆（手机上最通用的走法）。
       和上一版的区别：**锚点固定**。旧版是"锚点跟着手指跑"，想持续走就得
       不停搓手指 —— 走两步停一下，手机上很难受。现在按下定锚、手指相对锚点
       偏多少就走哪个方向、松手才停，和主流手游的浮动摇杆一致。
       死区 16px：点一下（比如去点暂停按钮）不会让角色乱走。
       摇杆头/底盘是纯视觉，画在 joystickFX 上，只有触摸输入才显示 ——
       桌面用鼠标拖也会走，但不画圈，免得碍眼。 */
    const DEAD = 16;    // 死区半径
    const FULL = 58;    // 摇杆头能走出的最大半径（纯视觉）
    /* 摇杆**只驱动 P1**。双人模式限定电脑端，本来就用不上；
       单人局手机玩家还得靠它。这里刻意写成 players[0].touchDir 而不是 this.touchDir ——
       this.touchDir 是"当前玩家"的代理，事件回调跑在 update 循环之外，
       pIndex 指向谁是不确定的，写成代理会偶尔把 P1 的手指落到 P2 身上 */
    this.input.on('pointerdown', (p) => {
      if (this.state !== 'playing') return;
      // 按在按钮上（暂停 / 主动技能 / 选卡）不算摇杆 ——
      // 否则按技能键会顺手把角色拖走一下
      if (this.input.hitTestPointer(p).length) return;
      this.touchAnchor = { x: p.x, y: p.y };
      this.touchKnob = { x: p.x, y: p.y };
      this.players[0].touchDir = null;
      this.touchIsTouch = !!p.wasTouch;
    });
    this.input.on('pointermove', (p) => {
      if (!this.touchAnchor || this.state !== 'playing') return;
      const P0 = this.players[0];
      const dx = p.x - this.touchAnchor.x;
      const dy = p.y - this.touchAnchor.y;
      const len = Math.hypot(dx, dy);
      if (len < DEAD) {
        // 回到死区里就停住，而不是保留上一次的方向 ——
        // 玩家把手指收回来时是明确想停
        P0.touchDir = null;
        this.touchKnob = { x: this.touchAnchor.x + dx, y: this.touchAnchor.y + dy };
        return;
      }
      const k = Math.min(1, FULL / len);
      this.touchKnob = { x: this.touchAnchor.x + dx * k, y: this.touchAnchor.y + dy * k };
      P0.touchDir = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? DIRS.right : DIRS.left)
        : (dy > 0 ? DIRS.down : DIRS.up);
    });
    const clearTouch = () => {
      this.touchAnchor = null;
      this.touchKnob = null;
      this.players[0].touchDir = null;
    };
    this.input.on('pointerup', clearTouch);
    this.input.on('pointerupoutside', clearTouch);
    // 切后台 / 转屏时手指会"丢"在屏幕上，回来时摇杆还亮着但没输入了
    this.game.events.on(Phaser.Core.Events.BLUR, clearTouch);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, clearTouch);
    });
  }

  /* 摇杆底盘 + 摇杆头。每帧 clear 重画，但只有按下时才有内容，
     未按下时 clear 一个空 Graphics 几乎不要钱 */
  updateJoystickFX() {
    const g = this.joystickFX;
    if (!this.touchAnchor || !this.touchIsTouch) {
      if (this._joyDrawn) { g.clear(); this._joyDrawn = false; }
      return;
    }
    g.clear();
    this._joyDrawn = true;
    const a = this.touchAnchor, k = this.touchKnob || a;
    const live = !!this.touchDir;

    // 底盘
    g.fillStyle(0x0a1420, 0.3);
    g.fillCircle(a.x, a.y, 54);
    g.lineStyle(2.5, 0x8fd0ff, live ? 0.55 : 0.3);
    g.strokeCircle(a.x, a.y, 54);
    g.lineStyle(1.5, 0xffffff, 0.16);
    g.strokeCircle(a.x, a.y, 40);

    // 方向箭头：只有真的推出去才亮，给"现在朝哪走"一个即时确认
    if (live) {
      const arm = 16;
      const d = this.touchDir;
      const cx = a.x + d.x * 62, cy = a.y + d.y * 62;
      g.fillStyle(0xffe066, 0.85);
      if (d.x !== 0) g.fillTriangle(cx + d.x * arm * 0.5, cy, cx - d.x * arm * 0.4, cy - arm * 0.5, cx - d.x * arm * 0.4, cy + arm * 0.5);
      else g.fillTriangle(cx, cy + d.y * arm * 0.5, cx - arm * 0.5, cy - d.y * arm * 0.4, cx + arm * 0.5, cy - d.y * arm * 0.4);
    }

    // 摇杆头
    g.fillStyle(0x2a6ea6, 0.55);
    g.fillCircle(k.x, k.y, 24);
    g.fillStyle(0xbfe4ff, live ? 0.9 : 0.6);
    g.fillCircle(k.x, k.y, 15);
    g.fillStyle(0xffffff, live ? 0.9 : 0.5);
    g.fillCircle(k.x - 4, k.y - 4, 6);
  }

  setupCollisions() {
    // 回调参数顺序：Phaser 在"组 vs 单个精灵"时会先传精灵，所以下面的形参名是准的
    this.physics.add.overlap(this.playerBullets, this.enemies, this.onBulletHitsEnemy, null, this);

    /* 每个玩家各挂一套"会被打中 / 会吃到道具"的判定。
       回调拿到的第一个参数就是撞上的那个精灵，回调开头用 usePlayer() 反查是哪位 ——
       之后的 this.hurtPlayer() / this.buffs / this.activateBuff() 就都落到正确的玩家身上。
       ⚠️ 必须一人一条，不能只挂 P1：只挂 P1 的话 P2 在场上就是个"打不到的幽灵"，
       玩家会觉得"我被打了但没掉血"（其实是根本没判到） */
    for (const P of this.players) {
      this.physics.add.overlap(this.enemyBullets, P.sprite, this.onBulletHitsPlayer, null, this);
      this.physics.add.overlap(this.enemies, P.sprite, this.onEnemyHitsPlayer, null, this);
      this.physics.add.overlap(this.powerups, P.sprite, this.onPickupPowerup, null, this);
    }

    // ---- 死灵法师的召唤物（三条判定，缺一条召唤物就会变成摆设）----
    // 骷髅的箭打敌人：这是骷髅唯一的输出手段
    this.physics.add.overlap(this.skeletonArrows, this.enemies, this.onArrowHitsEnemy, null, this);
    // 敌人的子弹打骷髅：骷髅只有 1 滴血，中一发就散架
    this.physics.add.overlap(this.enemyBullets, this.skeletons, this.onBulletHitsSkeleton, null, this);
    // 敌人撞骷髅：同归于尽（骷髅死，敌人吃 1 点伤害）
    this.physics.add.overlap(this.enemies, this.skeletons, this.onEnemyHitsSkeleton, null, this);
  }

  setupLifecycle() {
    // game.events 是全局事件总线，不随场景销毁，
    // 所以必须在 SHUTDOWN 时摘掉，否则每次重开都会多留一个监听器
    this._onBlur = () => { if (this.state === 'playing') this.pauseGame(); };
    this.game.events.on(Phaser.Core.Events.BLUR, this._onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this._onBlur);
      // 清掉未触发的慢动作定时器，并把时间缩放归位，
      // 否则下次进入 Game 场景时会带着 0.35 倍速开局
      clearTimeout(this._slowMoTimer);
      this.resetTimeScale();
      // 退出场景时补一次金币落盘（中途是攒 1 秒写一次的）
      this.flushCoins();
    });
  }

  /* ======================= 慢动作 ======================= */

  resetTimeScale() {
    // 场景 shutdown 期间，Phaser 会先回收 time / tweens / physics 这些子系统，
    // 然后才广播 SHUTDOWN 事件。所以在这个回调里不能直接写 timeScale ——
    // 会抛 "Cannot set properties of null"，整个关闭流程崩掉，
    // 表现就是点"返回主菜单 / 重新开始"之后卡死。三个都判一下空就稳了
    if (this.time) this.time.timeScale = 1;
    if (this.tweens) this.tweens.timeScale = 1;
    if (this.physics && this.physics.world) this.physics.world.timeScale = 1;
  }

  triggerSlowMo(ms) {
    // 三个 timeScale 一起调，才能让物理（移动）、补间（动画）、时钟（定时）
    // 同步慢下来，缺一个就会出现"怪慢了但动画还在跑"的割裂感
    const s = CONFIG.slowMoScale;
    this.time.timeScale = s;
    this.tweens.timeScale = s;
    this.physics.world.timeScale = s;

    clearTimeout(this._slowMoTimer);
    // 用原生 setTimeout 恢复，不走 Phaser 时钟 —— 否则它自己也被慢动作拖长
    this._slowMoTimer = setTimeout(() => this.resetTimeScale(), ms);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    // 关键修复：如果在慢动作期间暂停，先取消慢动作，避免恢复时时间跳变
    clearTimeout(this._slowMoTimer);
    this.resetTimeScale();

    this.state = 'paused';
    this.physics.world.pause();
    this.time.paused = true;
    this.pauseBtn.setVisible(false);
    this.flushCoins();   // 暂停往往意味着玩家要走开，这时候落盘最保险
    this.showPauseOverlay();
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.physics.world.resume();
    this.time.paused = false;
    this.pauseBtn.setVisible(true);
    this.hideOverlay();
  }

  clearOverlay() {
    // 先摘补间再销毁：补间若比对象活得久，会在对象销毁后继续写属性
    this.overlay.list.slice().forEach(c => this.tweens.killTweensOf(c));
    this.tweens.killTweensOf(this.overlay);
    this.overlay.removeAll(true);
  }

  showPauseOverlay() {
    this.clearOverlay();

    const W = CONFIG.width, H = CONFIG.height;

    const bg = this.add.graphics();
    bg.fillStyle(0x060b12, 0.55);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x101c2a, 0.35); bg.fillCircle(W/2, H/2 - 30, 480);
    bg.fillStyle(0x16263a, 0.30); bg.fillCircle(W/2, H/2 - 30, 340);
    bg.fillStyle(0x1d304a, 0.28); bg.fillCircle(W/2, H/2 - 30, 220);

    const blocker = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0);
    blocker.setInteractive();

    this.overlay.add(bg);
    this.overlay.add(blocker);

    const title = this.add.text(W/2, 120, '暂 停', {
      fontFamily: UI.FONT, fontSize: '52px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 6, '#000000', 12, true, true);
    this.overlay.add(title);

    const sub = this.add.text(W/2, 168, 'P A U S E', {
      fontFamily: UI.MONO, fontSize: '15px', color: '#8fa3b8', letterSpacing: 8,
    }).setOrigin(0.5);
    this.overlay.add(sub);

    const cx = W / 2, cy = H / 2 - 10;
    const bigBtn = this.add.container(cx, cy);
    const g = this.add.graphics();
    const drawBig = (hovered) => {
      g.clear();
      g.fillStyle(0x000000, 0.35);
      g.fillCircle(4, 6, 68);
      g.fillStyle(hovered ? 0x5fa8f0 : 0x4a90d9, 1);
      g.fillCircle(0, 0, 66);
      g.lineStyle(5, 0xffffff, 0.9);
      g.strokeCircle(0, 0, 66);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(-16, -26, -16, 26, 26, 0);
    };
    drawBig(false);
    bigBtn.add(g);

    const bigHit = this.add.circle(0, 0, 78, 0x000000, 0).setInteractive({ useHandCursor: true });
    bigHit.on('pointerover', () => drawBig(true));
    bigHit.on('pointerout',  () => drawBig(false));
    bigHit.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); this.resumeGame(); });
    bigBtn.add(bigHit);
    this.overlay.add(bigBtn);

    const contText = this.add.text(cx, cy + 104, '继 续 游 戏', {
      fontFamily: UI.FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlay.add(contText);

    const tipText = this.add.text(cx, cy + 134, '空格 / Esc 也可继续', {
      fontFamily: UI.FONT, fontSize: '14px', color: '#8fa3b8',
    }).setOrigin(0.5);
    this.overlay.add(tipText);


    this.overlay.add(UI.makeButton(this, cx - 150, H - 80, 240, 68, '重 新 开 始', 0x3a5230, 0x577346, () => {
      this.time.paused = false;
      this.physics.world.resume();
      this.state = 'playing';
      this.scene.restart(this.modeData());
    }));
    this.overlay.add(UI.makeButton(this, cx + 150, H - 80, 240, 68, '返 回 主 菜 单', 0x5d452a, 0x8b6a3f, () => {
      this.time.paused = false;
      this.physics.world.resume();
      this.state = 'playing';
      this.scene.start('Menu');
    }));

    this.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 180 });
  }

  update(time, delta) {
    if (this.state !== 'playing') return;

    // 标签页切回来时 delta 可能是几秒，钳一下防止物理瞬间穿模
    const dms = Math.min(delta, 50);
    this.elapsed += dms;

    if (this.difficultyLevel < CONFIG.maxDifficulty && this.elapsed >= this.nextLevelAt) {
      this.difficultyLevel++;
      const d = this.difficultyLevel;
      // 肉鸽模式下越后面的图爬得越快：衰减系数随图序号再加 0.02。
      // 第 1 张图每级间隔 20 秒起衰减，第 3 张图衰减快 1.8 倍 ——
      // 这就是"越往后的图，难度随时间的上涨幅度越大"
      const decay = CONFIG.diffIntervalDecay
        + (this.rogueMode ? ROGUE.diffDecayPerMap * this.rogue.map : 0);
      const interval = Math.max(
        CONFIG.diffIntervalMin,
        CONFIG.diffIntervalBase * Math.exp(-d * decay)
      );
      this.nextLevelAt = this.elapsed + interval;
      SoundSys.levelup();
      this.showDifficultyToast(this.difficultyLevel + 1);
    }

    const dp = this.getDiffParams();

    /* ---- 每个玩家各跑一遍"自己的那一份" ----
       玩家相关的这几个 update 逐人循环，场景级的（敌人 / 子弹 / 天气 / BOSS）
       只跑一次。顺序和拆分前一致：玩家 → 敌人 → 子弹。
       ⚠️ pIndex 必须在这里显式设置 —— 所有每玩家字段的代理都靠它定位，
       不设置的话两个人会共用同一套 buff / 开火计时 / 无敌帧 */
    for (let i = 0; i < this.players.length; i++) {
      this.pIndex = i;
      this.updatePlayer(dms);
      this.updateBuffs(dms);
      this.updateSkills(dms);
    }
    this.pIndex = 0;

    this.updateEnemies(dms, dp);
    this.updateBullets(dms);
    this.updateSpawning(dms, dp);
    this.updateDepth();
    this.updateCombo(dms);
    this.updateLowHpFX();
    this.updateDangerFX();
    this.updatePressureFX(dp);
    this.updateShieldFX();
    this.updateJoystickFX();
    this.updatePowerupRing();
    // 冲击波列表是每玩家的，但画在同一张 Graphics 上，
    // 所以只调一次、内部遍历所有人（见 updateShockwaves）
    this.updateShockwaves(dms);
    // 死灵法师的召唤物和亡灵。放在 updateEnemies 之后 ——
    // 亡灵的目标选择要读这一帧敌人刚算好的位置，反过来会慢一帧、看着像在追影子
    this.updateSkeletons(dms);
    this.updateUndeads(dms);
    this.updateSkillFX();
    this.updateHeartbeat(dms);

    // 肉鸽：BOSS 状态机 / 伤玩家的冲击波 / 砍影 / 阶段推进。
    // 放在最后是因为它们可能改 state（弹出三选一）——
    // 放前面的话后面那几个 updateXxx 还会拿旧状态多跑一帧

    this.updateWeather(dms);
    this.updateWeatherFX(dms);
    this.updateThunderBolts(dms);

    this.updateBossShocks(dms);
    this.updateBossSlash(dms);
    // 巫妖王的落雷和小巫妖。放在 updateBoss 之前 ——
    // updateBoss 可能改 state（弹出三选一 / 结算），放后面的话
    // 这三件事会拿旧状态多跑一帧
    this.updateLichBolts(dms);
    this.updateLichMinions(dms);
    this.updateBoss(dms);
    this.updateRogue(dms);

    if (this.rogueMode) {
      this.updateRogueHUD();
    } else {
      const lv = this.difficultyLabel(this.difficultyLevel);
      if (lv !== this._lastLevelText) {
        this._lastLevelText = lv;
        this.levelText.setText(lv);
      }
    }
  }

  /* 难度显示统一走这里，避免 HUD 和结算页各写一套导致不一致 */
  difficultyLabel(level) {
    return level >= CONFIG.maxDifficulty ? '难度 MAX' : '难度 ' + (level + 1);
  }

  updatePlayer(dms) {
    const p = this.player;

    // 施法锁定倒计时。放在 body 检查之前 —— 玩家在施法期间被打死时
    // body 会被禁用，倒计时跟着停的话，复活之后还会被锁住一段时间
    if (this.castLockMs > 0) this.castLockMs = Math.max(0, this.castLockMs - dms);

    if (!p.body.enable) return;

    // 施法锁定：死灵法师放专属技能期间完全不能动。
    // 必须在读输入之前拦下 —— 否则玩家按着方向键时角色还会滑一小段，
    // "释放技能时无法移动"这个承诺就破了。
    // 无敌帧由 triggerSkill 一次性给足，不在这里管
    if (this.castLockMs > 0) {
      p.body.setVelocity(0, 0);
      this.updatePlayerVisual(dms, false);
      this.playerShadow.setPosition(p.x, p.y + this.shadowDY);
      return;
    }

    // 冲锋期间完全接管：位移和贴图都走另一条路径，提前 return。
    // 跳过"斜向按键处理"和"格子吸附"是必须的 —— 冲锋是一条直线，
    // 中途被吸附到格子中线会走成锯齿状
    if (this.skillActive.charge > 0) {
      this.updateCharge(dms);
      this.updatePlayerVisual(dms, true);
      this.playerShadow.setPosition(p.x, p.y + this.shadowDY);
      return;
    }

    // 移动输入：读这个玩家**自己的**键位组（见 setupInput）。
    // 单人局 P1 同时吃 WASD 和方向键，双人局 P1 只认 WASD、P2 只认方向键。
    // 同一轴上有多个键按下时后读的覆盖前面的，与拆分前"方向键优先"的行为一致
    let ix = 0, iy = 0;
    const keys = this.P.keys;
    for (let ki = 0; ki < keys.length; ki++) {
      const k = keys[ki];
      if (k.left.isDown) ix = -1;
      if (k.right.isDown) ix = 1;
      if (k.up.isDown) iy = -1;
      if (k.down.isDown) iy = 1;
    }

    // 摇杆只驱动 P1（见 setupInput）。P2 的 touchDir 恒为 null，这一条不会误触发
    if (this.touchDir) { ix = this.touchDir.x; iy = this.touchDir.y; }

    // 斜向按键只保留最后按下的那个轴，避免斜着走导致对不齐网格
    if (ix !== 0 && iy !== 0) {
      if (this.lastHorizPress >= this.lastVertPress) iy = 0;
      else ix = 0;
    }

    // 移速 = 基础 × 角色修正 × 「疾风步」加成 × 肉鸽增幅，全程实时算，技能结束自动落回原速
    let weatherMul = 1;
    if (this.weather.current === 'snow') weatherMul *= CONFIG.snowSpeedMul;
    const puddle = this.weather.puddles.find(pd => Phaser.Math.Distance.Between(pd.x, pd.y, this.player.x, this.player.y) < pd.r + 17);
    if (puddle) {
       if (puddle.type === 'puddle') weatherMul *= CONFIG.puddleSpeedMul;
       else if (puddle.type === 'ditch' && (!this._ditchCooldown || this._ditchCooldown <= 0)) {
           this._ditchCooldown = CONFIG.ditchCooldown;
           this.hurtPlayer();
       }
    }
    if (this._ditchCooldown > 0) this._ditchCooldown -= dms;

    const speed = CONFIG.playerSpeed * this.charDef.speedMul
      * (this.skillActive.swiftstep > 0 ? 1.7 : 1)
      * this.mods.moveMul
      * weatherMul;
    const snapK = CONFIG.playerSnapStrength;
    const snapMax = CONFIG.playerSnapSpeed;
    let vx = 0, vy = 0;

    if (ix !== 0) {
      vx = ix * speed;
      // 横向移动时把纵向缓慢吸附到最近的格子中线
      vy = Phaser.Math.Clamp((Utils.nearestRowCenter(p.y) - p.y) * snapK, -snapMax, snapMax);
      p.facing = ix < 0 ? 'left' : 'right';
    } else if (iy !== 0) {
      vy = iy * speed;
      vx = Phaser.Math.Clamp((Utils.nearestColCenter(p.x) - p.x) * snapK, -snapMax, snapMax);
      p.facing = iy < 0 ? 'up' : 'down';
    }
    p.body.setVelocity(vx, vy);

    this.updatePlayerVisual(dms, ix !== 0 || iy !== 0);
    this.playerShadow.setPosition(p.x, p.y + this.shadowDY);

    // 射速 = 武器基础间隔 × 角色修正；连射道具和「火力全开」各再打一次对折。
    // 三个系数是相乘不是相加，叠满时也不会出现零间隔的无限射速
    const w = this.weaponDef;
    let fireInterval = w.interval * this.charDef.fireIntervalMul * this.mods.intervalMul;
    // 连射道具：每层射速 ×0.5，叠 3 层就是 ×0.125（8 倍射速）。
    // 用 Math.pow 而不是循环乘，层数改了不用动这段代码。
    // 和技能 / 卡牌是相乘的：三系同时拉满也不会出现"零间隔无限射速"，
    // 因为末尾有 Math.max(60, ...) 保底
    if (this.buffs.rapidStacks > 0) {
      fireInterval *= Math.pow(0.5, this.buffs.rapidStacks);
    }
    if (this.skillActive.overdrive > 0) fireInterval *= 0.5;
    if (this.skillActive.darkform > 0) fireInterval *= 0.5;
    fireInterval = Math.max(60, fireInterval);    

    this.fireAccum += dms;
    if (this.fireAccum >= fireInterval) {
      this.fireAccum -= fireInterval;

      const v = DIRS[p.facing];
      this.fireVolley();

      // 开火反馈三件套：枪口闪光 + 音效 + 后坐力微震。
      // 闪光点往前挪到 24px，落在角色轮廓之外，否则会被自己挡住看不见
      this.muzzleFlash.emitParticleAt(p.x + v.x * 24, p.y + v.y * 24, 1);
      SoundSys.shoot();
      this.recoilKick();
    }
  }

  /* 玩家贴图有两个来源：图集角色（巫女）走动画，程序化角色走单帧换图。
     动作优先级：受伤 > 形态 > 施法 > 跑步 / 攻击。
     跑步和攻击是互斥的，而且移动优先：这游戏一直在自动开火，
     要是让开火压过移动，跑步动画就永远看不到了。
     同一段动画不能重复 play —— 每帧重调会把播放头按回第 0 帧，动画看着就像卡死了 */
  updatePlayerVisual(dms, moving) {
    const p = this.player;

    // 堕天形态期间给全身打一层暖色。放在最前面，程序化角色也能享受到这个反馈。
    // ⚠️ 收尾要回到"这个玩家自己的基础色"而不是 clearTint() ——
    // P2 身上那层浅蓝染色是常驻的，clearTint() 会把它一起洗掉，
    // 表现是"P2 一开堕天形态就变回和 P1 一样的颜色"
    const tinted = this.skillActive.darkform > 0;
    if (tinted !== this._darkTinted) {
      this._darkTinted = tinted;
      if (tinted) p.setTint(0xffb080); else p.setTint(this.P.tint);
    }

    const runSheet = this.charDef.sheet ? charRunSheet(this.charDef) : null;
    const sheetOk = !!runSheet && this.textures.exists(runSheet);
    if (!sheetOk) {
      this.hidePlayerOverlay();
      const tex = 'player-' + this.charDef.key + '-' + p.facing;
      if (p.texture.key !== tex) p.setTexture(tex);
      return;
    }

    if (this.playerHurtMs > 0) this.playerHurtMs = Math.max(0, this.playerHurtMs - dms);

    // ---- 动作优先级：受伤 > 施法姿态 > 冲锋 > 移动 / 攻击 ----
    // 前三条都要把叠加层藏起来 —— 叠加层的语义是"攻击的上半身 + 走路的下半身"，
    // 施法 / 冲锋 / 受伤时下半身不该还在迈步

    if (this.playerHurtMs > 0) {
      this.hidePlayerOverlay();
      this.playPlayerAnim('hurt');
      return;
    }

    // 施法姿态：抬手 / 结印 / 砸地那一下。这段时间玩家不能动
    // （castLockMs 在 updatePlayer 里拦截输入），所以姿态可以独占画面。
    // 播哪个动作由技能定义里的 castAct 决定，castFrames 限制播到第几帧
    if (this.castLockMs > 0) {
      this.hidePlayerOverlay();
      this.skillAnimTick(dms, this.castAct, this.castFrames);
      return;
    }

    // 冲锋：位移期间姿态由 charge 接管。这套图集的帧序是倒的，reverse 见 CHAR_ANIMS
    if (this.skillActive.charge > 0) {
      this.hidePlayerOverlay();
      this.skillAnimTick(dms, 'atk3');
      return;
    }

    // 技能【生效期】的形态保持：逆反结界 / 堕天形态生效期间，主精灵定在
    // 一张形态帧上（每个方向一帧），移动时叠走路的下半身。
    // 和"边攻击边移动"是同一套叠加层，所以"保持形态"和"能移动、能开火"
    // 同时成立 —— 开火走 fireVolley，和贴图无关。
    // 位置必须在 castLockMs 之后：施法姿态期优先播完整动作
    // （比如堕天形态那 7 帧变身），播完再切到形态帧，两个阶段自然衔接
    const form = this.activeFormSheet();
    if (form) {
      this.playFormFrame(form);
      this.updatePlayerOverlay(moving);
      return;
    }

    // ⚠️ 走到这里说明"既没受伤，也没在施法姿态里，也没有要保的形态"。
    // 技能【生效期】以前是掉到下面这条正常路径上的 —— 能移动能开火，
    // 但形态帧也就永远出不来。现在生效期由上面的形态分支接管
    // （同样能移动能开火，只是贴图换成形态帧）。
    // 判断"在不在施法"只认 castLockMs，不认 skillActive。
    // 曾经把 skillActive.darkform > 0 写在这个位置，结果是 8 秒里角色
    // 一直定格在施法姿态上，既不能正常攻击也不能正常移动（用户 2026-09-16 的反馈）。

    // 没有叠加层图集的角色（程序化角色 / 图集没加载成功）走原来的逻辑：
    // 移动优先播跑步，站定播攻击。行为完全不变
    if (!this.playerOverlay) {
      this.playPlayerAnim(moving ? 'run' : 'atk1');
      return;
    }

    // 有叠加层：底图固定播攻击动画（上半身），叠加层负责走路的下半身。
    // 两个动画各自独立循环、互不干扰 —— 这就是"边攻击边移动"的实现方式
    this.playPlayerAnim('atk1');
    this.updatePlayerOverlay(moving);
  }

  /* 播放一段循环动画。key 和当前一致时直接跳过 ——
     每帧重调 play() 会把播放头按回第 0 帧，动画看着就像卡死了 */
  playPlayerAnim(act) {
    const p = this.player;
    const key = this.charDef.sheet + '-' + act + '-' + p.facing;
    if (!this.anims.exists(key)) return;
    if (this.playerAnimKey === key) return;
    this.playerAnimKey = key;
    p.anims.play(key, true);
  }

  /* 当前正在生效的技能形态图集（生效期要保持的那一帧），没有就返回 null。
     刻意每帧去读 skillActive 的剩余时间，而不是在 triggerSkill 里记一个状态：
     技能到期自动归零，不需要额外的清理路径，也不会漏清。
     注意这里不用闭包/箭头函数 —— 它在 updatePlayerVisual 里每帧都会走到，
     每帧新建一个函数对象就是白送的 GC 抖动（见 perf 清单） */
  activeFormSheet() {
    // 零开销短路：只有巫女的两个技能配了 formSheet，其他角色到这就返回，
    // 不必去翻技能表
    if (!(this.skillActive.darkform > 0) && !(this.skillActive.ward > 0)) return null;
    // 两个形态同时生效时按固定优先级取一个（堕天在上）—— 同时触发很罕见，
    // 但真发生时要有一个确定的结果，不能每帧随机换一张
    return this.formSheetOf('darkform') || this.formSheetOf('ward');
  }

  /* 某个技能的形态图能不能用：技能配了 formSheet、正在生效、图集也真的加载了。
     图集缺失就返回 null 退回正常动画路径 ——
     不能因为丢了一张图让人物变成空白/碎片 */
  formSheetOf(key) {
    const s = SKILLS[key];
    if (!s || !s.formSheet) return null;
    if (!(this.skillActive[key] > 0)) return null;
    return this.hasSheet(s.formSheet, 4) ? s.formSheet : null;
  }

  /* 形态帧：主精灵定在该方向的那一帧上。
     形态图集是"1 列 × 4 行"，所以帧号就等于行号。
     和 skillAnimTick 同一套手法 —— 先 pause 动画系统再 setTexture，
     否则动画系统下一帧会把贴图覆盖回去（原因见 skillAnimTick 的注释） */
  playFormFrame(file) {
    const p = this.player;
    const row = DIR_ROW[p.facing] || 0;
    const marker = file + '#form' + row;
    if (this.playerAnimKey === marker) return;
    this.playerAnimKey = marker;
    if (p.anims.isPlaying) p.anims.pause();
    p.setTexture(file, row);
  }

  /* 技能施法动画的手动帧播放器：按这张图集自己的帧率往前走，走到头就定格。
     为什么不用 Phaser 的 anims 系统：anims.stop() 会把 currentFrame 重置回
     第 0 帧，和随后的 setTexture 打架（停止和贴图切换在同一个 tick 里，
     下一帧动画系统还会抢着覆盖一次）；pause() 的行为又取决于动画是否已经播完，
     时序很微妙。手动算帧号 + setTexture 是唯一可控的做法。

     正播还是倒播由 CHAR_ANIMS 里的 reverse 决定，调用方不用管 ——
     图集作者把"完成态"画在了哪一头，是素材本身的性质，不是技能的性质。

     maxFrames：只播前 N 帧就定格。用来把"变身爆发"截在恶魔形态之前 ——
     堕天形态的 atk3 后三帧是蹲伏的恶魔姿态，没有站立动作，
     一旦保持住，角色移动时看起来像在地上滑行（见 SKILLS.darkform 的注释）。 */
  skillAnimTick(dms, act, maxFrames) {
    const p = this.player;
    const anims = CHAR_ANIMS[this.charDef.sheet];
    const def = anims ? anims[act] : null;
    if (!def) return;

    if (this.skillAnimMs == null) this.skillAnimMs = 0;
    // 帧计时乘一个倍率：让动画慢下来。这个 dms 是 update 里的真实 delta，
    // 不受 Phaser 的 time.timeScale 影响，所以必须在这里手动降速，
    // 不能指望全屏慢动作顺带把动画也拖慢。
    // 倍率优先级：技能级 castAnimMul > 角色级 skillAnimMul > 全局默认。
    // 技能级是后加的：堕天形态要完整播 7 帧变身，用角色默认的 0.75
    // 只要 0.33 秒就闪完了，玩家根本看不清动作（用户 2026-09-16 的要求）。
    // 倍率可以按角色覆盖：死灵法师的施法动作有 12 帧，
    // 沿用默认的 0.4 会拖到 3.3 秒，而他的技能 duration 只有 1.1~1.6 秒 ——
    // 动画还没播完技能就结束了，玩家只看到半截动作
    const mul = (this.castAnimMul > 0) ? this.castAnimMul
      : ((this.charDef.skillAnimMul != null)
        ? this.charDef.skillAnimMul : CONFIG.skillAnimSpeedMul);
    this.skillAnimMs += dms * mul;

    // 时间 → 正向帧号（0 = 动画刚开始，frames-1 = 动画走完）。
    // 封顶到 frames - 1：走到最后一帧就停住，后面的时间再长也不会越过这一行
    const frameDur = 1000 / def.rate;
    const total = def.frames;
    // 只播前 N 帧时，帧号封顶在 N-1。N 缺省或越界就按整段算
    const cap = (maxFrames > 0) ? Math.min(maxFrames, total) : total;
    const forward = Math.min(cap - 1, Math.floor(this.skillAnimMs / frameDur));
    // 逆向时翻转：正向 0 → 最右（frames-1），正向 frames-1 → 最左（0）
    const idx = def.reverse ? total - 1 - forward : forward;

    // 四个方向在图集里各占一行，行号固定是 下 / 上 / 左 / 右（见 DIR_ROW）
    const row = DIR_ROW[p.facing] || 0;
    const frame = row * total + idx;
    const marker = def.file + '#' + frame;

    if (this.playerAnimKey === marker) return;
    this.playerAnimKey = marker;

    // 暂停（而不是停止）anims：pause 保留 currentFrame，只停住播放头，
    // 后面的 setTexture 不会被动画系统的下一帧自动覆盖回去
    if (p.anims.isPlaying) p.anims.pause();
    p.setTexture(def.file, frame);
  }

  /* 按当前武器打出一次齐射。子弹的伤害和穿透次数挂在子弹对象上，
     命中逻辑只认子弹上的值，不用回头去查玩家装了什么 */
  fireVolley() {
    const p = this.player;
    const w = this.weaponDef;
    const v = DIRS[p.facing];
    const baseA = Math.atan2(v.y, v.x);

    // 肉鸽增幅：伤害走乘区、穿透走加区。
    // 伤害是"先加后乘"—— 重型弹的 +1 属于弹种修正，增幅属于全局乘区，
    // 顺序反过来会让重型弹吃不到增幅，玩家会觉得那张卡白拿了
    const m = this.mods;
    const damage = Math.max(1, Math.round(
      (w.damage + (this.skillActive.heavyround > 0 ? 1 : 0)) * m.dmgMul));
    // 武器的 explosive 字段直接透传：鞭炮的子弹就带 explosive，
    // 命中时按 AOE 结算；其余武器是 null，走原来的单体逻辑
    // raiseChance 同理透传：亡灵弹带着它，命中时掷骰子策反敌人
    // 天赋【火药】【猛药】（矮人）：鞭炮爆炸范围和伤害提升
    let explosive = w.explosive || null;
    if (explosive) {
      let radius = explosive.radius;
      let dmg = explosive.damage;
      if (this.hasTalent('powder')) radius *= 1.1;
      if (this.hasTalent('bigblast')) dmg += 1;
      explosive = { radius, damage: dmg, fx: explosive.fx };
    }
    const opts = {
      damage, pierce: w.pierce + m.pierceAdd,
      explosive,
      raise: w.raiseChance || 0,
      raiseMs: w.raiseMs || 0,
      // 这一发是谁打的。命中时 onBulletHitsEnemy 靠它把"当前玩家"切回去 ——
      // 暴击率 / 亡者烙印 / 积分加成 / 血祭回血全是**按玩家各算各的**，
      // 不记来源的话两个人的增幅会串在一起
      owner: this.pIndex,
    };
    // 弹型跟武器走：火弹是橙色火球，其余武器用普通黄弹
    let bulletTex = w.tex || 'bullet-p';
    // 天赋【凤凰烈焰】：10% 概率变成火凤凰（穿透）
    const isPhoenix = this.hasTalent('phoenix') && bulletTex === 'bullet-fire' && Math.random() < 0.1;
    if (isPhoenix) {
      bulletTex = 'bullet-fire'; // 依然用火弹贴图
    }
    // 天赋【浴血奋战】（勇者）：每损失 1 点生命，+12% 概率射出双剑气
    let isBloodRage = false;
    if (this.hasTalent('bloodrage') && bulletTex === 'bullet-slash') {
      const lostLives = Math.max(0, this.maxLives - this.lives);
      const chance = Math.min(0.36, lostLives * 0.12);
      isBloodRage = Math.random() < chance;
    }
    // 天赋【剑芒】（勇者）：剑气尺寸 +20%
    const slashScale = (this.hasTalent('swordsize') && bulletTex === 'bullet-slash') ? 1.2 : 1;
    // ---- 弹道分布 ----
    // 这里做两件事：先算"这次齐射的基础方向"，再把它们按各种加成扩展开。
    // 各种加成之间是乘法关系：散弹的 3 发 × 三连发道具的 N 层 × 三叉戟的 +2 条。
    // 顺序很关键：先做"方向"再做"加成"，否则加成会被后面的 if/else 覆盖，
    // 表现为"装了三发枪再吃三连发就没效果了"

    // 基础方向：武器的固有弹道（单发 / 散弹 / 堕天形态的三向）
    const baseOffsets = [];
    if (this.skillActive.darkform > 0) {
      baseOffsets.push(-0.30, 0, 0.30);
    } else if (w.pattern === 'spread') {
      const s = Phaser.Math.DegToRad(w.spread);
      baseOffsets.push(-s, 0, s);
    } else {
      // 单发武器有散布时给一个随机偏角：连发枪靠它换"近强远弱"，
      // 近距离散布还没拉开，远距离就打不准了
      const jitter = w.spread > 0
        ? Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-w.spread, w.spread))
        : 0;
      baseOffsets.push(jitter);
    }

    // 三连发道具：每个基础方向复制成 N 发（N = 1 + 层数），
    // 相邻两发之间错开一点点角度，不然它们会完全重合、看不出多发。
    // 这样"散弹枪 + 1 层"就是 3 个方向各 2 发 = 6 发，
    // 而不是像旧版那样把散弹的 3 发覆盖成 3 发
    const tripleMul = 1 + this.buffs.tripleStacks;
    const perShot = 0.05;    // 同一方向内两发之间的角度步长（弧度，约 2.9°）
    const offsets = [];
    for (const off of baseOffsets) {
      for (let i = 0; i < tripleMul; i++) {
        // 以 base 为中心均匀分布：1 发在正中，2 发在 ±step/2，3 发在 -step/0/+step
        const j = i - (tripleMul - 1) / 2;
        offsets.push(off + j * perShot);
      }
    }

    // 「三叉戟」：再加两条对称的斜向弹道。和上面是加法关系 ——
    // 散弹枪拿到它应该是 3 + 2 发，不是覆盖成 2 发
    for (let i = 0; i < m.multiShot; i++) {
      const sp = 0.20 * (i + 1);
      offsets.push(-sp, sp);
    }

    const speed = w.speed * m.bspeedMul;

    for (const off of offsets) {
      const a = baseA + off;
      // 如果是火凤凰，让它穿透，并且变大一点作为视觉区分
      const finalOpts = isPhoenix ? { ...opts, pierce: 99 } : opts;
      const b = this.fireBullet(this.playerBullets,
        p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20,
        Math.cos(a) * speed, Math.sin(a) * speed, bulletTex, finalOpts);
      if (isPhoenix && b) {
        b.setScale(1.6).setTint(0xffaa00); // 变大变亮
      }
      // 天赋【剑芒】：剑气尺寸 +20%
      if (b && slashScale !== 1) b.setScale(slashScale);
    }

    // 天赋【浴血奋战】：额外射出第二道剑气（略带角度偏移）
    if (isBloodRage) {
      const a2 = baseA + (Math.random() - 0.5) * 0.35;
      const b2 = this.fireBullet(this.playerBullets,
        p.x + Math.cos(a2) * 20, p.y + Math.sin(a2) * 20,
        Math.cos(a2) * speed, Math.sin(a2) * speed, bulletTex, opts);
      if (b2 && slashScale !== 1) b2.setScale(slashScale);
      this.popText(p.x, p.y - 40, '双剑气！', '#ff9a6a');
    }
  }

  /* 开火后坐力：极轻的镜头抖。只在没有更强的抖动（击杀 / 受击 / 死亡）在跑时才触发，
     否则每一发都会把上一击杀的冲击感顶掉 */
  recoilKick() {
    const now = performance.now();
    if (now < this._shakeUntil) return;
    this.cameras.main.shake(CONFIG.recoilShakeMs, CONFIG.recoilShakeIntensity);
    this._shakeUntil = now + CONFIG.recoilShakeMs;
  }

  /* 统一镜头抖动入口。priority=true 是"事件级"抖动（击杀 / 受击 / 死亡 / 道具），
     会把结束时间记下来，用来压住开火那种"周期级"的弱抖动 */
  shakeScreen(ms, intensity, priority) {
    const now = performance.now();
    if (!priority && now < this._shakeUntil) return;
    if (priority) this._shakeUntil = now + ms;
    this.cameras.main.shake(ms, intensity);
  }

  updateEnemies(dms, dp) {
    const m = CONFIG.enemyWrapMargin;

    this.enemies.children.each((e) => {
      if (!e.active || e.spawning) return;
      // BOSS 也在 enemies 组里（这样子弹 / 爆炸 / 冲击波的命中判定全都白捡），
      // 但它的移动、开火、阴影全部由 updateBoss 那套状态机接管，
      // 不能走小怪这套"绕场循环 + 按方向开火"
      if (e.isBoss) return;

      // 巫妖王召唤的小巫妖也在 enemies 组里，但它的移动 / 开火 / 寿命
      // 全部由 updateLichMinions 接管（朝玩家漂 + 追踪射击）。
      // 不跳过的话它会被"绕场循环"传送到场地对面，还会用普通小怪那套
      // 四方向弹幕开火 —— 用户明确要的是"只发射小月牙波，追踪玩家"
      if (e.isMinion) return;

      // 亡灵：移动和攻击由 updateUndeads 单独接管（追踪最近的敌人 + 同归于尽）。
      // 这里只帮它维护投影，其余全部跳过 ——
      // 不跳过的话它会被"绕场循环"传送到场地对面，还会朝玩家开火
      if (e.undead) {
        if (e.shadow) {
          e.shadow.setVisible(true).setPosition(e.x, e.y + e.shadowOffsetY).setAlpha(1);
        }
        return;
      }

      // 走出场地就从对面滑进来，形成循环
      if (e.dir.x > 0 && e.x > BOARD.x + BOARD.w + m) {
        this.placeEnemy(e, BOARD.x - m, Utils.rowCenter(e.row));
      } else if (e.dir.x < 0 && e.x < BOARD.x - m) {
        this.placeEnemy(e, BOARD.x + BOARD.w + m, Utils.rowCenter(e.row));
      } else if (e.dir.y > 0 && e.y > BOARD.y + BOARD.h + m) {
        this.placeEnemy(e, Utils.colCenter(e.col), BOARD.y - m);
      } else if (e.dir.y < 0 && e.y < BOARD.y - m) {
        this.placeEnemy(e, Utils.colCenter(e.col), BOARD.y + BOARD.h + m);
      }

      // 冰霜弹的减速计时：归零时把速度还回去并褪掉蓝色染色
      if (e.slowTimer > 0) {
        e.slowTimer -= dms;
        if (e.slowTimer <= 0) {
          e.slowTimer = 0;
          if (e.active) e.clearTint();
        }
      }

      // 天气与地形效果
      let weatherMul = 1;
      if (this.weather.current === 'snow') weatherMul *= CONFIG.snowSpeedMul;
      const puddle = this.weather.puddles.find(pd => Phaser.Math.Distance.Between(pd.x, pd.y, e.x, e.y) < pd.r + e.displayWidth * 0.3);
      if (puddle) {
          if (puddle.type === 'puddle') weatherMul *= CONFIG.puddleSpeedMul;
          else if (puddle.type === 'ditch') {
              if (!e._ditchCd || e._ditchCd <= 0) {
                  e._ditchCd = CONFIG.ditchCooldown;
                  this.damageEnemy(e, CONFIG.ditchDamage);
              }
          }
      }
      if (e._ditchCd > 0) e._ditchCd -= dms;
      e.weatherMul = weatherMul;
      this.applyEnemyVelocity(e);

      // 只在场地内开火，避免场地外的敌人隔着边界偷袭
      if (Utils.insideBoard(e.x, e.y, 4) && e.fireInterval !== Infinity) {
        e.fireAccum += dms;
        if (e.fireAccum >= e.fireInterval) {
          e.fireAccum -= e.fireInterval;
          this.enemyFire(e);
        }
      }

      // 出入场时按越界距离淡入淡出
      const outDist = Math.max(
        0, BOARD.x - e.x, e.x - (BOARD.x + BOARD.w),
        BOARD.y - e.y, e.y - (BOARD.y + BOARD.h)
      );
      e.setAlpha(Phaser.Math.Clamp(1 - outDist / CONFIG.enemyWrapMargin, 0, 1));

      if (e.shadow) {
        // 图集自带投影的兵种（步兵）在 spawnEnemy 里已把 shadowVisible 置 false
        const vis = e.shadowVisible && Utils.insideBoard(e.x, e.y, 0) && e.alpha > 0.05;
        e.shadow.setVisible(vis);
        if (vis) {
          e.shadow.setPosition(e.x, e.y + e.shadowOffsetY).setAlpha(e.alpha);
        }
      }
    });
  }

  placeEnemy(e, x, y) {
    e.body.reset(x, y);
    e.setPosition(x, y);
    this.applyEnemyVelocity(e);
  }

  /* 敌人速度的唯一出口：所有改速度的地方都走这里，
     否则"减速结束后速度没还回来"或"绕场一圈后减速失效"这类漏洞迟早会漏一个 */
  applyEnemyVelocity(e) {
    const mul = (e.slowTimer > 0 ? 0.55 : 1) * (e.weatherMul || 1);
    e.setVelocity(e.dir.x * e.speed * mul, e.dir.y * e.speed * mul);
  }

  enemyFire(e) {
    const mode = e.typeDef ? e.typeDef.fire : 'single';
    if (mode === 'none') return;

    const speed = CONFIG.enemyBulletSpeed;
    const muzzle = 22;
    // 三个特殊兵打月牙弹：形状 + 颜色都和普通兵的圆弹拉开，
    // 玩家不用看敌人本体就能判断"这发是特殊兵打的"
    const bulletKey = (e.typeDef && e.typeDef.crescent) ? 'bullet-e-crescent' : 'bullet-e';

    if (mode === 'spread') {
      const base = Math.atan2(e.dir.y, e.dir.x);
      const spread = Phaser.Math.DegToRad(22);
      for (let i = -1; i <= 1; i++) {
        const a = base + i * spread;
        this.fireBullet(this.enemyBullets,
          e.x + Math.cos(a) * muzzle, e.y + Math.sin(a) * muzzle,
          Math.cos(a) * speed, Math.sin(a) * speed, bulletKey);
      }
    } else if (mode === 'aimed') {
      // 瞄准开火瞬间玩家的位置，不预判走位，留出躲避空间。
      // 双人时打**最近的那位** —— 固定打 P1 的话，P2 可以站在旁边白嫖输出
      const tp = this.targetPlayer(e.x, e.y) || this.player;
      const a = Math.atan2(tp.y - e.y, tp.x - e.x);
      this.fireBullet(this.enemyBullets,
        e.x + Math.cos(a) * muzzle, e.y + Math.sin(a) * muzzle,
        Math.cos(a) * speed, Math.sin(a) * speed, bulletKey);
    } else {
      const v = e.dir;
      this.fireBullet(this.enemyBullets,
        e.x + v.x * muzzle, e.y + v.y * muzzle,
        v.x * speed, v.y * speed, bulletKey);
    }

    SoundSys.enemyShoot();
  }

  updateSpawning(dms, dp) {
    // 肉鸽模式：只有"小怪阶段"才刷怪。BOSS 阶段停止补给，
    // 场上的清完就是清完了 —— 否则 BOSS 战里会一直有杂兵从边上冒出来，
    // 玩家的注意力会被拖走，"打 BOSS"这件事就不成立了
    if (this.rogueMode && this.rogue.phase !== 'wave') {
      this.spawnAccum = 0;
      return;
    }

    // 一次刷怪波次要分几个 delayedCall 错开落点，期间用 isSpawning 挡住下一波。
    // 万一某个 delayedCall 因异常没跑到（时间被暂停等），看门狗负责解锁，
    // 否则刷怪会永久停摆 —— 这是比多刷几只怪严重得多的故障。
    if (this.isSpawning) {
      this._spawnWatchdog += dms;
      if (this._spawnWatchdog > 3000) {
        this.isSpawning = false;
        this._spawnWatchdog = 0;
      }
      // 卡住期间也照常累积，解锁后不必再等一整个间隔
      this.spawnAccum = Math.min(this.spawnAccum + dms, dp.spawnInterval * 2);
      return;
    }
    this._spawnWatchdog = 0;

    this.spawnAccum += dms;
    if (this.spawnAccum < dp.spawnInterval) return;

    this.spawnAccum -= dp.spawnInterval;

    const dirCount = Phaser.Math.Between(dp.spawnBurstMin, dp.spawnBurstMax);
    const sides = Phaser.Utils.Array.Shuffle(['top', 'bottom', 'left', 'right']).slice(0, dirCount);
    if (sides.length === 0) return;

    this.isSpawning = true;

    sides.forEach((side, index) => {
      this.time.delayedCall(index * 200, () => {
        try {
          if (this.state === 'playing' && this.enemies.countActive(true) < dp.maxEnemies) {
            this.spawnEnemy(dp, side);
          }
        } catch (err) {
          console.warn('spawnEnemy 出错（已忽略）:', err);
        } finally {
          if (index === sides.length - 1) this.isSpawning = false;
        }
      });
    });
  }

  /* 在指定边上按"离玩家越远权重越高"的分布挑一个格子。
     双人模式下传进来的是两个玩家的格子，取"离**最近那个**玩家的距离" ——
     只躲 P1 的话，怪会直接刷在 P2 脸上 */
  getWeightedEdgeCoord(side, cols, rows) {
    const minDist = CONFIG.spawnMinDist;
    const pow = CONFIG.spawnBiasPow;
    const candidates = [];
    const distTo = (c, r) => {
      let best = Infinity;
      for (let i = 0; i < cols.length; i++) {
        const d = Math.hypot(c - cols[i], r - rows[i]);
        if (d < best) best = d;
      }
      return best;
    };

    if (side === 'top' || side === 'bottom') {
      const r = side === 'top' ? 0 : CONFIG.rows - 1;
      for (let c = 0; c < CONFIG.cols; c++) {
        const d = distTo(c, r);
        if (d >= minDist) candidates.push({ col: c, row: r, d });
      }
    } else {
      const c = side === 'left' ? 0 : CONFIG.cols - 1;
      for (let r = 0; r < CONFIG.rows; r++) {
        const d = distTo(c, r);
        if (d >= minDist) candidates.push({ col: c, row: r, d });
      }
    }

    if (candidates.length === 0) {
      if (side === 'top')    return { col: Math.floor(CONFIG.cols / 2), row: 0 };
      if (side === 'bottom') return { col: Math.floor(CONFIG.cols / 2), row: CONFIG.rows - 1 };
      if (side === 'left')   return { col: 0, row: Math.floor(CONFIG.rows / 2) };
      return { col: CONFIG.cols - 1, row: Math.floor(CONFIG.rows / 2) };
    }

    let total = 0;
    for (const c of candidates) {
      c.w = 1 / Math.pow(c.d + 1, pow);
      total += c.w;
    }
    let rand = Math.random() * total;
    for (const c of candidates) {
      rand -= c.w;
      if (rand <= 0) return { col: c.col, row: c.row };
    }
    const last = candidates[candidates.length - 1];
    return { col: last.col, row: last.row };
  }

  pickEnemyType() {
    const specialBonus = Math.min(SPECIAL_BONUS_MAX, 1 + this.difficultyLevel * 0.04);

    // 保底：连续 3 次没出步兵就强制刷一个，避免场上全是特殊兵
    if (this._noInfantryStreak >= 3) {
      this._noInfantryStreak = 0;
      return ENEMY_TYPES.infantry;
    }

    const weights = [];
    let total = 0;
    for (const r of ENEMY_ROLLS) {
      const def = ENEMY_TYPES[r.key];
      const w = def.isSpecial ? r.w * specialBonus : r.w;
      weights.push({ key: r.key, w });
      total += w;
    }

    let x = Math.random() * total;
    for (const r of weights) {
      x -= r.w;
      if (x <= 0) {
        const def = ENEMY_TYPES[r.key];
        this._noInfantryStreak = def.isSpecial ? this._noInfantryStreak + 1 : 0;
        return def;
      }
    }
    this._noInfantryStreak = 0;
    return ENEMY_TYPES.infantry;
  }

  spawnEnemy(dp, side) {
    // 刷怪波次是分几个 delayedCall 错开落点的，最长的那个要等 600ms。
    // 这期间阶段可能已经切到 BOSS，所以这里必须再挡一次 ——
    // 只在 updateSpawning 里挡，会漏掉"已经排进队列"的那几只
    if (this.rogueMode && this.rogue.phase !== 'wave') return;

    // 出生点要躲开**所有**玩家（双人时只躲 P1，怪会直接刷在 P2 脸上）
    const cells = this.playerCells();
    const { col, row } = this.getWeightedEdgeCoord(side, cells.cols, cells.rows);

    let dir;
    if (side === 'top')         dir = DIRS.down;
    else if (side === 'bottom') dir = DIRS.up;
    else if (side === 'left')   dir = DIRS.right;
    else                        dir = DIRS.left;

    const typeDef = this.pickEnemyType();
    const x = Utils.colCenter(col);
    const y = Utils.rowCenter(row);

    // 该兵种配了图集、且图集确实加载成功，才走图集渲染，否则退回程序化纹理
    const sheet = (typeDef.sheet && this.sheetReady[typeDef.sheet]) ? typeDef.sheet : null;
    const texKey = sheet || ('enemy-' + typeDef.key + '-' + dir.name);

    const e = this.enemies.get(x, y, texKey);
    if (!e) return;
    e.setTexture(texKey);

    if (sheet) {
      e.play(sheet + '-walk-' + dir.name, true);
    } else if (e.anims && e.anims.isPlaying) {
      e.stop();
    }

    e.setActive(true).setVisible(true);
    e.body.enable = false;
    e.body.reset(x, y);
    e.setPosition(x, y);

    // 图集是 64×64 帧，程序化纹理是 48×48 帧，物理偏移的基准不同。
    // 缩放和物理半径允许按兵种覆盖：三个特殊兵比普通兵大一截，
    // 全都套 1.4 会让它们看起来和步兵一样小，"铁甲"两个字就白写了
    const baseScale = sheet
      ? (typeDef.sheetScale != null ? typeDef.sheetScale : CONFIG.sheetScale)
      : 1;
    const r = sheet
      ? (typeDef.sheetBodyRadius != null ? typeDef.sheetBodyRadius : CONFIG.sheetBodyRadius)
      : typeDef.radius;
    const offset = (sheet ? 32 : 24) - r;
    e.body.setCircle(r, offset, offset);

    e.typeDef = typeDef;
    e.useSheet = !!sheet;
    e.baseScale = baseScale;
    e.maxHp = typeDef.hp;
    e.hp = typeDef.hp;
    e.speed = dp.enemySpeed * typeDef.speedMul;
    e.fireInterval = typeDef.fireIntervalMul > 0
      ? dp.enemyFireInterval * typeDef.fireIntervalMul
      : Infinity;

    e.row = row;
    e.col = col;
    e.dir = dir;
    e.fireAccum = Phaser.Math.Between(0, 400);
    e.slowTimer = 0;   // 池化复用，减速状态必须跟着重置
    e.spawning = true;
    e.clearTint();

    // 投影：图集自带投影的兵种（步兵）要藏掉程序化阴影，否则是双影；
    // 其余用缩小的程序化阴影 —— 图集角色本体只有 24px 宽，原尺寸阴影比它还大
    e.shadowVisible = !typeDef.sheetShadow;
    // 阴影的落点和大小也得跟着兵种走：不同图集角色在帧内的站位不一样，
    // 共用同一个偏移会让大个子踩着影子、或者整个人悬在半空
    e.shadowOffsetY = sheet
      ? (typeDef.sheetShadowOffsetY != null ? typeDef.sheetShadowOffsetY : CONFIG.sheetShadowOffsetY)
      : 15;
    e.shadowScale = sheet
      ? (typeDef.sheetShadowScale != null ? typeDef.sheetShadowScale : CONFIG.sheetShadowScale)
      : typeDef.radius / 17;
    if (!e.shadow) e.shadow = this.add.image(x, y + e.shadowOffsetY, 'shadow').setDepth(1);
    e.shadow.setVisible(e.shadowVisible)
      .setPosition(x, y + e.shadowOffsetY)
      .setScale(e.shadowScale);

    e.setAlpha(1);
    e.setScale(0);
    this.tweens.add({
      targets: e, scale: baseScale, duration: CONFIG.spawnAnimMs, ease: 'Back.easeOut',
      onComplete: () => {
        if (!e.active) return;
        e.spawning = false;
        e.body.enable = true;
        this.applyEnemyVelocity(e);
      },
    });
  }

  recycleEnemy(e) {
    this.tweens.killTweensOf(e);
    if (e.shadow) e.shadow.setVisible(false);
    if (e.anims && e.anims.isPlaying) e.stop();
    e.setActive(false).setVisible(false);
    e.setAlpha(1);
    e.setScale(1);
    e.clearTint();
    e.spawning = false;
    e.slowTimer = 0;
    e.useSheet = false;
    e.shadowVisible = false;
    e.baseScale = 1;
    e.typeDef = null;
    e.hp = 0;
    e.maxHp = 0;
    e.fireInterval = Infinity;
    // BOSS 也在这个池子里，回收时必须把它用过的东西一起还原：
    // isBoss 不清掉，下一次从池里捞出来的小怪会被 updateEnemies 当成 boss 跳过；
    // origin 不清掉，boss 的"锚在脚底"会跟着到小怪身上，小怪会浮到半空
    e.isBoss = false;
    e.setOrigin(0.5, 0.5);
    // 亡灵状态也要一起还原，理由和 isBoss 完全一样：
    // undead 不清掉，下一次从池里捞出来的普通敌人会被当成友军 ——
    // 它不再伤害玩家、也不再被玩家打死，等于场上凭空多出一只无敌怪。
    // setAngle 是亡灵摆头留下的角度，不清掉新敌人会歪着出场
    e.undead = false;
    e.undeadMs = 0;
    e.undeadTick = 0;
    // 小巫妖标记同理。不清掉的话，下一次从池里捞出来的普通敌人会被
    // updateEnemies 当成召唤物跳过 —— 它不绕场、不开火，就杵在原地，
    // 而且 onEnemyHitsPlayer 里也跳过它，等于场上凭空多出一只撞不死的木头
    e.isMinion = false;
    e.minionLifeMs = 0;
    e.minionBobMs = 0;
    e.minionSeed = 0;
    e.mx = 0;
    e.my = 0;
    e.setAngle(0);
    if (e.body) { e.body.stop(); e.body.enable = false; }
  }

  killBullet(b) {
    b.setActive(false).setVisible(false);
    if (b.body) { b.body.stop(); b.body.enable = false; }
  }

  fireBullet(group, x, y, vx, vy, key, opts) {
    let b = group.get(x, y, key);
    if (!b) {
      // 池子打满时回收最早的一颗复用。直接返回 null 会让子弹静默消失，
      // 敌人"突然不开火"却查不出原因，比丢一颗子弹更难排查
      const oldest = group.getFirstAlive();
      if (oldest) this.killBullet(oldest);
      b = group.get(x, y, key);
    }
    if (!b) return null;

    // group.get 只在"新建对象"时才认 key，从池里捞出来的老对象会保留上一发的贴图
    // （Phaser 文档原话：Unless a new member is created, key, frame, and visible are
    // ignored）。火弹和普通弹共用玩家弹池，不显式换一次就会打出上一把枪的弹型。
    // 对于图集类贴图（item-dynamite / item-dynamite-pack 都是 3×3 的图集），
    // 必须显式传帧号 0，否则 Sprite 会退回 __BASE 帧、显示成整张图
    if (b.texture.key !== key) {
      const tex = this.textures.get(key);
      if (tex && tex.frameTotal > 1) b.setTexture(key, 0);
      else b.setTexture(key);
    }

    // 图集弹的帧比程序化弹大一倍（32 vs 16），缩放跟着弹型走。
    // 先定缩放再算物理体：下面的帧宽是从 displayWidth 反推的
    const look = BULLET_LOOK[key];
    const s = look ? look.scale : 1;
    b.setScale(s);

    // 物理体偏移必须按"这一帧的宽度"重算。池子里混着 16×16 的程序化弹和
    // 32×32 的图集弹，写死 offset=3 会让鞭炮的判定圈整体偏左 8 px，
    // 表现为"看着炸到了却没伤害"。这里不做 isCircle 短路 —— 从池里捞出来的
    // 老对象会带着上一种弹型的偏移继续用。
    // 半径要传 pr/s：setCircle 的半径会被精灵缩放再乘一次
    // （Phaser Body.updateFromGameObject：halfWidth = floor(radius * scaleX)），
    // 直接传 pr 会让缩到 0.7 倍的鞭炮判定圈跟着一起缩水。
    // 帧宽走 displayWidth / scale 反推（displayWidth = scaleX × 帧原始宽），
    // 而不是直接读 frame.realWidth —— 前者是 GameObject 的标准属性，
    // 不依赖 Textures.Frame 的内部字段名，换 Phaser 小版本也不会失效
    const fw = b.displayWidth / s;
    const pr = 5;                          // 屏幕上的判定半径，两种弹型保持一致
    const r = pr / s;
    b.body.setCircle(r, fw / 2 - r, fw / 2 - r);
    b.setActive(true).setVisible(true);
    b.body.enable = true;
    b.trailTimer = 0;
    b.grazed = false;   // 池化复用，擦弹标记必须跟着一起重置
    // 月牙弹、剑气、鞭炮、炸药都跟着飞行方向转；圆弹必须归零，
    // 否则复用时会带着上一发的角度。
    // 鞭炮的素材本身是斜着画的（引线朝右上），补掉这 45° 才能让它头朝哪飞哪
    const spin = (key === 'bullet-e-crescent' || key === 'bullet-slash'
                  || key === 'item-dynamite' || key === 'item-dynamite-pack'
                  || key === 'bullet-arrow');
    b.setRotation(spin ? Math.atan2(vy, vx) + (look ? look.angleOffset : 0) : 0);
    // 伤害和穿透次数挂在子弹上：命中逻辑只认子弹自己的值，
    // 不用回头去查"玩家现在装的是什么武器"
    b.damage = (opts && opts.damage) || 1;
    b.pierce = (opts && opts.pierce) || 0;
    /* 这一发是谁打出去的（0 = P1 / 1 = P2）。
       命中时 onBulletHitsEnemy 用它把"当前玩家"切回打枪的那位 ——
       暴击率 / 亡者烙印 / 积分加成 / 血祭回血全是按玩家各算各的，
       不记来源的话两个人的增幅会串在一起。
       ⚠️ 池化复用必须每次都重置：漏了的话，P2 打出的一发会把这个标记
       留给后面从池里捞出来的每一颗子弹 */
    b.ownerP = (opts && opts.owner != null) ? opts.owner : 0;
    // 爆炸标记：命中时按这个参数触发一次 AOE，然后再决定是不是只打单体。
    // 没传就是 null，走原来的单体命中路径
    b.explosive = (opts && opts.explosive) || null;
    // 策反标记（死灵法师的亡灵弹）：命中时按这个概率把敌人变成亡灵。
    // 和 explosive 一样是"挂在子弹上"的标记，命中逻辑只读子弹自己的值，
    // 不用回头查玩家装的是什么武器。
    // ⚠️ 池化复用必须每次都重置 —— 漏了的话，用亡灵弹打出的标记会留在子弹上，
    // 换回手枪之后每一发都还在策反
    b.raiseChance = (opts && opts.raise) || 0;
    b.raiseMs = (opts && opts.raiseMs) || 0;
    b._bounced = false; // 天赋【弹射炸药】（矮人）用的反弹标记
    if (b.pierce > 0) {
      if (!b.hitList) b.hitList = [];
      b.hitList.length = 0;   // 池化复用，命中名单必须清空，否则上一发的记录会挡住这一发
    }
    b.body.reset(x, y);
    b.setVelocity(vx, vy);
    b.setDepth(7000);
    // 火弹 / 剑气是"能量体"，加法混合让它们自发光；鞭炮和炸药是实体道具，
    // 用 ADD 会变成半透明，压在深色草地上像一团糊掉的亮斑
    b.setBlendMode(look ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
    return b;
  }

  updateBullets(dms) {
    const m = 8;

    // 一趟遍历同时做拖尾和越界回收，别分两次 each
    this.playerBullets.children.each((b) => {
      if (!b.active) return;
      b.trailTimer += dms;
      if (b.trailTimer >= 50) {
        b.trailTimer -= 50;
        this.bulletTrail.emitParticleAt(b.x, b.y, 1);
      }
      // 天赋【弹射炸药】（矮人）：炸药碰墙反弹一次
      if (!Utils.insideBoard(b.x, b.y, m)) {
        if (this.hasTalent('bouncebomb') && b.texture.key === 'item-dynamite-pack' && !b._bounced) {
          b._bounced = true;
          const vx = b.body.velocity.x, vy = b.body.velocity.y;
          // 先算出反向速度、先把位置夹回场内
          let newVx = vx, newVy = vy;
          if (b.x < BOARD.x + m || b.x > BOARD.x + BOARD.w - m) {
            newVx = -vx;
          } else {
            newVy = -vy;
          }
          const newX = Phaser.Math.Clamp(b.x, BOARD.x + m, BOARD.x + BOARD.w - m);
          const newY = Phaser.Math.Clamp(b.y, BOARD.y + m, BOARD.y + BOARD.h - m);
          // ⚠️ body.reset 会**清空速度**，所以必须 reset 之后再 setVelocity。
          // 顺序反了的话炸药会原地不动 —— 之前"敌人经过也不爆"就是这个原因。
          b.body.reset(newX, newY);
          b.setVelocity(newVx, newVy);
          return;
        }
        this.killBullet(b);
      }
    });

    this.enemyBullets.children.each((b) => {
      if (!b.active) return;
      if (!Utils.insideBoard(b.x, b.y, m)) { this.killBullet(b); return; }

      // 擦弹：敌弹擦身而过时给一声很轻的"嗖"，作为危险预警。
      // 每颗子弹只响一次（grazed 标记），再用全局冷却压住密集弹幕下的连响，
      // 否则满屏子弹时会变成一片噪音
      // 擦弹：对**每个**活着的玩家各判一次 ——
      // 只判 P1 的话，P2 贴脸躲弹时不会响那声"嗖"，两个人收到的危险预警不对等
      if (b.grazed) return;
      const gr = CONFIG.grazeRadius;
      let near = false;
      for (const P of this.players) {
        const sp = P.sprite;
        if (!sp || !sp.visible) continue;
        const dx = b.x - sp.x, dy = b.y - sp.y;
        if (dx * dx + dy * dy < gr * gr) { near = true; break; }
      }
      if (!near) return;

      b.grazed = true;
      const now = performance.now();
      if (now < this._grazeReady) return;
      this._grazeReady = now + CONFIG.grazeCooldownMs;
      SoundSys.graze();
    });

    // 骷髅的箭。单独一趟遍历 —— 它的池子既不是 playerBullets 也不是
    // enemyBullets，漏掉这一趟的话射空的箭会一直 active 着飞出场地外，
    // 永远不回收（表现为池子被"幽灵箭"占满，后面的箭要靠挤掉最早的才射得出来）。
    // 不给它加拖尾：箭是实体道具，和鞭炮一样用 NORMAL 混合，
    // 拖尾粒子会变成一串糊在箭后面的光点
    this.skeletonArrows.children.each((b) => {
      if (!b.active) return;
      if (!Utils.insideBoard(b.x, b.y, m)) this.killBullet(b);
    });
  }

  updateDepth() {
    // 按 y 排序做伪 2.5D 遮挡关系。每个玩家各排各的 ——
    // 两个人的 y 不同，谁挡住谁也要各自算
    for (let pi = 0; pi < this.players.length; pi++) {
      this.pIndex = pi;
      const p = this.player;
      if (p.visible) p.setDepth(p.y);
      // 叠加层的位置 / 深度 / 透明度都跟着主精灵走，见 syncPlayerOverlay
      this.syncPlayerOverlay();
    }
    this.pIndex = 0;
    this.enemies.children.each(e => { if (e.active) e.setDepth(e.y); });
    // 骷髅也必须排进来。它不在 enemies 组里（是独立的对象池），
    // 不排的话 depth 会一直停在创建时的 0 —— 比敌人阴影(1)还低，
    // 骷髅会从敌人脚底下穿过去，看着像贴在地上的一张纸
    if (this.skeletons) {
      this.skeletons.children.each(k => {
        if (!k.active) return;
        k.setDepth(k.y);
        this.syncSkelOverlay(k);
      });
    }
  }

  getComboMultiplier() {
    return Math.min(
      CONFIG.comboMaxMult,
      1 + Math.floor(this.comboCount / CONFIG.comboStep) * 0.5
    );
  }

  registerKill() {
    this.comboCount++;
    this.comboTimer = CONFIG.comboTimeout;
    this.updateComboHUD();
  }

  updateCombo(dms) {
    if (this.comboCount <= 0) return;
    this.comboTimer -= dms;
    if (this.comboTimer <= 0) {
      this.comboCount = 0;
      this.comboTimer = 0;
      SoundSys.comboBreak();
      this.updateComboHUD();
      return;
    }
    if (this.comboBar) {
      this.comboBar.scaleX = Math.max(0, this.comboTimer / CONFIG.comboTimeout);
    }
  }

  updateComboHUD() {
    if (this.comboCount < 2) {
      this.comboContainer.setVisible(false);
      return;
    }
    this.comboContainer.setVisible(true);
    const mult = this.getComboMultiplier();
    this.comboText.setText('连击 ×' + this.comboCount + '   ' + mult.toFixed(1) + 'x');
    this.comboBar.scaleX = 1;
  }

  showScorePopup(x, y, gain, mult, isSpecial) {
    const label = mult > 1 ? '+' + gain + '  ×' + mult.toFixed(1) : '+' + gain;

    const t = this.add.text(x, y, label, {
      fontFamily: UI.MONO,
      fontSize: isSpecial ? '17px' : '15px',
      color: isSpecial ? '#ffc93a' : '#ffe066',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(8950);

    t.setScale(0.5);
    this.tweens.add({ targets: t, scale: 1, duration: 130, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t, y: y - 50, alpha: 0, delay: 180, duration: 700, ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  showDifficultyToast(level) {
    const t = this.add.text(CONFIG.width / 2, CONFIG.height / 2 - 90, '难度 ' + level, {
      fontFamily: UI.FONT, fontSize: '54px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9050);
    t.setShadow(0, 6, '#000000', 14, true, true);
    t.setScale(1.5);

    this.tweens.add({
      targets: t, scale: 1,
      alpha: { from: 1, to: 0 },
      duration: 900, ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  flashHit() {
    // 红给"痛"、白给"亮"：红闪更浓、退得更快，白闪稍缓，
    // 两层错开衰减，比单层白闪更有"被揍了一下"的分量
    this.tweens.killTweensOf(this.flashRed);
    this.flashRed.setAlpha(0.45);
    this.tweens.add({
      targets: this.flashRed, alpha: 0, duration: 170, ease: 'Quad.easeOut',
    });

    this.tweens.killTweensOf(this.flashWhite);
    this.flashWhite.setAlpha(0.65);
    this.tweens.add({
      targets: this.flashWhite, alpha: 0, duration: 220, ease: 'Quad.easeOut',
    });
  }

  updateLowHpFX() {
    if (this.lives === 1 && this.state === 'playing') {
      const t = (Math.sin(this.elapsed / 350) + 1) / 2;
      this.redVignette.setAlpha(0.12 + t * 0.20);
    } else {
      this.redVignette.setAlpha(0);
    }
  }

  /* 危险预警：最近的敌人越近，画面四周渗进来的红光越浓。
     只在贴到 dangerRadius 以内才开始亮，且用平方衰减 —— 线性衰减会让敌人
     还在半屏外就有红光，玩家会误判距离 */
  updateDangerFX() {
    if (this.state !== 'playing') {
      this.dangerGlow.setAlpha(0);
      return;
    }

    // 取"所有玩家各自最近敌人的距离"里最小的那个 ——
    // 只算 P1 的话，P2 被贴脸时屏幕四周不泛红，两个人收到的预警不对等
    let nearest = Infinity;
    let anyAlive = false;
    this.enemies.children.each((e) => {
      if (!e.active || e.spawning) return;
      for (const P of this.players) {
        const sp = P.sprite;
        if (!sp || !sp.visible) continue;
        anyAlive = true;
        const d = Math.hypot(e.x - sp.x, e.y - sp.y);
        if (d < nearest) nearest = d;
      }
    });
    if (!anyAlive) { this.dangerGlow.setAlpha(0); return; }

    const R = CONFIG.dangerRadius;
    let t = nearest < R ? 1 - nearest / R : 0;
    t *= t;
    this.dangerGlow.setAlpha(t * CONFIG.dangerMaxAlpha);
  }

  /* 压力暗角：同屏敌人越接近当前难度的上限，四周压得越暗，把注意力收拢到战场中心 */
  updatePressureFX(dp) {
    const t = Phaser.Math.Clamp(
      this.enemies.countActive(true) / Math.max(1, dp.maxEnemies), 0, 1);
    this.pressureVignette.setAlpha(t * CONFIG.pressureMaxAlpha);
  }

  /* 玩家身上的护盾光环：每帧重绘，随呼吸脉动 */
  updateShieldFX() {
    const g = this.shieldFX;
    g.clear();
    if (this.state !== 'playing') return;

    // 护盾是 Buff，**不共享** —— 完全可能只有其中一个人有，
    // 所以每个玩家各画一圈自己的
    const t = this.elapsed / 1000;
    const pulse = 1 + Math.sin(t * 6) * 0.08;   // 呼吸

    for (const P of this.players) {
      if (!P.buffs.shield) continue;
      const sp = P.sprite;
      if (!sp || !sp.visible || !sp.body.enable) continue;

      const cx = sp.x, cy = sp.y;
      const r = 26 * pulse;

      // 外圈柔光
      g.lineStyle(6, 0x7fffa0, 0.22);
      g.strokeCircle(cx, cy, r + 3);
      // 主环
      g.lineStyle(2.5, 0x7fffa0, 0.9);
      g.strokeCircle(cx, cy, r);
      // 内环
      g.lineStyle(1.5, 0xffffff, 0.55);
      g.strokeCircle(cx, cy, r - 4);
      // 环绕的 3 个小点，随相位旋转
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + i * (Math.PI * 2 / 3);
        g.fillStyle(0xaaffcc, 0.95);
        g.fillCircle(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5), 2.5);
      }
    }
  }

  /* 道具外圈的倒计时环：颜色从绿→黄→红 */
  updatePowerupRing() {
    const g = this.powerupRing;
    g.clear();
    if (this.state !== 'playing') return;

    this.powerups.children.each((p) => {
      if (!p.active) return;
      if (!p.lifeTimer) return;   // 已回收 / 无计时器的道具跳过

      const remain = Math.max(0, p.lifeTimer.getRemaining());
      const ratio = Math.min(1, remain / (p.lifeMax || CONFIG.powerupLifetime));

      // 颜色：绿(1) → 黄(0.5) → 红(0)
      let color;
      if (ratio > 0.5) {
        const t = (ratio - 0.5) / 0.5;          // 0..1
        const rC = Math.floor(255 * (1 - t));
        color = (rC << 16) | (255 << 8) | 0x44; // 黄→绿
      } else {
        const t = ratio / 0.5;                  // 0..1
        const gC = Math.floor(255 * t);
        color = (255 << 16) | (gC << 8) | 0x44; // 红→黄
      }

      // 底环（暗），保证进度弧在任何背景下都清晰
      g.lineStyle(4, 0x000000, 0.35);
      g.strokeCircle(p.x, p.y, 22);

      // 进度弧：从 12 点方向顺时针
      g.lineStyle(3.5, color, 0.95);
      g.beginPath();
      g.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
      g.strokePath();
    });
  }

  tryDropPowerup(x, y, isSpecial) {
    /* 双人局：同屏上限 3 → 6、概率 ×1.5（见 TWO_PLAYER）。
       两个人抢三个道具的话，"各自吃各自的"这件事根本体现不出来 */
    const multi = this.players.length > 1;
    const cap = multi ? TWO_PLAYER.maxPowerups : 3;
    if (this.powerups.countActive(true) >= cap) return;

    const base = isSpecial ? 0.22 : 0.08;
    // 磁力手套：掉率翻倍，直接乘在概率上，不额外加一套掉落逻辑。
    // ⚠️ 它是**谁击杀谁算**的（pIndex 已由子弹的 ownerP 切好）——
    // P2 装了磁力手套，P1 杀怪是不加掉率的
    let chance = this.hasSkill('magnet') ? base * 2 : base;
    if (multi) chance *= TWO_PLAYER.dropChanceMul;
    if (Math.random() > chance) return;
    this.spawnPowerup(x, y);
  }

  spawnPowerup(x, y) {
    const picked = Utils.weightedPick(POWERUP_ROLLS);

    const p = this.powerups.get(x, y, 'powerup-' + picked);
    if (!p) return;
    p.setTexture('powerup-' + picked);
    p.setActive(true).setVisible(true);
    p.body.enable = true;
    p.body.reset(x, y);
    p.setDepth(7500);
    p.powerupKey = picked;
    p.setAlpha(1).setScale(1);

    this.tweens.killTweensOf(p);
    this.tweens.add({
      targets: p, scale: { from: 0.85, to: 1.15 },
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // 池子会复用同一个对象，所以回收时必须把这个定时器摘掉，
    // 否则旧的 10 秒定时器会把后来复用该对象的新道具提前清掉。
    // lifeMax 也挂在道具上，倒计时环按它算比例，磁力手套延长后环才不会算错
    p.lifeMax = CONFIG.powerupLifetime * (this.hasSkill('magnet') ? 1.5 : 1);
    p.lifeTimer = this.time.delayedCall(p.lifeMax, () => {
      p.lifeTimer = null;
      if (!p.active) return;
      this.recyclePowerup(p);
    });
  }

  recyclePowerup(p) {
    if (p.lifeTimer) { p.lifeTimer.remove(false); p.lifeTimer = null; }
    this.tweens.killTweensOf(p);
    p.setActive(false).setVisible(false);
    p.setAlpha(1).setScale(1);
    if (p.body) { p.body.stop(); p.body.enable = false; }
  }

  onPickupPowerup(player, p) {
    if (!p.active) return;
    // 谁吃到算谁的 —— 这是"不共享 Buff"的核心：同一个道具被 P2 抢到，
    // 只有 P2 拿到连射 / 三连发 / 护盾，P1 一点都分不到
    this.usePlayer(player);
    const key = p.powerupKey;
    this.recyclePowerup(p);
    this.activateBuff(key);
    SoundSys.pickup();
    this.burstKill.explode(10, player.x, player.y);
  }

  activateBuff(key) {
    if (key === 'rapid') {
      // 层数 +1（封顶），时间重置到满。
      // 到顶之后继续吃也还有意义（续时长），但不会变成"无限叠"
      this.buffs.rapidStacks = Math.min(
        CONFIG.rapidMaxStack, this.buffs.rapidStacks + 1);
      this.buffs.rapidMs = CONFIG.rapidMs;
    } else if (key === 'triple') {
      this.buffs.tripleStacks = Math.min(
        CONFIG.tripleMaxStack, this.buffs.tripleStacks + 1);
      this.buffs.tripleMs = CONFIG.tripleMs;
    } else if (key === 'shield') {
      this.buffs.shield = true;
    } else if (key === 'clear') {
      // 清屏：每个敌人给一半分，不计连击、不触发掉落
      this.enemies.children.each((e) => {
        if (!e.active || e.spawning) return;
        this.score += e.typeDef ? Math.floor(e.typeDef.score / 2) : 5;
        this.burstKill.explode(12, e.x, e.y);
        this.recycleEnemy(e);
      });
      this.scoreText.setText(String(this.score));
      this.shakeScreen(260, 0.012, true);
      this.flashWhite.setAlpha(0.4);
      this.tweens.killTweensOf(this.flashWhite);
      this.tweens.add({ targets: this.flashWhite, alpha: 0, duration: 320 });
    }
    this.updateBuffText();
  }

  updateBuffs(dms) {
    // 时间到就把层数一起清零，不要只清 Ms ——
    // 只清 Ms 的话下一层到点前 Stacks 还挂着，射速/弹道数会一直生效
    if (this.buffs.rapidMs > 0) {
      this.buffs.rapidMs = Math.max(0, this.buffs.rapidMs - dms);
      if (this.buffs.rapidMs <= 0) this.buffs.rapidStacks = 0;
    }
    if (this.buffs.tripleMs > 0) {
      this.buffs.tripleMs = Math.max(0, this.buffs.tripleMs - dms);
      if (this.buffs.tripleMs <= 0) this.buffs.tripleStacks = 0;
    }
    this.updateBuffText();
  }

  updateBuffText() {
    // 每帧都会被调用，但显示内容只在"整秒数变化"时才变。
    // 先用便宜的数字签名挡掉，省下每帧的数组分配和字符串拼接。
    const rapidS = this.buffs.rapidMs > 0 ? Math.ceil(this.buffs.rapidMs / 1000) : 0;
    const tripleS = this.buffs.tripleMs > 0 ? Math.ceil(this.buffs.tripleMs / 1000) : 0;
    const rk = this.buffs.rapidStacks, tk = this.buffs.tripleStacks;
    // 签名带上层数：不然"1 层 → 2 层"这种只有倍率变、倒计时没变的情况不会刷新
    const sig = (this.buffs.shield ? 1 : 0) + '|' + rk + '|' + rapidS + '|' + tk + '|' + tripleS;
    if (sig === this._buffSig) return;
    this._buffSig = sig;

    const parts = [];
    if (this.buffs.shield) parts.push('🛡 护盾');
    if (rapidS > 0) parts.push('≫ 连射 ×' + rk + '  ' + rapidS + 's');
    if (tripleS > 0) parts.push('≡ 三连发 ×' + tk + '  ' + tripleS + 's');
    this.buffText.setText(parts.join('    '));
  }

  /* ======================= 技能 =======================
     全部自动触发，玩家不需要任何额外输入 —— 这个游戏的操作已经"只有移动"了，
     再塞一个技能键会让手机端和"滑动移动"打架。
     冷却用每帧累加 dms 计时，暂停和慢动作天然生效。 */

  hasSkill(key) { return Object.prototype.hasOwnProperty.call(this.skillActive, key); }
  hasTalent(key) { return !!this.talents[key]; }


  updateSkills(dms) {
    // 天赋【战术】：减伤倒计时
    if (this._wardBuffMs > 0) this._wardBuffMs = Math.max(0, this._wardBuffMs - dms);

    for (const s of this.allSkills) {
      // 持续时间倒计时对主动技能同样有效 —— 形态到点必须自己结束
      if (this.skillActive[s.key] > 0) {
        this.skillActive[s.key] = Math.max(0, this.skillActive[s.key] - dms);
        continue;
      }

      // 主动技能：不参与自动触发，只递减它自己的动态冷却
      if (s.active) {
        if (this.skillCooldownLeft[s.key] > 0) {
          this.skillCooldownLeft[s.key] =
            Math.max(0, this.skillCooldownLeft[s.key] - dms);
        }
        continue;
      }

      if (s.cooldown > 0) {
        this.skillTimer[s.key] -= dms;
        if (this.skillTimer[s.key] <= 0) {
          this.skillTimer[s.key] = s.cooldown;
          this.triggerSkill(s);
        }
      }
    }
  }

  /* 主动技能的"能不能用"前置检查。返回 null 表示能用，
     否则返回一句给玩家看的原因。
     目前只有亡者转化需要 —— 场上没有可转化的敌人时用它等于白扔一次次数。
     检查必须放在扣次数之前（见 tryActiveSkill），扣完才发现用不了最伤人 */
  activeSkillBlockReason(s) {
    if (s.key === 'raiseundead') {
      let n = 0;
      this.enemies.children.each((e) => {
        if (e.active && !e.undead && !e.spawning && !e.isBoss) n++;
      });
      if (n === 0) return '场上没有可转化的敌人';
    }
    return null;
  }

  /* 主动技能：右下角按钮 / J、K 键触发。
     次数在 create 时按 s.charges 初始化，用光就再也点不动 ——
     不是"等一会儿又好了"，是这一局彻底没了（能靠击杀恢复的除外，见 tickKillRecover） */
  tryActiveSkill(idx) {
    const s = this.activeSkills[idx || 0];
    if (!s || this.state !== 'playing') return;
    if (!this.player.visible || !this.player.body.enable) return;

    // 施法期间不能再叠第二个技能：castLockMs 还没走完就再点，
    // 两次施法动画会互相覆盖、两段施法锁会叠成一条长条，
    // 玩家会以为"点了没反应"而反复点
    if (this.castLockMs > 0) { this.showSkillToast('施法中'); return; }

    if (this.skillActive[s.key] > 0) { this.showSkillToast('技能已开启'); return; }

    // 前置条件检查必须在扣次数之前 —— 扣完才发现用不了，次数就白白没了
    const block = this.activeSkillBlockReason(s);
    if (block) { this.showSkillToast(block); return; }

    // ---- 三种限制方式，按技能定义走不同的检查 ----
    if (s.cooldownDynamic) {
      // 动态冷却模式（矮人的炸药投掷）：冷却没走完不让点
      const left = this.skillCooldownLeft[s.key] || 0;
      if (left > 0) {
        this.showSkillToast('冷却中 ' + (left / 1000).toFixed(1) + 's');
        return;
      }
      // 用完这一次之后的冷却 = 初始 + 使用次数 × 增量，封顶在 max
      // 天赋【工程学】（矮人）：初始 -1 秒，max 变 12 秒
      const cfg = s.cooldownDynamic;
      let initVal = cfg.initial;
      let maxVal = cfg.max;
      if (s.key === 'throwbomb' && this.hasTalent('engineering')) {
        initVal -= 1000;
        maxVal = 12000;
      }
      const next = Math.min(maxVal, initVal + cfg.add * (this.skillCooldownUse[s.key] || 0));
      this.skillCooldownUse[s.key] = (this.skillCooldownUse[s.key] || 0) + 1;
      this.skillCooldownLeft[s.key] = next;
      this.skillCooldownTotal[s.key] = next;
    } else {
      // 次数模式：用光就整局失效。
      // 带 chargesFromKills 的技能（死灵法师的召唤）会把恢复进度显示出来，
      // 否则玩家不知道"还要杀几个才能再用一次"
      if (this.skillCharges[s.key] <= 0) {
        const need = s.chargesFromKills;
        this.showSkillToast(need
          ? ('次数已用尽 · 击杀 ' + (this.skillKillProgress[s.key] || 0) + '/' + need + ' 可恢复')
          : '次数已用尽');
        return;
      }
      this.skillCharges[s.key]--;
    }

    this.skillActive[s.key] = s.duration;
    this.triggerSkill(s);
  }

  /* ======================= 爆炸 ======================= */

  /* 通用爆炸：以 (x,y) 为心，对半径内的所有敌人一次性结算伤害。
     矮人的鞭炮和炸药都走这里 —— 和 groundcleave 的冲击波是同一思路，
     区别只是冲击波有个"从中心扩散"的过程，爆炸是瞬发的。
     视觉用橙色环 + 火花：和裂地斩的金色环区分开，一眼分得出是谁炸的 */
  explodeAt(x, y, radius, damage, fxType, owner) {
    /* 延迟引爆（地雷 / 炸药 / 亡者烙印的连锁）的回调跑在若干毫秒之后，
       那时 pIndex 可能已经指向别人了，所以允许显式传"这次爆炸算谁的"。
       同步调用时省略即可，默认沿用当前玩家 */
    if (owner != null) this.pIndex = owner;

    const hit = new Set();
    this.enemies.children.each((e) => {
      if (!e.active || e.spawning) return;
      if (hit.has(e)) return;
      if (Math.hypot(e.x - x, e.y - y) <= radius + e.displayWidth * 0.3) {
        hit.add(e);
        this.damageEnemy(e, damage);
      }
    });

    // 两种爆炸素材各注册一次动画。
    // fx-sparks：2 帧的小火花，给鞭炮用
    // fx-explosion：3 列 × 2 行 = 6 帧的爆炸序列（前 3 帧膨胀、后 3 帧消散），给炸药用。
    // ⚠️ 帧数必须按素材实际帧数写死。这张图只有 6 帧，之前写成 end:15 会让
    // generateFrameNumbers 造出一批不存在的帧号 —— 动画播到第 7 帧就卡住不结束，
    // animationcomplete 永远不触发，特效 sprite 不销毁，炸几次就在场上攒一堆
    if (this.textures.exists('fx-sparks') && !this.anims.exists('fx-sparks-anim')) {
      this.anims.create({
        key: 'fx-sparks-anim',
        frames: this.anims.generateFrameNumbers('fx-sparks', { start: 0, end: 1 }),
        frameRate: 16, repeat: 0,
      });
    }
    if (this.textures.exists('fx-explosion') && !this.anims.exists('fx-explosion-anim')) {
      this.anims.create({
        key: 'fx-explosion-anim',
        frames: this.anims.generateFrameNumbers('fx-explosion', { start: 0, end: 5 }),
        frameRate: 26, repeat: 0,
      });
    }

    // 按 fxType 挑素材。fxType 缺省时按半径自动判：
    // 小半径 → 火花，大半径 → 大爆炸，这样遗漏传参也不至于走错路径
    const useBig = (fxType === 'explosion') || (fxType == null && radius >= 90);
    const fit = useBig ? FX_FIT.explosion : FX_FIT.sparks;

    if (this.anims.exists(fit.anim)) {
      // 视觉直径 = 判定直径 × cover，再按素材内容宽度折算成缩放。
      // 两张素材的内容都正好落在帧中心（实测偏移 ≤1 px），所以直接以 (x,y)
      // 为锚点播放就行 —— 爆炸看上去就是从接触点开始向外撑开的
      const scale = (radius * 2 * fit.cover) / fit.contentW;
      const fx = this.add.sprite(x, y, fit.tex)
        .setDepth(7100).setBlendMode(Phaser.BlendModes.ADD);
      if (useBig) {
        fx.setScale(scale);
      } else {
        // 火花只有 2 帧、帧间几乎没有变化，光靠播帧看不出"炸开"的过程。
        // 补一个从 55% 涨到 100% 的缩放。时长必须短于动画本身（2 帧 @16fps
        // ≈ 125 ms），否则动画先播完把 sprite 销毁，tween 会打在空对象上
        fx.setScale(scale * 0.55);
        this.tweens.add({ targets: fx, scale, duration: 110, ease: 'Quad.easeOut' });
      }
      fx.play(fit.anim);
      fx.once('animationcomplete', () => fx.destroy());
    } else {
      // 素材没加载成功时退回程序化的橙色环，保证爆炸至少有视觉反馈
      const ring = this.add.image(x, y, 'explosion-ring')
        .setDepth(7100).setScale(0.3).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ring, scale: radius / 28,
        alpha: { from: 1, to: 0 }, duration: 320, ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
    this.burstKill.explode(14, x, y);

    this.shakeScreen(120, 0.006, true);
    SoundSys.heavyKill();
  }

  /* 炸药投掷：朝面朝方向打出一枚炸药包（item-dynamite-pack），
     命中敌人时炸开大范围。本质就是一颗"更大的鞭炮"，
     所以复用 fireBullet + explosive 这条路径，不另外维护一套投掷物对象。
     和鞭炮的区别只有三处：贴图不同、半径更大、特效换成 fx-explosion。
     飞出场地边界时只回收不引爆（见 updateBullets 的越界回收），
     免得在玩家看不到的屏幕外白白烧掉一次技能 */
  throwBomb(s) {
    const p = this.player;
    const v = DIRS[p.facing];
    const cfg = s.throwBomb;
    // 天赋【扩容】（矮人）：炸药范围 +10%
    let radius = cfg.radius;
    if (this.hasTalent('bigbomb')) radius *= 1.1;
    // 出膛位置往前挪 22px，和普通子弹一样落在角色轮廓之外
    this.fireBullet(this.playerBullets,
      p.x + v.x * 22, p.y + v.y * 22,
      v.x * cfg.speed, v.y * cfg.speed,
      'item-dynamite-pack',
      { damage: cfg.damage, pierce: 0,
        explosive: { radius, damage: cfg.damage, fx: 'explosion' } });

    // 甩出去的动作反馈：短促的镜头抖 + 一次火花
    this.shakeScreen(120, 0.006, true);
    SoundSys.shoot();
  }

  /* ======================= 勇者的两个技能 ======================= */

  /* 裂地斩：以玩家为中心扩散一圈冲击波，扫到的敌人各吃一次伤害。
     冲击波自己走一个短生命周期，每帧只对"还没被这圈扫到过"的敌人结算 ——
     命中名单挡住重复伤害，否则站在圈里的敌人会被每帧扣一次血。 */
  spawnShockwave(s) {
    const cfg = s.shockwave;
    this.shockwaves.push({
      x: this.player.x, y: this.player.y,
      r: 0, maxR: cfg.radius, damage: cfg.damage,
      elapsed: 0, life: cfg.expandMs,
      hit: new Set(),
    });
    this.shakeScreen(240, 0.012, true);
    SoundSys.heavyKill();
    this.triggerSlowMo(CONFIG.skillSlowMoMs);
  }

  /* 冲击波的推进与结算。半径走"先快后慢"的缓动，看着像一圈被砸出来的气浪。
     每帧重画一个 Graphics，比维护一堆 Image + Tween 便宜，也不会漏销毁 */
  updateShockwaves(dms) {
    const g = this.shockwaveFX;
    g.clear();

    /* 每个玩家的圈都画在**同一张** Graphics 上，所以只调一次、内部遍历所有人 ——
       每玩家调一次的话，后一位开头的 g.clear() 会把前一位刚画好的圈擦掉。
       同时把 pIndex 切到圈的主人：圈里的伤害算他的（暴击率 / 积分加成各算各的） */
    for (let pi = 0; pi < this.players.length; pi++) {
      const list = this.players[pi].shockwaves;
      if (!list.length) continue;
      this.pIndex = pi;

      for (let i = list.length - 1; i >= 0; i--) {
        const w = list[i];
        w.elapsed += dms;
        const t = Phaser.Math.Clamp(w.elapsed / w.life, 0, 1);
        w.r = w.maxR * (1 - (1 - t) * (1 - t));

        this.enemies.children.each((e) => {
          if (!e.active || e.spawning) return;
          if (w.hit.has(e)) return;
          // 用敌人的显示宽度当"身体半径"的近似：体型大的特殊兵
          // 不该因为"圆心在圈外、其实身体已经贴着圈了"被漏掉
          if (Math.hypot(e.x - w.x, e.y - w.y) <= w.r + e.displayWidth * 0.3) {
            w.hit.add(e);
            this.damageEnemy(e, w.damage);
          }
        });

        const alpha = 1 - t;
        g.lineStyle(6, 0xffd54a, alpha * 0.8);
        g.strokeCircle(w.x, w.y, w.r);
        g.lineStyle(2, 0xffffff, alpha * 0.9);
        g.strokeCircle(w.x, w.y, Math.max(0, w.r - 5));

        if (t >= 1) list.splice(i, 1);
      }
    }
    this.pIndex = 0;
  }

  /* ======================= 死灵法师：骷髅弓手 =======================
     骷髅是"会走、会射箭、1 滴血"的友军。它没有放进 enemies 组 ——
     放进去会被玩家自己的子弹打、被自己的爆炸波及，还得处处加"这是不是友军"的判断。
     单独一个 skeletons 组，判定关系全部显式接线（见 setupCollisions），
     只连三条：它的箭打敌人、敌人的弹打它、敌人撞它。

     移动方向固定是"召唤时那个方向"，不需要寻路 ——
     一旦让召唤物追敌人，就要处理卡位、绕障、目标丢失，复杂度涨十倍，
     而"四个方向推过去"这个视觉已经足够传达"我召唤了帮手"。

     射箭走的是完整的拉弓动画（12 帧），箭在第 9 帧离弦 ——
     所以它不是"到点直接生成一支箭"，而是先播动作、动作播到那一帧才出箭，
     玩家能看到箭是从弓上射出去的，而不是凭空出现在骷髅前面。 */

  /* 一次召唤：以玩家为中心，四个正交方向各放一只。
     召唤点用"格"做单位而不是像素，棋盘格宽改了会跟着走。
     玩家贴着场地边站时召唤点会落到场地外 —— 必须夹回场地内，
     否则骷髅一出生就在界外，下一帧就被出界判定回收，看着像召唤失败 */
  summonSkeletons(s) {
    const cfg = s.skeleton;
    const p = this.player;
    const off = CONFIG.cell * cfg.offsetCells;
    const m = 30;
    let n = 0;
    for (const d of ['up', 'down', 'left', 'right']) {
      const v = DIRS[d];
      const x = Phaser.Math.Clamp(p.x + v.x * off, BOARD.x + m, BOARD.x + BOARD.w - m);
      const y = Phaser.Math.Clamp(p.y + v.y * off, BOARD.y + m, BOARD.y + BOARD.h - m);
      if (this.spawnSkeleton(x, y, d, cfg)) n++;
      // 天赋【亡者狂热】（亡灵法师）：30% 概率额外召唤一只（同一方向）
      if (this.hasTalent('legion') && Math.random() < 0.3) {
        const x2 = Phaser.Math.Clamp(x + (Math.random() - 0.5) * 40, BOARD.x + m, BOARD.x + BOARD.w - m);
        const y2 = Phaser.Math.Clamp(y + (Math.random() - 0.5) * 40, BOARD.y + m, BOARD.y + BOARD.h - m);
        if (this.spawnSkeleton(x2, y2, d, cfg)) n++;
      }
    }
    if (n > 0) {
      this.burstHit.explode(20, p.x, p.y);
      this.shakeScreen(200, 0.008, true);
      SoundSys.heavyKill();
    }
    return n;
  }

  spawnSkeleton(x, y, dirName, cfg) {
    const anims = CHAR_ANIMS.skel;
    if (!anims || !this.textures.exists(anims.run.file)) return false;
    // 动画 key 没注册成功（图集加载失败）就直接不召唤，
    // 否则会生成一堆不会动的静止贴图，看着像卡住了
    if (!this.anims.exists('skel-run-' + dirName)) return false;

    let k = this.skeletons.get(x, y, anims.run.file);
    if (!k) {
      // 池满：回收最早那一只复用。不处理的话召唤会静默少一只，
      // 玩家看到"四个方向只冒出三个"，查起来毫无头绪
      const oldest = this.skeletons.getFirstAlive();
      if (oldest) this.recycleSkeleton(oldest);
      k = this.skeletons.get(x, y, anims.run.file);
    }
    if (!k) return false;

    k.setTexture(anims.run.file);
    k.setActive(true).setVisible(true);
    k.body.enable = true;

    const scale = cfg.scale;
    k.setScale(scale);
    // 半径传 bodyRadius/scale：setCircle 的半径会被 sprite 缩放再乘一次，
    // offset 用"未缩放的帧宽/2 - 半径"保证同心（和 buildPlayer 同一个道理）
    const br = cfg.bodyRadius / scale;
    k.body.setCircle(br, 24 - br, 24 - br);

    k.setPosition(x, y);
    k.body.reset(x, y);

    const v = DIRS[dirName];
    k.setVelocity(v.x * cfg.speed, v.y * cfg.speed);

    k.dirName = dirName;
    k.hp = cfg.hp;
    k.damage = cfg.damage;
    // 天赋【迅击】（亡灵法师）：骷髅射速 +10%
    k.fireInterval = cfg.fireInterval * (this.hasTalent('fastarrow') ? 0.9 : 1);
    // 错开四只的第一箭，否则四支箭同时离弦、看着像一次齐射，
    // 而且四声开火音会叠成一个爆音
    k.fireAccum = Phaser.Math.Between(0, 320);
    k.fireFrame = cfg.fireFrame;
    k.atkFrames = anims.atk1 ? anims.atk1.frames : 12;
    // 天赋【长眠】（亡灵法师）：骷髅存在时间 +2 秒
    k.lifeMs = cfg.lifeMs + (this.hasTalent('longerlife') ? 2000 : 0);
    k.attacking = false;
    k.shotFired = false;

    k.setAlpha(0);
    this.tweens.add({ targets: k, alpha: 1, duration: 180 });
    k.play('skel-run-' + dirName, true);
    this.attachSkelOverlay(k, scale);
    return true;
  }

  /* 骷髅的"边攻击边移动"叠加层。和玩家那套是同一个思路，但更简单：
     骷髅的位移从头到尾不停（拉弓时也在往前走），所以叠加层只要
     "活着就一直显示、方向跟着 dirName 走"就够了，没有"停下就藏起来"的分支。

     为什么不做成共享一张全局贴图：叠加层必须和本体逐帧同步位置，
     做成一只一个精灵最省事，而且它天然跟着对象池复用（见 recycleSkeleton）。 */
  attachSkelOverlay(k, scale) {
    const key = 'skel-run-lo';
    if (!this.textures.exists(key)) return;
    if (!k.overlay) {
      k.overlay = this.add.sprite(k.x, k.y, key).setVisible(false);
      k.overlayKey = '';
    }
    k.overlay.setScale(scale).setAlpha(1);
  }

  /* 叠加层的每帧同步：位置、深度、透明度全跟着本体。
     深度用 +0.5 压在本体上面，又不会跨到下一段 y 的遮挡关系里 */
  syncSkelOverlay(k) {
    const o = k.overlay;
    if (!o) return;
    if (!k.active) { if (o.visible) o.setVisible(false); return; }

    const key = 'skel-run-lo-' + k.dirName;
    if (!this.anims.exists(key)) { o.setVisible(false); return; }
    if (!o.visible) o.setVisible(true);
    if (k.overlayKey !== key) { k.overlayKey = key; o.play(key, true); }
    o.setPosition(k.x, k.y).setAlpha(k.alpha).setDepth(k.depth + 0.5);
  }

  recycleSkeleton(k) {
    if (!k) return;
    // 池化对象上挂的 tween 必须显式杀掉：淡入 tween 还在跑的时候
    // 这个对象可能已经被回收并复用成新的一只，旧 tween 会把新的 alpha 拖到 0
    this.tweens.killTweensOf(k);
    if (k.anims && k.anims.isPlaying) k.stop();
    k.setActive(false).setVisible(false);
    k.setAlpha(1);
    k.attacking = false;
    k.shotFired = false;
    if (k.body) { k.body.stop(); k.body.enable = false; }
    // 叠加层是独立精灵，不跟着 setActive(false) 一起消失，必须手动藏
    if (k.overlay) {
      if (k.overlay.anims && k.overlay.anims.isPlaying) k.overlay.anims.stop();
      k.overlay.setVisible(false);
    }
  }

  /* 骷髅散架。1 滴血的设计意味着它一定会被打死或被撞死，
     所以必须给一个明确的反馈 —— 不然玩家只会看到帮手凭空消失，
     分不清是"被打掉了"还是"走到边缘自己没了" */
  killSkeleton(k) {
    const x = k.x, y = k.y;
    this.recycleSkeleton(k);
    this.burstHit.explode(10, x, y);
  }

  fireSkeletonArrow(k) {
    const cfg = SKILLS.summonskeletons.skeleton;
    const v = DIRS[k.dirName];
    this.fireBullet(this.skeletonArrows,
      k.x + v.x * 20, k.y + v.y * 20,
      v.x * cfg.arrowSpeed, v.y * cfg.arrowSpeed,
      'bullet-arrow',
      { damage: k.damage, pierce: 0 });
    SoundSys.enemyShoot();
  }

  updateSkeletons(dms) {
    if (!this.skeletons) return;
    this.skeletons.children.each((k) => {
      if (!k.active) return;

      k.lifeMs -= dms;
      // 出界 / 超时回收。出界留 40px 余量：骷髅的设定是"走到场地边缘就消失"，
      // 卡在边界线上来回抖的时候不该还留在场上
      if (k.lifeMs <= 0 || !Utils.insideBoard(k.x, k.y, 40)) {
        this.recycleSkeleton(k);
        return;
      }

      if (!k.attacking) {
        k.fireAccum += dms;
        if (k.fireAccum >= k.fireInterval) {
          k.fireAccum -= k.fireInterval;
          k.attacking = true;
          k.shotFired = false;
          k.play('skel-atk1-' + k.dirName, true);
        }
        return;
      }

      // ---- 拉弓中 ----
      // 攻击动画没播起来（图集缺失 / key 不对）时直接退回走路，
      // 否则 attacking 会永远停在 true，这只骷髅再也不射箭
      const cur = k.anims.currentAnim ? k.anims.currentAnim.key : '';
      if (cur !== 'skel-atk1-' + k.dirName) {
        k.attacking = false;
        k.play('skel-run-' + k.dirName, true);
        return;
      }

      // 用帧号判断"箭离弦"和"动画播完"，不用 delayedCall ——
      // delayedCall 会被暂停冻住、被慢动作拉长，和动画的实际进度对不上
      const idx = k.anims.currentFrame ? k.anims.currentFrame.index - 1 : 0;
      if (!k.shotFired && idx >= k.fireFrame) {
        k.shotFired = true;
        this.fireSkeletonArrow(k);
      }
      if (idx >= k.atkFrames - 1) {
        k.attacking = false;
        k.play('skel-run-' + k.dirName, true);
      }
    });
  }

  /* 骷髅的箭打敌人。亡灵跳过 —— 骷髅是友军，不能打友军 */
  onArrowHitsEnemy(arrow, enemy) {
    if (!arrow.active || !enemy.active || enemy.spawning) return;
    if (enemy.undead) return;
    this.killBullet(arrow);
    this.damageEnemy(enemy, arrow.damage || 1);
  }

  /* 敌人的子弹打骷髅：1 滴血，中一发就散架 */
  onBulletHitsSkeleton(bullet, skel) {
    if (!bullet.active || !skel.active) return;
    this.killBullet(bullet);
    this.killSkeleton(skel);
  }

  /* 敌人撞骷髅：同归于尽 —— 骷髅散架，敌人吃 1 点伤害。
     不给"骷髅把敌人撞死"是因为它只有 1 滴血，
     能一换一已经是很划算的交换，再强就变成无脑召唤流了 */
  onEnemyHitsSkeleton(enemy, skel) {
    if (!enemy.active || !skel.active || enemy.spawning) return;
    if (enemy.undead) return;
    const dmg = skel.damage || 1;
    this.killSkeleton(skel);
    this.damageEnemy(enemy, dmg);
  }

  /* ======================= 死灵法师：亡灵 =======================
     亡灵不是新对象，就是"被策反的敌人" —— 复用 enemies 组里的精灵，
     只多挂一个 undead 标记。这样子弹判定、爆炸判定全都白捡，
     不用再维护第二套物理组和对象池。

     代价是每一处"敌人 vs 玩家"的判定都要显式跳过亡灵，
     漏一处就会出现"我的亡灵把我打死了"这种最荒谬的 bug。
     目前需要跳过的地方：
       damageEnemy       —— 统一入口，子弹 / 爆炸 / 冲击波 / 冲锋都走它
       onEnemyHitsPlayer —— 贴身伤害玩家
       updateEnemies     —— 绕场循环 + 朝玩家开火
     改动时按 undead 搜一遍。 */

  makeUndead(e, ms) {
    if (!e || !e.active || e.isBoss || e.undead) return false;
    e.undead = true;
    e.undeadMs = ms;
    e.undeadTick = 0;
    // 冻结状态必须清掉：被冻住的敌人变成亡灵后，蓝色 tint 会盖掉眩晕紫，
    // 而且 slowTimer 到期时 applyEnemyVelocity 会把它的追踪速度改回原方向
    e.slowTimer = 0;
    // 眩晕色：亮紫。和"被冻住"的蓝、和"刚被打中"的白闪都区分得开
    e.setTint(0xc98fff);
    return true;
  }

  /* 亡灵每帧：计时、找最近的普通敌人、贴上去同归于尽。
     找目标走两重遍历 —— 敌人池上限 80、亡灵最多 6 只，
     最坏 480 次距离计算，比维护一张空间索引便宜得多。 */
  updateUndeads(dms) {
    if (!this.enemies) return;

    // 先收集一份，避免在 each 回调里改速度时和遍历本身打架
    const list = [];
    this.enemies.children.each((e) => { if (e.active && e.undead) list.push(e); });
    if (!list.length) return;

    for (const u of list) {
      if (!u.active || !u.undead) continue;

      u.undeadMs -= dms;
      if (u.undeadMs <= 0) { this.fadeUndead(u); continue; }

      // 摆头：用 sin 让贴图左右微摆。满屏敌人里，"在摇摆的那几只"一眼就认得出，
      // 光靠紫色 tint 在弹幕里不够醒目
      u.undeadTick += dms;
      u.setAngle(Math.sin(u.undeadTick / 120) * 7);

      // 找最近的普通敌人
      let best = null, bestD = Infinity;
      this.enemies.children.each((e) => {
        if (!e.active || e.undead || e.spawning || e.isBoss) return;
        const d = Math.hypot(e.x - u.x, e.y - u.y);
        if (d < bestD) { bestD = d; best = e; }
      });
      if (!best) continue;

      // 朝目标加速冲过去。直接改速度，不走 applyEnemyVelocity ——
      // 后者是按 e.dir 算的固定方向，亡灵要的是实时追踪
      const a = Math.atan2(best.y - u.y, best.x - u.x);
      const sp = CONFIG.enemySpeed * 1.6;
      u.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp);

      // 贴身就同归于尽：双方各挨一下。伤害给 2 是为了让它"值一次转化"，
      // 给 1 的话两只步兵互相抵消，玩家会觉得转化了等于没转化
      if (bestD <= 26) {
        this.burstHit.explode(14, u.x, u.y);
        this.damageEnemy(best, 2);
        this.fadeUndead(u);
      }
    }
  }

  /* 亡灵消散。和"被打死"走完全不同的路径 ——
     不记击杀、不掉分、不掉金币：它本来就是玩家花一次技能换来的资源，
     给分等于变相刷分，给金币更会变成刷钱机器 */
  fadeUndead(u) {
    if (!u.active) return;
    this.burstHit.explode(8, u.x, u.y);
    u.clearTint();
    u.setAngle(0);
    this.recycleEnemy(u);
    // 天赋【献祭】（亡灵法师）：10% 概率治疗 0.5 血
    if (this.hasTalent('soulharvest') && Math.random() < 0.1) {
      this._healAccum = (this._healAccum || 0) + 0.5;
      if (this._healAccum >= 1 && this.lives < this.maxLives) {
        this._healAccum -= 1;
        this.lives++;
        this.updateLivesHUD();
        this.popText(this.player.x, this.player.y - 30, '+1', '#8affa0');
      }
    }
  }

  /* 亡者转化：从场上随机挑一批敌人策反。
     数量 = 敌人数 × ratio，再夹到 [min, max]。
     ⚠️ min 是保底，不是装饰：残局场上只剩 1 只敌人时，
     1 × 0.6 四舍五入是 1、但场上只有 1 只也就算了；
     真正要防的是"只剩 2 只、算出 1 只"和"ratio 调小之后算出 0 只" ——
     玩家用掉一次宝贵的技能次数却什么都没发生，是最伤体验的一类失败 */
  raiseUndead(s) {
    const cfg = s.raise;
    const pool = [];
    this.enemies.children.each((e) => {
      if (!e.active || e.undead || e.spawning || e.isBoss) return;
      pool.push(e);
    });
    if (!pool.length) return 0;

    // 洗牌后取前 n 个。不用 sort(() => Math.random() - 0.5) ——
    // 那种写法在不同引擎上的分布是不均匀的，会偏好某些位置
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Phaser.Math.Between(0, i);
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }

    // 天赋【黑暗契约】：保底数量 +1
    // 天赋【掌控生死】：策反比例 60% → 75%
    let ratio = cfg.ratio;
    let minN = cfg.min;
    if (this.hasTalent('mastery')) ratio = 0.75;
    if (this.hasTalent('contract')) minN += 1;
    const n = Phaser.Math.Clamp(Math.round(pool.length * ratio), minN, cfg.max);
    let done = 0;
    for (let i = 0; i < Math.min(n, pool.length); i++) {
      if (this.makeUndead(pool[i], cfg.undeadMs)) {
        done++;
        this.burstHit.explode(12, pool[i].x, pool[i].y);
      }
    }
    return done;
  }

  /* 击杀恢复：每 chargesFromKills 次击杀给主动技能回 1 次。
     只处理带这个字段的技能（死灵法师的召唤），
     次数模式 / 动态冷却模式的技能完全不受影响。
     次数已经满了就不再累加进度 —— 否则计数器会一直涨，
     玩家用掉一次之后瞬间又满，等于没有限制 */
  tickKillRecover() {
    for (const s of this.activeSkills) {
      if (!s.chargesFromKills) continue;
      if ((this.skillCharges[s.key] || 0) >= s.charges) {
        this.skillKillProgress[s.key] = 0;
        continue;
      }
      // 天赋【快速恢复】（亡灵法师）：击杀恢复门槛 10 → 8
      let need = s.chargesFromKills;
      if (this.hasTalent('quickrecover')) need = Math.max(1, need - 2);
      const p = (this.skillKillProgress[s.key] || 0) + 1;
      if (p >= need) {
        this.skillKillProgress[s.key] = 0;
        this.skillCharges[s.key] = (this.skillCharges[s.key] || 0) + 1;
        this.showSkillToast(s.name + ' 次数 +1');
        this.burstKill.explode(14, this.player.x, this.player.y);
      } else {
        this.skillKillProgress[s.key] = p;
      }
    }
  }

  /* 对单个敌人结算一次伤害。子弹、冲击波、冲锋都走这里，
     免得"扣血 → 白闪 → 死亡"这段在三处各写一遍，改一处忘两处 */
  damageEnemy(enemy, damage) {
    if (!enemy.active || enemy.spawning) return;

    // 亡灵免疫一切伤害。放在最前面，是因为它是"友军"这个身份的兜底 ——
    // 子弹 / 爆炸 / 冲击波 / 冲锋全都汇聚到这里，
    // 在这一个地方挡住，就不用在四条路径上各写一遍跳过判断
    // （少写一条的后果是"我的子弹把我的亡灵打死了"）
    if (enemy.undead) return;

    // BOSS 不吃小怪这一套（hp 的量级差两个数量级、死亡流程也完全不同），
    // 单独走 damageBoss。放在最前面，是因为下面那段"白闪 + 减速"对 boss 不适用
    if (enemy.isBoss) { this.damageBoss(damage); return; }

    let dmg = damage || 1;
    // 混沌弹：概率暴击。放在扣血之前，扣的是乘完之后的伤害。
    // 暴击率是**打枪的那个人**的增幅，pIndex 已由子弹的 ownerP 切好
    const m = this.mods;
    if (m.critChance > 0 && Math.random() < m.critChance) {
      dmg = Math.round(dmg * m.critMul);
      this.popText(enemy.x, enemy.y - 16, '×' + m.critMul.toFixed(1), '#ffd54a');
    }

    enemy.hp -= dmg;

    // 冰霜弹：命中就减速。放在扣血之后、死亡判定之前，
    // 这样"被冻住的那一下"也是有效的，玩家不会觉得白打
    if (this.hasSkill('frost')) this.applyFrost(enemy);

    if (enemy.hp > 0) {
      // 未破防：白闪一下 + 轻微震动，让"打中了但没死"有明确反馈
      enemy.setTintFill(0xffffff);
      this.time.delayedCall(60, () => {
        if (!enemy.active) return;
        // 被冻住的敌人要把蓝色染色还回去，否则白闪一过减速就看不出是减速了
        if (enemy.slowTimer > 0) enemy.setTint(0x8fd0ff); else enemy.clearTint();
      });
      this.shakeScreen(40, 0.0015, true);
      return;
    }

    this.killEnemy(enemy);
  }

  /* 破军冲锋：把玩家沿面朝方向甩出去一段固定距离。
     方向在按下那一刻就锁死 —— 中途还能转向的话，玩家一边冲一边改方向
     会画出诡异的弧线，也失去了"冲进去、撞出来"的爽感。 */
  startCharge(s) {
    const v = DIRS[this.player.facing];
    this.chargeDir = { x: v.x, y: v.y };
    // 天赋【疾行】：冲锋距离 +2 格（原来 4 格，约 260px；+2 格 = +128px → 速度 ×1.5）
    this.chargeSpeed = s.charge.speed * (this.hasTalent('chargefar') ? 1.5 : 1);
    // 天赋【剑气长河】：记录本次冲锋已命中的两侧敌人，避免重复伤害
    this._chargeHitSet = new Set();
    // 帧计时归零 + 清掉上一段动画的标记。漏了这两行的话，冲锋会从
    // "上一次技能播到一半的位置"接着往下播，看着像动作被吃掉了半截
    this.skillAnimMs = 0;
    this.playerAnimKey = '';
    // 冲锋 + 落地后的无敌合成一个总时长一次性给出去，
    // 省得去追"冲锋什么时候结束"这件事 —— 反正全程都该无敌
    // 天赋【铁壁】：落地后的无敌 +0.5 秒
    const afterInv = s.charge.invincibleAfterMs + (this.hasTalent('steadfast') ? 500 : 0);
    this.grantInvincible(s.duration + afterInv);
    this.shakeScreen(260, 0.013, true);
    SoundSys.heavyKill();
    this.triggerSlowMo(CONFIG.skillSlowMoMs + 120);
  }

  /* 冲锋位移。刻意不走物理速度，而是按真实 delta 直接推位置 ——
     慢动作会把 physics.world.timeScale 压低，走物理的话冲锋距离会随
     慢动作时长变化，玩家算不准自己会不会一头撞进弹幕里。
     直接位移的距离恒等于 speed × duration，手感可预期。 */
  updateCharge(dms) {
    const p = this.player;
    if (!this.chargeDir) return;

    const step = this.chargeSpeed * (dms / 1000);
    const m = 20;
    p.setPosition(
      Phaser.Math.Clamp(p.x + this.chargeDir.x * step, BOARD.x + m, BOARD.x + BOARD.w - m),
      Phaser.Math.Clamp(p.y + this.chargeDir.y * step, BOARD.y + m, BOARD.y + BOARD.h - m));
    // 物理体必须跟着走，否则这一段的 overlap 判定还停在旧位置，撞到的敌人一个都不会死
    if (p.body) p.body.reset(p.x, p.y);

    // 拖尾：每帧留一点火花，把"一条直线冲过去"的轨迹画出来
    this.burstHit.explode(1, p.x, p.y);

    // 天赋【剑气长河】：冲锋路径两侧的敌人也受到 1 点伤害
    if (this.hasTalent('swordriver') && this._chargeHitSet) {
      const dir = this.chargeDir;
      this.enemies.children.each(e => {
        if (!e.active || e.spawning || e.undead || e.isBoss) return;
        if (this._chargeHitSet.has(e)) return;
        // 水平冲锋 → 检查上下两条相邻道；垂直冲锋 → 检查左右两条相邻道
        let inSideLane = false;
        if (dir.x !== 0) {
          const dy = Math.abs(e.y - p.y);
          inSideLane = dy > 40 && dy < 90;
        } else {
          const dx = Math.abs(e.x - p.x);
          inSideLane = dx > 40 && dx < 90;
        }
        if (inSideLane) {
          this._chargeHitSet.add(e);
          this.damageEnemy(e, 1);
        }
      });
    }
  }

  triggerSkill(s) {
    /* 技能级慢放倍率，缺省 0 = 用角色默认（CHARACTERS.<角色>.skillAnimMul）。
       ⚠️ 每次触发都要重置：不重置的话，上一个技能设的 0.4 会残留给下一个
       没写 castAnimMul 的技能 —— 破军冲锋走的就是这条没有 castMs 的路径，
       动画会莫名变慢，而且只在"放过堕天形态之后"才复现，极难查 */
    this.castAnimMul = s.castAnimMul || 0;

    /* ---- 施法姿态（抬手 / 结印 / 砸地）：所有技能一视同仁 ----
       判定只认 castMs，不看是不是主动技能 —— 巫女的自动技能（逆反结界）
       和勇者 / 矮人的自动技能（裂地斩、炸药投掷）走的是同一条路径。
       用户 2026-09-16 明确要求"一视同仁，也锁也无敌"。

       为什么必须锁移动：updatePlayerVisual 只在 castLockMs > 0 期间播施法姿态
       （见那里的动作优先级）。不锁的话姿态根本不会出现，castMs 就白设了 ——
       "延长了却还是看不见动作"就是这么来的。
       为什么必须同时给无敌：不能动又不能无敌，等于原地站着挨打。
       无敌多给 200ms 是因为"施法完成"到"能重新移动"之间有一帧的间隙。 */
    if (s.castMs > 0) {
      this.castLockMs = s.castMs;
      this.castAct = s.castAct || 'atk2';
      this.castFrames = s.castFrames || 0;
      this.grantInvincible(s.castMs + 200);
      // 帧计时归零 + 清掉上一段动画的标记。漏了这两行的话，新动画的第一帧
      // 会被上一轮的 key（比如 "sorc-atk3#27"）挡住，看着像"重新触发但角色不动"
      this.skillAnimMs = 0;
      this.playerAnimKey = '';
    }

    switch (s.key) {
      case 'overdrive':
        this.skillActive.overdrive = s.duration;
        break;

      case 'heavyround':
        this.skillActive.heavyround = s.duration;
        break;

      case 'swiftstep':
        this.skillActive.swiftstep = s.duration;
        break;

      case 'ward':
        // 天赋【持久】和【固化】增加结界持续时间
        let wardDur = s.duration;
        if (this.hasTalent('enduring')) wardDur += 500;
        if (this.hasTalent('solidify')) wardDur += 1000;
        this.skillActive.ward = wardDur;
        
        // 天赋【圣光】：结界开启瞬间获得护盾
        if (this.hasTalent('holylight')) {
          this.buffs.shield = true;
          this.updateBuffText();
          this.burstKill.explode(14, this.player.x, this.player.y);
        }
        // 施法姿态（抬手结印 + 锁移动 + 无敌帧）由函数开头的统一分支处理，
        // 参数见 SKILLS.ward.castMs。她是自动技能，触发时玩家可能正在走位，
        // 会被定住 1.1 秒 —— 这是"看得清施法动作"的必要代价，无敌帧兜住风险
        // 释放瞬间来一次全屏慢动作 —— 持续时长由 CONFIG.skillSlowMoMs 决定，
        // 到点后 triggerSlowMo 里的原生 setTimeout 会自动把三个 timeScale 恢复
        this.triggerSlowMo(CONFIG.skillSlowMoMs);
        break;

      case 'darkform':
        // 天赋【延展】增加堕天持续时间
        let darkDur = s.duration;
        if (this.hasTalent('extend')) darkDur += 1000;
        this.skillActive.darkform = darkDur;
        // 变身瞬间炸一圈火花 + 一次镜头冲击，"我变身了"这件事必须立刻有体感，
        // 否则玩家点完按钮只会看到射速变快，反应不过来发生了什么
        this.burstKill.explode(24, this.player.x, this.player.y);
        this.shakeScreen(220, 0.01, true);
        // 变身姿态（atk3 前 4 帧）由函数开头的统一分支处理，见 SKILLS.darkform.castFrames。
        // ⚠️ 生效期的 8 秒刻意不保持任何特殊姿态 —— 掉回正常路径走
        // "atk1 底图 + 走路叠加层"，所以这 8 秒里攻击和移动动画都照常播。
        // 变身是主动技能，慢动作给得比被动技能再明显一点 ——
        // 玩家按下按钮的那一刻就能感觉到"进入状态了"
        this.triggerSlowMo(CONFIG.skillSlowMoMs + 120);
        break;

      case 'groundcleave':
        // 天赋【阔斩】：裂地斩范围 +10%
        let radius = s.shockwave.radius;
        if (this.hasTalent('slashrange')) radius *= 1.1;
        this.skillActive.groundcleave = s.duration;
        // 临时把半径塞进配置里（spawnShockwave 读的是 s.shockwave）
        const cfgCopy = Object.assign({}, s.shockwave, { radius });
        this.spawnShockwave({ shockwave: cfgCopy });
        // 天赋【战术】：释放后 2 秒内减伤 50%
        if (this.hasTalent('tactics')) {
          this._wardBuffMs = 2000;
        }
        break;

      case 'charge':
        this.startCharge(s);
        break;

      case 'throwbomb':
        this.skillActive.throwbomb = s.duration;
        // 天赋【工程学】（矮人）：初始冷却 -1 秒，最长 12 秒
        if (this.hasTalent('engineering')) {
          const used = this.skillCooldownUse['throwbomb'] || 0;
          const next = Math.min(12000, 4000 + 1000 * used);
          this.skillCooldownLeft['throwbomb'] = next;
          this.skillCooldownTotal['throwbomb'] = next;
        }
        this.throwBomb(s);
        break;

      case 'summonskeletons':
        // 施法姿态 + 施法锁定 + 无敌帧由函数开头的统一分支处理（castMs 1000）
        this.skillActive.summonskeletons = s.duration;
        this.summonSkeletons(s);
        break;

      case 'raiseundead':
        // 施法姿态 + 施法锁定 + 无敌帧由函数开头的统一分支处理（castMs 1750）
        this.skillActive.raiseundead = s.duration;
        // 转化是"一次改变战场格局"的技能，慢动作给得比召唤更足，
        // 让玩家看清红色法阵铺开、一批敌人同时变色的过程
        this.triggerSlowMo(CONFIG.skillSlowMoMs + 140);
        this.raiseUndead(s);
        break;

      case 'ironwall':
        // 已经有护盾时不白触发：改送一段无敌，冷却照样进
        if (this.buffs.shield) this.grantInvincible(900);
        else this.buffs.shield = true;
        this.updateBuffText();
        break;

      case 'heal':
        if (this.lives < this.maxLives) {
          this.lives++;
          this.updateLivesHUD();
          this.burstKill.explode(14, this.player.x, this.player.y);
        } else {
          // 满血时不消耗这次冷却，1.5 秒后再看一次，避免满血把冷却白白走掉
          this.skillTimer.heal = 1500;
          return;
        }
        break;

      default:
        return;
    }

    SoundSys.levelup();
    this.showSkillToast(s.name);
  }

  showSkillToast(label) {
    const t = this.add.text(this.player.x, this.player.y - 34, label, {
      fontFamily: UI.FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(8960);

    this.tweens.add({
      targets: t, y: t.y - 26, alpha: 0, duration: 780, ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /* 技能栏：左下角一排小圆标。外圈是冷却进度环，持续型技能触发时整圈亮起。
     每帧重绘一个 Graphics，比维护一堆 Image + Tween 便宜，也不会漏销毁 */
  updateSkillFX() {
    const g = this.skillFX;
    g.clear();
    if (this.state !== 'playing') return;

    // 主动技能按钮和这排小圆标一起重绘，省掉一次 update 里的调用
    this.updateActiveSkillFX();

    // 逐玩家画。技能是**各自**的，冷却进度当然也要各画各的
    for (const P of this.players) {
      for (let i = 0; i < P.hudSkills.length; i++) {
        const s = P.hudSkills[i];
        const x = P.skillIconX + i * P.skillIconStep;
        const y = P.skillIconY;
        const active = P.skillActive[s.key] > 0;

        g.fillStyle(0x0b1520, 0.75);
        g.fillCircle(x, y, 18);
        g.fillStyle(s.color, active ? 1 : 0.5);
        g.fillCircle(x, y, 12);

        if (active) {
          g.lineStyle(3, s.color, 1);
          g.strokeCircle(x, y, 21);
        } else {
          g.lineStyle(2, 0x33404f, 1);
          g.strokeCircle(x, y, 18);

          if (s.cooldown > 0) {
            const ratio = Phaser.Math.Clamp(1 - P.skillTimer[s.key] / s.cooldown, 0, 1);
            g.lineStyle(3, 0x8fa3b8, 0.9);
            g.beginPath();
            g.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
            g.strokePath();
          }
        }
      }
    }
  }

  updateHeartbeat(dms) {
    if (this.lives !== 1 || this.state !== 'playing') return;
    this.heartbeatTimer -= dms;
    if (this.heartbeatTimer <= 0) {
      this.heartbeatTimer = 1200;
      SoundSys.heartbeat();
      this.time.delayedCall(150, () => {
        if (this.lives === 1 && this.state === 'playing') SoundSys.breathe();
      });
    }
  }

  onBulletHitsEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active || enemy.spawning) return;
    if (!Utils.insideBoard(enemy.x, enemy.y, 10)) return;

    /* 把"当前玩家"切回打出这一发的人。
       后面的暴击率 / 亡者烙印 / 积分加成 / 血祭回血 / 天赋判定读的全是
       代理字段，切对了才谈得上"各自计算"。子弹是从池子里捞的，
       ownerP 在 fireBullet 里每次都会重写，不会残留上一位的标记 */
    if (bullet.ownerP != null) this.pIndex = bullet.ownerP;

    // 亡灵是友军：子弹直接穿过去，既不伤害也不消失。
    // 不回收子弹是刻意的 —— 玩家的亡灵常常挡在枪口正前方，
    // 让子弹穿过去，玩家不会觉得"我的火力被自己人挡住了"
    if (enemy.undead) return;

    // 穿透弹会连续多帧压在同一个敌人身上，靠命中名单把它挡掉，
    // 否则一帧扣一次血，穿透弹会变成秒杀弹
    if (bullet.pierce > 0 && bullet.hitList && bullet.hitList.indexOf(enemy) >= 0) return;

    // 爆炸弹（鞭炮 / 炸药）：先按命中点的位置炸开 AOE，再回收子弹。
    // 爆炸范围内的敌人（包括命中的这个）一起结算，命中名单会挡住重复伤害
    if (bullet.explosive) {
      const x = bullet.x, y = bullet.y;
      const exp = bullet.explosive;
      this.killBullet(bullet);
      this.explodeAt(x, y, exp.radius, exp.damage, exp.fx);
      // 天赋【连环爆破】（矮人）：15% 概率留下小地雷
      if (this.hasTalent('chainbomb') && Math.random() < 0.15) {
        const mine = this.add.circle(x, y, 8, 0xff4a3a, 0.7).setDepth(7000);
        this.tweens.add({ targets: mine, scale: 1.4, duration: 300, yoyo: true, repeat: 2 });
        // 地雷是延迟引爆的，回调跑在 1 秒后 —— 那时 pIndex 早就不一定指向谁了，
        // 必须把埋雷的人提前捕获下来
        const owner = this.pIndex;
        this.time.delayedCall(1000, () => {
          mine.destroy();
          if (this.state !== 'playing') return;
          this.explodeAt(x, y, 55, 1, 'sparks', owner);
        });
      }
      return;
    }

    // 亡灵弹的策反：在扣血之前掷骰子。
    // ⚠️ 必须放在扣血之前 —— 放在之后的话，这一发已经把敌人打死了（对象已回收进池），
    // 再给"它"挂 undead 标记等于改了一个空壳，
    // 下一只从池里捞出来的敌人会莫名其妙带着亡灵标记出场
    if (bullet.raiseChance > 0 && Math.random() < bullet.raiseChance) {
      if (this.makeUndead(enemy, bullet.raiseMs || 6000)) {
        this.burstHit.explode(14, enemy.x, enemy.y);
        this.popText(enemy.x, enemy.y - 16, '策反', '#c98fff');
        this.shakeScreen(90, 0.004, true);
        // 非穿透弹命中后照常回收；穿透弹留着继续飞
        if (bullet.pierce > 0) bullet.pierce--;
        else this.killBullet(bullet);
        return;
      }
    }

    // 天赋【余烬】：火弹命中产生极小范围爆炸
    if (this.hasTalent('ember') && (bullet.texture.key === 'bullet-fire' || bullet.texture.key === 'bullet-p')) {
      this.explodeAt(bullet.x, bullet.y, 30, 0.5, 'sparks');
    }

    if (bullet.pierce > 0) {
      bullet.pierce--;
      if (bullet.hitList) bullet.hitList.push(enemy);
    } else {
      this.killBullet(bullet);
    }

    // 扣血和死亡结算统一走 damageEnemy，子弹 / 冲击波 / 冲锋共用同一份逻辑
    this.damageEnemy(enemy, bullet.damage || 1);
  }

  /* 冰霜弹的减速：只改速度倍率，不动 e.speed 本身，
     所以减速一结束把速度算回去就行，不用记原始值 */
  applyFrost(enemy) {
    enemy.slowTimer = 1500;
    enemy.setTint(0x8fd0ff);
    this.applyEnemyVelocity(enemy);
  }

  killEnemy(enemy) {
    const x = enemy.x, y = enemy.y;
    const typeDef = enemy.typeDef;
    const isSpecial = !!(typeDef && typeDef.isSpecial);

    this.recycleEnemy(enemy);   // typeDef 已在上面取出，回收清空不影响后续

    this.registerKill();
    const mult = this.getComboMultiplier();

    const baseScore = typeDef ? typeDef.score : 10;
    // 肉鸽的「贪婪之眼」在这里生效：只放大积分，不放大金币 ——
    // 金币是商城的货币，被增幅放大就变成刷钱了
    const gain = Math.round(baseScore * mult * this.mods.scoreMul);
    this.addScore(gain);

    // 金币和分数是两条独立的线：分数受连击倍率放大，金币不受，
    // 否则高连击时会变成"刷钱"而不是"活下来"
    let coins = isSpecial ? CONFIG.coinSpecial : CONFIG.coinNormal;
    if (this.hasSkill('greed') && Math.random() < 0.3) coins++;
    this.addCoins(coins);

    this.showScorePopup(x, y, gain, mult, isSpecial);

    this.burstKill.explode(isSpecial ? 18 : 12, x, y);
    this.shockRing.emitParticleAt(x, y, isSpecial ? 2 : 1);
    this.shakeScreen(isSpecial ? 140 : 90, isSpecial ? 0.008 : CONFIG.shakeOnKill, true);

    if (isSpecial) {
      SoundSys.heavyKill();
      Utils.vibrate(CONFIG.vibrateOnHeavyKill);
      // 击杀特殊敌人时触发短暂慢动作，让"这一下"有仪式感
      this.triggerSlowMo(CONFIG.slowMoMs);
    } else {
      // 连击越高击杀音越尖，形成"越打越热"的听觉坡度
      SoundSys.kill(this.comboCount);
    }

    if (typeDef && typeDef.onDeath === 'burst') this.burstOnDeath(x, y, typeDef);

    this.tryDropPowerup(x, y, isSpecial);

    this.onRogueKill();

    // 死灵法师：击杀累计到阈值就给召唤技能回一次次数。
    // 放在这里而不是某个"玩家击杀"的分支里 —— 骷髅的箭打死敌人也该算，
    // 否则玩家会发现"我召唤的帮手打死的怪不算数"，这违反直觉
    this.tickKillRecover();

    // 「亡者烙印」：击杀时概率引发一次爆炸。爆炸本身又会打死人，
    // 于是可能连锁触发 —— 用深度计数兜底，否则一圈敌人挨在一起时会递归到爆栈
    const m = this.mods;
    if (m.boomChance > 0 && Math.random() < m.boomChance && this._boomDepth < 3) {
      this._boomDepth = (this._boomDepth || 0) + 1;
      this.explodeAt(x, y, 76, 3, 'sparks');
      this._boomDepth--;
    }

    this.tweens.killTweensOf(this.scoreText);
    this.scoreText.setScale(1.22);
    this.tweens.add({ targets: this.scoreText, scale: 1, duration: 160, ease: 'Quad.easeOut' });
  }

  /* 金币入口。localStorage 是同步写，每杀一个就落盘一次会拖帧，
     所以攒够 1 秒才真正写一次；暂停 / 结算 / 退出场景时都会补一次落盘 */
  addCoins(n) {
    this.coins += n;
    this.coinsEarned += n;
    this.updateCoinText();

    // 数字弹一下：不弹的话玩家很容易整局都没注意到自己在赚钱
    this.tweens.killTweensOf(this.coinText);
    this.coinText.setScale(1.25);
    this.tweens.add({ targets: this.coinText, scale: 1, duration: 150, ease: 'Quad.easeOut' });

    const now = performance.now();
    if (now - this._lastCoinSave > 1000) {
      this._lastCoinSave = now;
      Storage.writeCoins(this.coins);
    }
  }

  flushCoins() { Storage.writeCoins(this.coins); }

  burstOnDeath(x, y, typeDef) {
    const speed = CONFIG.enemyBulletSpeed * 0.95;
    const muzzle = 14;
    const bulletKey = (typeDef && typeDef.crescent) ? 'bullet-e-crescent' : 'bullet-e';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.fireBullet(this.enemyBullets,
        x + Math.cos(a) * muzzle, y + Math.sin(a) * muzzle,
        Math.cos(a) * speed, Math.sin(a) * speed, bulletKey);
    }
    this.burstKill.explode(24, x, y);
    this.shakeScreen(180, 0.009, true);
  }

  onBulletHitsPlayer(player, bullet) {
    if (!bullet.active) return;
    // 撞上的是 P1 还是 P2。后面的结界 / 无敌帧 / 护盾 / 扣血全部按这一位算 ——
    // 不切的话两个人的无敌帧会串在一起，表现为"P1 挨打后 P2 也跟着闪"
    this.usePlayer(player);

    // 逆反结界：完全不掉血，把这一发原路弹回去变成自己的火弹。
    // 放在最前面，因为它是"完全免伤"，不该被后面的无敌 / 护盾逻辑截断
    if (this.skillActive.ward > 0) {
      this.reflectBullet(bullet);
      return;
    }

    // 天赋【反射】：堕天形态期间有 15% 概率反弹碰到的敌弹
    if (this.skillActive.darkform > 0 && this.hasTalent('reflect') && Math.random() < 0.15) {
      this.reflectBullet(bullet);
      SoundSys.deflect();
      return;
    }

    this.killBullet(bullet);
    this.hurtPlayer('bullet');
  }

  /* 反弹：敌弹从哪来就朝哪打回去一发玩家的火弹。
     不直接把这颗子弹改个速度复用 —— 敌弹和玩家弹在两个不同的物理组里，
     只改速度进不了"玩家弹 vs 敌人"的判定，等于弹了个寂寞。
     只能先回收它，再从玩家弹池里新打一发。 */
  reflectBullet(b) {
    const bvx = b.body ? b.body.velocity.x : 0;
    const bvy = b.body ? b.body.velocity.y : 0;
    const speed = Math.hypot(bvx, bvy) || CONFIG.bulletSpeed;
    const a = Math.atan2(-bvy, -bvx);   // 原路返回
    const x = b.x, y = b.y;

    this.killBullet(b);

    // 天赋【双生】：反弹子弹变成两发（带有微小散布）
    const angles = this.hasTalent('twin') ? [a - 0.08, a + 0.08] : [a];
    for (const ang of angles) {
      this.fireBullet(this.playerBullets, x, y,
        Math.cos(ang) * speed * 1.5, Math.sin(ang) * speed * 1.5,
        'bullet-fire', { damage: this.weaponDef.damage, pierce: 0 });
    }

    // 天赋【奥术回响】：20% 概率增加堕天次数
    if (this.hasTalent('echo') && Math.random() < 0.2) {
      const curCharges = this.skillCharges['darkform'] || 0;
      const maxCharges = SKILLS.darkform.charges + 2; // 最多额外+2次
      if (curCharges < maxCharges) {
        this.skillCharges['darkform'] = curCharges + 1;
        this.popText(this.player.x, this.player.y - 48, '堕天 +1', '#ff5a2a');
      }
    }

    this.shockRing.emitParticleAt(x, y, 1);
    SoundSys.deflect();
  }

  onEnemyHitsPlayer(player, enemy) {
    if (!enemy.active || enemy.spawning) return;
    // 撞上的是哪位：冲锋撞死敌人 / 受伤都按这一位结算
    this.usePlayer(player);

    // 亡灵是友军，贴着玩家站也不会伤血。必须放在最前面 ——
    // 下面那条普通路径会 recycleEnemy(enemy)，把玩家的亡灵直接回收掉，
    // 而亡灵追踪敌人时几乎必然要从玩家身边经过
    if (enemy.undead) return;

    // BOSS 撞人：只扣血，既不回收也不吃冲锋的"撞谁谁死"。
    // 必须放在最前面 —— 下面冲锋那条路径会执行 damageEnemy(enemy, enemy.hp)，
    // 拿 boss 的血量当伤害值传进去，等于玩家一冲锋就把 boss 秒了
    if (enemy.isBoss) {
      this.hurtPlayer();
      return;
    }

    // 小巫妖不撞人。用户明确说它们"只会发射小月牙波" ——
    // 它们是会追着玩家飘的炮台，撞死玩家会让人完全摸不着头脑
    //（看着像个悬浮的装饰，走上去却掉血）。伤害全部来自它们发的小月牙
    if (enemy.isMinion) return;

    // 冲锋中：撞到谁谁当场死，玩家一点血都不掉（冲锋全程无敌）。
    // 伤害值传 enemy.hp 而不是一个大数 —— 满血铁甲兵也正好一击带走，
    // 语义上就是"这条路径上的敌人全死"，不是"打了一大坨伤害"
    if (this.skillActive.charge > 0) {
      this.burstKill.explode(14, enemy.x, enemy.y);
      this.damageEnemy(enemy, enemy.hp);
      this.shakeScreen(90, 0.004, true);
      return;
    }

    const isRusher = !!(enemy.typeDef && enemy.typeDef.touchDamage);

    this.burstKill.explode(10, enemy.x, enemy.y);
    this.recycleEnemy(enemy);

    if (isRusher) this.hurtPlayer();
  }

  hurtPlayer(dmgType) {
    const p = this.player;
    if (window.__cheatInvincible) return;  // 作弊菜单：全局无敌
    if (p.invincible || this.state !== 'playing') return;

    // 天赋【战术】（勇者）：减伤期间 50% 概率免伤
    if (this._wardBuffMs > 0 && Math.random() < 0.5) {
      this.popText(p.x, p.y - 30, '减伤！', '#7fd4ff');
      this.burstHit.explode(10, p.x, p.y);
      return;
    }

    // 天赋【防爆服】（矮人）：受到爆炸伤害时 20% 概率完全免伤
    if (dmgType === 'blast' && this.hasTalent('blastarmor') && Math.random() < 0.2) {
      this.popText(p.x, p.y - 30, '挡爆', '#ffcc66');
      this.grantInvincible(300);
      return;
    }

    // 天赋【铁骨】（矮人）：冲撞伤害 50% 概率完全免伤
    if (dmgType === 'touch' && this.hasTalent('ironbone') && Math.random() < 0.5) {
      this.popText(p.x, p.y - 30, '铁骨', '#aaffcc');
      this.grantInvincible(300);
      return;
    }

    if (this.buffs.shield) {
      // 护盾挡伤：不扣血、不断连击，只消耗护盾并给一小段无敌
      this.buffs.shield = false;
      p.invincible = true;
      this.time.delayedCall(600, () => { if (this.state === 'playing') p.invincible = false; });
      this.burstHit.explode(24, p.x, p.y);
      this.shakeScreen(140, 0.008, true);
      SoundSys.comboBreak();
      this.updateBuffText();
      return;
    }

    SoundSys.hurt();
    Utils.vibrate(CONFIG.vibrateOnHurt);
    this.lives--;
    // 受伤动画：4 帧 @12fps ≈ 340ms，播完由 updatePlayerVisual 自动切回跑步。
    // 护盾挡下的那次不走这里 —— 没掉血就不该有挨打的姿态
    this.playerHurtMs = 340;

    // 荆棘护甲：真掉血才反击（被护盾挡下的那次不算）。
    // 放在扣血之后、死亡判定之前，这样"最后一击"也能还手
    if (this.hasSkill('thorn')) this.fireThorns();

    if (this.lives === 1) this.heartbeatTimer = 1200;

    this.updateLivesHUD();
    this.shakeScreen(220, CONFIG.shakeOnPlayerHit, true);
    this.burstHit.explode(16, p.x, p.y);
    this.flashHit();

    if (this.comboCount > 0) {
      this.comboCount = 0;
      this.comboTimer = 0;
      this.updateComboHUD();
    }

    if (this.lives <= 0) {
      // 天赋【紧急避险】（矮人）：致命伤害时若炸药在冷却，重置冷却 + 推敌 + 锁 1 血
      if (this.hasTalent('lastresort') && !this._lastResortUsed) {
        const left = this.skillCooldownLeft['throwbomb'] || 0;
        if (left > 0) {
          this._lastResortUsed = true;
          this.skillCooldownLeft['throwbomb'] = 0;
          this.skillCooldownTotal['throwbomb'] = 0;
          this.lives = 1;
          this.updateLivesHUD();
          this.explodeAt(this.player.x, this.player.y, 140, 1, 'explosion');
          this.enemies.children.each(e => {
            if (!e.active || e.spawning || e.undead || e.isBoss || e.isMinion) return;
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 170) {
              this.damageEnemy(e, 99);
            }
          });
          this.grantInvincible(2200);
          this.showBanner('紧 急 避 险', '#ff4a3a');
          return;
        }
      }
      // 天赋【灵魂链接】（亡灵法师）：消耗所有亡灵，每只回复 1 血
      if (this.hasTalent('soulchain') && !this._soulChainUsed) {
        let undeadCount = 0;
        this.enemies.children.each(e => {
          if (e.active && e.undead) undeadCount++;
        });
        if (undeadCount > 0) {
          this._soulChainUsed = true;
          const heal = Math.min(undeadCount, this.maxLives);
          this.enemies.children.each(e => {
            if (e.active && e.undead) this.fadeUndead(e);
          });
          this.lives = heal;
          this.updateLivesHUD();
          this.grantInvincible(2200);
          this.showBanner('灵 魂 链 接', '#c98fff');
          return;
        }
      }
      // 复活护符：每局只有一次机会，用完就照常结算
      if (this.hasSkill('revive') && !this.reviveUsed) {
        this.reviveUsed = true;
        this.doRevive();
        return;
      }
      this.gameOver();
      return;
    }
    // 「幻影步」把受击无敌时间拉长，给站桩输出留出窗口
    this.grantInvincible(CONFIG.playerInvincibleMs * this.mods.invMul);
  }

  /* 荆棘护甲：向八个方向各打一发。走玩家子弹池，所以能正常命中、正常结算击杀 */
  fireThorns() {
    const p = this.player;
    const n = 8;
    const speed = 520;
    const opts = { damage: 1, pierce: 0 };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 8;
      this.fireBullet(this.playerBullets,
        p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18,
        Math.cos(a) * speed, Math.sin(a) * speed, 'bullet-p', opts);
    }
  }

  /* 复活护符：补 1 条命 + 清空全场。
     不清场的话，复活瞬间会被原来贴脸的敌人再撞一次，等于白复活 */
  doRevive() {
    this.lives = 1;
    this.updateLivesHUD();

    this.enemies.children.each((e) => {
      if (!e.active || e.spawning) return;
      this.burstHit.explode(10, e.x, e.y);
      this.recycleEnemy(e);
    });

    this.burstKill.explode(30, this.player.x, this.player.y);
    this.shakeScreen(300, 0.014, true);
    this.tweens.killTweensOf(this.flashWhite);
    this.flashWhite.setAlpha(0.5);
    this.tweens.add({ targets: this.flashWhite, alpha: 0, duration: 420 });

    SoundSys.levelup();
    this.showSkillToast('复 活');
    this.grantInvincible(1800);
  }

  /* 无敌帧。用递增 token 保证"多次授予只认最后一次收尾" ——
     早期实现是每次直接挂一个 delayedCall，先挂的那个到点就把 invincible
     清成 false，把后授予的那段无敌一起掐掉。
     例：挨打给 1.4 秒（t=0~1400），第 1 秒时裂地斩又给 1.15 秒（t=1000~2150），
     第一个回调在 t=1400 触发 → 施法姿态还剩 550ms 却已经不无敌了，
     "施法期间无敌"这个承诺就破了。
     2026-09-16 施法姿态统一给无敌帧之后，这种重叠从"偶尔"变成"常见"，
     所以必须修。只有最后一次授予的回调才有权清除。

     ⚠️ _invToken 刻意不在 create 里清零：它是单调递增的，
     这样重开一局后残留的旧回调（token 比当前小）永远匹配不上、不会误清。
     一旦清零，上一局 token=1 的残留回调就会撞上新一局第一个 token=1 的授予 */
  grantInvincible(ms) {
    const p = this.player;
    if (!p.visible) return;
    p.invincible = true;
    const token = (this._invToken = (this._invToken || 0) + 1);
    this.tweens.killTweensOf(p);
    this.tweens.add({ targets: p, alpha: 0.3, duration: 130, yoyo: true, repeat: -1 });
    this.time.delayedCall(ms, () => {
      if (this.state !== 'playing') return;
      // 这段时间里又被授予过 → 交给那一次收尾，别抢先解掉
      if (token !== this._invToken) return;
      this.tweens.killTweensOf(p);
      p.setAlpha(1);
      p.invincible = false;
    });
  }

  /* 把 0..maxDifficulty 的难度映射到 0..1 的进度，用指数饱和避免后段陡增 */
  diffProgress(d) {
    const max = CONFIG.maxDifficulty;
    const tau = CONFIG.diffSaturateTau;
    const norm = 1 - Math.exp(-max / tau);
    return (1 - Math.exp(-d / tau)) / norm;
  }

  getDiffParams() {
    const d = this.difficultyLevel;
    const p = this.diffProgress(d);

    return {
      level: d,
      spawnInterval:     Utils.lerp(CONFIG.spawnInterval, CONFIG.spawnIntervalFinal, p),
      maxEnemies:        Math.round(Utils.lerp(CONFIG.maxEnemies, CONFIG.maxEnemiesFinal, p)),
      enemySpeed:        Utils.lerp(CONFIG.enemySpeed, CONFIG.enemySpeedFinal, p),
      enemyFireInterval: Utils.lerp(CONFIG.enemyFireInterval, CONFIG.enemyFireIntervalFinal, p),
      spawnBurstMin:     Math.min(4, 1 + Math.floor(d / 6)),
      spawnBurstMax:     Math.min(4, 1 + Math.ceil(d / 3)),
    };
  }

  /* ==========================================================================
     肉鸽模式 · 积分 / 阶段 / 增幅三选一
     ========================================================================== */

  /* 所有加分的唯一入口。
     "跨过 buffStep 就攒一次三选一"这件事只在这里判断 ——
     散在 killEnemy / damageBoss 里各写一遍，迟早会漏掉一处，
     表现为"打完 BOSS 才发现少弹了一张卡" */
  addScore(n) {
    const add = Math.max(0, Math.round(n));
    if (add === 0) return;
    this.score += add;
    this.scoreText.setText(String(this.score));

    if (!this.rogueMode) return;

    // 一次加太多分时（未来的大额奖励、或者调试时直接灌分），
    // 朴素的 while 会攒出成百上千次三选一，玩家得连点几分钟才回到游戏。
    // 这里给个上限：超过就把阈值直接推到当前分之后，少给的卡当作没发生
    let steps = 0;
    let step = this.buffStepBase();
    while (this.score >= this.rogue.nextBuffAt) {
      this.rogue.buffsTaken++;
      // 第 n 张卡的宽度 = base + grow × n（封顶）。
      // 所以阈值依次是 300 / 750 / 1350 / 2100 / 3000 —— 第 1 张最便宜，越往后越贵。
      // 双人模式下 base / max 会整体乘 TWO_PLAYER.buffStepMul
      step = Math.min(this.buffStepMax(),
        this.buffStepBase() + ROGUE.buffStepGrow * this.rogue.buffsTaken);
      this.rogue.nextBuffAt += step;
      this.rogue.curStep = step;
      if (++steps >= 5) {
        this.rogue.nextBuffAt = this.score + step;
        this.rogue.curStep = step;
        break;
      }
    }
    this.rogue.pendingBuffs += steps;
  }

  /* 每击杀一个敌人调一次：血祭 / 血怒的回血阈值在这里结算 */
  onRogueKill() {
    if (!this.rogueMode) return;
    const g = this.rogue;
    g.killCount++;

    /* 回血阈值是**击杀者自己**的增幅（血祭 / 血怒），进度也各记各的 ——
       共享一个计数器的话，两个人交替击杀会互相把对方的进度顶掉，
       表现为"明明杀了 30 个却没回血" */
    const m = this.mods;
    if (m.healEvery <= 0) return;

    this.P.healCount++;
    if (this.P.healCount < m.healEvery) return;
    this.P.healCount = 0;
    // 生命是共享的，所以回血直接加在共享血条上
    if (this.lives >= this.maxLives) return;

    this.lives++;
    this.updateLivesHUD();
    this.popText(this.player.x, this.player.y - 34, '+1', '#ff8a8a');
  }

  /* 三选一能不能现在弹。
     BOSS 从黑影到落地这一段必须排除：玩家会看到黑影卡在半空、
     boss 却已经在选卡，而且选卡期间物理是暂停的，落地演出会永远停在那儿。
     飞骑的 flyin 同理 —— 它正在从场外往落点飞，中途弹选卡会把进场演出冻在半路。
     dying 也必须排除 —— BOSS 击杀奖励是 1200 分，比 buffStep(900) 还大，
     几乎必定跨过积分线；如果这时弹积分卡，state 变 choosing，
     1500ms 后 onBossDefeated 撞上 state !== 'playing' 直接 return，
     BOSS 不回收、地图不推进，整局就卡死在"场上什么都没有"的状态 */
  rogueCanInterrupt() {
    if (!this.rogueMode) return false;
    if (this.state !== 'playing') return false;
    if (this.bossState === 'telegraph' || this.bossState === 'fall'
      || this.bossState === 'flyin') return false;
    if (this.bossState === 'dying') return false;
    return true;
  }

  updateRogue(dms) {
    if (!this.rogueMode) return;
    const g = this.rogue;

    // 被暂停 / 选卡推迟的 BOSS 结算，回到 playing 后第一件事就是补上。
    // 必须排在 pendingBuffs 前面：否则会先弹积分卡，这张图的推进又得再等一轮，
    // 玩家会看到"打完 BOSS 却迟迟不进下一张图"
    if (this._bossDefeatPending) { this.onBossDefeated(); return; }

    // 攒下的增幅先弹出来。一帧只弹一次 —— 连跨两级时下一帧接着弹，
    // 不能 while 循环连着弹两个，第二张卡会把第一张卡盖掉
    if (g.pendingBuffs > 0 && this.rogueCanInterrupt()) {
      g.pendingBuffs--;
      this.enqueueBuffChoices({
        title: '积 分 突 破',
        sub: '累计 ' + this.score + ' 分 · 选一项永久增幅',
        strongChance: 0,
        onPick: b => this.applyBuff(b),
      });
      return;
    }

    if (g.phase === 'wave') {
      g.waveLeft -= dms;
      if (g.waveLeft <= 0) {
        g.waveLeft = 0;
        g.phase = 'bossIntro';
        this.beginBossIntro();
      }
    }
  }

  /* 当前 BOSS 的配置表。三只 BOSS 的 hpBase / scorePerHp / deathMs / 体型全都不同，
     到处写三元表达式迟早漏一处 —— 而漏掉的表现是"打巫妖王不给分"这种，
     不报错、不崩溃，只是数值悄悄不对，最难发现 */
  bossK() {
    return this.bossKind === 'goblin' ? GOBLIN
      : this.bossKind === 'lich' ? LICH : BOSS;
  }

  /* 小怪阶段结束：先把场上的杂兵和敌弹清干净，再放 BOSS */
  beginBossIntro() {
    this.clearFieldForBoss();
    this.showBanner('B O S S   降 临', '#ff8a6a');
    SoundSys.levelup();

    // 落点：随机格子，但离**每个**玩家都至少 2.5 格 —— 一屁股坐在玩家脸上，
    // 玩家连躲的余地都没有，那不是难，是耍赖。
    // 双人时必须两个人都躲开，只躲一个的话另一位开局就被贴脸
    const pc = this.playerCells();
    let col = Math.floor(CONFIG.cols / 2), row = Math.floor(CONFIG.rows / 2);
    for (let i = 0; i < 40; i++) {
      const c = Phaser.Math.Between(0, CONFIG.cols - 1);
      const r = Phaser.Math.Between(0, CONFIG.rows - 1);
      let ok = true;
      for (let k = 0; k < pc.cols.length; k++) {
        if (Math.hypot(c - pc.cols[k], r - pc.rows[k]) < 2.5) { ok = false; break; }
      }
      if (ok) { col = c; row = r; break; }
    }
    this.bossCue = { x: Utils.colCenter(col), y: Utils.rowCenter(row) };

    // 这一场是谁：第 1 张图哥布林飞骑、第 2 张图巫妖王、第 3 张图骷髅王。
    // 血量按各自那张表算 —— 三只 BOSS 的 hpBase / hpPerMap 都不一样
    this.bossKind = ROGUE.bossKind[Math.min(this.rogue.map, ROGUE.bossKind.length - 1)];
    const K = this.bossK();
    this.bossNameText.setText(K.name);

    this.bossHpMax = K.hpBase + K.hpPerMap * this.rogue.map;
    this.bossHp = this.bossHpMax;
    this.bossFacing = 'down';
    // 狂暴计时从这一场 BOSS 重新起算，否则第 2 张图的 BOSS 会继承第 1 张图的狂暴值
    this.bossFightMs = 0;
    this.refreshBossTune();
    this.enterBossState('telegraph');
  }

  /* 清场：小怪淡出而不是凭空消失，敌弹一起清掉。
     敌弹不清的话，BOSS 还没落地玩家就先被上一波子弹打死了 */
  clearFieldForBoss() {
    this.enemies.children.each(e => {
      if (!e.active || e.isBoss) return;
      // 立刻退出判定，否则淡出这 320ms 里它还在伤人
      e.spawning = true;
      if (e.body) { e.body.stop(); e.body.enable = false; }
      this.tweens.killTweensOf(e);
      if (e.shadow) e.shadow.setVisible(false);
      this.tweens.add({
        targets: e, alpha: 0, scale: (e.baseScale || 1) * 0.4,
        duration: 320, ease: 'Quad.easeIn',
        onComplete: () => { if (e.active) this.recycleEnemy(e); },
      });
    });
    this.clearEnemyBullets();
    this.isSpawning = false;
    this.spawnAccum = 0;
  }

  clearEnemyBullets() {
    this.enemyBullets.children.each(b => { if (b.active) this.killBullet(b); });
  }

  rollBuffCards(n, strongChance) {
    const out = [];
    const pickOne = (tier) => {
      const pool = ROGUE_BUFFS.filter(b => b.tier === tier);
      // 同一轮里不出现重复的卡，否则三选一会变成"两个一样 + 一个别的"
      for (let i = 0; i < 50; i++) {
        const b = Phaser.Utils.Array.GetRandom(pool);
        if (out.indexOf(b) < 0) return b;
      }
      return pool[0];
    };
    for (let i = 0; i < n; i++) {
      const strong = strongChance > 0 && Math.random() < strongChance;
      out.push(pickOne(strong ? 2 : 1));
    }
    return out;
  }

  /* 增幅结算。mod 里的键分三类，处理方式必须分开写：
       加区（pierceAdd / multiShot）—— 直接累加
       乘区（dmgMul / intervalMul / …）—— 连乘，叠三次 1.18 就是 1.64 倍
       阈值类（healEvery）—— 取更优的那个，连乘会变成 360 杀回一血
       概率类（critChance / boomChance）—— 相加并封顶，防止叠成 100% 必爆 */
  applyBuff(b) {
    const m = this.mods;
    for (const [k, v] of Object.entries(b.mod)) {
      switch (k) {
        case 'lifeAdd':   this.addLives(v); break;
        case 'pierceAdd': m.pierceAdd += v; break;
        case 'multiShot': m.multiShot += v; break;
        case 'healEvery': m.healEvery = m.healEvery > 0 ? Math.min(m.healEvery, v) : v; break;
        case 'critChance': m.critChance = Math.min(0.55, m.critChance + v); break;
        case 'boomChance': m.boomChance = Math.min(0.55, m.boomChance + v); break;
        default:          m[k] *= v; break;
      }
    }
    this.rogue.picks.push(b.key);
    SoundSys.levelup();
    this.showSkillToast(b.name);
  }

  addLives(n) {
    this.maxLives += n;
    this.lives = Math.min(this.maxLives, this.lives + n);
    // 生命图标是在 buildLivesHUD 里按当时的 maxLives 建好的，
    // 上限涨了必须补建，否则新加的命在 HUD 上看不见
    const step = this.maxLives > 5 ? 26 : 34;
    const sc = this.maxLives > 5 ? 0.78 : 1;
    for (let i = this.lifeIcons.length; i < this.maxLives; i++) {
      const icon = this.add.image(CONFIG.width - 90 - i * step, 44, 'life').setDepth(9000);
      if (sc !== 1) icon.setScale(sc);
      this.lifeIcons.push(icon);
    }
    // 数量跨过 5 这个坎时要整体重排（比如双人局吃到【生命上限】从 6 变 8），
    // 否则新旧图标会用两套间距，排出来是断开的
    if (step !== this._lifeStep) {
      this._lifeStep = step;
      this._lifeScale = sc;
      this.lifeIcons.forEach((icon, i) => {
        icon.setPosition(CONFIG.width - 90 - i * step, 44);
        icon.setScale(sc);
      });
    }
    this.updateLivesHUD();
  }

  /* 三选一入队。
     单人局 = 一个人选一张，和以前完全一样；
     双人局 = 两个人**各自**选一张，两套卡是独立随机出来的 ——
     需求是"不共享增幅，各自计算"，所以谁选到的卡只进谁的乘区。
     连续弹两次而不是并排塞进一屏：卡片尺寸不用缩、描述看得清，
     而且选卡期间物理本来就是暂停的，多等一次不影响公平性 */
  enqueueBuffChoices(opts) {
    if (!this.buffQueue) this.buffQueue = [];
    for (let i = 0; i < this.players.length; i++) {
      this.buffQueue.push({ pi: i, opts });
    }
    this.showNextBuffChoice();
  }

  /* 弹队列里的下一张卡；队列空了才恢复游戏 */
  showNextBuffChoice() {
    const job = this.buffQueue && this.buffQueue.shift();
    if (!job) {
      this._buffChoice = null;
      this.hideOverlay();
      this.state = 'playing';
      this.physics.world.resume();
      return;
    }
    // 切到该选卡的那位：applyBuff 读的是代理字段，切错了卡就加错人
    this.pIndex = job.pi;
    this.showBuffChoice({
      title: job.opts.title,
      sub: job.opts.sub,
      strongChance: job.opts.strongChance,
      // 双人局在标题上方标一句"这张卡是给谁的"，否则玩家分不清现在轮到谁选
      tag: this.players.length > 1 ? (job.pi === 0 ? 'P 1  选 择' : 'P 2  选 择') : null,
      onPick: job.opts.onPick,
    });
  }

  /* 三选一面板。三张卡横排，点卡片或按 1/2/3 都能选。
     选卡期间 state='choosing' + 物理暂停 —— update 直接 return，
     敌人、子弹、BOSS 状态机全部冻住，选完再原样恢复 */
  showBuffChoice(opts) {
    this.state = 'choosing';
    this.physics.world.pause();
    this.clearOverlay();
    this.overlay.setVisible(true).setAlpha(1);

    const W = CONFIG.width, H = CONFIG.height;
    const cards = this.rollBuffCards(3, opts.strongChance || 0);
    this._buffChoice = { cards, onPick: opts.onPick };

    const bg = this.add.rectangle(0, 0, W, H, 0x060b12, 0.9).setOrigin(0, 0);
    bg.setInteractive();
    this.overlay.add(bg);

    // 双人局的归属标签。放在标题上方，不挤占原来的排版
    if (opts.tag) {
      const tw = 148, th = 32, ty = 30;
      const tagBg = this.add.graphics();
      tagBg.fillStyle(0x1e3446, 1);
      tagBg.fillRoundedRect(W / 2 - tw / 2, ty, tw, th, 10);
      tagBg.lineStyle(2, 0x4ac2ff, 0.9);
      tagBg.strokeRoundedRect(W / 2 - tw / 2, ty, tw, th, 10);
      this.overlay.add(tagBg);
      this.overlay.add(this.add.text(W / 2, ty + th / 2, opts.tag, {
        fontFamily: UI.FONT, fontSize: '17px', color: '#bfe4ff', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    const t1 = this.add.text(W / 2, 76, opts.title, {
      fontFamily: UI.FONT, fontSize: '42px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    t1.setShadow(0, 5, '#000000', 12, true, true);
    this.overlay.add(t1);

    const t2 = this.add.text(W / 2, 124, opts.sub, {
      fontFamily: UI.FONT, fontSize: '16px', color: '#8fa3b8',
    }).setOrigin(0.5);
    this.overlay.add(t2);

    const cw = 256, chh = 348, gap = 26;
    const x0 = (W - (3 * cw + 2 * gap)) / 2 + cw / 2;
    const cy = 348;

    cards.forEach((b, i) => {
      const cont = this.add.container(x0 + i * (cw + gap), cy);
      const hex = '#' + b.color.toString(16).padStart(6, '0');

      const g = this.add.graphics();
      const draw = (hovered) => {
        g.clear();
        g.fillStyle(0x000000, 0.45);
        g.fillRoundedRect(-cw / 2 + 5, -chh / 2 + 8, cw, chh, 18);
        g.fillStyle(hovered ? 0x1e3446 : 0x152130, 1);
        g.fillRoundedRect(-cw / 2, -chh / 2, cw, chh, 18);
        g.fillStyle(b.color, hovered ? 0.26 : 0.13);
        g.fillRoundedRect(-cw / 2 + 6, -chh / 2 + 6, cw - 12, 108, 14);
        g.lineStyle(hovered ? 4 : 3, b.color, hovered ? 1 : 0.75);
        g.strokeRoundedRect(-cw / 2, -chh / 2, cw, chh, 18);
      };
      draw(false);
      cont.add(g);

      cont.add(this.add.text(0, -chh / 2 + 58, b.icon, {
        fontFamily: UI.FONT, fontSize: '50px', color: hex, fontStyle: 'bold',
      }).setOrigin(0.5));

      cont.add(this.add.text(0, -chh / 2 + 106, b.tier === 2 ? '★  强 力' : '◆  常 规', {
        fontFamily: UI.FONT, fontSize: '13px',
        color: b.tier === 2 ? '#ffd54a' : '#8fa3b8',
      }).setOrigin(0.5));

      cont.add(this.add.text(0, -32, b.name, {
        fontFamily: UI.FONT, fontSize: '25px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));

      cont.add(this.add.text(0, 26, b.desc, {
        fontFamily: UI.FONT, fontSize: '15px', color: '#b8c8d8', align: 'center',
        wordWrap: { width: cw - 46, useAdvancedWrap: true },
      }).setOrigin(0.5));

      cont.add(this.add.text(0, chh / 2 - 30, '按 ' + (i + 1) + ' 键选择', {
        fontFamily: UI.FONT, fontSize: '13px', color: '#55697d',
      }).setOrigin(0.5));

      const hit = this.add.rectangle(0, 0, cw, chh, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => draw(true));
      hit.on('pointerout',  () => draw(false));
      hit.on('pointerdown', () => { SoundSys.unlock(); SoundSys.uiClick(); this.pickBuff(i); });
      cont.add(hit);

      cont.setAlpha(0);
      this.tweens.add({
        targets: cont, alpha: 1, y: cy - 8,
        delay: i * 70, duration: 220, ease: 'Quad.easeOut',
      });
      this.overlay.add(cont);
    });
  }

  pickBuff(i) {
    const c = this._buffChoice;
    if (!c || !c.cards[i]) return;
    const card = c.cards[i];
    this._buffChoice = null;

    this.applyBuff(card);
    if (c.onPick) c.onPick(card);

    // 双人局另一位还没选 → 接着弹下一张；队列空了才真正回到游戏。
    // showNextBuffChoice 内部会 clearOverlay + 重新 pause，所以这里不用先 hideOverlay
    if (this.buffQueue && this.buffQueue.length) {
      this.showNextBuffChoice();
      return;
    }

    this.hideOverlay();
    this.state = 'playing';
    this.physics.world.resume();
  }

  /* ==========================================================================
     BOSS · 骷髅王
     ========================================================================== */

  buildBossLayer() {
    // 黑影 / 警示圈：每帧重绘一个 Graphics，比维护一堆 Image + Tween 便宜，
    // 也不会漏销毁（boss 每张图要落一次场，漏一个就是永久残留）
    this.bossCueFX = this.add.graphics().setDepth(60);
    this.bossShockFX = this.add.graphics().setDepth(7040);
    // 落雷的预警圈 / 光柱。和 bossShockFX 一个套路：每帧重绘，
    // 不用一堆 Image + Tween —— 落雷最多同时挂 5 道，建对象会漏销毁
    this.bossBoltFX = this.add.graphics().setDepth(7055);
    this.bossBarFX = this.add.graphics().setDepth(9001);
    this.rogueBarFX = this.add.graphics().setDepth(9001);

    // 巫妖王的落地投影。为什么另外画一个而不是用它图集自带的：
    // 图集里烘的那块投影在构建时就剥掉了（不剥的话本体一浮起来，
    // 投影会跟着升空，看着像踩在空气上）。这里画在地面线上，
    // 高度越高越小越淡，才读得出"离地了"
    this.bossShadow = this.add.image(0, 0, 'shadow').setDepth(1).setVisible(false);

    // 名字在 beginBossIntro 里按 bossKind 改（两场 BOSS 名字不同），
    // 这里先建好空着，避免出场那一刻现建一个 Text 掉帧
    this.bossNameText = this.add.text(CONFIG.width / 2, 61, BOSS.name, {
      fontFamily: UI.FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(9002).setOrigin(0.5).setVisible(false);

    // 巫妖王的伤害倍率标签（只在 lich 时显示）。
    // 不加这个提示的话，玩家完全感觉不到"落地时伤害更高"这件事 ——
    // 一个只存在于代码里的机制等于不存在。
    // 位置放血条正下方 y=84：那里正好是血条（50~72）和连击条（112）之间的空隙
    this.bossMulText = this.add.text(CONFIG.width / 2, 84, '', {
      fontFamily: UI.MONO, fontSize: '13px', color: '#ffe066', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(9002).setOrigin(0.5).setVisible(false);

    // 砍影 / 反月牙 / 巫妖王的大小月牙共用这个池子
    //（都是"飞出去伤玩家的东西"，命中判定完全一样）。
    // maxSize 4 → 8 → 24：骷髅王最多同时 4 道砍影，飞骑一轮 4 发月牙，
    // 而巫妖王最凶的时候是"2 道大月牙 + 6 道竖月牙 + 场上 7 只小巫妖各打各的"
    // —— 月牙活得比一轮发射更长（2.2~2.6 秒），池子小会让后面的直接 get 失败、
    // 凭空消失，而且是**静默**消失（get 返回 null，什么都不发生），最难排查
    this.bossSlashes = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image, maxSize: 24,
    });
    /* 砍影 / 月牙的判定要一人挂一条 ——
       只挂 P1 的话，P2 站在月牙里完全不掉血（同 setupCollisions 里的三条判定）。
       processCallback（bossSlashHits）是纯几何判断，多挂几条没有副作用 */
    for (const P of this.players) {
      this.physics.add.overlap(this.bossSlashes, P.sprite,
        this.onBossSlashHitsPlayer, this.bossSlashHits, this);
    }
  }

  /* ---- 出场：黑影 → 天降 → 落地砸地 ---- */

  drawBossCue(t) {
    const g = this.bossCueFX;
    const c = this.bossCue;
    if (!c) return;
    g.clear();

    const r = 30 + 46 * t;                       // 黑影从小长到大
    g.fillStyle(0x000000, 0.16 + 0.42 * t);
    g.fillEllipse(c.x, c.y, r * 2, r * 0.95);

    // 警示环：从大收到小，收到和黑影一样大时就是落地时刻。
    // 收缩比放大更容易让玩家读出"还剩多久"，这是通用做法
    const ringR = 200 - 150 * t;
    g.lineStyle(3, 0xff5c4a, 0.35 + 0.5 * t);
    g.strokeEllipse(c.x, c.y, ringR * 2, ringR * 0.95);
    g.lineStyle(2, 0xffd54a, 0.25 + 0.4 * t);
    g.strokeEllipse(c.x, c.y, ringR * 2 + 12, ringR * 0.95 + 11);
  }

  createBossSprite() {
    const kind = this.bossKind;
    const gob = kind === 'goblin';
    const lich = kind === 'lich';
    const K = this.bossK();
    const idleTex = gob ? 'goblin-idle' : lich ? 'lich-idle' : 'boss-idle';

    const e = this.enemies.get(this.bossCue.x, this.bossCue.y - 640, idleTex);
    if (!e) { this.bossState = 'none'; return; }

    e.setTexture(idleTex, 0);
    e.setActive(true).setVisible(true);
    e.isBoss = true;
    e.isMinion = false;            // 池子共用，从巫妖王的小怪那捞回来的要清掉
    e.spawning = true;             // 出场演出期间免疫，别让玩家在演出里就把它打残
    e.shadowVisible = false;       // 巫妖王的投影在构建时剥掉了，另外画（见 bossShadow）
    e.typeDef = { key: 'boss', name: K.name, isSpecial: true };
    e.hp = this.bossHp;
    e.maxHp = this.bossHpMax;
    e.dir = DIRS.down;
    e.row = 0; e.col = 0;
    e.speed = 0;
    e.fireInterval = Infinity;
    e.slowTimer = 0;
    e.setAlpha(1);
    e.clearTint();

    // ⚠️ 物理体必须显式开启。enemies.get 从池里捞出来的对象，
    // 上一次 recycleEnemy 时被关了 body.enable。
    // 不重新开的话，整场战斗 BOSS 都碰不到任何东西 —— 玩家打不中它、
    // 它也撞不到玩家，只有它的投射物还能伤人。
    // 演出期间靠 e.spawning 挡命中判定，不靠关物理体
    if (e.body) e.body.enable = true;

    this.boss = e;
    this.bossFacing = 'down';
    this.bossAnimKey = '';
    // 骷髅王和巫妖王都是"跳"倒放（从天上砸下来）；飞骑的出场是飞进来，
    // 进 flyin 时才定动画
    this.playBossAnim(gob ? 'idle' : 'jump');

    // ---- 巫妖王：记下地面线 + 起一块落地投影 ----
    // 地面线 = 落点格子中心。漂浮高度、阴影位置、冲击波圆心全都相对它算，
    // 所以必须在这一刻钉死；后面 boss.y 会被"漂浮 + 起伏"改来改去
    if (lich) {
      this.lichGroundY = this.bossCue.y;
      this.lichFloat = 0;
      this.lichBobMs = 0;
      this.bossShadow.setVisible(true)
        .setPosition(this.bossCue.x, this.bossCue.y)
        .setScale(2.6).setAlpha(0.46);
    } else {
      this.bossShadow.setVisible(false);
    }

    this.bossNameText.setVisible(true);
  }

  /* 播一段 BOSS 动画。
     三只 BOSS 的帧规格完全不同，必须各取各的表：
       骷髅王 —— 单帧逐张不同（48 / 64 / 128），originY 要按当前帧高换算
       飞骑   —— 单帧统一 80，地面线统一 68
       巫妖王 —— 单帧统一 80，但每条动作的地面线 / 躯干质心都不一样（见 LICH_GROUND_Y）
     每次都要重设 origin 和物理体，因为帧尺寸换了 displayOrigin 就变了：
     漏了这一步，从待机切到攻击会整体下沉一大截（3 倍缩放下 24px 的跳变） */
  playBossAnim(act) {
    const b = this.boss;
    if (!b) return;

    const kind = this.bossKind;
    const gob = kind === 'goblin';
    const lich = kind === 'lich';
    const K = this.bossK();
    const def = gob ? GOBLIN_ANIMS[act] : lich ? LICH_ANIMS[act] : BOSS_ANIMS[act];
    if (!def) return;

    // 巫妖王固定朝下、不转身。两个原因：
    //   1) 素材 Left / Right 行的躯干质心偏帧心 5.5px（Death 左行偏到 10.6），
    //      按帧心对齐会让"朝左 / 朝右"时本体整体歪出去；
    //   2) 它是定点漂浮施法的，招式全靠投射物，本来就不需要转身。
    // 飞骑 / 骷髅王照旧跟着 bossFacing 转
    const facing = lich ? 'down' : this.bossFacing;
    const key = (gob ? 'gob-' : lich ? 'lich-' : 'boss-') + act + '-' + facing;
    if (!this.anims.exists(key)) return;

    const dimW = gob ? GOBLIN_FRAME : lich ? LICH_FRAME : BOSS_SHEET_DIMS[def.file].w;
    const dimH = gob ? GOBLIN_FRAME : lich ? LICH_FRAME : BOSS_SHEET_DIMS[def.file].h;
    const groundY = gob ? GOBLIN_GROUND_Y
      : lich ? LICH_GROUND_Y[def.file] : BOSS_GROUND_Y[def.file];
    // 躯干质心（帧内 x）。飞骑 / 骷髅王是居中的，巫妖王不是 ——
    // 它的躯干质心在 38.5~43.8 之间飘，按帧心 40 对齐的话，
    // 从 idle 切到 atk3 时整个本体横移 4px（3.4 倍缩放下 14px），看着像瞬移
    const cx = lich ? LICH_BODY_CX[def.file] : dimW / 2;

    b.setScale(K.scale);
    b.setOrigin(cx / dimW, groundY / dimH);

    // 物理体：半径和 offset 都以"帧内像素"为单位，帧尺寸换了就得重算。
    // 半径传 bodyR 而不是屏幕半径 —— setCircle 的半径会被 sprite 缩放再乘一次。
    // offset 用 cx - r 让判定圈和躯干同心（见上面 LICH_BODY_CX 那段）
    const r = K.bodyR;
    const cyF = groundY - K.bodyUp;
    if (b.body) b.body.setCircle(r, cx - r, cyF - r);

    if (this.bossAnimKey === key && b.anims.isPlaying) return;
    this.bossAnimKey = key;
    // 记下"这个状态本来该播哪个动作"：受伤闪完要靠它把动画还原回去。
    // hurt 自己不记 —— 否则闪完会去还原成 hurt，卡在受伤姿势上不动
    if (act !== 'hurt') this.bossAnimAct = act;
    b.anims.play(key, true);
  }

  enterBossState(s) {
    this.bossState = s;
    this.bossT = 0;
    const b = this.boss;

    switch (s) {
      case 'idle':
        this.playBossAnim('idle');
        break;

      // 旋转弹幕：atk2 是 4 帧一圈的旋斩，循环播
      case 'spin':
        this.bossSpinFired = 0;
        this.playBossAnim('atk2');
        break;

      // 走向最近的棋盘边缘
      case 'walkout':
        this.bossFacing = this.nearestEdgeDir(b.x, b.y);
        this.playBossAnim('walk');
        break;

      // 场外劈砍
      case 'slash':
        this.bossSlashFired = 0;
        this.bossSlashRewound = false;
        // 出手方向在起手那一刻就锁死：玩家看到抬镰刀还有时间闪开。
        // 两刀都实时瞄准的话就是必中，没有任何操作空间
        // 双人时瞄最近的那位
        const _tp = this.targetPlayer(b.x, b.y) || this.player;
        this.bossSlashDir = Math.atan2(_tp.y - b.y, _tp.x - b.x);
        this.playBossAnim('atk1');
        break;

      // 跳回棋盘
      case 'jumpback': {
        this.bossJumpFrom = { x: b.x, y: b.y };
        const land = this.pickBossLanding();
        this.bossJumpTo = land;
        // 起跳前先面向落点，否则会背对着飞过去
        const dx = land.x - b.x, dy = land.y - b.y;
        this.bossFacing = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        this.playBossAnim('jump');
        break;
      }

      case 'land':
        this.playBossAnim('land');
        break;

      case 'smash':
        this.bossFiredSmash = false;
        this.playBossAnim('atk3');
        break;

      /* ================= 以下只有哥布林飞骑会走到 ================= */

      // 飞上棋盘：起点固定在屏幕外，方向随机。
      // 起点必须按**屏幕边**算，不能按"离落点多少像素"算 —— 棋盘 832px 宽、
      // 屏幕 960px，落点靠近另一侧时，"离落点 560px"会落在屏幕里，
      // BOSS 就会凭空出现在场地正中央，而不是从场外飞进来
      case 'flyin': {
        const d = Phaser.Utils.Array.GetRandom(['down', 'up', 'left', 'right']);
        const M = GOBLIN.flyinMargin;
        this.bossFlyFrom = d === 'up' ? { x: this.bossCue.x, y: -M }
          : d === 'down' ? { x: this.bossCue.x, y: CONFIG.height + M }
            : d === 'left' ? { x: -M, y: this.bossCue.y }
              : { x: CONFIG.width + M, y: this.bossCue.y };
        // 朝向 = 飞行方向 = 起点的反方向（从屏幕上方飞下来就是朝下）
        this.bossFacing = d === 'up' ? 'down' : d === 'down' ? 'up'
          : d === 'left' ? 'right' : 'left';
        // 时长按距离算（进场速度恒定），再夹进 [min, max]
        this.bossFlyMs = Phaser.Math.Clamp(
          Math.hypot(this.bossFlyFrom.x - this.bossCue.x,
            this.bossFlyFrom.y - this.bossCue.y) / GOBLIN.flySpeed * 1000,
          GOBLIN.flyinMinMs, GOBLIN.flyinMaxMs);
        b.setPosition(this.bossFlyFrom.x, this.bossFlyFrom.y);
        if (b.body) b.body.reset(b.x, b.y);
        this.playBossAnim('move');
        break;
      }

      // 猛冲前摇：转向玩家 + 收翅膀蓄势。方向在这一刻锁死 ——
      // 玩家看到它收翅膀还有 600ms 可以闪开。实时追踪的话就是必中，没有操作空间
      case 'dashWind': {
        const plan = this.goblinDashPlan(b.x, b.y, this.dirToPlayer());
        this.goblinDashDir = plan.dir;
        this.goblinDashTo = plan.to;
        // 贴图只有四方向：掉头冲对面边时朝向也要跟着改，否则会背对着飞
        this.bossFacing = plan.dir;
        this.playBossAnim('wind');
        break;
      }

      case 'dashRun':
        this.playBossAnim('dive');
        this.shakeScreen(160, 0.008, true);
        SoundSys.enemyShoot();
        break;

      // 撞到边缘后的停顿。三次猛冲之间的"间隔"就靠它 ——
      // 没有这段，三连冲会连成一坨，玩家只能站着挨打
      case 'dashStop':
        this.playBossAnim('idle');
        break;

      // 月牙的转向前摇：每一发都重新瞄一次玩家。
      // 用户明确要"玩家移动，发射方向也要变化"，所以瞄准点不能锁死在段首
      case 'waveAim':
        this.bossFacing = this.dirToPlayer();
        this.playBossAnim('idle');
        break;

      case 'waveCast':
        this.goblinWaveFired = false;
        this.bossFacing = this.dirToPlayer();
        this.playBossAnim('cast');
        break;

      /* ================= 以下只有巫妖王会走到 ================= */

      // 飘起来（出场砸完地、以及 B 段落地之后都走这里）。
      // 位移不用管：动画本身是"离地 → 腾空"，updateLichBoss 收尾时补上 lichFloat
      case 'rise':
        this.playBossAnim('rise');
        break;

      // A 段的转向前摇：本体不动，只等时间 —— 这就是"释放技能的前摇"。
      // 和飞骑的 waveAim 同一个道理，只是巫妖王不转身（固定朝下）
      case 'waveWind':
        this.playBossAnim('idle');
        break;

      case 'waveCast':
        this.lichWaveFired = 0;
        this.playBossAnim('atk1');
        break;

      // B 段的前摇
      case 'slashWind':
        this.playBossAnim('idle');
        break;

      case 'slashCast':
        this.lichSlashFired = 0;
        this.lichSlashRewound = false;
        this.playBossAnim('atk2');
        break;

      // B 段收尾：落地。用户明确要的"等一会就落地"
      case 'landDrop':
        this.lichLandShocked = false;
        this.playBossAnim('land');
        break;

      // C 段的前摇
      case 'summonWind':
        this.playBossAnim('idle');
        break;

      case 'summonCast':
        this.lichSummoned = false;
        this.lichBoltFired = 0;
        this.playBossAnim('atk3');
        break;
    }
  }

  /* 算出本帧该用哪一档 BOSS 节奏，结果缓存在 this.bossTune。
     三个来源合成一个狂暴系数 rage：
        图基准   —— 第 2 / 3 张图的 BOSS 一登场就比上一张凶
        图内进度 —— 同一张图里缠斗越久越凶（打满 rageSpanMs 拉满）
        图斜率   —— 越后面的图涨得越快
     每帧算一次（几次乘加，可忽略），其他方法直接读 this.bossTune，
     免得同一个系数在五六个地方各算一遍、改一处漏一处 */
  refreshBossTune() {
    const map = Math.min(this.rogue.map, ROGUE.rageBase.length - 1);
    const prog = Math.min(1, this.bossFightMs / ROGUE.rageSpanMs);
    const rage = Math.min(ROGUE.rageMax,
      ROGUE.rageBase[map] + prog * ROGUE.rageSlope[map]);
    const k = rage / ROGUE.rageMax;              // 0..1 的插值权重
    const L = (a, b) => a + (b - a) * k;

    // 哥布林飞骑的节奏表。它没有"劈砍 / 走位 / 跳回"那套，
    // 只有"猛冲 + 月牙"两段，所以插值的项完全是另一组
    if (this.bossKind === 'goblin') {
      this.bossTune = {
        rage,
        dashSpeed:    L(GOBLIN.dashSpeed, GOBLIN.dashSpeedRage),
        dashStopMs:   L(GOBLIN.dashStopMs, GOBLIN.dashStopMsRage),
        segIdleMs:    L(GOBLIN.segIdleMs, GOBLIN.segIdleMsRage),
        waveCount:    Math.round(L(GOBLIN.waveCount, GOBLIN.waveCountRage)),
        waveWindupMs: L(GOBLIN.waveWindupMs, GOBLIN.waveWindupMsRage),
        waveSpeed:    L(GOBLIN.waveSpeed, GOBLIN.waveSpeedRage),
        // goBossPause 不传 ms 时的默认停顿。飞骑没有独立的两档停顿，
        // 段间停顿就是它 —— 留着是为了不让 bossTune.idleMs 变成 undefined
        idleMs:       L(GOBLIN.segIdleMs, GOBLIN.segIdleMsRage),
      };
      return this.bossTune;
    }

    // 巫妖王的节奏表。它的招式是"大月牙 / 三段劈 / 召唤 + 落雷"三选一循环，
    // 和骷髅王那套（弹幕 / 走位 / 劈砍 / 跳回）完全不同，插值项也是另一组。
    // 用户要求"攻击欲望、频率随时间不断变高" —— 全部靠这里的两端插值实现：
    // 缠斗越久 k 越大，前摇越短、召唤越多、落雷越密
    if (this.bossKind === 'lich') {
      // 狂暴到这条线，三段劈斩变两轮六刀。
      // 用 0.75 而不是骷髅王那条 1.0：第 2 张图的 rage 上限只到 1.1，
      // 按 1.0 算要缠斗 104 秒才触发，那会儿玩家早就打完了
      const dbl = rage >= LICH.slashDoubleAt;
      this.bossTune = {
        rage,
        hoverMs:      L(LICH.hoverMs, LICH.hoverMsRage),
        waveWindMs:   L(LICH.waveWindMs, LICH.waveWindMsRage),
        waveCount:    Math.round(L(LICH.waveCount, LICH.waveCountRage)),
        waveSpeed:    L(LICH.waveSpeed, LICH.waveSpeedRage),
        slashWindMs:  L(LICH.slashWindMs, LICH.slashWindMsRage),
        slashSpeed:   L(LICH.slashSpeed, LICH.slashSpeedRage),
        slashMarks:   dbl ? LICH.slashMarksRage : LICH.slashMarks,
        slashCastMs:  dbl ? LICH.slashCastMsRage : LICH.slashCastMs,
        minionCount:  Math.round(L(LICH.minionCount, LICH.minionCountRage)),
        minionFireMs: L(LICH.minionFireMs, LICH.minionFireMsRage),
        minionLifeMs: L(LICH.minionLifeMs, LICH.minionLifeMsRage),
        minionSpeed:  L(LICH.minionSpeed, LICH.minionSpeedRage),
        minionWaveSpeed: L(LICH.minionWaveSpeed, LICH.minionWaveSpeedRage),
        boltCount:    Math.round(L(LICH.boltCount, LICH.boltCountRage)),
        boltGapMs:    L(LICH.boltGapMs, LICH.boltGapMsRage),
        boltWarnMs:   L(LICH.boltWarnMs, LICH.boltWarnMsRage),
        // goBossPause 不传 ms 时的默认停顿 = 两次出招之间的漂浮停顿
        idleMs:       L(LICH.hoverMs, LICH.hoverMsRage),
      };
      return this.bossTune;
    }

    // 狂暴过半才把场外劈砍从两刀变两轮四刀。
    // 第 1 张图 rage 最高只到 0.5，永远到不了这条线 —— 新手那张图始终是两刀
    const four = rage >= ROGUE.rageFourSlashAt;

    this.bossTune = {
      rage,
      idleMs:      L(BOSS.idleMs, BOSS.idleMsRage),
      outIdleMs:   L(BOSS.outIdleMs, BOSS.outIdleMsRage),
      spinWaves:   Math.round(L(BOSS.spinWaves, BOSS.spinWavesRage)),
      spinGapMs:   L(BOSS.spinGapMs, BOSS.spinGapMsRage),
      spinBullets: Math.round(L(BOSS.spinBullets, BOSS.spinBulletsRage)),
      walkSpeed:   L(BOSS.walkSpeed, BOSS.walkSpeedRage),
      slashMarks:  four ? BOSS.slashMarksRage : BOSS.slashMarks,
      slashMs:     four ? BOSS.slashMsRage : BOSS.slashMs,
    };
    return this.bossTune;
  }

  /* 先停一小段再进下一个动作。所有"停一下"都从这里走，
     免得十几个 setTimeout 散在状态机里，想调节奏都找不到。
     不传 ms 就用当前狂暴档位的通用停顿 —— 这样"BOSS 越打越快"只需要改一个地方 */
  goBossPause(next, ms) {
    this.bossNext = next;
    this.bossPauseMs = ms != null ? ms
      : (this.bossTune ? this.bossTune.idleMs : BOSS.idleMs);
    this.enterBossState('idle');
  }

  /* 固定攻击流程的状态机。每个 case 只做"这一帧该做的事"，
     状态切换靠 bossT 超时 —— 不用嵌套 setTimeout，因为一旦被暂停或
     慢动作打断，嵌套定时器就会错位，而且极难排查 */
  updateBoss(dms) {
    if (!this.rogueMode) return;
    if (this.bossState === 'none' || this.bossState === 'dying') return;

    // 缠斗计时只在这里涨：暂停和选卡时 update() 首行就 return 了，
    // 所以挂机看菜单不会把 BOSS 越养越疯
    this.bossFightMs += dms;
    const T = this.refreshBossTune();

    this.bossT += dms;

    // 三只 BOSS 的固定攻击流程毫无共同点，分流到各自的 switch。
    // 共用的只有"外壳"：bossT 累加、狂暴档位、goBossPause、血条、死亡结算
    if (this.bossKind === 'goblin') { this.updateGoblinBoss(dms, T); return; }
    if (this.bossKind === 'lich')   { this.updateLichBoss(dms, T); return; }

    const b = this.boss;

    switch (this.bossState) {
      // (0) 黑影：越长越大，警示环往里收
      case 'telegraph': {
        const t = Math.min(1, this.bossT / BOSS.telegraphMs);
        this.drawBossCue(t);
        if (t >= 1) {
          this.createBossSprite();
          if (this.boss) this.enterBossState('fall');
        }
        break;
      }

      // (1) 天降：位置直接算，不走物理 —— 物理速度会被慢动作改，
      //     落地时刻就不确定了，而后面所有节奏都挂在"落地"这个点上
      case 'fall': {
        const t = Math.min(1, this.bossT / BOSS.fallMs);
        const ease = t * t;                     // 加速下落，落地才有重量
        b.setPosition(this.bossCue.x, this.bossCue.y - 640 * (1 - ease));
        if (b.body) b.body.reset(b.x, b.y);
        if (t >= 1) {
          b.spawning = false;                   // 落地即刻可打
          this.bossFacing = 'down';
          this.enterBossState('land');
          this.shakeScreen(320, 0.018, true);
          SoundSys.heavyKill();
          Utils.vibrate(70);
        }
        break;
      }

      // (2) 落地姿态 → 接砸地
      case 'land': {
        if (this.bossT >= BOSS.landMs) {
          this.bossCueFX.clear();
          this.enterBossState('smash');
        }
        break;
      }

      // (3) 砸地：动画播到 shockAtMs 时放出范围冲击波
      case 'smash': {
        if (!this.bossFiredSmash && this.bossT >= BOSS.shockAtMs) {
          this.bossFiredSmash = true;
          this.spawnBossShockwave(b.x, b.y, BOSS.shockR, 1);
          this.shakeScreen(400, 0.022, true);
          SoundSys.heavyKill();
          Utils.vibrate(90);
        }
        if (this.bossT >= BOSS.smashMs) this.goBossPause('spin');
        break;
      }

      // 通用停顿
      case 'idle': {
        if (this.bossT >= this.bossPauseMs) this.enterBossState(this.bossNext);
        break;
      }

      // (4) 旋转弹幕：波数和波间隔都跟着狂暴走
      case 'spin': {
        const wave = Math.floor(this.bossT / T.spinGapMs);
        if (wave > this.bossSpinFired && wave <= T.spinWaves) {
          this.bossSpinFired = wave;
          this.fireBossRing(wave);
        }
        if (this.bossT >= T.spinWaves * T.spinGapMs + 300) this.goBossPause('walkout');
        break;
      }

      // (5) 走向最近的边缘，直到站到棋盘外
      case 'walkout': {
        const v = DIRS[this.bossFacing];
        b.x += v.x * T.walkSpeed * dms / 1000;
        b.y += v.y * T.walkSpeed * dms / 1000;
        if (b.body) b.body.reset(b.x, b.y);
        // 32 而不是"走出很远"：棋盘外到屏幕边只有 58px（左右）/ 50px（下），
        // 而 BOSS 放大后本体有 144~192px 宽 —— 按中心算走出 76px 时
        // 四分之三个身子已经在屏幕外，玩家看不见他在蓄力，只剩一道砍影飞过来。
        // 32px 足够读成"站到场地外"，又能留住头和躯干
        if (this.bossOutDist(b.x, b.y) >= 32) {
          // 站定之后掉头面向棋盘，否则会背对棋盘挥镰刀
          this.bossFacing = this.dirTowardBoard(b.x, b.y);
          this.goBossPause('slash', T.outIdleMs);
        }
        break;
      }

      // (6) 场外劈砍：低狂暴两刀，高狂暴两轮四刀
      case 'slash': {
        const marks = T.slashMarks;
        // 第二轮起手：第一轮动画（10 帧 @10fps = 1000ms）已经播完，
        // 这里提前 slashRewindMs 重播一次，让"抬镰刀"的动作在月牙飞出去之前
        // 就被看见。原来是在飞刀的同一下才重播，看着像凭空冒出来的
        if (marks.length > 2 && !this.bossSlashRewound
          && this.bossT >= marks[2] - BOSS.slashRewindMs) {
          this.bossSlashRewound = true;
          // 双人时瞄最近的那位
        const _tp = this.targetPlayer(b.x, b.y) || this.player;
        this.bossSlashDir = Math.atan2(_tp.y - b.y, _tp.x - b.x);
          this.playBossAnim('atk1');
        }
        while (this.bossSlashFired < marks.length && this.bossT >= marks[this.bossSlashFired]) {
          this.bossSlashFired++;
          this.fireBossSlash();
        }
        if (this.bossT >= T.slashMs) this.goBossPause('jumpback');
        break;
      }

      // (7) 跳回棋盘 → 落地 → 循环回 (4)
      case 'jumpback': {
        const t = Math.min(1, this.bossT / BOSS.jumpBackMs);
        const ease = t * t;
        b.setPosition(
          Phaser.Math.Linear(this.bossJumpFrom.x, this.bossJumpTo.x, ease),
          Phaser.Math.Linear(this.bossJumpFrom.y, this.bossJumpTo.y, ease));
        if (b.body) b.body.reset(b.x, b.y);
        if (t >= 1) {
          this.bossFacing = this.dirToPlayer();
          this.enterBossState('land');
          this.shakeScreen(280, 0.016, true);
          SoundSys.heavyKill();
          Utils.vibrate(60);
        }
        break;
      }
    }
  }

  /* ==========================================================================
     哥布林飞骑的固定攻击流程
     --------------------------------------------------------------------------
       黑影 → 飞上棋盘 → 猛冲 ×3（每次都冲到棋盘边缘）
         → 停顿 → 反月牙 ×N（每发重新瞄玩家）
         → 停顿 → 回到猛冲 ×3，无限循环
     和骷髅王那套共用 bossState / bossT / bossTune / goBossPause，
     所以暂停、选卡、死亡结算这些都不用重写一遍
     ========================================================================== */
  updateGoblinBoss(dms, T) {
    // 出场黑影这一段必须排在"没有 boss 就返回"之前：
    // 此时 boss 还没被创建（createBossSprite 就是在这个 case 里建的），
    // 先做空判会直接 return，黑影永远长不大，整局就卡在没有 BOSS 的状态里
    if (this.bossState === 'telegraph') {
      const t = Math.min(1, this.bossT / GOBLIN.telegraphMs);
      this.drawBossCue(t);
      if (t >= 1) {
        this.createBossSprite();
        if (this.boss) this.enterBossState('flyin');
      }
      return;
    }

    const b = this.boss;
    if (!b) return;

    // 受伤动作倒计时。只换贴图，不碰 bossT —— 攻击节奏是按 bossT 走的，
    // 受伤如果也去改 bossT，猛冲的距离和月牙的出手时机就全乱了
    if (this.bossFlinchMs > 0) {
      this.bossFlinchMs -= dms;
      if (this.bossFlinchMs <= 0) this.playBossAnim(this.bossAnimAct || 'idle');
    }

    switch (this.bossState) {
      // (1) 飞上棋盘：位移直接算，不走物理 —— 物理速度会被慢动作改，
      //     落位时刻就不确定了，而后面所有节奏都挂在"落位"这个点上
      case 'flyin': {
        const t = Math.min(1, this.bossT / this.bossFlyMs);
        const e = 1 - (1 - t) * (1 - t);       // 减速进场，落点处速度归零
        b.setPosition(
          Phaser.Math.Linear(this.bossFlyFrom.x, this.bossCue.x, e),
          Phaser.Math.Linear(this.bossFlyFrom.y, this.bossCue.y, e));
        if (b.body) b.body.reset(b.x, b.y);
        if (t >= 1) {
          b.spawning = false;                  // 落位即刻可打
          this.bossCueFX.clear();
          this.bossFacing = this.dirToPlayer();
          this.playBossAnim('idle');
          this.shakeScreen(240, 0.012, true);
          SoundSys.heavyKill();
          Utils.vibrate(50);
          this.startGoblinDashSegment(T);
        }
        break;
      }

      // 通用停顿（段与段之间）
      case 'idle':
        if (this.bossT >= this.bossPauseMs) this.enterBossState(this.bossNext);
        break;

      // (2) 猛冲前摇：位置不动，只等时间。方向和终点已经在进入这个状态时定好
      case 'dashWind':
        if (this.bossT >= GOBLIN.dashWindupMs) this.enterBossState('dashRun');
        break;

      // (3) 俯冲：沿锁定的四方向之一冲到棋盘边缘的停靠点
      case 'dashRun': {
        const v = DIRS[this.goblinDashDir];
        const to = this.goblinDashTo;
        b.x += v.x * T.dashSpeed * dms / 1000;
        b.y += v.y * T.dashSpeed * dms / 1000;
        // 越过停靠点就夹回去：帧率抖动时不会冲过头，每次落点都一样
        const past = v.x !== 0
          ? (v.x > 0 ? b.x >= to.x : b.x <= to.x)
          : (v.y > 0 ? b.y >= to.y : b.y <= to.y);
        if (past) { b.x = to.x; b.y = to.y; }
        if (b.body) b.body.reset(b.x, b.y);

        // 掠影：让它看着是"擦着地面扫过去"而不是瞬移。
        // 按时间节流而不是每帧都放 —— 60fps 下每帧放一发，一秒就是 180 个粒子，
        // 粒子池会被这一下抽干，别的爆炸就没粒子可用了
        this._dashFxMs = (this._dashFxMs || 0) + dms;
        if (this._dashFxMs >= 70) {
          this._dashFxMs = 0;
          this.burstKill.explode(2, b.x, b.y + 6);
        }

        if (past) {
          // 撞边反馈：三件套（屏震 + 音效 + 粒子），缺一个"撞实了"的感觉就掉一半
          this.shakeScreen(260, 0.016, true);
          SoundSys.heavyKill();
          Utils.vibrate(70);
          this.burstKill.explode(10, to.x, to.y + 6);
          this.shockRing.emitParticleAt(to.x, to.y, 1);
          this.enterBossState('dashStop');
        }
        break;
      }

      // (4) 撞边后的停顿 → 还有次数就接着冲，没有就进月牙段
      case 'dashStop':
        if (this.bossT >= T.dashStopMs) {
          this.goblinDashLeft--;
          if (this.goblinDashLeft > 0) this.enterBossState('dashWind');
          else this.goBossPause('waveAim', T.segIdleMs);
        }
        break;

      // (5) 月牙的转向前摇
      case 'waveAim':
        if (this.bossT >= T.waveWindupMs) this.enterBossState('waveCast');
        break;

      // (6) 甩月牙：动画播到 waveReleaseMs 时才真的飞出去（对齐甩尾那一帧）
      case 'waveCast': {
        if (!this.goblinWaveFired && this.bossT >= GOBLIN.waveReleaseMs) {
          this.goblinWaveFired = true;
          this.fireGoblinWave();
        }
        if (this.bossT >= GOBLIN.waveCastMs) {
          this.goblinWaveLeft--;
          if (this.goblinWaveLeft > 0) this.enterBossState('waveAim');
          else this.startGoblinDashSegment(T);
        }
        break;
      }
    }
  }

  /* ==========================================================================
     巫妖王的固定攻击流程
     --------------------------------------------------------------------------
       黑影 → 天降 → 落地姿态 → 砸地（冲击波，范围比骷髅王小）→ 飘起来
       然后按**固定顺序**循环三段（用户指定的顺序，不许打乱）：
         A 大月牙   hover → 前摇 → atk1 甩出 1~2 道大月牙波
         B 三段劈   hover → 前摇 → atk2 连劈三道（每道一个竖月牙，各瞄一次玩家）
                    → 等一会 → 落地（Land）+ 小冲击波 → 再飘起来
         C 召唤     hover → 前摇 → atk3 爆白光，随机位置召唤小巫妖
                    + 接连几道落雷（瞄准玩家位置，伤害 1）
       然后回到 A。

     "攻击欲望、频率随时间不断变高"这件事**不在这里写死** ——
     所有时长都从 this.bossTune 取（refreshBossTune 按 rage 在两档之间插值），
     所以缠斗越久，前摇越短、停顿越短、大月牙变两道、三段劈变六刀、
     小巫妖变多、落雷变密。想调"越打越凶"的曲线，只改 LICH 表里那两组数
     ========================================================================== */

  /* 当前该进哪个前摇。固定顺序就是靠这个"段号 → 前摇状态"的映射钉住的：
     lichStep 只在每段**结束时**前进，中途被打断（暂停 / 选卡）不会乱序 */
  lichWindState() {
    return this.lichStep === 0 ? 'waveWind'
      : this.lichStep === 1 ? 'slashWind' : 'summonWind';
  }

  updateLichBoss(dms, T) {
    // 黑影阶段必须排在"没有 boss 就返回"之前：此时 boss 还没被创建
    //（createBossSprite 就在这个 case 里建的），先做空判会直接 return，
    // 黑影永远长不大，整局卡在没有 BOSS 的状态里。
    // 这个坑飞骑踩过一次，这里照抄同一条纪律
    if (this.bossState === 'telegraph') {
      const t = Math.min(1, this.bossT / LICH.telegraphMs);
      this.drawBossCue(t);
      if (t >= 1) {
        this.createBossSprite();
        if (this.boss) this.enterBossState('fall');
      }
      return;
    }

    const b = this.boss;
    if (!b) return;

    // 受伤动作倒计时。只换贴图，不碰 bossT —— 出手时机是按 bossT 走的，
    // 受伤如果也去改 bossT，月牙的出手帧和落雷的节奏就全乱了
    if (this.bossFlinchMs > 0) {
      this.bossFlinchMs -= dms;
      if (this.bossFlinchMs <= 0) this.playBossAnim(this.bossAnimAct || 'idle');
    }

    switch (this.bossState) {
      // (1) 天降：位置直接算，不走物理 —— 物理速度会被慢动作改，
      //     落地时刻就不确定了，而后面所有节奏都挂在"落地"这个点上
      case 'fall': {
        const t = Math.min(1, this.bossT / LICH.fallMs);
        const ease = t * t;                     // 加速下落，落地才有重量
        b.setPosition(this.bossCue.x, this.bossCue.y - 640 * (1 - ease));
        if (b.body) b.body.reset(b.x, b.y);
        this.updateBossShadow(1 - ease);        // 影子跟着越落越大
        if (t >= 1) {
          b.spawning = false;                   // 落地即刻可打
          this.enterBossState('land');
          this.shakeScreen(320, 0.018, true);
          SoundSys.heavyKill();
          Utils.vibrate(70);
        }
        break;
      }

      // (2) 落地姿态 → 接砸地
      case 'land':
        if (this.bossT >= LICH.landMs) {
          this.bossCueFX.clear();
          this.lichSmashFired = false;
          this.enterBossState('smash');
        }
        break;

      // (3) 砸地：atk1 播到 waveMarkMs 时放出范围冲击波。
      //     半径 LICH.shockR = 170，骷髅王是 300 —— 用户要求"范围小点"
      case 'smash': {
        if (!this.lichSmashFired && this.bossT >= LICH.waveMarkMs) {
          this.lichSmashFired = true;
          this.spawnBossShockwave(b.x, this.lichGroundY, LICH.shockR, 1);
          this.shakeScreen(380, 0.02, true);
          SoundSys.heavyKill();
          Utils.vibrate(80);
        }
        if (this.bossT >= LICH.waveCastMs) this.enterBossState('rise');
        break;
      }

      // (4) 飘起来。位移交给动画（jump 正向播，本体自己抬 8px），
      //     收尾时把 lichFloat 一次性补满 —— 动画末帧和 idle 首帧的本体高度
      //     差的正好是这 8px，补上才不会"飘到位又掉一下"。
      //     这也是用户指定要的：用 Jump 那张图"跳起来的高度"作为漂浮高度
      case 'rise':
        if (this.bossT >= LICH.riseMs) {
          this.lichFloat = LICH.floatUp * LICH.scale;
          // 狂暴档（B 段变六刀）不再给这段漂浮悬停，飘完直接进下一个前摇。
          // 为什么必须区别对待：六刀把 slashCast 从 1700 拉到 2200，
          // 这一段多出来的时长会一口吃掉悬停省下的时间，
          // 一轮循环反而比温和档更长 —— 那就直接违背了用户要的"频率随时间变高"。
          // 表现上也说得通：落地 + 飘起本身就是这一拍的呼吸点，
          // 狂暴档收走额外的悬停，正好是"不再给你喘气时间"的意思
          if (T.slashMarks.length > 3) this.enterBossState(this.lichWindState());
          else this.goBossPause(this.lichWindState(), T.hoverMs);
        }
        break;

      // 通用停顿 = 两次出招之间的漂浮悬停。
      // ⚠️ 这个 case 必须叫 'idle'，不能叫 'hover' —— goBossPause 进去的就是 'idle'
      //（它被三只 BOSS 共用）。写成 'hover' 的话状态会被设成 'idle' 而这里没有
      // 对应分支，出场砸完地就**永远停在那儿**：不报错、不崩溃，只是再也不出招
      case 'idle':
        if (this.bossT >= this.bossPauseMs) this.enterBossState(this.bossNext);
        break;

      /* ---------------- A 段：一道大月牙波 ---------------- */

      // 前摇：本体不动、也不放东西，纯粹给玩家反应时间
      case 'waveWind':
        if (this.bossT >= T.waveWindMs) this.enterBossState('waveCast');
        break;

      case 'waveCast': {
        // 每一发都实时重新瞄准 —— 玩家挪位，下一发的方向就跟着变。
        // 狂暴后 waveCount 变 2，两发之间错开 waveStaggerMs，
        // 不靠"一次同时出"：同时出会糊成一坨，读不出是两道
        while (this.lichWaveFired < T.waveCount
          && this.bossT >= LICH.waveMarkMs + this.lichWaveFired * LICH.waveStaggerMs) {
          this.lichWaveFired++;
          this.fireLichWaveAtPlayer('big', T.waveSpeed, LICH.waveLifeMs);
          this.shakeScreen(120, 0.006, true);
          SoundSys.enemyShoot();
        }
        const castMs = LICH.waveCastMs + (T.waveCount - 1) * LICH.waveStaggerMs;
        if (this.bossT >= castMs) {
          this.lichStep = 1;                    // 固定顺序：下一段是 B
          this.goBossPause(this.lichWindState(), T.hoverMs);
        }
        break;
      }

      /* ---------------- B 段：三段劈斩（竖月牙） ---------------- */

      case 'slashWind':
        if (this.bossT >= T.slashWindMs) this.enterBossState('slashCast');
        break;

      case 'slashCast': {
        const marks = T.slashMarks;
        // 第二轮起手：第一轮动画（13 帧 @8fps = 1625ms）播完之后，
        // 提前 slashRewindMs 重播一次 atk2，让"抬剑"在月牙飞出去之前被看见。
        // 不重播的话第二轮的月牙看着像凭空冒出来的
        if (marks.length > 3 && !this.lichSlashRewound
          && this.bossT >= marks[3] - LICH.slashRewindMs) {
          this.lichSlashRewound = true;
          this.playBossAnim('atk2');
        }
        // 每一道都单独瞄一次玩家（用户明确要的"每次都朝向玩家位置"）
        while (this.lichSlashFired < marks.length
          && this.bossT >= marks[this.lichSlashFired]) {
          this.lichSlashFired++;
          this.fireLichWaveAtPlayer('blade', T.slashSpeed, LICH.waveLifeMs);
          this.shakeScreen(70, 0.003, true);
          SoundSys.enemyShoot();
        }
        if (this.bossT >= T.slashCastMs) {
          this.lichStep = 2;                    // 固定顺序：下一段是 C
          this.enterBossState('landDrop');
        }
        break;
      }

      // B 段收尾：落地。用户明确要的"等一会就落地"，
      // 落完再飘起来接 C 段 —— 落地这一下也是整段的节奏重音
      case 'landDrop': {
        if (!this.lichLandShocked && this.bossT >= LICH.landShockAtMs) {
          this.lichLandShocked = true;
          // 比出场那个 170 还小：这一下是"重音"，不是杀招，不该逼玩家每次都跑
          this.spawnBossShockwave(b.x, this.lichGroundY, LICH.landShockR, 1);
          this.shakeScreen(240, 0.012, true);
          SoundSys.heavyKill();
          Utils.vibrate(50);
        }
        if (this.bossT >= LICH.landDropMs) this.enterBossState('rise');
        break;
      }

      /* ---------------- C 段：召唤小巫妖 + 连续落雷 ---------------- */

      case 'summonWind':
        if (this.bossT >= T.slashWindMs) this.enterBossState('summonCast');
        break;

      case 'summonCast': {
        // atk3 播到 summonMarkMs 时爆白光 —— 召唤动作的"节拍点"。
        // 小巫妖在这一刻才出现，不是进状态就出现：玩家看得到前摇
        if (!this.lichSummoned && this.bossT >= LICH.summonMarkMs) {
          this.lichSummoned = true;
          this.summonLichMinions(T);
        }
        // 落雷一道道接着来，每道自己带 boltWarnMs 的预警圈。
        // 预警圈就是它的前摇：圈收完才劈，玩家有时间走开
        while (this.lichBoltFired < T.boltCount
          && this.bossT >= LICH.summonMarkMs + this.lichBoltFired * T.boltGapMs) {
          this.lichBoltFired++;
          this.spawnLichBolt(T);
        }
        const castMs = LICH.summonMarkMs + T.boltCount * T.boltGapMs + LICH.boltTailMs;
        if (this.bossT >= castMs) {
          this.lichStep = 0;                    // 固定顺序：回到 A
          this.goBossPause(this.lichWindState(), T.hoverMs);
        }
        break;
      }
    }

    // 漂浮位置统一在这里落一次。fall 自己算位移（要从天上往下走），排除掉；
    // 其余状态不管在不在漂浮集合里都走这一句 —— 落地类状态的目标高度是 0，
    // 于是"从漂浮高度降下来"这件事也自动有了过渡
    if (this.bossState !== 'fall') this.updateLichFloat(dms);
  }

  /* 漂浮高度 + 上下起伏。用累加相位而不是 bossT：
     bossT 每次换状态都归零，起伏会一顿一顿的 */
  updateLichFloat(dms) {
    const b = this.boss;
    if (!b) return;

    const full = LICH.floatUp * LICH.scale;          // 满漂浮高度（屏幕像素）
    const target = LICH_FLOAT_STATES[this.bossState] ? full : 0;
    const rate = full / LICH.riseMs;                 // 上升速度（px/ms）

    if (this.lichFloat < target) {
      this.lichFloat = Math.min(target, this.lichFloat + rate * dms);
    } else if (this.lichFloat > target) {
      // 下落比上升快 1.8 倍：落地要有重量感，慢慢飘下来像气球
      this.lichFloat = Math.max(target, this.lichFloat - rate * 1.8 * dms);
    }

    this.lichBobMs += dms;
    // 起伏按"当前离地比例"缩放：刚离地时几乎不晃，飘稳了才明显
    const frac = full > 0 ? this.lichFloat / full : 0;
    const bob = Math.sin(this.lichBobMs / LICH.bobCycleMs * Math.PI * 2)
      * LICH.bobAmp * LICH.scale * frac;

    b.setPosition(b.x, this.lichGroundY - this.lichFloat - bob);
    if (b.body) b.body.reset(b.x, b.y);
    this.updateBossShadow(frac);
  }

  /* 落地投影：本体升得越高，影子越小越淡。
     airFrac 0 = 贴地（影子最大最深），1 = 满漂浮 */
  updateBossShadow(airFrac) {
    const s = this.bossShadow;
    if (!s || !s.visible || !this.boss) return;
    const f = Phaser.Math.Clamp(airFrac, 0, 1);
    s.setPosition(this.boss.x, this.lichGroundY);
    s.setScale(2.6 - 0.7 * f);
    s.setAlpha(0.46 - 0.16 * f);
  }

  /* 哪些状态允许播受伤动作。
     只放"悬停 / 前摇"这类纯等待状态 —— 出手时机（waveCast / slashCast /
     summonCast）是跟动画帧硬对齐的，中途插一段受伤动画，
     月牙会从"没在挥的那一帧"飞出去 */
  lichFlinchable() {
    const s = this.bossState;
    return s === 'idle' || s === 'waveWind' || s === 'slashWind' || s === 'summonWind';
  }

  /* 巫妖王所有投射物的发射点：胸口。
     b.y 是**地面线**（originY = groundY/帧高 就是为这个），本体在它上方
     bodyUp×scale 处 —— 不补这个偏移，月牙会从脚底下钻出来 */
  lichMuzzle() {
    const b = this.boss;
    return { x: b.x, y: b.y - LICH.bodyUp * LICH.scale };
  }

  /* 朝玩家甩一道月牙。size 取 LICH_WAVE 的键（big / blade / mini） */
  fireLichWaveAtPlayer(size, speed, lifeMs) {
    const b = this.boss;
    if (!b) return null;
    // 双人时甩向最近的那位
    const tp = this.targetPlayer(b.x, b.y) || this.player;
    const ang = Math.atan2(tp.y - b.y, tp.x - b.x);
    const m = this.lichMuzzle();
    return this.fireLichWave(m.x, m.y, size, ang, speed, lifeMs);
  }

  /* 巫妖王系的月牙发射器。和 fireGoblinWave 是同一套判定口径，
     区别只有：形状规格从 LICH_WAVE 取（三档非等比缩放 + 冰蓝染色），
     朝向支持 'across'（长轴 ⊥ 飞行方向）和 'along'（长轴 ∥ 飞行方向） */
  fireLichWave(x, y, size, ang, speed, lifeMs) {
    const W = LICH_WAVE[size];
    if (!W) return null;

    // 出生点往前推一点，否则第一帧和本体叠在一起，看不出是"飞出去"。
    // 小月牙推得近一些 —— 它是从 30px 宽的小巫妖身上发出来的
    const off = size === 'mini' ? 24 : LICH.waveOffset;
    const cx = x + Math.cos(ang) * off;
    const cy = y + Math.sin(ang) * off;

    const s = this.bossSlashes.get(cx, cy, W.tex);
    if (!s) return null;

    s.setTexture(W.tex);
    s.setActive(true).setVisible(true);
    s.setBlendMode(Phaser.BlendModes.ADD);
    s.setTint(W.tint);
    s.setScale(W.sx, W.sy);

    // 朝向：
    //   'across' —— 长轴 ⊥ 飞行方向（和哥布林反月牙同一套）。宽弧波，
    //               "一道波推过来"的读法
    //   'along'  —— 长轴 ∥ 飞行方向。这就是用户说的"竖起来的月牙波"：
    //               巫妖王朝下方的玩家劈下去时，129px 的长轴正好立在屏幕上，
    //               像一把竖着的刀锋横扫过来，和大月牙一眼就能区分
    const rot = W.spin === 'along' ? ang : ang - Math.PI / 2;
    s.setRotation(rot);
    s.setDepth(7050);

    const box = this.waveAABB(rot, W.sx, W.sy, W.halfW, W.halfH);
    s.body.setSize(box.w, box.h, true);
    s.setPosition(cx, cy);
    s.body.reset(cx, cy);
    s.body.updateFromGameObject();     // reset 只把 body 摆到帧左上角，见 fireGoblinWave 的注释
    s.body.enable = true;

    s.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
    s.lifeMs = lifeMs;
    s.noSpin = true;                   // 判定框是按发射那一刻的角度算的，不能自转
    // 精确判定要用的三个值，按这一发实际用的规格存下来（池子是共用的）
    s.axis0 = W.axis0;
    s.capAxis = W.halfW * W.sx - W.halfH * W.sy;
    s.capThick = W.halfH * W.sy;

    // 小月牙不炸粒子：7 只小巫妖一起开火时，光是出生特效就能把粒子池抽干
    if (size !== 'mini') this.burstKill.explode(8, cx, cy);
    return s;
  }

  /* C 段：随机位置召唤一批小巫妖 */
  summonLichMinions(T) {
    const b = this.boss;
    if (!b) return;

    const m = this.lichMuzzle();
    // 爆白光：召唤动作的节拍点，也是"我要开始放杂兵了"的提示
    this.burstKill.explode(26, m.x, m.y);
    this.shockRing.emitParticleAt(m.x, m.y, 3);
    this.shakeScreen(300, 0.014, true);
    SoundSys.levelup();

    // 随机落点，三条纪律：
    //   · 留在场内（边距 40，免得半个身子卡在栅栏外）
    //   · 离玩家 ≥ 110px —— 直接刷在玩家脸上是耍赖，不是难
    //   · 离本体 ≥ 90px —— 不然一群小巫妖糊在 BOSS 身上，玩家分不清谁是谁
    const n = T.minionCount;
    let placed = 0;
    for (let i = 0; i < 80 && placed < n; i++) {
      const x = Phaser.Math.Between(BOARD.x + 40, BOARD.x + BOARD.w - 40);
      const y = Phaser.Math.Between(BOARD.y + 40, BOARD.y + BOARD.h - 40);
      // 要躲开**每个**玩家：只躲 P1 的话，小巫妖会直接刷在 P2 身上
      let nearPlayer = false;
      for (const PP of this.players) {
        const sp = PP.sprite;
        if (sp && Math.hypot(x - sp.x, y - sp.y) < 110) { nearPlayer = true; break; }
      }
      if (nearPlayer) continue;
      if (Math.hypot(x - b.x, y - b.y) < 90) continue;
      this.spawnLichMinion(x, y, T);
      placed++;
    }
    // 兜底：场地被挤满 / 玩家正好站在唯一空位时也得召出来，
    // 否则这一招会变成"白光一闪什么都没发生"
    for (let i = placed; i < n; i++) {
      const x = BOARD.x + BOARD.w * (0.12 + 0.76 * Math.random());
      const y = BOARD.y + BOARD.h * (0.12 + 0.76 * Math.random());
      this.spawnLichMinion(x, y, T);
    }
  }

  /* 一只小巫妖。它挂在 enemies 组里，所以子弹 / 爆炸 / 冲击波那三条判定
     全是白捡的（和 BOSS 本体同一个套路）；但移动和开火由 updateLichMinions
     接管，updateEnemies / onEnemyHitsPlayer 里都要按 isMinion 跳过 */
  spawnLichMinion(x, y, T) {
    const e = this.enemies.get(x, y, 'lich-idle');
    if (!e) return;

    const r = LICH_MINION.bodyR;
    const groundY = LICH_GROUND_Y['lich-idle'];
    const cxF = LICH_BODY_CX['lich-idle'];

    e.setTexture('lich-idle', 0);
    e.setActive(true).setVisible(true);
    e.isBoss = false;              // 池子共用，从 BOSS 那捞回来的要清掉
    e.isMinion = true;
    e.spawning = true;             // 出场那 260ms 免疫，免得刚冒出来就被清掉
    e.typeDef = {
      key: 'lich-minion', name: '小巫妖', isSpecial: false, score: LICH_MINION.score,
    };
    e.hp = LICH_MINION.hp;
    e.maxHp = LICH_MINION.hp;
    e.dir = DIRS.down;             // 不走绕场循环，这两个只是为了 applyFrost 不炸
    e.speed = 0;
    e.fireInterval = Infinity;
    e.slowTimer = 0;
    e.fireAccum = Phaser.Math.Between(200, 700);
    e.clearTint();
    e.shadowVisible = false;

    // 逻辑坐标（地面线上的落点）。bob 是叠在贴图上的，
    // 不能直接改 e.x / e.y —— 那样起伏会被当成位移攒起来，越飘越远
    e.mx = x;
    e.my = y;
    e.minionLifeMs = T ? T.minionLifeMs : LICH.minionLifeMs;
    e.minionBobMs = 0;
    e.minionSeed = Phaser.Math.Between(0, LICH.bobCycleMs);   // 错开相位，否则一群整齐地上下动

    e.setOrigin(cxF / LICH_FRAME, groundY / LICH_FRAME);
    if (e.body) e.body.setCircle(r, cxF - r, (groundY - LICH_MINION.bodyUp) - r);
    if (e.body) e.body.enable = false;   // 出场动画期间不开物理体

    // 飘着的东西也要有落地投影，否则读不出"它悬在半空"
    if (!e.shadow) e.shadow = this.add.image(x, y, 'shadow').setDepth(1);
    e.shadow.setVisible(true).setPosition(x, y).setScale(0.9).setAlpha(0.45);

    e.setAlpha(1).setScale(0);
    this.tweens.add({
      targets: e, scale: LICH_MINION.scale, duration: 260, ease: 'Back.easeOut',
      onComplete: () => {
        if (!e.active) return;
        e.spawning = false;
        if (e.body) e.body.enable = true;
      },
    });

    this.burstKill.explode(12, x, y);
    this.shockRing.emitParticleAt(x, y, 1);
  }

  /* 小巫妖的移动 / 开火 / 寿命。三个纪律：
       · 只朝玩家漂，不绕场、不撞人（撞人那条在 onEnemyHitsPlayer 里跳过）
       · 打到玩家的是它发的**小月牙**，不是它自己
       · 寿命到点自己散掉（用户要求"即使不死，过一段时间就消失"） */
  updateLichMinions(dms) {
    // 无限模式里不可能有小巫妖（只有肉鸽的巫妖王会召），
    // 但这一句是每帧无条件跑的 —— 不早退的话会白白遍历整个敌人池（≤80 只）。
    // rogueMode 在 init() 里定死、整局不变，所以这个早退是安全的
    if (!this.rogueMode) return;

    const T = this.bossTune;
    const p = this.player;
    const bobCycle = LICH.bobCycleMs;

    this.enemies.children.each(e => {
      if (!e.active || !e.isMinion) return;

      // 寿命到点：散掉。用粒子而不是直接消失，让玩家看得出"它没了"
      e.minionLifeMs -= dms;
      if (e.minionLifeMs <= 0) {
        this.burstKill.explode(10, e.x, e.y);
        this.recycleEnemy(e);
        return;
      }

      // 冰霜弹减速。小巫妖不走 updateEnemies，减速计时得自己维护 ——
      // 不然被冻住之后蓝色染色永远褪不掉，看着像卡了个 bug
      let mul = 1;
      if (e.slowTimer > 0) {
        e.slowTimer -= dms;
        if (e.slowTimer <= 0) { e.slowTimer = 0; e.clearTint(); }
        else mul = 0.55;
      }

      // 朝玩家漂，但贴到 standoff 就停住 —— 糊在玩家脸上会变成
      // "看不见的碰撞体"，玩家只会觉得莫名其妙被挡住
      const dx = p.x - e.mx, dy = p.y - e.my;
      const d = Math.hypot(dx, dy) || 1;
      if (d > LICH_MINION.standoff) {
        const spd = (T ? T.minionSpeed : LICH.minionSpeed) * mul;
        e.mx += dx / d * spd * dms / 1000;
        e.my += dy / d * spd * dms / 1000;
      }

      // 漂浮起伏。每只错开相位（minionSeed），否则一群小巫妖整齐地上下动，
      // 一眼就看出是复制粘贴的
      e.minionBobMs += dms;
      const bob = Math.sin((e.minionBobMs + e.minionSeed) / bobCycle * Math.PI * 2)
        * LICH.bobAmp * LICH_MINION.scale;
      const fy = e.my - LICH_MINION.floatUp * LICH_MINION.scale - bob;
      e.setPosition(e.mx, fy);
      if (e.body) e.body.reset(e.mx, fy);
      if (e.shadow && e.shadow.visible) e.shadow.setPosition(e.mx, e.my);

      // 开火：只发小月牙，追踪玩家。间隔跟着狂暴走
      const iv = T ? T.minionFireMs : LICH.minionFireMs;
      e.fireAccum += dms;
      if (e.fireAccum >= iv) {
        e.fireAccum -= iv;
        this.fireLichWave(e.mx, e.my - LICH_MINION.bodyUp * LICH_MINION.scale, 'mini',
          Math.atan2(p.y - e.my, p.x - e.mx),
          T ? T.minionWaveSpeed : LICH.minionWaveSpeed,
          LICH.minionWaveLifeMs);
      }
    });
  }

  /* C 段：一道落雷。落点 = 玩家**此刻**的位置 —— 定下来就不再改，
     预警圈（boltWarnMs）就是玩家唯一的反应窗口 */
  spawnLichBolt(T) {
    const m = 20;
    // 落雷砸"离巫妖王最近的那位"：双人时如果固定砸 P1，
    // P2 可以一直站着不动；而如果两道雷都砸同一个人，另一位又完全没压力
    const tp = this.targetPlayer(this.boss ? this.boss.x : CONFIG.width / 2,
      this.boss ? this.boss.y : CONFIG.height / 2) || this.player;
    this.lichBolts.push({
      x: Phaser.Math.Clamp(tp.x + Phaser.Math.Between(-14, 14),
        BOARD.x + m, BOARD.x + BOARD.w - m),
      y: Phaser.Math.Clamp(tp.y + Phaser.Math.Between(-14, 14),
        BOARD.y + m, BOARD.y + BOARD.h - m),
      r: LICH.boltR,
      warnMs: T.boltWarnMs,
      phase: 'warn',
      t: 0,
    });
    SoundSys.uiClick();     // 每道雷生成时"叮"一下，把前摇也做成听觉提示
  }

  /* 落雷的预警圈 / 光柱。和 updateBossShocks 一个套路：每帧重绘一个 Graphics */
  updateLichBolts(dms) {
    const g = this.bossBoltFX;
    g.clear();
    if (!this.lichBolts.length) return;

    for (let i = this.lichBolts.length - 1; i >= 0; i--) {
      const q = this.lichBolts[i];
      q.t += dms;

      if (q.phase === 'warn') {
        const t = Phaser.Math.Clamp(q.t / q.warnMs, 0, 1);
        // 预警圈从大收到小，收满就劈。收缩比放大更好读 ——
        // 玩家一眼能看出"还剩多少"，这是通用做法（和出场黑影同一套）
        const r = q.r * (2.6 - 1.6 * t);
        g.lineStyle(3, 0x9fe8ff, 0.32 + 0.5 * t);
        g.strokeCircle(q.x, q.y, r);
        g.lineStyle(2, 0xffffff, 0.18 + 0.45 * t);
        g.strokeCircle(q.x, q.y, r * 0.6);
        // 十字准星：明确告诉玩家"这一格会被劈"
        const arm = q.r * 0.5;
        g.lineStyle(2, 0x9fe8ff, 0.45 + 0.45 * t);
        g.lineBetween(q.x - arm, q.y, q.x + arm, q.y);
        g.lineBetween(q.x, q.y - arm, q.x, q.y + arm);

        if (t >= 1) {
          q.phase = 'flash';
          q.t = 0;
          this.strikeLichBolt(q);
        }
        continue;
      }

      // flash：一道竖光 + 一圈扩散的白环，boltFlashMs 内收掉
      const t = Phaser.Math.Clamp(q.t / LICH.boltFlashMs, 0, 1);
      const a = 1 - t;
      g.lineStyle(7 * a + 1, 0xd8f4ff, a);
      g.lineBetween(q.x, q.y - 220, q.x, q.y);
      g.lineStyle(3, 0xffffff, a);
      g.strokeCircle(q.x, q.y, q.r * (0.5 + 1.6 * t));

      if (t >= 1) this.lichBolts.splice(i, 1);
    }
  }

  strikeLichBolt(q) {
    this.burstKill.explode(16, q.x, q.y);
    this.shockRing.emitParticleAt(q.x, q.y, 1);
    this.shakeScreen(140, 0.008, true);
    SoundSys.enemyShoot();

    // 判定半径 = 落雷半径 + 玩家半径：擦边也算中，躲的时候要往外站。
    // 用户指定伤害是 1，所以直接 hurtPlayer（它内部会处理无敌帧）。
    // 逐个玩家判 —— 只判 P1 的话，P2 站在雷里完全不掉血
    for (let pi = 0; pi < this.players.length; pi++) {
      const sp = this.players[pi].sprite;
      if (!sp || !sp.visible) continue;
      if (Math.hypot(sp.x - q.x, sp.y - q.y) <= q.r + 17) {
        this.pIndex = pi;
        this.hurtPlayer();
      }
    }
  }

  /* BOSS 死 / 换图时把小巫妖一起收掉。
     不收的话它们会活到下一张图，而那时 bossTune 已经变成下一只 BOSS 的了 */
  clearLichMinions() {
    this.enemies.children.each(e => {
      if (e.active && e.isMinion) {
        this.burstKill.explode(10, e.x, e.y);
        this.recycleEnemy(e);
      }
    });
  }

  /* 进"猛冲段"：重置次数，先停 segIdleMs 再冲第一次。
     次数在段首统一重置（而不是每次冲完减），这样循环回来不会越冲越少 */
  startGoblinDashSegment(T) {
    this.goblinDashLeft = GOBLIN.dashCount;
    this.goblinWaveLeft = T.waveCount;
    this.goBossPause('dashWind', T.segIdleMs);
  }

  /* 哪些状态允许播受伤动作。
     只放"停顿类"——猛冲（dive）和甩月牙（cast）的出手时机是跟动画帧对齐的，
     中途插一段受伤动画，月牙会从"没在甩的那一帧"飞出去 */
  goblinFlinchable() {
    const s = this.bossState;
    return s === 'idle' || s === 'dashStop' || s === 'waveAim';
  }

  /* 猛冲的终点 + 最终方向。
     沿 dir 冲到棋盘边缘（停在离边缘 dashEdgeInset 处）。
     如果这么冲只有很短一段（玩家正好贴在那侧边上），就掉头冲对面那条边 ——
     否则会出现"猛冲 20px 就停下"，读起来像卡住了。
     返回的 dir 可能和传入的不同，所以两者一起返回，别只返回终点 */
  goblinDashPlan(x, y, dir) {
    const M = GOBLIN.dashEdgeInset;
    const at = d => d === 'left' ? { x: BOARD.x + M, y }
      : d === 'right' ? { x: BOARD.x + BOARD.w - M, y }
        : d === 'up' ? { x, y: BOARD.y + M }
          : { x, y: BOARD.y + BOARD.h - M };
    const flip = { left: 'right', right: 'left', up: 'down', down: 'up' };

    let to = at(dir);
    if (Math.hypot(to.x - x, to.y - y) < GOBLIN.dashMinDist) {
      dir = flip[dir];
      to = at(dir);
    }
    return { dir, to };
  }

  /* 反月牙：朝玩家甩一道月牙冲击波。
     每一发都实时重新瞄准 —— 玩家挪位，下一发的方向就跟着变（用户明确要的手感）。
     瞄准点不锁死是有代价的（可能必中），所以发射前的 waveWindupMs 前摇
     必须够长，那是玩家唯一的反应窗口 */
  fireGoblinWave() {
    const b = this.boss;
    if (!b) return;

    // 双人时甩向最近的那位
    const tp = this.targetPlayer(b.x, b.y) || this.player;
    const a = Math.atan2(tp.y - b.y, tp.x - b.x);
    // 出生点往前推一点，否则第一帧和蝙蝠本体叠在一起，看不出是"飞出去"
    const cx = b.x + Math.cos(a) * GOBLIN.waveOffset;
    const cy = b.y + Math.sin(a) * GOBLIN.waveOffset;

    const s = this.bossSlashes.get(cx, cy, 'goblin-wave');
    if (!s) return;

    s.setTexture('goblin-wave');
    s.setActive(true).setVisible(true);
    s.setBlendMode(Phaser.BlendModes.ADD);
    s.setScale(GOBLIN_WAVE.sx, GOBLIN_WAVE.sy);
    // 朝向：源动画里月牙永远是「尖角朝着飞行方向」——
    // Down 方向尖角朝下、往下飞；Up 方向尖角朝上、往上飞（逐帧量过像素）。
    // 素材本身是"凸面朝上、尖角朝下"，也就是尖角方向 = 帧内的 (0,1)，
    // 而 Down 方向它往下飞时是**不旋转**的 → 通用角就是 飞行角 - 90°。
    // （写 +90° 会把月牙转 180°，变成凸面朝前"倒着飞"，和源动画相反）
    const rot = a - Math.PI / 2;
    s.setRotation(rot);
    s.setDepth(7050);

    // 判定体不能用圆：月牙是 132×24 的长条，圆要么罩不住两头、
    // 要么横向宽得离谱。这里按"旋转后的外接矩形"写成长方形 ——
    // 横着飞是 132×24、竖着飞是 24×132、斜着飞是中间值。
    // ⚠️ 外接框必须按 **sprite.rotation** 算，不是按飞行角 a 算。
    // 这两个差 90°（rotation = a - 90°），按 a 算的话正好把长宽对调：
    // 逐像素测下来判定只盖住月牙像素的 45.1%，四个方向全都错。
    // ⚠️ 入参是**帧内单位**：setSize 会把它乘一遍缩放，所以不能再除 scale
    const box = this.waveAABB(rot, GOBLIN_WAVE.sx, GOBLIN_WAVE.sy,
      GOBLIN_WAVE.halfW, GOBLIN_WAVE.halfH);
    s.body.setSize(box.w, box.h, true);
    s.setPosition(cx, cy);
    // reset 负责停速度 + 同步 prev；但它只把 body 摆到"帧左上角"，
    // 完全不管 offset，所以后面必须再补一次 updateFromGameObject 摆正 ——
    // 少了这一句，月牙飞出去的第一帧判定框会整体偏出去几十像素
    s.body.reset(cx, cy);
    s.body.updateFromGameObject();
    // reset 不保证把 enable 打开（从池里捞出来的上一次是被 recycleBossSlash 关掉的）
    s.body.enable = true;

    const spd = this.bossTune ? this.bossTune.waveSpeed : GOBLIN.waveSpeed;
    s.setVelocity(Math.cos(a) * spd, Math.sin(a) * spd);
    s.lifeMs = GOBLIN.waveLifeMs;
    // 砍影会自转（像被甩出去的刀刃），月牙不能转 ——
    // 它的判定框是按"发射那一刻的角度"算出来的外接矩形，一转就错位
    s.noSpin = true;
    // 精确判定（bossSlashHits）要用的三个值，按"这一发实际用的规格"存下来。
    // 池子是共用的，不能在判定里回头读 GOBLIN_WAVE —— 读到的是哥布林的规格，
    // 巫妖王的大月牙 / 竖月牙尺寸和它不一样
    s.axis0 = GOBLIN_WAVE.axis0;
    s.capAxis = GOBLIN_WAVE.halfW * GOBLIN_WAVE.sx - GOBLIN_WAVE.halfH * GOBLIN_WAVE.sy;
    s.capThick = GOBLIN_WAVE.halfH * GOBLIN_WAVE.sy;

    this.burstKill.explode(8, cx, cy);
    this.shakeScreen(120, 0.006, true);
    SoundSys.enemyShoot();
  }

  /* 旋转弹幕：一圈子弹。每波错开半个扇区，四波下来看着像螺旋而不是
     四层完全重叠的圆 —— 重叠的话玩家会误判"这波已经躲完了" */
  fireBossRing(wave) {
    const b = this.boss;
    if (!b) return;
    // 弹数跟着狂暴走：开局 10 发，狂暴拉满 16 发
    const n = this.bossTune ? this.bossTune.spinBullets : BOSS.spinBullets;
    const step = Math.PI * 2 / n;
    const base = wave * step * 0.5;
    for (let i = 0; i < n; i++) {
      const a = base + i * step;
      this.fireBullet(this.enemyBullets,
        b.x + Math.cos(a) * 34, b.y + Math.sin(a) * 34,
        Math.cos(a) * BOSS.spinSpeed, Math.sin(a) * BOSS.spinSpeed, 'bullet-e');
    }
    this.shakeScreen(90, 0.004, true);
    SoundSys.enemyShoot();
  }

  /* 伤玩家的冲击波。和小怪那套 shockwaves 是两码事：
     那个是玩家放的、打敌人；这个是 BOSS 放的、打玩家。
     硬合成一个列表会让命中判定不知道该往哪边结算 */
  spawnBossShockwave(x, y, maxR, damage) {
    this.bossShocks.push({
      x, y, r: 0, maxR, damage, elapsed: 0, life: 720, hit: false,
    });
  }

  updateBossShocks(dms) {
    const g = this.bossShockFX;
    g.clear();
    if (!this.bossShocks.length) return;

    for (let i = this.bossShocks.length - 1; i >= 0; i--) {
      const w = this.bossShocks[i];
      w.elapsed += dms;
      const t = Phaser.Math.Clamp(w.elapsed / w.life, 0, 1);
      // 半径"先快后慢"：一圈被砸出来的气浪就是这个形状
      w.r = w.maxR * (1 - (1 - t) * (1 - t));

      // 冲击波对**每个**玩家各判一次：共享一个 hit 标记的话，
      // 只有先踩到的那位会掉血，另一位站在同一圈里完全免疫
      if (!w.hitP) w.hitP = [];
      for (let pi = 0; pi < this.players.length; pi++) {
        if (w.hitP[pi]) continue;
        const sp = this.players[pi].sprite;
        if (!sp || !sp.visible) continue;
        if (Math.hypot(sp.x - w.x, sp.y - w.y) <= w.r + 16) {
          w.hitP[pi] = true;
          this.pIndex = pi;
          this.hurtPlayer();
        }
      }

      const alpha = 1 - t;
      g.lineStyle(9, 0xffd54a, alpha * 0.75);
      g.strokeCircle(w.x, w.y, w.r);
      g.lineStyle(3, 0xffffff, alpha * 0.9);
      g.strokeCircle(w.x, w.y, Math.max(0, w.r - 9));
      g.lineStyle(2, 0xff7a2a, alpha * 0.5);
      g.strokeCircle(w.x, w.y, Math.max(0, w.r - 22));

      if (t >= 1) this.bossShocks.splice(i, 1);
    }
  }

  fireBossSlash() {
    const b = this.boss;
    if (!b) return;
    const a = this.bossSlashDir;
    const sx = b.x + Math.cos(a) * 42;
    const sy = b.y + Math.sin(a) * 42;

    const s = this.bossSlashes.get(sx, sy, 'boss-slash');
    if (!s) return;

    s.setTexture('boss-slash');
    s.setActive(true).setVisible(true);
    s.setBlendMode(Phaser.BlendModes.ADD);
    s.setScale(1);
    s.setRotation(a);
    s.setDepth(7050);
    // 帧是 128×128，半径 34 的判定圈要与精灵同心 → offset = 帧宽/2 - 半径
    s.body.setCircle(34, 64 - 34, 64 - 34);
    s.body.reset(sx, sy);
    // reset 不保证把 enable 打开（子弹那条路径也是显式补一句），
    // 从池里捞出来的砍影上一次是被 recycleBossSlash 关掉物理体的
    s.body.enable = true;
    s.setVelocity(Math.cos(a) * BOSS.slashSpeed, Math.sin(a) * BOSS.slashSpeed);
    s.lifeMs = BOSS.slashLifeMs;
    // 显式关掉"不自转"：bossSlashes 是砍影和反月牙共用的池子，
    // 上一次从池里捞出来的可能是飞骑的月牙（它标了 noSpin），不清会带着这个标记
    s.noSpin = false;

    this.burstKill.explode(12, b.x, b.y);
    this.shakeScreen(150, 0.009, true);
    SoundSys.heavyKill();
  }

  updateBossSlash(dms) {
    this.bossSlashes.children.each(s => {
      if (!s.active) return;
      s.lifeMs -= dms;
      // 砍影会自转（看着像被甩出去的刀刃）；反月牙不能转 ——
      // 它的判定框是按"发射那一刻的角度"算出来的外接矩形，一转就对不上了
      if (!s.noSpin) s.rotation += dms * 0.0035;
      // 边界留 150px：boss 是站在棋盘外挥砍的，砍影出生点本来就在场地外
      if (s.lifeMs <= 0 || !Utils.insideBoard(s.x, s.y, 150)) this.recycleBossSlash(s);
    });
  }

  recycleBossSlash(s) {
    s.setActive(false).setVisible(false);
    if (s.body) { s.body.stop(); s.body.enable = false; }
  }

  /* 旋转后的轴对齐外接框，返回**帧内单位**（正好是 body.setSize 想要的单位）。
     为什么不能直接写 halfW*2 / halfH*2：
       1) 月牙是旋转的，外接框要按 rotation 重算；
       2) sprite 的 scale 允许 x / y 分开给（巫妖王的三种月牙就是靠非等比缩放做的），
          纹理内半宽沿 scaleX、半厚沿 scaleY，两个方向得分开乘。
     最后再各自除回 scale —— body.setSize 会把入参乘一次 scaleX / scaleY，
     不除回去的话非等比缩放的那几档判定框会整体偏大或偏小 */
  waveAABB(rot, sx, sy, halfW, halfH) {
    const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
    return {
      w: 2 * (c * halfW + s * halfH * sy / sx),
      h: 2 * (s * halfW * sx / sy + c * halfH),
    };
  }

  /* 砍影 / 月牙 的精确判定（processCallback）。
     为什么非做不可：Arcade 的 body 不跟着 sprite 旋转，而月牙是 132×24 的细长弧，
     斜着飞时"旋转外接矩形"会膨胀成 110×110 的方框，四个角全是空区 ——
     玩家离刀刃还有几十像素也会被判中。这类不公平命中比漏判更伤手感。
     这里把刀刃当成一个胶囊（轴长 108 + 半径 12，两端加回半径正好是 132×24），
     对玩家做"点到线段距离"，把空角裁掉。
     砍影本身是半径 34 的圆，AABB 已经够准，直接放行。
     为什么不会漏判：processCallback 只在 AABB 已相交之后才会被调用
     （Phaser World.separate 先跑 intersects 再调它），而且胶囊内切于旋转矩形、
     两边再各自膨胀玩家半径后仍是包含关系 —— 所以这里只可能"裁掉"，不会少打。 */
  bossSlashHits(player, s) {
    if (!s.noSpin) return true;              // 砍影：圆判定放行

    // 长轴方向 = sprite.rotation + axis0。
    // axis0 = "月牙长轴在纹理帧内的角度"，这张图是横着抠出来的（bbox 66×12），
    // 所以 axis0 = 0，胶囊轴就是 sprite.rotation。
    // ⚠️ 这里曾经写成 rotation + π/2 —— 等于把胶囊转 90°：横着飞的月牙
    // 拿一根竖着的胶囊去判。逐像素覆盖测试：各角度都只命中 45.1%，
    // 而且砍的是旋转外接矩形的两个**空角**（斜飞时最明显，玩家离得老远就被判中）
    const a = s.rotation + (s.axis0 || 0);

    // 胶囊参数按"这一发实际用的规格"读（发射时就存在 sprite 上）。
    // 兜底用哥布林的规格，是为了兼容那些不走 fireXxxWave 的老路径
    const axis = s.capAxis != null ? s.capAxis
      : (GOBLIN_WAVE.halfW - GOBLIN_WAVE.halfH) * GOBLIN_WAVE.sx;   // 屏幕上的胶囊轴半长
    const thick = s.capThick != null ? s.capThick
      : GOBLIN_WAVE.halfH * GOBLIN_WAVE.sy;                        // 屏幕上的半厚

    const ux = Math.cos(a), uy = Math.sin(a);
    // 玩家中心投到轴上再夹进 [-axis, axis]，就得到线段上的最近点
    let t = (player.x - s.x) * ux + (player.y - s.y) * uy;
    t = Phaser.Math.Clamp(t, -axis, axis);
    const dx = player.x - (s.x + ux * t);
    const dy = player.y - (s.y + uy * t);
    const reach = player.body.halfWidth + thick;   // 玩家半径（屏幕值）+ 刀刃半厚
    return dx * dx + dy * dy <= reach * reach;
  }

  onBossSlashHitsPlayer(player, s) {
    if (!s.active) return;
    // 先切到撞上的那位玩家：hurtPlayer 内部读的全是代理字段
    // （无敌帧 / 护盾 / 复活次数），不切的话挨打的永远是 P1
    this.usePlayer(player);
    this.recycleBossSlash(s);
    this.burstHit.explode(22, s.x, s.y);
    this.hurtPlayer();
  }

  /* ---- BOSS 受伤与死亡 ---- */

  damageBoss(damage) {
    const b = this.boss;
    if (!b || !b.active || b.spawning || this.bossState === 'dying') return;

    const m = this.mods;
    let dmg = (damage || 1) * m.bossDmgMul;

    // 巫妖王：落地 / 漂浮的伤害倍率不同。
    //   落地（lichFloat = 0）        → 1.5 倍
    //   满漂浮（lichFloat = fullUp） → 0.5 倍
    //   中间是线性插值，让"落地"这个窗口有明确的奖励感。
    // 只在 lich 时生效 —— 骷髅王和飞骑没有这个机制，直接原样走
    if (this.bossKind === 'lich') {
      const full = LICH.floatUp * LICH.scale;
      const fr = full > 0 ? Phaser.Math.Clamp(this.lichFloat / full, 0, 1) : 0;
      dmg *= 1.5 - fr;
    }
    let crit = false;
    if (m.critChance > 0 && Math.random() < m.critChance) {
      dmg *= m.critMul;
      crit = true;
    }
    dmg = Math.max(1, Math.round(dmg));

    this.bossHp -= dmg;
    // 打 BOSS 本身也给分：不然"打 boss"这段时间积分完全停滞，
    // 阶段增幅的进度条会卡住不动，看着像坏了
    this.addScore(dmg * this.bossK().scorePerHp);

    // 白闪节流。射速堆高之后每 50ms 一次的 setTintFill + delayedCall
    // 会攒出几百个待执行定时器，这里用 performance.now 卡一个最小间隔
    const now = performance.now();
    if (crit || now - this._bossFlashAt > 90) {
      this._bossFlashAt = now;
      b.setTintFill(0xffffff);
      this.time.delayedCall(50, () => {
        if (b.active && this.bossState !== 'dying') b.clearTint();
      });
    }
    if (crit) this.popText(b.x, b.y - 84, '×' + m.critMul.toFixed(1), '#ffd54a');

    // 飞骑 / 巫妖王挨打会抖一下（用 hurt 图集）。只在"停顿类"状态里播：
    // 猛冲 / 甩月牙 / 劈斩的判定点跟动画帧硬对齐，中途插受伤动画会让后面全错位。
    // 节流是必须的 —— 射速堆起来后 90ms 就一发，不节流会卡在受伤第一帧上抖
    if (this.bossKind === 'goblin' && this.goblinFlinchable()
      && now - this._goblinFlinchAt > GOBLIN.flinchGapMs) {
      this._goblinFlinchAt = now;
      this.bossFlinchMs = GOBLIN.flinchMs;
      this.playBossAnim('hurt');
    } else if (this.bossKind === 'lich' && this.lichFlinchable()
      && now - this._lichFlinchAt > LICH.flinchGapMs) {
      this._lichFlinchAt = now;
      this.bossFlinchMs = LICH.flinchMs;
      this.playBossAnim('hurt');
    }

    this.shakeScreen(40, 0.0015, true);

    if (this.bossHp <= 0) { this.bossHp = 0; this.onBossKilled(); }
  }

  onBossKilled() {
    const b = this.boss;
    if (!b || this.bossState === 'dying') return;

    const K = this.bossK();

    this.bossState = 'dying';
    this.bossT = 0;
    b.spawning = true;                 // 死亡演出期间免疫，也别再撞人
    if (b.body) { b.body.stop(); b.body.enable = false; }
    this.bossFacing = 'down';
    this.playBossAnim('death');

    this.addScore(K.killScore);
    this.clearEnemyBullets();
    this.bossSlashes.children.each(s => { if (s.active) this.recycleBossSlash(s); });
    this.bossCueFX.clear();

    // 巫妖王死了，它的召唤物和还没劈下来的落雷一起收掉。
    // 不收的话小巫妖会继续追着玩家打 —— BOSS 都死了还在挨打，体验上像 bug
    if (this.bossKind === 'lich') {
      this.clearLichMinions();
      this.lichBolts.length = 0;
      this.bossBoltFX.clear();
      this.bossShadow.setVisible(false);
    }

    this.shakeScreen(700, 0.026, true);
    SoundSys.over();
    Utils.vibrate(180);
    this.showBanner('B O S S   击 破', '#ffd54a');

    // 死亡演出：连续的小爆点，让"这东西真的散架了"看得见。
    // 爆点要围着**本体**炸，不能围着"地面线"炸 —— 飞骑和巫妖王的本体都悬在
    // 地面线上方 bodyUp×scale 处（巫妖王还额外飘着 floatUp），
    // 不补这个偏移爆点会全炸在肚子底下
    const oy = this.bossKind === 'goblin' ? -K.bodyUp * K.scale
      : this.bossKind === 'lich' ? -K.bodyUp * K.scale - this.lichFloat
        : 0;
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 120, () => {
        if (!b.active) return;
        const ex = b.x + Phaser.Math.Between(-80, 80);
        const ey = b.y + oy + Phaser.Math.Between(-60, 30);
        this.burstKill.explode(22, ex, ey);
        this.shockRing.emitParticleAt(ex, ey, 1);
      });
    }

    this.time.delayedCall(K.deathMs, () => this.onBossDefeated());
  }

  onBossDefeated() {
    // 玩家已经死了 / 已经通关 → 结算界面在跑，这里绝不能再插一层三选一
    if (this.state === 'gameover') return;

    // ---- 结算肉鸽模式的灵魂碎片 ----
    // 1. 局内积分：每满 2000 分，获得 1 个
    const scoreShards = Math.floor(this.score / 2000);
    // 2. BOSS 击杀奖励
    let bossShards = 0;
    if (this.rogue.map === 0) bossShards = 15;
    else if (this.rogue.map === 1) bossShards = 30;
    else if (this.rogue.map >= 2) bossShards = 60;

    const totalShards = scoreShards + bossShards;
    if (totalShards > 0) {
      Storage.addSoulShard(totalShards);
      this._lastSoulShardGain = totalShards;
    }
    // 兜底：万一将来多出别的中断源把 state 挪走（选卡、新的暂停态……），
    // 也不能把这次结算直接丢掉 —— 丢掉就等于 BOSS 不回收、这张图永远推进不下去。
    // 挂个标记，等回到 playing 由 updateRogue 补跑。
    // 注：暂停走不到这里 —— pauseGame 会把 this.time.paused 置真，
    // 连 delayedCall(deathMs) 都一起冻住，恢复后才继续倒计时
    if (this.state !== 'playing') { this._bossDefeatPending = true; return; }
    this._bossDefeatPending = false;

    this.recycleBoss();
    const g = this.rogue;

    if (g.map >= ROGUE.maps - 1) { this.rogueComplete(); return; }

    // 强力卡的概率随积分上涨：基础 15%，每多跨过一条积分线再加 7%，封顶 85%。
    // 用 buffsTaken（已跨线数）而不是 score/固定值 —— 阈值本身是递增的，
    // 拿分数直接除会算出"越往后越容易"的假象
    const strong = Phaser.Math.Clamp(
      ROGUE.strongBase + g.buffsTaken * ROGUE.strongPerStep,
      ROGUE.strongBase, ROGUE.strongMax);

    this.enqueueBuffChoices({
      title: '击 破   B O S S',
      sub: '第 ' + (g.map + 1) + ' 张图完成 · 强力卡出现率 ' + Math.round(strong * 100) + '%',
      strongChance: strong,
      /* 推进下一张图。
         ⚠️ 双人局这张卡会弹两次（两个人各选一张），必须等两个人都选完才推进 ——
         否则 P1 一选完，第二张图的 BOSS 流程就开始了，P2 还停在选卡面板上。
         判断依据是"选卡队列空了没"：pickBuff 里已经 shift 掉当前这一项，
         所以队列里还有剩就说明另一位还没选 */
      onPick: b => {
        this.applyBuff(b);
        if (!this.buffQueue || !this.buffQueue.length) this.startNextMap();
      },
    });
  }

  recycleBoss() {
    const b = this.boss;
    this.boss = null;
    this.bossState = 'none';
    this.bossT = 0;
    this.bossFightMs = 0;
    this.bossTune = null;
    this.bossCue = null;
    this.bossAnimKey = '';
    this.bossShocks.length = 0;
    // 哥布林飞骑的流程进度也要清 —— 场景实例是复用的，
    // 不清的话下一局开场就带着上一局剩下的"猛冲次数"
    this.goblinDashLeft = 0;
    this.goblinWaveLeft = 0;
    this.goblinDashTo = null;
    this.goblinWaveFired = false;
    this.bossFlyFrom = null;
    this.bossFlyMs = 0;
    this.bossAnimAct = '';
    this.bossFlinchMs = 0;
    this._goblinFlinchAt = 0;
    this._dashFxMs = 0;

    // 巫妖王的流程进度同样要清。它比飞骑多一大串"这一段发了几发"的计数器，
    // 漏掉任何一个，下一局开场就会带着上一局的进度 —— 表现是"一上来就放落雷"
    // 或者"月牙少放一道"，而且只在打第二次时才出现，最难复现
    this.lichStep = 0;
    this.lichFloat = 0;
    this.lichBobMs = 0;
    this.lichGroundY = 0;
    this.lichSmashFired = false;
    this.lichWaveFired = 0;
    this.lichSlashFired = 0;
    this.lichSlashRewound = false;
    this.lichLandShocked = false;
    this.lichSummoned = false;
    this.lichBoltFired = 0;
    this.lichBolts.length = 0;
    this._lichFlinchAt = 0;
    this.clearLichMinions();

    this.bossShockFX.clear();
    this.bossBoltFX.clear();
    this.bossCueFX.clear();
    this.bossBarFX.clear();
    if (this.bossShadow) this.bossShadow.setVisible(false);
    if (this.bossNameText) this.bossNameText.setVisible(false);
    if (b) {
      this.tweens.killTweensOf(b);
      this.recycleEnemy(b);
    }
  }

  startNextMap() {
    const g = this.rogue;
    g.map++;
    g.phase = 'wave';
    g.waveLeft = ROGUE.waveMs[Math.min(g.map, ROGUE.waveMs.length - 1)];
    // 难度不重置，反而从更高的起点继续爬 ——
    // 每张图都从"开局那几只步兵"重新来一遍，第 3 张图会无聊得让人想退
    this.difficultyLevel = ROGUE.diffPerMap * g.map;
    this.nextLevelAt = this.elapsed + CONFIG.diffIntervalBase;
    this._lastLevelText = '';
    this.isSpawning = false;
    this.spawnAccum = 0;
    this.clearFieldForBoss();
    // 过图回血：补 1 条命（不超上限）。
    // 不回血的话，第 1 张图被打到 1 血之后，后面两张图就是纯送 ——
    // 肉鸽的"越打越强"不该被血线卡死，而且回血也让"再来一局"的心理成本低得多
    if (this.lives < this.maxLives) {
      this.lives++;
      this.updateLivesHUD();
      this.popText(this.player.x, this.player.y - 40, '+1 生命', '#8affa0');
    }
    this.showBanner('第 ' + (g.map + 1) + ' 张 图', '#7fd4ff');
  }

  rogueComplete() {
    this.state = 'gameover';
    this.gameOverAt = this.time.now;
    SoundSys.levelup();

    this.clearEnemyBullets();
    this.bossCueFX.clear();
    this.bossShockFX.clear();
    this.bossBarFX.clear();
    this.rogueBarFX.clear();
    this.comboContainer.setVisible(false);
    if (this.pauseBtn) this.pauseBtn.setVisible(false);
    clearTimeout(this._slowMoTimer);
    this.resetTimeScale();

    if (this.score > this.best) {
      this.best = this.score;
      Storage.writeBest(this.best);
    }
    this.bestText.setText('最高 ' + this.best);
    this.flushCoins();
    Storage.pushHistory({
      score: this.score, difficulty: CONFIG.maxDifficulty,
      mode: 'rogue', map: ROGUE.maps, cleared: true, date: Date.now(),
    });
    this.enemies.children.each(e => { if (e.active && e.body) e.body.stop(); });

    this.time.delayedCall(520, () => this.showVictoryOverlay());
  }

  /* ---- BOSS 用的几个小几何工具 ---- */

  nearestEdgeDir(x, y) {
    const dL = x - BOARD.x, dR = BOARD.x + BOARD.w - x;
    const dT = y - BOARD.y, dB = BOARD.y + BOARD.h - y;
    const m = Math.min(dL, dR, dT, dB);
    if (m === dL) return 'left';
    if (m === dR) return 'right';
    if (m === dT) return 'up';
    return 'down';
  }

  bossOutDist(x, y) {
    return Math.max(0, BOARD.x - x, x - (BOARD.x + BOARD.w),
                       BOARD.y - y, y - (BOARD.y + BOARD.h));
  }

  dirTowardBoard(x, y) {
    const cx = BOARD.x + BOARD.w / 2, cy = BOARD.y + BOARD.h / 2;
    const dx = cx - x, dy = cy - y;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  dirToPlayer() {
    const b = this.boss;
    if (!b) return 'down';
    // 双人模式朝"离 BOSS 最近的那位" —— 固定朝 P1 的话，
    // P2 站在另一边输出完全不会被理睬
    const t = this.targetPlayer(b.x, b.y) || this.player;
    const dx = t.x - b.x, dy = t.y - b.y;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  pickBossLanding() {
    // 落点要同时躲开**两个**玩家：只躲 P1 的话，BOSS 可能一屁股坐在 P2 脸上
    const pc = this.playerCells();
    for (let i = 0; i < 30; i++) {
      const c = Phaser.Math.Between(0, CONFIG.cols - 1);
      const r = Phaser.Math.Between(0, CONFIG.rows - 1);
      let ok = true;
      for (let k = 0; k < pc.cols.length; k++) {
        if (Math.hypot(c - pc.cols[k], r - pc.rows[k]) < 2) { ok = false; break; }
      }
      if (ok) return { x: Utils.colCenter(c), y: Utils.rowCenter(r) };
    }
    return {
      x: Utils.colCenter(Math.floor(CONFIG.cols / 2)),
      y: Utils.rowCenter(Math.floor(CONFIG.rows / 2)),
    };
  }

  /* ---- 肉鸽 HUD ---- */

  updateRogueHUD() {
    const g = this.rogue;

    let label;
    if (g.phase === 'wave') {
      label = '第 ' + (g.map + 1) + ' / ' + ROGUE.maps + ' 图   ·   小怪  '
        + Math.max(0, Math.ceil(g.waveLeft / 1000)) + 's';
    } else if (g.phase === 'bossIntro') {
      label = '第 ' + (g.map + 1) + ' / ' + ROGUE.maps + ' 图   ·   B O S S   降 临';
    } else {
      label = '第 ' + (g.map + 1) + ' / ' + ROGUE.maps + ' 图   ·   B O S S';
    }
    if (label !== this._lastLevelText) {
      this._lastLevelText = label;
      this.levelText.setText(label);
      this.levelText.setColor(g.phase === 'wave' ? '#8fa3b8' : '#ff9a6a');
    }

    // 下一次"阶段增幅"的进度条。阈值是递增的，所以这一段要从
    // nextBuffAt 往回退 curStep（当前段的宽度），不能用固定值
    const p = this.rogueBarFX;
    p.clear();
    const prev = g.nextBuffAt - g.curStep;
    const t = Phaser.Math.Clamp((this.score - prev) / g.curStep, 0, 1);
    const bw = 200, bx = 48, by = 100;
    p.fillStyle(0x0b1520, 0.75);
    p.fillRoundedRect(bx - 2, by - 2, bw + 4, 12, 6);
    if (t > 0.02) {
      p.fillStyle(0xffd54a, 0.95);
      p.fillRoundedRect(bx, by, Math.max(6, bw * t), 8, 4);
    }
    p.lineStyle(1.5, 0x33404f, 1);
    p.strokeRoundedRect(bx - 2, by - 2, bw + 4, 12, 6);

    // BOSS 血条
    const b = this.bossBarFX;
    b.clear();
    if (this.bossState === 'none' || this.bossHpMax <= 0) return;

    // 巫妖王的伤害倍率标签：只在它这一场、且不在出场 / 死亡演出里显示。
    // 每帧刷一次显示，用 setColor 让"高倍率 / 低倍率"一眼分得出 ——
    // 数字本身要读，颜色不用
    if (this.bossMulText) {
      const active = this.bossKind === 'lich'
        && this.bossState !== 'none'
        && this.bossState !== 'telegraph'
        && this.bossState !== 'fall'
        && this.bossState !== 'dying';
      if (active) {
        const full = LICH.floatUp * LICH.scale;
        const fr = full > 0 ? Phaser.Math.Clamp(this.lichFloat / full, 0, 1) : 0;
        const mul = 1.5 - fr;
        this.bossMulText.setVisible(true);
        this.bossMulText.setText('伤 害  ×' + mul.toFixed(2));
        // 落地（≥1.2）暖橙，漂浮（≤0.7）冷蓝，中间黄 ——
        // 三色系直接对应"该不该打"
        this.bossMulText.setColor(
          mul >= 1.2 ? '#ff8a5a' : mul <= 0.7 ? '#8fd0ff' : '#ffe066');
      } else if (this.bossMulText.visible) {
        this.bossMulText.setVisible(false);
      }
    }

    const BW = 560, BH = 22;
    const bx2 = CONFIG.width / 2 - BW / 2, by2 = 50;
    const ratio = Phaser.Math.Clamp(this.bossHp / this.bossHpMax, 0, 1);

    b.fillStyle(0x0b1520, 0.88);
    b.fillRoundedRect(bx2 - 4, by2 - 4, BW + 8, BH + 8, 9);
    b.fillStyle(0x33181a, 1);
    b.fillRoundedRect(bx2, by2, BW, BH, 5);
    if (ratio > 0.01) {
      // 血量过半是暗红，见底转橙 —— 只靠长度变化，在弹幕里很容易看漏
      b.fillStyle(ratio > 0.35 ? 0xd94a4a : 0xff7a2a, 1);
      b.fillRoundedRect(bx2, by2, Math.max(6, BW * ratio), BH, 5);
    }
    b.lineStyle(2, 0xffd54a, 0.8);
    b.strokeRoundedRect(bx2 - 4, by2 - 4, BW + 8, BH + 8, 9);
  }

  /* ---- 通用小特效 ---- */

  popText(x, y, str, color) {
    const t = this.add.text(x, y, str, {
      fontFamily: UI.MONO, fontSize: '20px', color: color || '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(8960);

    this.tweens.add({
      targets: t, y: y - 30, alpha: 0, duration: 620, ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /* ======================= 天气系统 ======================= */

  changeWeather(forceType) {
    const probs = CONFIG.weatherProbs;
    let type = forceType;

    if (!type) {
      const roll = Math.random();
      let cumulative = 0;
      for (const [k, v] of Object.entries(probs)) {
        cumulative += v;
        if (roll < cumulative) { type = k; break; }
      }
    }

    // 如果类型相同，只是重置时间
    if (type === this.weather.current && !forceType) {
      this.weather.timer = CONFIG.weatherDuration;
      return;
    }

    this.weather.current = type;
    this.weather.timer = CONFIG.weatherDuration;
    this.weather.puddles = [];
    this.weather.thunderBolts = [];
    this.weather.thunderTimer = 0;
    this.weather.fade = 0;   // 新天气的特效从 0 淡入
    // 每次切天气重新掷一次风。连着几场雨都朝同一边飘会很假，
    // 而且风向也决定了雪花往哪边横漂
    this.weather.wind = (Math.random() * 2 - 1) * 0.6;

    // 根据天气生成地形。
    // 位置用固定种子 —— 同一场天气里重画两次（比如切回来又切过去）不会跳位置
    if (type === 'rain' || type === 'thunderstorm') {
      const count = PERF.low ? 4 : Phaser.Math.Between(5, 8);
      const rnd = new Phaser.Math.RandomDataGenerator(['weather', type, String(Math.round(this.elapsed))]);
      for (let i = 0; i < count; i++) {
        this.weather.puddles.push({
          x: rnd.between(BOARD.x + 70, BOARD.x + BOARD.w - 70),
          y: rnd.between(BOARD.y + 70, BOARD.y + BOARD.h - 70),
          r: rnd.between(46, 76),
          phase: rnd.realInRange(0, Math.PI * 2),  // 涟漪相位，错开才不会同步呼吸
          type: rnd.frac() < 0.4 ? 'ditch' : 'puddle',
        });
      }
    }

    if (type === 'thunder' || type === 'thunderstorm') {
      this.weather.thunderTimer = 1500;
    }

    // 雨 / 雪的贴图是懒建的：一直晴天的话一张 CanvasTexture 都不用生成
    Textures.ensureWeather(this);
    const rain = type === 'rain' || type === 'thunderstorm';
    const snow = type === 'snow';
    this.weatherRain.setVisible(rain);
    this.weatherSnow.setVisible(snow);
    // 密度靠 tileScale 调：低配机把图放大 = 单位面积里雨丝 / 雪花更少，
    // 但滚动速度不变，观感一致只是更省
    this.weatherRain.setTileScale(PERF.rainScale);
    this.weatherSnow.setTileScale(PERF.snowScale);

    this.rebuildWeatherGround();

    // 显示天气横幅
    const banners = {
      sunny: { text: '晴 天', color: '#ffe066' },
      rain: { text: '雨 天', color: '#8fd0ff' },
      snow: { text: '雪 天', color: '#ffffff' },
      thunder: { text: '雷 天', color: '#ffd54a' },
      thunderstorm: { text: '雷 雨 天', color: '#ff9a6a' }
    };
    if (banners[type]) this.showBanner(banners[type].text, banners[type].color);
  }

  /* 静态地形只在切天气时重画一次。
     画在角色**下面**（depth -900）—— 雷天压暗如果压在角色上面，
     敌人和子弹也会一起糊暗，玩起来看不清 */
  rebuildWeatherGround() {
    const g = this.weatherGroundFX;
    g.clear();
    const type = this.weather.current;

    if (type === 'thunder' || type === 'thunderstorm') {
      g.fillStyle(0x06101f, 0.42);
      g.fillRect(0, 0, CONFIG.width, CONFIG.height);
    }

    if (type === 'snow') {
      g.fillStyle(0xdfeeff, 0.16);
      g.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
      // 四边积雪：比中间更实，看着像雪被风推到了边上
      g.fillStyle(0xffffff, 0.2);
      g.fillRect(BOARD.x, BOARD.y, BOARD.w, 10);
      g.fillRect(BOARD.x, BOARD.y + BOARD.h - 10, BOARD.w, 10);
      g.fillRect(BOARD.x, BOARD.y, 10, BOARD.h);
      g.fillRect(BOARD.x + BOARD.w - 10, BOARD.y, 10, BOARD.h);
    }

    for (const p of this.weather.puddles) {
      if (p.type === 'puddle') this.drawPuddle(g, p);
      else this.drawDitch(g, p);
    }
  }

  /* 水洼：三层同心椭圆假装径向渐变（Graphics 没有渐变填充，
     为几个水洼生成一张 CanvasTexture 不划算），再叠镜面高光和一圈水边高光 */
  drawPuddle(g, p) {
    const w = p.r * 2, h = p.r * 1.24;
    // 外沿：被水浸湿的深色泥
    g.fillStyle(0x14202c, 0.5);
    g.fillEllipse(p.x, p.y, w * 1.16, h * 1.16);
    // 水色由外到内逐层变亮
    g.fillStyle(0x123049, 0.85); g.fillEllipse(p.x, p.y, w, h);
    g.fillStyle(0x1b4a70, 0.85); g.fillEllipse(p.x, p.y, w * 0.8, h * 0.78);
    g.fillStyle(0x2a6ea6, 0.78); g.fillEllipse(p.x, p.y, w * 0.52, h * 0.5);
    // 镜面高光：偏左上的一小片，暗示光从左上打过来
    g.fillStyle(0xcfe8ff, 0.2);
    g.fillEllipse(p.x - p.r * 0.34, p.y - p.r * 0.24, w * 0.34, h * 0.2);
    // 水边高光弧
    g.lineStyle(1.5, 0x8fd0ff, 0.32);
    g.strokeEllipse(p.x, p.y, w * 0.98, h * 0.98);
  }

  /* 水沟：踩上去掉血的危险地形，所以长得必须和"水洼"一眼分得开 ——
     深黑 + 冷青双色描边 + 内部斜纹暗流。旧版只是颜色深一点，
     玩家分不清哪个能踩哪个不能踩 */
  drawDitch(g, p) {
    const w = p.r * 1.8, h = p.r * 0.92;
    g.fillStyle(0x050b12, 0.92); g.fillEllipse(p.x, p.y, w * 1.14, h * 1.14);
    g.fillStyle(0x0a1d2e, 1);    g.fillEllipse(p.x, p.y, w, h);
    g.fillStyle(0x0d2b42, 1);    g.fillEllipse(p.x, p.y, w * 0.7, h * 0.66);
    // 沟底的暗流斜纹
    g.lineStyle(1.5, 0x2f6f96, 0.5);
    for (let i = -2; i <= 2; i++) {
      const cx = p.x + i * w * 0.16;
      g.lineBetween(cx - h * 0.26, p.y + h * 0.2, cx + h * 0.26, p.y - h * 0.2);
    }
    // 危险描边：外圈青内圈白，双色比单色显眼得多
    g.lineStyle(3, 0x8fd0ff, 0.5); g.strokeEllipse(p.x, p.y, w, h);
    g.lineStyle(1.5, 0xffffff, 0.36); g.strokeEllipse(p.x, p.y, w * 0.88, h * 0.88);
  }

  updateWeather(dms) {
    this.weather.t += dms;
    if (this.weather.fade < 1) {
      this.weather.fade = Math.min(1, this.weather.fade + dms / CONFIG.weatherTransitionMs);
    }
    this.weather.timer -= dms;
    if (this.weather.timer <= 0) {
      this.changeWeather();
    }

    // 雷天/雷雨天的打雷逻辑
    if (this.weather.current === 'thunder' || this.weather.current === 'thunderstorm') {
      this.weather.thunderTimer -= dms;
      if (this.weather.thunderTimer <= 0) {
        this.weather.thunderTimer = Phaser.Math.Between(1500, 3000);
        this.spawnThunderBolt();
      }
    }
  }

  /* 雷击。折线在**生成那一刻**就算好并冻住 —— 每帧重算的话闪电会疯狂抖动，
     看着像一根跳动的面条而不是一道光 */
  spawnThunderBolt() {
    const m = 26;
    const x = Phaser.Math.Between(BOARD.x + m, BOARD.x + BOARD.w - m);
    const y = Phaser.Math.Between(BOARD.y + m, BOARD.y + BOARD.h - m);

    // 主干：从屏幕上方外面折到落点，中间几段随机偏移
    const startX = x + Phaser.Math.Between(-110, 110);
    const segs = 6;
    const path = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const jitter = (i === 0 || i === segs) ? 0 : Phaser.Math.Between(-30, 30);
      path.push({ x: startX + (x - startX) * t + jitter, y: -30 + (y + 30) * t });
    }

    // 分叉：从主干中间两个点各引一条更短更细的支线
    const forks = [];
    for (let f = 0; f < 2; f++) {
      const from = path[2 + f];
      if (!from) continue;
      const dir = f === 0 ? -1 : 1;
      const branch = [{ x: from.x, y: from.y }];
      let bx = from.x, by = from.y;
      for (let i = 0; i < 3; i++) {
        bx += dir * Phaser.Math.Between(18, 42);
        by += Phaser.Math.Between(24, 54);
        branch.push({ x: bx, y: by });
      }
      forks.push(branch);
    }

    this.weather.thunderBolts.push({
      x, y, r: 40,
      warnMs: 820,     // 前摇：预警圈从大到小收拢，收完才劈
      flashMs: 240,    // 闪电本体 + 全屏曝光
      afterMs: 460,    // 地面余辉
      phase: 'warn',
      t: 0,
      path, forks,
    });
  }

  updateThunderBolts(dms) {
    const list = this.weather.thunderBolts;
    if (!list.length) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      q.t += dms;
      if (q.phase === 'warn') {
        if (q.t >= q.warnMs) {
          q.phase = 'flash';
          q.t = 0;
          this.strikeThunder(q);
        }
      } else if (q.phase === 'flash') {
        if (q.t >= q.flashMs) { q.phase = 'after'; q.t = 0; }
      } else if (q.t >= q.afterMs) {
        list.splice(i, 1);
      }
    }
  }

  /* 雷劈下来的那一帧：伤害判定 + 全屏曝光 + 音效。
     判定口径和旧版**完全一致**（半径 40 + 玩家半径 17 / 敌人 30% 体宽），
     这一轮只换了表现，没有动数值 */
  strikeThunder(q) {
    this.burstKill.explode(18, q.x, q.y);
    this.shockRing.emitParticleAt(q.x, q.y, 1);
    this.shakeScreen(190, 0.011, true);
    this.weather.flash = 1;
    SoundSys.thunder();

    // 玩家伤害：逐个玩家判 —— 只判 P1 的话，P2 站在雷里完全不掉血
    for (let pi = 0; pi < this.players.length; pi++) {
      const sp = this.players[pi].sprite;
      if (!sp || !sp.visible) continue;
      if (Math.hypot(sp.x - q.x, sp.y - q.y) <= q.r + 17) {
        this.pIndex = pi;
        this.hurtPlayer();
      }
    }
    // 敌人伤害
    this.enemies.children.each(e => {
      if (e.active && !e.isBoss && !e.undead && !e.spawning && Math.hypot(e.x - q.x, e.y - q.y) <= q.r + e.displayWidth * 0.3) {
        this.damageEnemy(e, 1);
      }
    });
  }

  updateWeatherFX(dms) {
    const type = this.weather.current;
    const fade = this.weather.fade;
    const t = this.weather.t;

    // ---- 雨 / 雪：只改 tilePosition，各 1 个 draw call ----
    if (this.weatherRain.visible) {
      this.weatherRain.setAlpha(0.85 * fade);
      this.weatherRain.tilePositionY += dms * 1.35;
      this.weatherRain.tilePositionX += (dms * 0.42 + this.weather.wind * dms * 0.5);
    }
    if (this.weatherSnow.visible) {
      this.weatherSnow.setAlpha(0.9 * fade);
      this.weatherSnow.tilePositionY += dms * 0.075;
      // 雪花横漂 = 风力 + 一条很慢的正弦，看着像被气流感着走
      this.weatherSnow.tilePositionX += this.weather.wind * dms * 0.05
        + Math.sin(t / 2600) * 0.06;
    }

    // ---- 水面涟漪 ----
    const wg = this.weatherWaterFX;
    wg.clear();
    if (type === 'rain' || type === 'thunderstorm') {
      for (const p of this.weather.puddles) {
        if (p.type !== 'puddle') continue;
        for (let k = 0; k < 2; k++) {
          // 周期和相位都错开，水面才不会像在同步呼吸
          const cyc = 1500 + k * 520;
          const ph = ((t + p.phase * 700 + k * 400) % cyc) / cyc;
          const rr = p.r * (0.18 + 0.75 * ph);
          wg.lineStyle(1.5, 0xbfe4ff, (1 - ph) * 0.4 * fade);
          wg.strokeEllipse(p.x, p.y, rr * 2, rr * 1.24);
        }
      }
    }

    // ---- 闪电 ----
    const sg = this.weatherSkyFX;
    sg.clear();
    for (const q of this.weather.thunderBolts) {
      if (q.phase === 'warn') this.drawBoltWarning(sg, q, fade);
      else if (q.phase === 'flash') this.drawBoltStrike(sg, q);
      else this.drawBoltAfter(sg, q);
    }

    // ---- 全屏曝光衰减 ----
    if (this.weather.flash > 0) {
      this.weather.flash = Math.max(0, this.weather.flash - dms / 200);
      // 平方一下：亮得快、暗得也快，中间那段不会糊太久
      this.weatherFlashRect.setAlpha(this.weather.flash * this.weather.flash * 0.5);
    } else if (this.weatherFlashRect.alpha !== 0) {
      this.weatherFlashRect.setAlpha(0);
    }
  }

  /* 落雷前摇：从大到小收拢的预警圈 + 十字准星 + 地面亮斑。
     圈收完才劈 —— 这就是这一招的全部前摇，玩家靠它躲 */
  drawBoltWarning(g, q, fade) {
    const p = Phaser.Math.Clamp(q.t / q.warnMs, 0, 1);
    const r = q.r * (2.8 - 1.8 * p);
    const a = (0.28 + 0.62 * p) * fade;

    // 地面亮斑：越接近落雷越亮，把视线拉过去
    g.fillStyle(0x8fd0ff, 0.1 * p * fade);
    g.fillEllipse(q.x, q.y, q.r * 2.1, q.r * 1.1);

    g.lineStyle(3, 0x9fe8ff, a);
    g.strokeCircle(q.x, q.y, r);
    g.lineStyle(2, 0xffffff, a * 0.7);
    g.strokeCircle(q.x, q.y, r * 0.58);

    // 十字准星画在圈**外面**，不盖住判定范围
    const arm = q.r * 0.62;
    const gap = r + 6;
    g.lineStyle(2, 0xd8f4ff, a * 0.8);
    g.lineBetween(q.x - gap - arm, q.y, q.x - gap, q.y);
    g.lineBetween(q.x + gap, q.y, q.x + gap + arm, q.y);
    g.lineBetween(q.x, q.y - gap - arm, q.x, q.y - gap);
    g.lineBetween(q.x, q.y + gap, q.x, q.y + gap + arm);
  }

  /* 闪电本体：主干折线 + 两条分叉，各画三层（宽而暗 / 中而亮 / 细而白）做辉光。
     折线在 spawnThunderBolt 里就冻住了，这里只是照着画 */
  drawBoltStrike(g, q) {
    const k = Phaser.Math.Clamp(q.t / q.flashMs, 0, 1);
    const a = 1 - k * 0.55;
    const stroke = (pts, w, color, alpha) => {
      g.lineStyle(w, color, alpha);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokePath();
    };

    stroke(q.path, 16, 0x4a90d9, 0.16 * a);
    stroke(q.path, 7, 0x9fe8ff, 0.5 * a);
    stroke(q.path, 2.5, 0xffffff, 0.95 * a);
    for (const f of q.forks) {
      stroke(f, 9, 0x4a90d9, 0.12 * a);
      stroke(f, 3.5, 0xcfe8ff, 0.45 * a);
      stroke(f, 1.5, 0xffffff, 0.8 * a);
    }

    // 落点炸开的光圈
    g.lineStyle(4, 0xd8f4ff, (1 - k) * 0.9);
    g.strokeCircle(q.x, q.y, q.r * (0.5 + 1.7 * k));
    g.fillStyle(0xffffff, (1 - k) * 0.5);
    g.fillEllipse(q.x, q.y, q.r * 1.2, q.r * 0.6);
  }

  /* 雷击余辉：地上留一圈烧焦的暗斑慢慢淡掉。
     没有这一段的话闪电会"啪一下没了"，像贴图丢了 */
  drawBoltAfter(g, q) {
    const k = Phaser.Math.Clamp(q.t / q.afterMs, 0, 1);
    const a = 1 - k;
    g.fillStyle(0x1a1005, 0.26 * a);
    g.fillEllipse(q.x, q.y, q.r * 1.9, q.r * 0.95);
    g.lineStyle(2, 0xffb066, 0.2 * a);
    g.strokeCircle(q.x, q.y, q.r * (1.05 + 0.5 * k));
  }

  showBanner(text, color) {
    const t = this.add.text(CONFIG.width / 2, 214, text, {
      fontFamily: UI.FONT, fontSize: '40px', color: color || '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8980);
    t.setShadow(0, 5, '#000000', 12, true, true);
    t.setScale(0.72).setAlpha(0);

    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t, alpha: 0, y: 182, delay: 1150, duration: 420, ease: 'Quad.easeIn',
      onComplete: () => t.destroy(),
    });
  }

  gameOver() {
    this.state = 'gameover';
    this.gameOverAt = this.time.now;
    SoundSys.over();

    this.burstHit.explode(30, this.player.x, this.player.y);
    this.shakeScreen(320, 0.02, true);

    // 图集角色有完整的倒地动画，让它播完再收尾；程序化角色没有这套动画，
    // 这里返回 0，下面的节奏和改动前完全一样
    const deathMs = this.playPlayerDeath();

    this.redVignette.setAlpha(0);
    this.dangerGlow.setAlpha(0);
    this.pressureVignette.setAlpha(0);
    this.comboContainer.setVisible(false);
    if (this.pauseBtn) this.pauseBtn.setVisible(false);

    // 死亡时立刻把时间缩放归位，避免结算界面还在慢动作
    clearTimeout(this._slowMoTimer);
    this.resetTimeScale();

    if (this.score > this.best) {
      this.best = this.score;
      Storage.writeBest(this.best);
    }
    this.bestText.setText('最高 ' + this.best);

    // 结算前把金币落盘：中途是攒够 1 秒才写的，最后一笔必须补上
    this.flushCoins();

    // 结算灵魂碎片（仅无尽模式）
    // 结算灵魂碎片
    let shards = 0;
    if (this.rogueMode) {
      // 肉鸽模式：按积分计算（每 2000 分 1 个），Boss 奖励已经在 onBossDefeated 里发过了
      shards = Math.floor(this.score / 2000);
    } else {
      // 无尽模式
      if (this.score >= 1000) shards = 2;
      if (this.score >= 3000) shards = 4;
      if (this.score >= 6000) shards = 7;
      if (this.score >= 10000) shards = 10;
    }
    if (shards > 0) {
      Storage.addSoulShard(shards);
      this._lastSoulShardGain = shards;
    }

    Storage.pushHistory({
      score: this.score,
      difficulty: this.difficultyLevel + 1,
      // 肉鸽局记一下打到第几张图，历史战绩里能看出两种模式的区别
      mode: this.rogueMode ? 'rogue' : 'endless',
      map: this.rogueMode ? this.rogue.map + 1 : 0,
      date: Date.now(),
    });

    // 冻结残余敌人，避免结算画面上还有东西在动
    this.enemies.children.each(e => { if (e.active && e.body) e.body.stop(); });

    this.time.delayedCall(deathMs + 320, () => this.showGameOverOverlay());
  }

  /* 死亡动画：图集角色把整套倒地动作播完再消失，程序化角色直接消失。
     物理体必须立刻停掉，不能等动画播完 —— 否则这七百毫秒里敌人还会反复
     撞上来，画面上一个已经倒地的人还在挨打。
     返回"要等多久才收尾"，由 gameOver 决定什么时候弹结算界面。 */
  playPlayerDeath() {
    const p = this.player;
    const key = this.charDef.sheet ? this.charDef.sheet + '-death-' + p.facing : null;

    if (key && this.anims.exists(key)) {
      p.anims.play(key, true);
      this.playerAnimKey = key;
      p.body.enable = false;

      // 死亡动画整体时长 = 帧数 ÷ 帧率。从 CHAR_ANIMS 里读真实值而不是写死 700ms ——
      // 矮人这种 6 帧 @ 8fps 的图集要播 750ms，写死 700 会让最后一帧还没显示完人就消失了。
      // 再乘一个 1.4 的缓冲系数，让玩家看清倒地姿态再进结算界面
      const def = CHAR_ANIMS[this.charDef.sheet] && CHAR_ANIMS[this.charDef.sheet].death;
      const rawMs = def ? (def.frames / def.rate) * 1000 : 700;
      const ms = Math.round(rawMs * 1.4);

      this.time.delayedCall(ms, () => {
        if (this.state !== 'gameover') return;
        p.setVisible(false);
        this.playerShadow.setVisible(false);
      });
      return ms;
    }

    p.body.enable = false;
    p.setVisible(false);
    this.playerShadow.setVisible(false);
    return 0;
  }

  showGameOverOverlay() {
    this.clearOverlay();

    const W = CONFIG.width, H = CONFIG.height;

    const bg = this.add.rectangle(0, 0, W, H, 0x060b12, 0.85).setOrigin(0, 0);
    bg.setInteractive();
    this.overlay.add(bg);

    const title = this.add.text(W/2, 140, '被 击 倒 了', {
      fontFamily: UI.FONT, fontSize: '58px', color: '#ff7a7a', fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 6, '#000000', 12, true, true);
    this.overlay.add(title);

    const sub = this.add.text(W/2, 206, 'G A M E   O V E R', {
      fontFamily: UI.MONO, fontSize: '16px', color: '#55697d', letterSpacing: 8,
    }).setOrigin(0.5);
    this.overlay.add(sub);

    const cardX = W/2 - 160, cardY = 280, cardW = 320, cardH = 120;
    const card = this.add.graphics();
    card.fillStyle(0x152130, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    card.lineStyle(2, 0x4a90d9, 0.6);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);
    this.overlay.add(card);

    const scoreLabel = this.add.text(W/2, cardY + 24, '本 局 得 分', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#8fa3b8',
    }).setOrigin(0.5);
    this.overlay.add(scoreLabel);

    const scoreNum = this.add.text(W/2, cardY + 72, String(this.score), {
      fontFamily: UI.MONO, fontSize: '44px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlay.add(scoreNum);

    const bestText = this.add.text(W/2, cardY + cardH + 22, '最高分  ' + this.best, {
      fontFamily: UI.MONO, fontSize: '17px', color: '#8fa3b8',
    }).setOrigin(0.5);
    this.overlay.add(bestText);

    // 与 HUD 用同一套标签逻辑，满难度时显示 MAX 而不是"难度 31"。
    // 肉鸽局改成显示打到第几张图 —— 那边"难度等级"对玩家没有意义
    const diffText = this.add.text(W/2, cardY + cardH + 52,
      this.rogueMode
        ? '肉鸽进度 · 第 ' + (this.rogue.map + 1) + ' / ' + ROGUE.maps + ' 张图'
        : '到达 ' + this.difficultyLabel(this.difficultyLevel), {
      fontFamily: UI.MONO, fontSize: '17px', color: '#7fffa0',
    }).setOrigin(0.5);
    this.overlay.add(diffText);

    const hint = this.add.text(W/2, cardY + cardH + 84, '空格 / 回车 / R 快速重开', {
      fontFamily: UI.FONT, fontSize: '13px', color: '#55697d',
    }).setOrigin(0.5);
    this.overlay.add(hint);

    const coinText = this.add.text(W/2, cardY + cardH + 112,
      '本局金币 +' + this.coinsEarned + '      金币总数 ' + this.coins, {
        fontFamily: UI.MONO, fontSize: '16px', color: '#ffd54a', fontStyle: 'bold',
      }).setOrigin(0.5);
    this.overlay.add(coinText);

    // 重开必须把模式一起传回去。scene.restart() 不传 data 时，
    // 新一局拿到的 data 是 undefined，肉鸽局会静默变成无限模式
    this.overlay.add(UI.makeButton(this, W/2 - 150, H - 80, 240, 68, '重 新 开 始', 0x3a5230, 0x577346, () => {
      this.time.paused = false;
      this.physics.world.resume();
      this.state = 'playing';
      this.scene.restart(this.modeData());
    }));
    this.overlay.add(UI.makeButton(this, W/2 + 150, H - 80, 240, 68, '返 回 主 菜 单', 0x5d452a, 0x8b6a3f, () => {
      this.time.paused = false;
      this.physics.world.resume();
      this.state = 'playing';
      this.scene.start('Menu');
    }));

    this.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 260 });
  }

  /* 重开时要把整备信息原样带回去的唯一出口。
     ⚠️ 双人局必须把两人的角色 / 武器 / 技能一起带上 ——
     只带 mode 的话，按 R 重开或点"再来一局"会掉回单人模式，
     而且用的是存档里的整备，两个人选的配置全丢 */
  modeData() {
    const d = { mode: this.rogueMode ? 'rogue' : 'endless' };
    if (this.twoPlayer) {
      d.twoPlayer = true;
      d.p1 = this.playerCfgs[0] || {};
      d.p2 = this.playerCfgs[1] || {};
    }
    return d;
  }

  /* 肉鸽通关：三张图全部打完 */
  showVictoryOverlay() {
    this.clearOverlay();

    const W = CONFIG.width, H = CONFIG.height;

    const bg = this.add.rectangle(0, 0, W, H, 0x06120b, 0.88).setOrigin(0, 0);
    bg.setInteractive();
    this.overlay.add(bg);

    const title = this.add.text(W/2, 118, '通    关', {
      fontFamily: UI.FONT, fontSize: '64px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5);
    title.setShadow(0, 7, '#000000', 14, true, true);
    this.overlay.add(title);

    const sub = this.add.text(W/2, 184, 'V I C T O R Y   ·   ' + ROGUE.maps + ' / ' + ROGUE.maps + '  图 全 清', {
      fontFamily: UI.MONO, fontSize: '16px', color: '#7fffa0', letterSpacing: 4,
    }).setOrigin(0.5);
    this.overlay.add(sub);

    const cardX = W/2 - 230, cardY = 236, cardW = 460, cardH = 168;
    const card = this.add.graphics();
    card.fillStyle(0x152130, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    card.lineStyle(2.5, 0xffd54a, 0.7);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);
    this.overlay.add(card);

    this.overlay.add(this.add.text(W/2, cardY + 26, '总 积 分', {
      fontFamily: UI.FONT, fontSize: '15px', color: '#8fa3b8',
    }).setOrigin(0.5));

    this.overlay.add(this.add.text(W/2, cardY + 70, String(this.score), {
      fontFamily: UI.MONO, fontSize: '46px', color: '#ffe066', fontStyle: 'bold',
    }).setOrigin(0.5));

    const picks = this.rogue.picks.length;
    this.overlay.add(this.add.text(W/2, cardY + 112,
      '共获得 ' + picks + ' 项增幅   ·   击杀 ' + this.rogue.killCount + ' 个敌人', {
      fontFamily: UI.MONO, fontSize: '15px', color: '#7fffa0',
    }).setOrigin(0.5));

    this.overlay.add(this.add.text(W/2, cardY + 140,
      '最高分  ' + this.best + '      本局金币 +' + this.coinsEarned, {
      fontFamily: UI.MONO, fontSize: '15px', color: '#ffd54a',
    }).setOrigin(0.5));

    // 本局拿到的增幅列一遍，让玩家回味一下自己这套 build
    if (picks > 0) {
      const names = this.rogue.picks
        .map(k => (ROGUE_BUFFS.find(b => b.key === k) || {}).name)
        .filter(Boolean)
        .join(' · ');
      this.overlay.add(this.add.text(W/2, cardY + cardH + 30, names, {
        fontFamily: UI.FONT, fontSize: '14px', color: '#8fa3b8', align: 'center',
        wordWrap: { width: W - 160, useAdvancedWrap: true },
      }).setOrigin(0.5, 0));
    }

    this.overlay.add(this.add.text(W/2, cardY + cardH + 84, '空格 / 回车 / R 快速重开', {
      fontFamily: UI.FONT, fontSize: '13px', color: '#55697d',
    }).setOrigin(0.5));

    this.overlay.add(UI.makeButton(this, W/2 - 150, H - 62, 240, 60, '再 来 一 局', 0xa8392f, 0xd95a4a, () => {
      this.time.paused = false;
      this.physics.world.resume();
      this.state = 'playing';
      this.scene.restart(this.modeData());
    }));
    this.overlay.add(UI.makeButton(this, W/2 + 150, H - 62, 240, 60, '返 回 主 菜 单', 0x5d452a, 0x8b6a3f, () => {
      this.time.paused = false;
      this.physics.world.resume();
      this.state = 'playing';
      this.scene.start('Menu');
    }));

    this.overlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 1, duration: 260 });
  }

  hideOverlay() {
    this.tweens.killTweensOf(this.overlay);
    this.tweens.add({
      targets: this.overlay, alpha: 0, duration: 160,
      onComplete: () => {
        this.overlay.list.slice().forEach(c => this.tweens.killTweensOf(c));
        this.overlay.setVisible(false);
        this.overlay.removeAll(true);
      },
    });
  }
}

