/* ============================================================================
   棋盘皮肤
   ----------------------------------------------------------------------------
   一个皮肤 = 一组可选"覆盖层"。'grass'（默认）什么也不加，挂回 09-game.js
   buildBackground 里的程序化绘制（木栅栏 + 草地 + 棋盘纹理 + 光影）；
   'thunder' 是雷电主题，额外在 BOARD 矩形上盖一层 4 帧循环的 sprite sheet。
   它不替换程序化背景 —— 草地和棋盘纹路还在，只是上面多了一层飘电。
   字段都集中在表里：未来加皮肤只需在这张表登记，菜单切换和 buildBackground
   都会自动从这张表读，不会漏改一处。
   ============================================================================ */
const BOARD_SKINS = {
  grass: {
    key: 'grass',
    name: '青 草 地',
    desc: '默认皮肤。程序化绘制的草地 + 木栅栏，零资源开销。',
    sheet: null,        // 没有 sprite sheet
    frames: 0,
    rate: 0,
    alpha: 0,
    owned: true,        // 默认解锁，无须购买
  },
  thunder: {
    key: 'thunder',
    name: '雷 电 棋 盘',
    desc: '在青草地上叠加一层循环的电光粒子，棋盘四角带蓝色边框灯。',
    sheet: 'board-thunder',
    frames: 4,
    rate: 4,            // 4 fps，4 帧循环刚好 1 秒；太快会乱，太慢像卡图
    alpha: 0.85,        // 不要全不透明，会盖住棋盘纹路，玩家看不出自己在走格子
    owned: true,        // 免费送的（用户要的"添加皮肤"）
  },
};

/* 当前选中的棋盘皮肤键。在主菜单可以切换，写进 loadout 跨局保存。
   找不到的 key 自动退回 'grass'，这样以后从表里删掉某个皮肤也不会崩 */
const DEFAULT_BOARD_SKIN = 'thunder';
const BOARD_SKINS_ORDER = ['grass', 'thunder'];

/* ============================================================================
   CONFIG —— 想调手感，改这里就够了
   ============================================================================ */
const CONFIG = {
  width: 960,
  height: 640,
  cols: 13,
  rows: 7,
  cell: 64,

  playerSpeed: 205,
  playerSnapStrength: 40,
  playerSnapSpeed: 1800,
  playerInvincibleMs: 1400,
  playerRadius: 17,

  // 注意：射速和玩家弹速现在由 WEAPONS 表按武器决定（下面两个值只剩参考意义，
  // 就是手枪的数值），改武器手感请去 WEAPONS 里改
  playerFireInterval: 290,
  bulletSpeed: 470,
  enemyBulletSpeed: 215,

  enemySpeed: 85,
  enemyFireInterval: 1650,
  spawnInterval: 1700,
  maxEnemies: 4,
  spawnAnimMs: 300,
  enemyWrapMargin: 28,

  enemySpeedFinal: 200,
  enemyFireIntervalFinal: 450,
  spawnIntervalFinal: 400,
  maxEnemiesFinal: 20,

  maxDifficulty: 30,
  diffSaturateTau: 10,

  diffIntervalBase: 20000,
  diffIntervalDecay: 0.05,
  diffIntervalMin: 5000,

  spawnBiasPow: 1.6,
  spawnMinDist: 2,

  comboTimeout: 2500,
  comboStep: 6,
  comboMaxMult: 3.0,

  powerupLifetime: 10000,
  rapidMs: 5000,
  tripleMs: 5000,
  // 道具叠加的上限层数。肉鸽卡牌、装备、技能效果不算在内 ——
  // 那些有自己的乘区，会自动和道具叠起来。
  // 到顶之后继续吃只刷新时间，不再加层
  rapidMaxStack: 3,
  tripleMaxStack: 3,

  // 图集兵的默认参数（步兵 / 疾风兵 / 散弹兵用这一套）。
  // 三张老图集都是 64×64 帧、角色本体约 17~21 px 宽，比程序化敌人（30~36 px）小一圈，
  // 放大 1.4 倍让体型接近；物理半径同步收到 13（13 × 1.4 ≈ 18.2），
  // 与其他敌人（17）同级 —— 否则玩家会觉得"明明打中了却没中"。
  // 三个特殊兵（铁甲兵 / 追踪炮 / 爆裂兵）本体更大，在 ENEMY_TYPES 里逐条覆盖这三个值。
  // 物理偏移的算法是 offset = 帧宽/2 - 半径（Phaser 内部会把 offset 一起乘缩放，
  // 所以这条式子在任意缩放下都成立，不用按 scale 修正）
  sheetScale: 1.4,
  sheetBodyRadius: 13,
  // 图集兵的程序化投影要按本体尺寸缩小：阴影贴图宽 38px，
  // 原样铺上去比 24px 宽的角色还大，看着像站在一张黑饼上。
  // offsetY 对应本体底边（帧内 y=39，中心 y=32）再乘缩放。
  sheetShadowScale: 0.7,
  sheetShadowOffsetY: 10,

  poolPlayerBullets: 120,
  poolEnemyBullets: 700,
  poolEnemies: 80,
  poolPowerups: 12,
  // 死灵法师的召唤物。骷髅一次召唤 4 只、最长活 12 秒、射速 900ms，
  // 16 只的池子够同时存在两批；箭按 4 只 × 12 秒 ÷ 0.9 秒 ≈ 53 支算，
  // 取 48 是因为箭会被命中 / 出界提前回收，实际不会同时存活那么多
  poolSkeletons: 16,
  poolSkeletonArrows: 48,

  // 慢动作：只对"击杀特殊敌人"触发，倍率与时长都集中在这里调
  slowMoScale: 0.35,
  slowMoMs: 220,

  // 技能释放：结界 / 堕天形态触发瞬间的全屏慢动作时长。
  // 比击杀稍长一点，让"放技能"这一步有分量，但也不能太长 ——
  // 全屏慢动作期间敌人和玩家一起变慢，超过半秒就会影响正常走位
  skillSlowMoMs: 380,
  // 技能动画本身的播放速度倍率。1 = 原速，越小越慢。
  // 0.4 大约把 500ms 的施法动作拉长到 1.2 秒，兼顾"慢下来"和"不拖沓"
  skillAnimSpeedMul: 0.4,

  vibrateOnHurt: 90,
  vibrateOnHeavyKill: 35,

  // ---- 天气系统配置 ----
  weatherDuration: 20000, // 每种天气持续 20 秒
  weatherTransitionMs: 650, // 切天气后新特效的淡入时长（硬切会很突兀）
  weatherProbs: {
    sunny: 0.40,        // 晴天 40%
    rain: 0.20,         // 雨天 20%
    snow: 0.20,         // 雪天 20%
    thunder: 0.15,      // 雷天 15%
    thunderstorm: 0.05 // 雷雨天 5%（最低）
  },
  snowSpeedMul: 0.7,    // 雪天全员减速 30%
  puddleSpeedMul: 0.5,  // 洼地减速 50%
  ditchDamage: 1,       // 水沟伤害 1 点
  ditchCooldown: 1000,  // 水沟伤害冷却 1 秒

  shakeOnKill: 0.0045,
  shakeOnPlayerHit: 0.014,

  /* ---- 射击爽感参数（按「开火 / 受击 / 危险 / 放大」四层反馈分组）---- */
  // 枪口闪光：每发都在枪口点一下，是"这一发真的出去了"的第一反馈
  muzzleFlashMs: 90,
  muzzleFlashScale: 1.1,
  // 开火后坐力：极轻的镜头抖动。只在没有更强抖动（击杀 / 受击）在跑时触发，
  // 否则会把击杀那一击的冲击感盖掉
  recoilShakeMs: 34,
  recoilShakeIntensity: 0.0016,
  // 擦弹：敌弹从身边掠过时一声"嗖"，给危险一个听觉预警
  grazeRadius: 46,
  grazeCooldownMs: 130,
  // 危险预警：敌人贴脸时屏幕边缘泛红，越近越浓
  dangerRadius: 120,
  dangerMaxAlpha: 0.18,
  // 压力暗角：同屏敌人越多，四周越暗，把注意力压回战场中心
  pressureMaxAlpha: 0.45,
  // 连击音调：每层连击把击杀音往上抬一点，连击越高声音越尖
  comboPitchStep: 0.035,
  comboPitchMaxStep: 18,

  color: {
    outside:      0x0b1520,
    ground:       0x46603a,
    groundDark:   0x3a5230,
    groundLight:  0x577346,
    fence:        0x8b6a3f,
    fenceDark:    0x5d452a,
    player:       0x4a90d9,
    playerDark:   0x2a5f96,
    playerAccent: 0xffd54a,
    bulletP:      0xffe066,
    bulletE:      0xff5c8a,
    // 特殊兵（铁甲兵 / 追踪炮 / 爆裂兵）的月牙弹单独给一个颜色，
    // 让玩家一眼分得出"这发是特殊兵打过来的"，比形状本身还快
    bulletCrescent: 0xff7ab8,
  },

  // 金币：击杀普通敌人 1 枚、特殊敌人 2 枚，攒够了去商城里解锁东西
  coinNormal: 1,
  coinSpecial: 2,
};

/* ============================================================================
   双人模式平衡
   ----------------------------------------------------------------------------
   两个人一起打，输出大约是单人的 1.6~1.8 倍（两条枪线 + 两套技能），
   走位空间也大一倍（敌人不可能同时贴住两个人）。照搬单人参数会变成"散步"。
   这里把压力按"人多"重算一遍：

     · 敌人更多    —— 同屏上限 ×1.5、生成间隔 ×0.68
     · 开火更密    —— 敌人开火间隔 ×0.8
     · 敌人略快    —— ×1.06。**只加一点点**，加到 1.15 以上就变成"躲不掉"了
     · 道具更多    —— 同屏上限 3 → 6、掉落概率 ×1.5

   为什么不把难度系数做成"随人数线性翻倍"：
   共享生命 = 两人生命之和，所以总血量本来就有单人的两倍左右。
   上面这几条乘起来刚好把这个便宜吃掉，剩下的才是"双人协作"该有的红利。
   数值是拍出来的，不是算出来的 —— 玩着觉得太松就把 spawnIntervalMul 调小。

   ⚠️ 这些系数只在 players.length > 1 时生效，单人局一个数都不动。
   ============================================================================ */
const TWO_PLAYER = {
  enemySpeedMul: 1.06,
  enemyFireIntervalMul: 0.80,
  spawnIntervalMul: 0.68,
  maxEnemiesMul: 1.50,

  // 掉落：同屏上限和概率一起加。只加概率的话，上限还是 3，
  // 两个人抢三个道具，"各自吃各自的"这件事根本体现不出来
  dropChanceMul: 1.5,
  maxPowerups: 6,

  // 肉鸽抽卡阈值。双人击杀速度约为单人 1.6 倍，阈值不同步放大，
  // 一局下来卡会多到刷不完，build 会强到没边
  buffStepMul: 1.6,
};

/* ============================================================================
   敌人类型
   ============================================================================ */
const ENEMY_TYPES = {
  // sheet  —— 该兵种用哪张图集渲染（有值就走图集，否则用程序化纹理）
  // sheetShadow —— 图集里本身已经画好投影了，这时要藏掉程序化阴影，否则是双影
  infantry: {
    key: 'infantry', name: '步兵', hp: 1,
    speedMul: 1.00, fireIntervalMul: 1.0, radius: 17,
    color: { main: 0xd94a4a, dark: 0x8f2626, accent: 0xffc2c2 },
    fire: 'single', score: 10, isSpecial: false,
    sheet: 'slime', sheetShadow: true,
  },
  rusher: {
    key: 'rusher', name: '疾风兵', hp: 1,
    speedMul: 1.65, fireIntervalMul: 0, radius: 14,
    color: { main: 0xff9838, dark: 0xa85a1a, accent: 0xffe0b3 },
    fire: 'none', score: 10, isSpecial: false,
    touchDamage: true,
    sheet: 'rusher',
  },
  shotgunner: {
    key: 'shotgunner', name: '散弹兵', hp: 1,
    speedMul: 0.82, fireIntervalMul: 1.6, radius: 17,
    color: { main: 0x4ac2ff, dark: 0x2a6b94, accent: 0xc2e8ff },
    fire: 'spread', score: 10, isSpecial: false,
    sheet: 'shotgunner',
  },
  armored: {
    key: 'armored', name: '铁甲兵', hp: 3,
    speedMul: 0.62, fireIntervalMul: 1.4, radius: 21,
    color: { main: 0xa04ad9, dark: 0x5f2b82, accent: 0xe0c2ff },
    fire: 'single', score: 20, isSpecial: true,
    // 图集 8 列 × 4 行（32 帧），本体约 25×27 px。缩放拉到 1.9 让它在屏幕上
    // 比步兵（约 24 px 宽）明显大一圈；物理半径给 12（×1.9 ≈ 22.8）跟着放大
    sheet: 'armored', sheetScale: 1.9, sheetBodyRadius: 12,
    // 这版图集自带投影（全图唯一的半透明色 rgba(40,41,63,89)，落在脚底 y 38~46）。
    // 再叠一层程序化阴影就成了双影，所以这里藏掉 —— 和 slime / sniper / bomber 一样
    sheetShadow: true,
    crescent: true,
  },
  bomber: {
    key: 'bomber', name: '爆裂兵', hp: 2,
    speedMul: 0.92, fireIntervalMul: 1.2, radius: 18,
    color: { main: 0x4ad96a, dark: 0x2a7a3a, accent: 0xc2ffcc },
    fire: 'single', score: 20, isSpecial: true, onDeath: 'burst',
    // 本体含展开的血翼有 39 px 宽，缩放只给 1.3 就够了（1.3×39 ≈ 51 px），
    // 再大就会糊住半个格子，玩家看不清它往哪走
    sheet: 'bomber', sheetScale: 1.3, sheetBodyRadius: 18,
    sheetShadow: true,
    crescent: true,
  },
  sniper: {
    key: 'sniper', name: '追踪炮', hp: 2,
    speedMul: 0.68, fireIntervalMul: 1.7, radius: 17,
    color: { main: 0xffc93a, dark: 0xa8781a, accent: 0xffeeb3 },
    fire: 'aimed', score: 20, isSpecial: true,
    // 本体 27 px 宽，缩放 1.7 → 约 46 px，是三个特殊兵里最"瘦高"的一个
    sheet: 'sniper', sheetScale: 1.7, sheetBodyRadius: 13,
    sheetShadow: true,
    crescent: true,
  },
};

const ENEMY_ROLLS = [
  { key: 'infantry',    w: 48 },
  { key: 'rusher',      w: 16 },
  { key: 'shotgunner',  w: 19 },
  { key: 'armored',     w: 5 },
  { key: 'bomber',      w: 5 },
  { key: 'sniper',      w: 3 },
];

/* 需要走图集渲染的兵种。键名同时是文件名（assets/<key>.png）和动画前缀（<key>-walk-down） */
const SHEET_KEYS = ['slime', 'rusher', 'shotgunner', 'armored', 'sniper', 'bomber'];

/* 每张图集的"单向帧数"。六张图集单帧都是 64×64，但列数不一样：
   五张 8 列（每向 8 帧），一张 6 列（每向 6 帧）。
   帧数写死会让 6 列的图集被判成"没加载成功"而静默退回矢量贴图。
   ⚠️ 这个数字必须和图片实际列数一致，否则 setupAnimations 里
   `step × 行号` 算出来的帧区间会错行 —— 上/左/右三个方向会从
   下一行的开头取帧，表现为"朝上走的时候先闪两帧朝下的姿势"。
   armored 2026-09-15 换成 512×256 的新图（8 列）后这里漏改了，
   一直停留在旧图的 6，四个方向里错三个。改图片务必回来对一遍。 */
const SHEET_FRAMES_PER_DIR = {
  slime: 8, rusher: 8, shotgunner: 8, armored: 8,
  sniper: 6, bomber: 6,
};

