/* ============================================================================
   增益道具
   ============================================================================ */
const POWERUP_TYPES = {
  rapid:  { key: 'rapid',  name: '连射',   color: 0xff9838 },
  triple: { key: 'triple', name: '三连发', color: 0x4ac2ff },
  shield: { key: 'shield', name: '护盾',   color: 0x7fffa0 },
  clear:  { key: 'clear',  name: '清屏',   color: 0xffc93a },
};

const POWERUP_ROLLS = [
  { key: 'rapid',  w: 50 },
  { key: 'triple', w: 30 },
  { key: 'shield', w: 12 },
  { key: 'clear',  w: 8 },
];

/* ============================================================================
   武器 / 角色 / 技能 —— 商城里买卖的东西
   ----------------------------------------------------------------------------
   数值全集中在这里，改平衡不用碰逻辑代码。
   cost 是解锁价格；默认拥有的两件（手枪 / 枪手）写 0，并且列在 DEFAULT_LOADOUT.owned 里。
   ============================================================================ */
const WEAPONS = {
  pistol: {
    key: 'pistol', name: '手枪', cost: 0, color: 0xffe066,
    desc: '单发稳定，射速和弹速都够用，什么局面都能打',
    interval: 290, speed: 470, damage: 1, pattern: 'single', spread: 0, pierce: 0,
  },
  shotgun: {
    key: 'shotgun', name: '散弹枪', cost: 50, color: 0xffa14a,
    desc: '一次三发扇形，被围时贴脸清场极快；射速慢，打远处会漏',
    interval: 520, speed: 430, damage: 1, pattern: 'spread', spread: 17, pierce: 0,
  },
  smg: {
    key: 'smg', name: '连发枪', cost: 60, color: 0x7fd4ff,
    desc: '射速接近翻倍，近距离压制力最强；弹道有散布，打远处会飘',
    interval: 150, speed: 420, damage: 1, pattern: 'single', spread: 8, pierce: 0,
  },
  sniper: {
    key: 'sniper', name: '狙击枪', cost: 80, color: 0xd9a6ff,
    desc: '一枪两点伤害，能秒掉爆裂兵和追踪炮；射速很慢，被围时吃力',
    interval: 760, speed: 900, damage: 2, pattern: 'single', spread: 0, pierce: 0,
  },
  piercer: {
    key: 'piercer', name: '穿透枪', cost: 100, color: 0x7fffe0,
    desc: '子弹打中敌人不消失，最多穿透 2 个；单发伤害偏低',
    interval: 420, speed: 700, damage: 1, pattern: 'single', spread: 0, pierce: 2,
  },
  /* 巫女的专属武器。exclusive 让它不出现在商城武器页 —— 它跟着角色走，不单卖。
     角色一旦带上 weaponLock，整备里选的武器就完全失效（见 GameScene.create）。 */
  firebolt: {
    key: 'firebolt', name: '火弹', cost: 0, color: 0xff7a2a,
    desc: '巫女专属：伤害是普通子弹的两倍，且不能被其它武器替换',
    interval: 300, speed: 460, damage: 2, pattern: 'single', spread: 0, pierce: 0,
    // 用专属弹型：橙色火球比黄色圆弹更好认，"这一发是火弹"一眼可见
    tex: 'bullet-fire',
    exclusive: true,
  },
  /* 勇者的专属武器。同样 exclusive：跟着角色走，不单卖。
     弹速比手枪快、伤害一样，靠"挥剑甩出去"的观感和火弹区分开 */
  slash: {
    key: 'slash', name: '剑气', cost: 0, color: 0x9fe8ff,
    desc: '勇者专属：挥剑甩出的一道剑气，伤害 1，不能被其它武器替换',
    interval: 320, speed: 560, damage: 1, pattern: 'single', spread: 0, pierce: 0,
    // 细长的青色弯月，飞出去时会跟着方向转，看着像一道斩击
    tex: 'bullet-slash',
    exclusive: true,
  },
  /* 矮人的专属武器：鞭炮。
     explosive 字段是关键 —— fireBullet 会把它挂到子弹上，命中时触发 AOE 结算 */
  firecracker: {
    key: 'firecracker', name: '鞭炮', cost: 0, color: 0xff4a3a,
    desc: '矮人专属：碰到敌人就炸开，小范围内每个敌人各受 1 点伤害',
    interval: 500, speed: 450, damage: 1, pattern: 'single', spread: 0, pierce: 0,
    // 飞行贴图用 item-dynamite 图集（3×3，单帧 32×32）。
    // 图集类贴图必须显式取第 0 帧，否则 Sprite 会退回 __BASE 帧显示成整张图 ——
    // 这件事在 fireBullet 里统一处理，这里只要给出纹理 key
    tex: 'item-dynamite',
    exclusive: true,
    // 命中时的小爆炸：半径 60 px、伤害 1，用 fx-sparks 的 2 帧火花
    explosive: { radius: 60, damage: 1, fx: 'sparks' },
  },
  /* 死灵法师的专属武器：亡灵弹。
     伤害和手枪一样是 1，唯一的不同是 raiseChance ——
     命中时按这个概率把敌人策反成自己的亡灵。
     raiseChance 会和 explosive 一样透传到子弹对象上，
     命中判定只读子弹上的值，不用回头查玩家装了什么武器。
     概率不能给高：15% 配上 300ms 的射速，十几发就能拉出一个亡灵，
     再高的话整局会变成"敌人在给自己打工"，难度曲线直接塌掉 */
  necrobolt: {
    key: 'necrobolt', name: '亡灵弹', cost: 0, color: 0xa855f7,
    desc: '亡灵法师专属：紫色发光弹，伤害 1，命中有小概率把敌人变成你的亡灵',
    interval: 300, speed: 500, damage: 1, pattern: 'single', spread: 0, pierce: 0,
    // 紫色发光弹：外层光晕明显比其它弹大，在满屏弹幕里一眼认得出是谁打的
    tex: 'bullet-necro',
    exclusive: true,
    raiseChance: 0.12,
    // 子弹策反出来的亡灵活得比技能转化的短（6s vs 10s）——
    // 技能是玩家主动花一次次数换来的，该更"值"；
    // 子弹是顺手的副产品，短一点才不会让场上永远堆着一群免费打手
    raiseMs: 6000,
  },
};

/* 角色表。
   skills 是数组而不是单个字符串：绝大多数角色只有 1 个专属技能，
   巫女有 2 个（结界 + 形态），写成单值就得多挂一个"第二专属"字段。
   下面五个字段只有走图集渲染的角色才需要写，程序化角色靠 color 现生成纹理：
     sheet / sheetScale    —— 图集前缀与游戏内缩放
     portraitScale         —— 菜单、商城、整备界面上的立绘缩放
     shadowOffsetY         —— 脚下阴影相对角色中心的距离
     weaponLock            —— 武器槽锁死，整备里选的武器对这个角色失效 */
const CHARACTERS = {
  gunner: {
    key: 'gunner', name: '枪手', cost: 0,
    desc: '没有短板的全能选手',
    lives: 3, speedMul: 1.00, fireIntervalMul: 1.00,
    color: { main: 0x4a90d9, dark: 0x2a5f96, accent: 0xffd54a },
    skills: ['overdrive'],
  },
  heavy: {
    key: 'heavy', name: '重装兵', cost: 80,
    desc: '皮厚一条命，代价是走得更慢',
    lives: 4, speedMul: 0.90, fireIntervalMul: 1.00,
    color: { main: 0x8896ab, dark: 0x4a5464, accent: 0xffd54a },
    skills: ['ironwall'],
  },
  ranger: {
    key: 'ranger', name: '游侠', cost: 80,
    desc: '全场跑得最快，靠身法活命',
    lives: 3, speedMul: 1.15, fireIntervalMul: 1.00,
    color: { main: 0x4ad99a, dark: 0x2a7a58, accent: 0xd8ffe8 },
    skills: ['swiftstep'],
  },
  artillerist: {
    key: 'artillerist', name: '炮手', cost: 120,
    desc: '平时开火更慢，爆发时子弹更重',
    lives: 3, speedMul: 0.95, fireIntervalMul: 1.15,
    color: { main: 0xd94a8a, dark: 0x8f2650, accent: 0xffd0e2 },
    skills: ['heavyround'],
  },

  /* 巫女：走图集动画，不是程序化纹理。
     帧内本体只有 16 px 宽 / 33 px 高，而程序化角色是个 34 px 的圆球 ——
     人形天然比圆球瘦高，所以缩放不能按宽度硬对齐（那样会有 66 px 高，
     比铁甲兵还大一圈），取 1.7 倍让它比步兵明显大、和铁甲兵同档。
     物理半径同步收到 15（直径 30）贴着视觉宽度，避免"看着没碰到却被打中"。 */
  sorceress: {
    key: 'sorceress', name: '巫女', cost: 150,
    desc: '锁定火弹（伤害翻倍），结界能把敌弹弹回去',
    lives: 3, speedMul: 0.95, fireIntervalMul: 1.00,
    color: { main: 0x9a3a5c, dark: 0x4a1a2c, accent: 0xff9a4a },
    skills: ['ward', 'darkform'],
    sheet: 'sorc', sheetScale: 1.7, bodyRadius: 15,
    // 界面立绘单独一档：程序化角色在界面上用 1.3 倍，两边差太多会显得巫女很小
    portraitScale: 1.7,
    // 图集里脚底在帧内 y≈41（程序化角色是 37），影子要跟着往下挪，
    // 否则影子会盖在小腿上
    shadowOffsetY: 29,
    // 武器槽锁死：火弹是她专属的，整备里换武器对她无效
    weaponLock: 'firebolt',
  },

  /* 勇者：4 条命的重甲剑士。
     本体比巫女壮一圈（24×33 px，巫女是 16×33），所以缩放只给 1.45 ——
     视觉宽度 35 px，和默认物理直径 34 基本齐平，不会出现"看着没碰到却被打中"。
     物理半径直接用默认的 17，不覆盖。 */
  warrior: {
    key: 'warrior', name: '勇者', cost: 150,
    desc: '锁定剑气（伤害 1），冲锋无敌；裂地斩能扫清四周',
    lives: 4, speedMul: 1.00, fireIntervalMul: 1.00,
    color: { main: 0x5a8fd9, dark: 0x2a4a7a, accent: 0xcfe4ff },
    skills: ['groundcleave', 'charge'],
    sheet: 'wari', sheetScale: 1.45,
    portraitScale: 1.5,
    // 脚底在帧内 y≈40（帧中心 24），(40-24)×1.45 ≈ 23
    shadowOffsetY: 23,
    // 武器槽锁死：剑气是他专属的，整备里换武器对他无效
    weaponLock: 'slash',
  },

  /* 矮人：4 条命的重装爆破手。
     锁定鞭炮，子弹命中就爆 —— 一枪一点伤害，爆炸范围还能清掉周围的小怪。
     专属技能是每隔一段时间自动扔一枚炸药，范围更大、伤害更高。 */
  dwarf: {
    key: 'dwarf', name: '矮人', cost: 150,
    desc: '锁定鞭炮（命中即爆），专属技能炸药范围更大',
    lives: 4, speedMul: 0.95, fireIntervalMul: 1.15,
    color: { main: 0xd94a3a, dark: 0x7a2a1a, accent: 0xffd54a },
    skills: ['throwbomb'],
    sheet: 'dwarf', sheetScale: 1.5,
    portraitScale: 1.5,
    // 脚底在帧内 y≈40，帧中心 24，(40-24)×1.5 ≈ 24
    shadowOffsetY: 24,
    // 武器槽锁死：鞭炮是他专属的，整备里换武器对他无效
    weaponLock: 'firecracker',
  },

  /* 死灵法师：只有 2 条命的召唤流法师，全场最脆。
     本体帧内约 19.5 px 宽（巫女 16、勇者 24），所以缩放取 1.6 ——
     视觉宽度 31 px，物理半径同步收到 15（直径 30）贴着视觉走，
     否则 2 滴血的角色会被"看着没碰到却被打中"这种判定坑死。
     脚底在帧内 y≈41、帧中心 24，(41-24)×1.6 ≈ 27。
     移速给 1.05 一点小补偿：两个专属技能释放期间都不能动（见 castLockMs），
     加上只有 2 滴血，不给点机动性的话容错太低。 */
  necromancer: {
    key: 'necromancer', name: '亡灵法师', cost: 200,
    desc: '只有 2 滴血的召唤师：亡灵弹能策反敌人，还能召唤骷髅弓手',
    lives: 2, speedMul: 1.05, fireIntervalMul: 1.00,
    color: { main: 0x7a4ad9, dark: 0x2a1a4a, accent: 0xc98fff },
    skills: ['summonskeletons', 'raiseundead'],
    sheet: 'necro', sheetScale: 1.6, bodyRadius: 15,
    portraitScale: 1.6,
    shadowOffsetY: 27,
    // 施法动画的慢放倍率，覆盖 CONFIG.skillAnimSpeedMul（0.4）。
    // 为什么这个角色要单独一档：他的 atk3 有 12 帧、是全场最长的施法动作，
    // 沿用 0.4 会拖到 3.3 秒（12 帧 ÷ 9fps ÷ 0.4），而施法期间还不能动，
    // 玩家会觉得被罚站。
    // 0.75 折算下来是 1.33 倍慢放。这个数是反推出来的，不是拍的：
    //   atk3 走完 12 帧需要 (11 帧 × 111ms) ÷ 0.75 ≈ 1630ms
    //   atk2 走完 7 帧需要  (6 帧 × 100ms) ÷ 0.75 ≈ 800ms
    // 两个技能的 duration 分别取 1750 / 1000，留出收势的余量。
    // ⚠️ 这三个数是一组：改 skillAnimMul 就必须回头改两个 duration，
    // 否则动画会在半途被 skillActive 归零掐断，玩家只看到半截施法
    skillAnimMul: 0.75,
    // 武器槽锁死：亡灵弹是他专属的，整备里换武器对他无效
    weaponLock: 'necrobolt',
  },
};

const SKILLS = {
  /* ---- 技能的两个时长是两回事，别混用 ----
       duration —— 技能【效果】持续多久。堕天形态 8 秒、结界 6 秒。
                   期间玩家照常移动、照常开火（叠加层也照常工作）。
       castMs   —— 技能【释放动作】占多久。抬手、结印、砸地那一下。
                   这段时间玩家不能动（GameScene.castLockMs），但全程无敌。
       cooldown —— 自动技能的触发间隔。

     ⚠️ 这两个值以前是同一个（都写在 duration 里），后果是
     "堕天形态 8 秒里角色一直定格在施法姿态上" —— 既不能正常攻击也不能正常移动。
     现在拆开：castMs 到点就恢复行动，duration 只负责效果。

     ---- 释放动作（castMs 期间）----
       castAct      播哪个动作（缺省 atk2）
       castFrames   限定播到第几帧（缺省播完整段）
       castAnimMul  这一段的慢放倍率，覆盖角色默认的 skillAnimMul
                    （缺省 0 = 用角色默认；堕天形态用 0.4 把 7 帧变身拉长到 1.25 秒）

     ---- 生效期（duration 期间）----
       formSheet    保持哪张形态图（1 列 × 4 行，每个方向一帧）。
                    角色定在这一帧上，但**照常移动、照常开火** ——
                    移动时由叠加层补走路的下半身，两个专属技能都配了它。
                    图集必须登记进 CHAR_FORM_SHEETS，否则没人加载它，
                    表现是"技能开着但贴图一动不动"（静态自检第 29 项盯着这条）。 */
  /* ---- 角色专属：跟着角色走，不进技能槽、不能买卖 ---- */
  overdrive: {
    key: 'overdrive', name: '火力全开', innate: true, color: 0xffd54a,
    desc: '每 14 秒触发一次，持续 3 秒：射速翻倍',
    cooldown: 14000, duration: 3000,
  },
  ironwall: {
    key: 'ironwall', name: '铁壁', innate: true, color: 0x7fffa0,
    desc: '每 20 秒自动获得一次护盾',
    cooldown: 20000, duration: 0,
  },
  swiftstep: {
    key: 'swiftstep', name: '疾风步', innate: true, color: 0x4ad99a,
    desc: '每 12 秒触发一次，持续 2.5 秒：移速提升 70%',
    cooldown: 12000, duration: 2500,
  },
  heavyround: {
    key: 'heavyround', name: '重炮', innate: true, color: 0xd94a8a,
    desc: '每 16 秒触发一次，持续 3 秒：子弹伤害 +1',
    cooldown: 16000, duration: 3000,
  },

  /* 巫女专属 1：结界。触发方式和别的被动技能一样是"冷却到就自动开"，
     效果却发生在受击判定里 —— 持续期间敌弹打中她不但不掉血，
     还会原路弹回去变成她的火弹（见 GameScene.onBulletHitsPlayer） */
  ward: {
    key: 'ward', name: '逆反结界', innate: true, color: 0x9a6bff,
    desc: '每 18 秒触发一次，持续 6 秒：敌弹打中你时被弹回去，变成你的火弹',
    cooldown: 18000, duration: 6000,
    // 施法姿态：开结界时抬手结印，这段不能动但无敌（见下面 castMs 的说明）
    castMs: 1100,
    // 【生效期】保持的形态：结界展开完成态（sorc-atk2 的第 6 帧）。
    // 6 秒里角色定在这一帧上，但照常能移动、照常开火 ——
    // 移动时叠加层补走路的下半身，见 updatePlayerVisual 的形态分支
    formSheet: 'sorc-ward',
  },

  /* 巫女专属 2：堕天形态。全局唯一的主动技能。
     active 标记让它不参与自动冷却，改由右下角按钮 / J 键触发；
     charges 是"每局几次"，用光就整局失效（不是等冷却，是彻底没了） */
  darkform: {
    key: 'darkform', name: '堕天形态', innate: true, color: 0xff5a2a,
    desc: '主动释放（按钮 / J 键），每局 3 次，持续 8 秒：射速翻倍、火弹变三向、移速 +25%',
    cooldown: 0, duration: 8000,
    active: true, charges: 3,
    // 变身爆发：**完整播完** atk3 的 7 帧（①站立 → ②黄色光团 → ③红色光团 →
    // ④红色尖塔 → ⑤⑥⑦蹲伏的恶魔形态）。
    // 用户 2026-09-16 明确要求"释放动作要是完整的这个精灵图，且技能释放速度
    // 要慢一些，保证玩家能看清动作"。
    // ⚠️ 上一版只播前 4 帧，理由是"保持住恶魔形态会让移动像滑行"——
    // 现在【生效期】有自己的形态帧（formSheet），播完立刻切走，
    // 不存在"一直保持蹲伏姿态"的问题，所以完整播完是安全的。
    // 慢放用 castAnimMul 覆盖角色默认的 0.75：7 帧 @ rate 12、倍率 0.4
    // → 6 × 83.3 ÷ 0.4 ≈ 1250ms，比上一版的 333ms 慢了近四倍，动作看得清。
    // castMs 取 1350，让最后一帧（恶魔形态）多停 100ms 再切到形态帧。
    // ⚠️ 帧数 × 倍率 ÷ castMs 是一组连动的数，改一个必须重算另两个 ——
    // 静态自检第 26 项就是这条断言
    castMs: 1350, castAct: 'atk3', castAnimMul: 0.4,
    // 【生效期】保持的形态：堕天形态的起手站姿（sorc-atk3 的第 0 帧）
    formSheet: 'sorc-dark',
  },

  /* 勇者专属 1：裂地斩。跳起来砸地，以自己为中心炸开一圈冲击波。
     伤害只有 1，但胜在无差别覆盖四周 —— 被围住时的解围手段。
     duration 不是"效果持续"，而是"施法姿态保持多久"，让 atk2 动画能完整播一次 */
  groundcleave: {
    key: 'groundcleave', name: '裂地斩', innate: true, color: 0xffd54a,
    desc: '每 16 秒触发一次：以你为中心炸开半径 150 的冲击波，扫到的敌人各受 1 点伤害',
    cooldown: 16000, duration: 0,
    // 施法姿态：举剑砸地。warrior.atk2 有 6 帧、帧率 14、倍率 0.4，
    // 走完 5 帧要 5 × 71.4 ÷ 0.4 ≈ 893ms，取 950 留余量。
    // ⚠️ 原来是 520 —— 只够播 3 帧，抬手动作播一半就没了（用户 2026-09-16 反馈）
    castMs: 950,
    shockwave: { radius: 150, damage: 1, expandMs: 340 },
  },

  /* 勇者专属 2：破军冲锋。全局第二个主动技能。
     冲撞期间和落地后各有一段无敌，路径上的敌人直接死 ——
     代价是每局只能用 2 次，而且冲锋方向在按下那一刻就锁死，中途改不了 */
  charge: {
    key: 'charge', name: '破军冲锋', innate: true, color: 0x6fd0ff,
    desc: '主动释放（按钮 / J 键），每局 2 次：朝面朝方向冲 4 格，撞到的敌人当场死亡，全程无敌并在落地后再保 1.5 秒',
    cooldown: 0, duration: 420,
    active: true, charges: 2,
    // 620 px/s × 0.42 s ≈ 260 px ≈ 4 格
    charge: { speed: 620, invincibleAfterMs: 1500 },
  },

  /* 矮人专属：炸药投掷。和 groundcleave 一样是"冷却到就自动触发"的被动技能，
     区别是它把伤害扔出去而不是留在自己脚下 —— 朝面朝方向飞一枚炸药，
     命中敌人时炸开大范围，范围内敌人各受 2 点伤害。
     duration 是技能【效果】时长，这里是 0（炸药飞出去就算完了，没有持续状态）；
     施法姿态时长看 castMs。 */
  throwbomb: {
    key: 'throwbomb', name: '炸药投掷', innate: true, color: 0xff4a3a,
    desc: '主动释放（按钮 / J 键）：朝面朝方向投出一枚炸药，命中敌人时炸开大范围，范围内的敌人各受 2 点伤害。用一次冷却就长一截，最长封顶 15 秒',
    cooldown: 0, duration: 0,
    // 投掷姿态：矮人的 atk2 复用的是 dwarf-walk（4 帧 @12fps），
    // 走完 3 帧要 3 × 83.3 ÷ 0.4 = 625ms，取 700
    castMs: 700,
    // active 让它走上"主动按钮"这条路；不再靠自动冷却，
    // 而是靠下面的 cooldownDynamic 逐次变长
    active: true,
    // 动态冷却：第一次用完等 5 秒，每用一次 +1 秒，15 秒封顶。
    // 和 charges 模式（巫女 / 勇者）是并列的两条路径，互不影响
    cooldownDynamic: { initial: 5000, add: 1000, max: 15000 },
    // radius 比鞭炮的 60 大一半多；伤害翻倍
    throwBomb: { radius: 100, damage: 2, speed: 520 },
  },

  /* 死灵法师专属 1：亡者召唤。主动技能，走"次数 + 击杀恢复"这条新路径。
     和前三个主动技能都不一样：
       巫女 / 勇者 = charges，用光整局没了
       矮人        = cooldownDynamic，等冷却
       这里        = chargesFromKills，靠击杀数攒回来
     为什么要这条路径：召唤流的核心乐趣是"越打越有资源"，
     如果做成固定次数，玩家会舍不得用、一直攒到死；
     做成冷却又和"召唤"这个动作的量级不搭。按击杀恢复最贴合角色定位。

     召唤位置是"玩家往外 1 格的四个正交方向" —— 用偏移格而不是固定像素，
     棋盘格宽变了召唤点会自动跟着走，不会跑到场地外面。 */
  summonskeletons: {
    key: 'summonskeletons', name: '亡者召唤', innate: true, color: 0x7fffe0,
    desc: '主动释放（按钮 / J 键）：向四周四个格子各召唤一个骷髅弓手。骷髅朝各自方向推进，边走边射箭（伤害 1），只有 1 滴血，走出场地边缘就消失。用掉后每击杀 10 个敌人自动恢复 1 次',
    // 施法姿态时长（castMs），不是效果时长 —— 召唤是瞬发的，没有持续状态，
    // 所以 duration 是 0。atk2 走完 7 帧要 6 × 100ms ÷ 0.75 ≈ 800ms，取 1000 留收势余量
    cooldown: 0, duration: 0,
    active: true, charges: 2,
    castMs: 1000, castAct: 'atk2',
    // 每击杀这么多个敌人恢复 1 次。攒够自动 +1，攒到 charges 上限就不再涨
    chargesFromKills: 10,
    skeleton: {
      hp: 1, damage: 1,
      // 推进速度。2026-09-16 从 170 降到 120 ——
      // 170 时骷髅几乎是一路小跑冲出场外，来不及射几箭就没了；
      // 放慢之后它能在场上多待两三秒，边推进边输出，更像"帮手"而不是"一次性召唤"
      speed: 120,
      // 射箭间隔。比敌人的开火间隔（1650ms）快一截，
      // 否则骷髅走到边缘之前只来得及射一两箭，"召唤了四个帮手"的感觉出不来
      fireInterval: 900,
      // 第几帧把箭射出去：skel-atk1 共 12 帧，第 9 帧是箭离弦那一帧
      fireFrame: 9,
      // 箭的飞行速度。比敌人的弹（215）快得多 —— 它是"友军的输出"，
      // 飞得慢会追不上正在前进的敌人，射出去全打空。
      // 2026-09-16 从 430 提到 620：430 时敌人横向走位就能轻松躲开
      arrowSpeed: 620,
      offsetCells: 1,
      // 骷髅本体帧内约 18 px 宽（比死灵法师的 19.5 略瘦），
      // 缩放 1.4 → 视觉 25 px；物理半径 11（直径 22）贴着视觉走
      scale: 1.4, bodyRadius: 11,
      // 兜底存活时间：正常会走出场地被回收，这个是防止"被卡在边界上"漏回收
      lifeMs: 12000,
    },
  },

  /* 死灵法师专属 2：亡者转化。主动技能，次数模式。
     把场上随机一批敌人直接策反成亡灵。
     ⚠️ 必须有保底（raise.min）：如果只按比例随机，残局只剩 1 只敌人时
     会算出 0 个 —— 玩家用掉一次宝贵的技能次数却什么都没发生，
     这是最伤体验的一类失败。所以"按比例取数量"之后还要抬到 min。

     施法期间玩家不能动，但有无敌帧（GameScene.castLockMs / grantInvincible）——
     这个技能的施法姿态最长（1.75 秒），不能动又不能无敌的话就是站着挨打。
     时长同样是反推的：atk3 走完 12 帧要 11 × 111ms ÷ 0.75 ≈ 1630ms，
     取 1750 留收势余量。改这个数要连着看角色表里的 skillAnimMul。 */
  raiseundead: {
    key: 'raiseundead', name: '亡者转化', innate: true, color: 0xc98fff,
    desc: '主动释放（按钮 / K 键），每局 3 次：把场上随机一批敌人变成你的亡灵（至少 2 个，BOSS 免疫）。亡灵不再伤害你，会扑向最近的敌人同归于尽',
    cooldown: 0, duration: 0,
    active: true, charges: 3,
    castMs: 1750, castAct: 'atk3',
    raise: {
      // 转化数量 = 场上敌人数 × ratio，再夹到 [min, max]
      ratio: 0.6, min: 2, max: 6,
      // 亡灵存活时间。到点自己消散 ——
      // 不设时限的话，几轮转化下来场上会全是友军，游戏直接失去压力
      undeadMs: 10000,
    },
  },

  /* ---- 可购买技能：最多同时装备 2 个 ---- */
  heal: {
    key: 'heal', name: '治疗术', cost: 90, color: 0xff8fa8,
    desc: '每 40 秒回复 1 点生命（不会超过上限）',
    cooldown: 40000, duration: 0,
  },
  frost: {
    key: 'frost', name: '冰霜弹', cost: 80, color: 0x8fd0ff,
    desc: '子弹命中敌人时让它减速 45%，持续 1.5 秒',
    cooldown: 0, duration: 0,
  },
  magnet: {
    key: 'magnet', name: '磁力手套', cost: 60, color: 0xc98fff,
    desc: '道具掉落率翻倍，道具在场时间延长 50%',
    cooldown: 0, duration: 0,
  },
  greed: {
    key: 'greed', name: '吸金术', cost: 50, color: 0xffd54a,
    desc: '每次击杀有 30% 概率额外获得 1 枚金币',
    cooldown: 0, duration: 0,
  },
  thorn: {
    key: 'thorn', name: '荆棘护甲', cost: 70, color: 0xff9a5c,
    desc: '受伤的瞬间向四周打出 8 发子弹',
    cooldown: 0, duration: 0,
  },
  revive: {
    key: 'revive', name: '复活护符', cost: 110, color: 0x7fffe0,
    desc: '每局一次：生命归零时原地复活并清空全场敌人',
    cooldown: 0, duration: 0,
  },
};
/* ============================================================================
   天赋树数据
   每个角色拥有三条分支（进攻 / 防御 / 机制），每条分支三个节点。
   节点数据结构：cost 消耗碎片，maxLv 最大等级（目前都是1级），effect 为效果标识
   ============================================================================ */
const TALENTS = {
  sorceress: {
    atk: [
      { key: 'ember',    name: '余 烬',   cost: 10, maxLv: 1, desc: '火弹命中时，产生小范围爆炸' },
      { key: 'twin',     name: '双 生',   cost: 30, maxLv: 1, desc: '结界反弹的子弹变成 2 发' },
      { key: 'phoenix',  name: '凤凰烈焰', cost: 80, maxLv: 1, desc: '10% 概率变成火凤凰，贯穿路径' },
    ],
    def: [
      { key: 'enduring', name: '持 久',   cost: 10, maxLv: 1, desc: '结界时长 +0.5 秒' },
      { key: 'solidify', name: '固 化',   cost: 30, maxLv: 1, desc: '结界时长 +1 秒' },
      { key: 'holylight',name: '圣 光',   cost: 80, maxLv: 1, desc: '结界开启时，获得 1 层护盾' },
    ],
    util: [
      { key: 'reflect',  name: '反 射',   cost: 10, maxLv: 1, desc: '堕天形态时，15% 概率反弹敌弹' },
      { key: 'extend',   name: '延 展',   cost: 30, maxLv: 1, desc: '堕天时长 +1 秒' },
      { key: 'echo',     name: '奥术回响', cost: 80, maxLv: 1, desc: '反弹时 20% 概率 +1 次堕天' },
    ],
  },

  warrior: {
    atk: [
      { key: 'slashrange', name: '阔 斩',   cost: 10, maxLv: 1, desc: '裂地斩范围 +10%' },
      { key: 'swordsize',  name: '剑 芒',   cost: 30, maxLv: 1, desc: '剑气尺寸 +20%' },
      { key: 'swordriver', name: '剑气长河', cost: 80, maxLv: 1, desc: '冲锋两侧的敌人也受到 1 点伤害' },
    ],
    def: [
      { key: 'toughness',  name: '健 壮',   cost: 10, maxLv: 1, desc: '生命上限 +1' },
      { key: 'steadfast',  name: '铁 壁',   cost: 30, maxLv: 1, desc: '冲锋落地后的无敌 +0.5 秒' },
      { key: 'bloodrage',  name: '浴血奋战', cost: 80, maxLv: 1, desc: '每损失 1 血 +12% 概率射出双剑气（最多 36%）' },
    ],
    util: [
      { key: 'chargefar',    name: '疾 行',   cost: 10, maxLv: 1, desc: '冲锋距离 +2 格' },
      { key: 'tactics',      name: '战 术',   cost: 30, maxLv: 1, desc: '裂地斩冷却 -10%，释放后 2 秒减伤 50%' },
      { key: 'doublecharge', name: '双重冲锋', cost: 80, maxLv: 1, desc: '冲锋次数 +1（每局多一次）' },
    ],
  },

  dwarf: {
    atk: [
      { key: 'powder',     name: '火 药',   cost: 10, maxLv: 1, desc: '鞭炮爆炸范围 +10%' },
      { key: 'bigblast',   name: '猛 药',   cost: 30, maxLv: 1, desc: '鞭炮爆炸伤害 +1' },
      { key: 'chainbomb',  name: '连环爆破', cost: 80, maxLv: 1, desc: '鞭炮命中时 15% 概率留下小地雷（1 秒后爆炸）' },
    ],
    def: [
      { key: 'blastarmor', name: '防爆服',   cost: 10, maxLv: 1, desc: '受到爆炸伤害降低 20%' },
      { key: 'ironbone',   name: '铁 骨',   cost: 30, maxLv: 1, desc: '冲撞伤害免伤 50%' },
      { key: 'lastresort', name: '紧急避险', cost: 80, maxLv: 1, desc: '致命伤害时若炸药在冷却，重置冷却 + 推敌 + 锁 1 血（每局一次）' },
    ],
    util: [
      { key: 'engineering', name: '工程学',   cost: 10, maxLv: 1, desc: '炸药投掷初始冷却 -1 秒，最长为 12 秒' },
      { key: 'bigbomb',     name: '扩 容',   cost: 30, maxLv: 1, desc: '炸药投掷范围 +10%' },
      { key: 'bouncebomb',  name: '弹射炸药', cost: 80, maxLv: 1, desc: '炸药碰到墙壁反弹一次' },
    ],
  },

  necromancer: {
    atk: [
      { key: 'longerlife', name: '长 眠',   cost: 10, maxLv: 1, desc: '骷髅存在时间 +2 秒' },
      { key: 'fastarrow',  name: '迅 击',   cost: 30, maxLv: 1, desc: '骷髅射速 +10%' },
      { key: 'legion',     name: '亡者狂热', cost: 80, maxLv: 1, desc: '召唤时 30% 概率额外召唤一只' },
    ],
    def: [
      { key: 'soulharvest', name: '献 祭',   cost: 10, maxLv: 1, desc: '亡灵死亡时 10% 概率治疗 0.5 血' },
      { key: 'lifeforce',   name: '生 机',   cost: 30, maxLv: 1, desc: '生命上限 +1' },
      { key: 'soulchain',   name: '灵魂链接', cost: 80, maxLv: 1, desc: '致命伤害时消耗所有亡灵，每只回复 1 血（每局一次）' },
    ],
    util: [
      { key: 'contract',    name: '黑暗契约', cost: 10, maxLv: 1, desc: '亡者转化保底数量 +1' },
      { key: 'quickrecover',name: '快速恢复', cost: 30, maxLv: 1, desc: '击杀恢复召唤次数的门槛 10 → 8' },
      { key: 'mastery',     name: '掌控生死', cost: 80, maxLv: 1, desc: '亡者转化策反比例从 60% 提升至 75%' },
    ],
  },
};
/* 技能槽数量：除角色专属技能外，最多再带两个。
   装备界面上是 4 个格子：武器 / 专属 / 技能槽 1 / 技能槽 2 */
const SKILL_SLOTS = 2;

const DEFAULT_LOADOUT = {
  character: 'gunner',
  weapon: 'pistol',
  skills: [null, null],
  boardSkin: DEFAULT_BOARD_SKIN,
  owned: {
    character: ['gunner'],
    weapon: ['pistol'],
    skill: [],
  },
};

/* 商店分类 → 数据表，UI 和存档校验共用一张表，避免两边写两套 */
const SHOP_CATEGORIES = {
  character: { label: '角色', table: CHARACTERS },
  weapon:    { label: '武器', table: WEAPONS },
  skill:     { label: '技能', table: SKILLS },
};

