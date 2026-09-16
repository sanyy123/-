/* ============================================================================
   图集资源（2026-09-16 打包成 2 张大图）
   ----------------------------------------------------------------------------
   原来 63 个 png = 63 次 HTTP 请求，手机端光排队就要好几秒。
   现在由 .workbuddy-ai/tmp/build-atlas.py 全部拼成 2 张大图，运行时只发 2 个请求
   （散图字节数 442KB → 562KB，多了 27%，换来 61 次请求的减少，手机端是净赚）。

   拼图时每张图四周留了 2px 并把边缘像素复制出去（extrude）——
   Phaser 的纹理过滤是 LINEAR，不这么做的话采样会取到隔壁那张图的像素，
   角色边缘会出现一圈别人的颜色。复制边缘等价于原来散图时的 clamp 行为。

   ★ 关键：每张图仍然注册成"独立 spritesheet"（addSpriteSheetFromAtlas）。
     帧号语义和逐张加载时完全一致 —— SHEET_FRAMES_PER_DIR / BOSS_SHEET_DIMS /
     所有动画帧下标一处都不用改。这是本次敢动素材的唯一理由。

   frames 每条 = [页号, x, y, 宽, 高, 单帧宽, 单帧高]。
   这张表由 build-atlas.py 生成，**不要手改** —— 改了必须重跑脚本 + --verify。

   ⚠️ goblin-wave 故意留在散图里（只有 166 字节）：
   代码用 setTexture('goblin-wave') 不带帧号取它，注册成 spritesheet 之后
   默认帧会落到 __BASE（= 整页大图），一炮糊满屏幕。
   ============================================================================ */
const SHEET_ATLAS = {
  pages: [
    { key: 'sheet-atlas-0', file: 'assets/atlas-0.png' },
    { key: 'sheet-atlas-1', file: 'assets/atlas-1.png' },
  ],
  // key: [页号, x, y, 宽, 高, 单帧宽, 单帧高]
  frames: {
    'armored': [1, 646, 2, 512, 256, 64, 64],
    'bomber': [1, 1034, 262, 384, 256, 64, 64],
    'boss-atk1': [1, 2, 2, 640, 256, 64, 64],
    'boss-atk2': [0, 2, 2, 512, 512, 128, 128],
    'boss-atk3': [0, 974, 1490, 768, 256, 64, 64],
    'boss-death': [1, 2, 522, 624, 192, 48, 48],
    'boss-hurt': [1, 246, 1502, 192, 192, 48, 48],
    'boss-idle': [1, 342, 1110, 288, 192, 48, 48],
    'boss-jump': [1, 634, 1110, 288, 192, 48, 48],
    'boss-land': [1, 442, 1502, 192, 192, 48, 48],
    'boss-walk': [1, 534, 718, 480, 192, 48, 48],
    'dwarf-death': [1, 1330, 1502, 160, 128, 32, 32],
    'dwarf-walk': [1, 1494, 1502, 128, 128, 32, 32],
    'fx-explosion': [1, 1826, 1502, 96, 64, 32, 32],
    'fx-sparks': [1, 1926, 1502, 64, 32, 32, 32],
    'goblin-atk1': [0, 2, 1166, 480, 320, 80, 80],
    'goblin-atk2': [0, 486, 1166, 400, 320, 80, 80],
    'goblin-death': [0, 2, 518, 800, 320, 80, 80],
    'goblin-hurt': [0, 1698, 1166, 320, 320, 80, 80],
    'goblin-idle': [0, 890, 1166, 400, 320, 80, 80],
    'goblin-move': [0, 2, 1490, 320, 320, 80, 80],
    'item-dynamite': [1, 1726, 1502, 96, 96, 32, 32],
    'item-dynamite-pack': [1, 1626, 1502, 96, 96, 32, 32],
    'lich-atk1': [0, 2, 842, 560, 320, 80, 80],
    'lich-atk2': [0, 518, 2, 1040, 320, 80, 80],
    'lich-atk3': [0, 566, 842, 560, 320, 80, 80],
    'lich-death': [0, 806, 518, 720, 320, 80, 80],
    'lich-hurt': [0, 326, 1490, 320, 320, 80, 80],
    'lich-idle': [0, 1130, 842, 560, 320, 80, 80],
    'lich-jump': [0, 1294, 1166, 400, 320, 80, 80],
    'lich-land': [0, 650, 1490, 320, 320, 80, 80],
    'necro-atk1': [1, 778, 914, 336, 192, 48, 48],
    'necro-atk2': [1, 1118, 914, 336, 192, 48, 48],
    'necro-atk3': [1, 630, 522, 576, 192, 48, 48],
    'necro-death': [1, 2, 718, 528, 192, 48, 48],
    'necro-hurt': [1, 638, 1502, 192, 192, 48, 48],
    'necro-run': [1, 1218, 1110, 288, 192, 48, 48],
    'necro-run-lo': [1, 926, 1110, 288, 192, 48, 48],
    'rusher': [1, 1162, 2, 512, 256, 64, 64],
    'shotgunner': [1, 2, 262, 512, 256, 64, 64],
    'skel-atk1': [1, 1210, 522, 576, 192, 48, 48],
    'skel-death': [1, 1502, 718, 384, 192, 48, 48],
    'skel-run': [1, 2, 1306, 288, 192, 48, 48],
    'skel-run-lo': [1, 1510, 1110, 288, 192, 48, 48],
    'slime': [1, 518, 262, 512, 256, 64, 64],
    'sniper': [1, 1422, 262, 384, 256, 64, 64],
    'sorc-atk1': [1, 1754, 1306, 240, 192, 48, 48],
    'sorc-atk2': [1, 1458, 914, 336, 192, 48, 48],
    'sorc-atk3': [1, 2, 1110, 336, 192, 48, 48],
    'sorc-dark': [1, 1226, 1502, 48, 192, 48, 48],
    'sorc-death': [1, 1018, 718, 480, 192, 48, 48],
    'sorc-hurt': [1, 834, 1502, 192, 192, 48, 48],
    'sorc-run': [1, 586, 1306, 288, 192, 48, 48],
    'sorc-run-lo': [1, 294, 1306, 288, 192, 48, 48],
    'sorc-ward': [1, 1278, 1502, 48, 192, 48, 48],
    'wari-atk1': [1, 878, 1306, 288, 192, 48, 48],
    'wari-atk2': [1, 1170, 1306, 288, 192, 48, 48],
    'wari-atk3': [1, 2, 1502, 240, 192, 48, 48],
    'wari-death': [1, 1462, 1306, 288, 192, 48, 48],
    'wari-hurt': [1, 1030, 1502, 192, 192, 48, 48],
    'wari-run-lo': [1, 2, 914, 384, 192, 48, 48],
    'wari-walk': [1, 390, 914, 384, 192, 48, 48],
  },
};

/* 把两张图集大图排进加载队列。
   四个场景的 preload 都会调，已经加载过就跳过（重复 load 会让 Phaser 重读文件刷警告） */
function loadSheetAtlas(scene) {
  for (const p of SHEET_ATLAS.pages) {
    if (!scene.textures.exists(p.key)) scene.load.image(p.key, p.file);
  }
  // 反月牙投射物单独一张（见上面 SHEET_ATLAS 的说明）
  if (!scene.textures.exists('goblin-wave')) {
    scene.load.image('goblin-wave', 'assets/goblin-wave.png');
  }
}

/* 把大图里的每一块注册成独立 spritesheet。
   ⚠️ 必须在 preload 结束之后（create 里）调用 —— 那时大图才真正进到纹理管理器。
   大图没加载成功时整批跳过，上层 hasSheet() 会自动退回程序化纹理 */
function buildSheetTextures(scene) {
  for (const [key, f] of Object.entries(SHEET_ATLAS.frames)) {
    if (scene.textures.exists(key)) continue;
    const page = SHEET_ATLAS.pages[f[0]];
    if (!page || !scene.textures.exists(page.key)) continue;

    // 先在大图上登记一块"区域帧"，addSpriteSheetFromAtlas 就是按它切的
    const pageTex = scene.textures.get(page.key);
    const region = key + '-region';
    if (!pageTex.has(region)) pageTex.add(region, 0, f[1], f[2], f[3], f[4]);

    scene.textures.addSpriteSheetFromAtlas(key, {
      atlas: page.key,
      frame: region,
      frameWidth: f[5],
      frameHeight: f[6],
    });

    // Parser.SpriteSheet 建的 __BASE 取的是 texture.source[0] 的尺寸，也就是**整页大图**。
    // 逐张加载时 __BASE 就是这张图本身，这个语义得补回来 ——
    // 否则任何一处漏传帧号（比如池里捞出来的老对象没换帧）都会画出 2048×2048 的巨图，
    // 而不是像以前那样只是"显示成整张图"。
    // ⚠️ 只能原地 setSize，**不能 remove('__BASE') 再 add**：
    //    Phaser 的 Texture.remove() 不递减 frameTotal，remove + add 会让 frameTotal 多 1，
    //    而 hasSheet() 正是拿 frameTotal - 1 跟声明的帧数比的 ——
    //    多出来的 1 会让"少一帧的坏图集"被判成加载成功，属于静默失效。
    const tex = scene.textures.get(key);
    const base = tex && tex.frames['__BASE'];
    if (base) base.setSize(f[3], f[4], f[1], f[2]);
  }
}

/* ---- 可玩角色的图集 ----
   排布和敌人图集是同一套（四行按 下 / 上 / 左 / 右），但单帧改成 48×48，
   而且一张图集只装一个动作（敌人是一张图集装"走路"这一件事）。
   帧数必须逐张写死：没有规律可推，写错一列整段动画就会错位。
   reverse: true 表示这张图集的帧序是倒的 —— 作者把"完成态"画在了每行最左边那一帧，
   得反过来播才有"动作逐渐做出来"的感觉。
   atk1 是普通攻击、atk2 是专属技能 1、atk3 是专属技能 2（主动），
   三者的播放时机都在 GameScene 里决定。 */
const CHAR_ANIMS = {
  sorc: {
    run:   { file: 'sorc-run',   frames: 6,  rate: 12, repeat: -1 },
    atk1:  { file: 'sorc-atk1',  frames: 5,  rate: 14, repeat: -1 },
    atk2:  { file: 'sorc-atk2',  frames: 7,  rate: 14, repeat: -1 },
    atk3:  { file: 'sorc-atk3',  frames: 7,  rate: 12, repeat: -1 },
    hurt:  { file: 'sorc-hurt',  frames: 4,  rate: 12, repeat: 0 },
    death: { file: 'sorc-death', frames: 10, rate: 14, repeat: 0 },
  },
  wari: {
    // 勇者的素材叫 Walk，功能就是"跑步"，所以动作名统一叫 run，逻辑里不用分两套
    run:   { file: 'wari-walk',  frames: 8, rate: 12, repeat: -1 },
    atk1:  { file: 'wari-atk1',  frames: 6, rate: 14, repeat: -1 },
    atk2:  { file: 'wari-atk2',  frames: 6, rate: 14, repeat: -1 },
    // 冲锋：这套图集的帧序是倒的，要从右往左播（reverse 由动画注册和帧播放器分别处理）
    atk3:  { file: 'wari-atk3',  frames: 5, rate: 12, repeat: 0, reverse: true },
    hurt:  { file: 'wari-hurt',  frames: 4, rate: 12, repeat: 0 },
    // Death 的 Up 方向素材是 6 帧、其余三个方向只有 5 帧，拼图时已经补齐到 6，
    // 所以这里按 6 写；照抄 5 会让上方向的死亡动画少一帧
    death: { file: 'wari-death', frames: 6, rate: 12, repeat: 0 },
  },
  dwarf: {
    // 矮人：素材只有"行走"和"死亡"两套图集，攻击 / 受伤没有专门的动作，
    // 所以 atk1 / atk2 / hurt 三个动作直接复用 dwarf-walk。
    // 复用方式是"同一个 file、不同动画 key" —— 语义上还是
    // "攻击时播 dwarf-atk1-xxx"，以后有专门素材了改这里的 file 就行。
    // 帧数按实际素材算：两张图集都是 4 列 × 4 行，每向 4 帧。
    // 写成 6 会让 generateFrameNumbers 多算 2 帧、切到下一行的内容上，
    // 动画会突然闪一下
    run:   { file: 'dwarf-walk',  frames: 4, rate: 10, repeat: -1 },
    atk1:  { file: 'dwarf-walk',  frames: 4, rate: 12, repeat: -1 },
    atk2:  { file: 'dwarf-walk',  frames: 4, rate: 12, repeat: -1 },
    hurt:  { file: 'dwarf-walk',  frames: 4, rate: 18, repeat: 0 },
    // 死亡：源素材 death-front 是 5 帧（最后一帧是"整个人沉进地里"），
    // 拼图时原样搬了 5 列过来。这里必须写 5 ——
    // 写 4 不只是少播最后一帧，`step × 行号` 会把上/左/右三行整体错开一格，
    // 播出来是"上方向先闪一帧朝下的姿势再转过来"。
    // 5 帧 @ 10 fps = 500ms，乘 playPlayerDeath 里的 1.4 缓冲 ≈ 700ms
    death: { file: 'dwarf-death', frames: 5, rate: 10, repeat: 0 },
  },

  /* 死灵法师：四方向 × 六动作，单帧 48×48，和巫女 / 勇者同规格。
     atk1 = 普通攻击（挥杖）、atk2 = 亡者召唤、atk3 = 亡者转化。
     ⚠️ 这套素材的 Attack03 是"从左往右"排的（第 0 帧起手、最后一帧收势），
     和勇者那套"从右往左"正好相反 —— 所以这里**不加 reverse**。
     加错了会变成"先看到红光炸开、再看到抬手"，动作读起来是倒的。
     death 有 11 帧，但后 6 帧是"身体溶解成一道横痕"的效果，
     不是没画完 —— 那是作者的表现手法，照播即可。 */
  necro: {
    run:   { file: 'necro-run',   frames: 6,  rate: 11, repeat: -1 },
    atk1:  { file: 'necro-atk1',  frames: 7,  rate: 12, repeat: -1 },
    atk2:  { file: 'necro-atk2',  frames: 7,  rate: 10, repeat: -1 },
    atk3:  { file: 'necro-atk3',  frames: 12, rate: 9,  repeat: 0 },
    hurt:  { file: 'necro-hurt',  frames: 4,  rate: 12, repeat: 0 },
    death: { file: 'necro-death', frames: 11, rate: 14, repeat: 0 },
  },

  /* 骷髅弓手：不是可玩角色，是死灵法师召唤出来的友军。
     放进这张表是为了白捡 loadCharSheets 和 setupAnimations ——
     它的图集排布（四行 下 / 上 / 左 / 右）和可玩角色完全一样，
     在这里声明一次，加载、动画注册、帧尺寸兜底三条路径全都复用。
     它只有 攻击 / 死亡 / 移动 三套素材，所以只填三个动作；
     缺的 atk2 / hurt 不会被读到（召唤物不走 updatePlayerVisual）。 */
  skel: {
    run:   { file: 'skel-run',   frames: 6,  rate: 11, repeat: -1 },
    // 弓箭：12 帧里第 9 帧才把箭射出去，所以射击判定要延后到那一帧（见 updateSkeletons）
    atk1:  { file: 'skel-atk1',  frames: 12, rate: 14, repeat: 0 },
    death: { file: 'skel-death', frames: 8,  rate: 12, repeat: 0 },
  },
};

/* 旧名字：巫女的手动帧播放器按这个名字取图。保留是为了不动那段已经跑通的代码 */
const SORC_ANIMS = CHAR_ANIMS.sorc;

/* 取某个角色"跑步"图集的 key。
   不能直接拼 charDef.sheet + '-run' —— 巫女那张图集叫 sorc-run，
   勇者那张叫 wari-walk（素材作者用词就不统一），拼出来会拿到一个不存在的 key，
   然后整个角色静默退回程序化纹理。图集缺失时返回 null，调用方据此降级 */
function charRunSheet(charDef) {
  const anims = CHAR_ANIMS[charDef.sheet];
  return (anims && anims.run) ? anims.run.file : null;
}

/* 朝向 → 图集行号。四行固定是 下 / 上 / 左 / 右（敌人图集也是这套约定）。
   以前这个映射只内联在 skillAnimTick 里，形态帧要用第二遍 —— 抽出来，
   免得以后有一处改了另一处忘了，贴图整行错位还看不出来 */
const DIR_ROW = { down: 0, up: 1, left: 2, right: 3 };

/* 各张角色图集的"一帧大小"。
   ⚠️ 这里必须和素材实际尺寸一致 —— 写错了就会切出"上半身叠着下半身"
   这种错位（第一帧取满 48×48 时会纵向跨到第二帧一半）。
   量法：把图片拖进看图软件，宽度 ÷ 列数、高度 ÷ 行数 就是一帧的尺寸。
   没列在这张表里的图集，按 48×48 处理（巫女、勇者都是这个尺寸） */
const CHAR_SHEET_DIMS = {
  'dwarf-walk':  { w: 32, h: 32 },
  'dwarf-death': { w: 32, h: 32 },
};

/* "边攻击边移动"的叠加层图集：把走路图集从腰部横切，只留下半身。
   用法是底图播攻击动画、这层盖在上面播走路 —— 上半身挥杖、下半身迈步。
   为什么不放进 CHAR_ANIMS：它不是一个独立动作，只是 run 的裁剪版，
   放进去会被 setupAnimations 多注册出一整排用不到的动画 key。
   切割线在 .workbuddy-ai/tmp/build-walkatk.py 里定，改线要重新生成图片。 */
const CHAR_OVERLAY_SHEETS = ['necro-run-lo', 'skel-run-lo', 'sorc-run-lo', 'wari-run-lo'];

/* 技能【生效期】保持的形态图集：1 列 × 4 行，每个方向就一帧（48×48）。
   巫女的逆反结界 6 秒 / 堕天形态 8 秒里，主精灵定在这一帧上不动，
   移动时由叠加层（*-run-lo）补上下半身的走路 —— 所以"保持形态"和
   "能移动、能开火"是同时成立的，见 GameScene.updatePlayerVisual 的形态分支。
   谁用哪一张写在 SKILLS.<技能>.formSheet 里，这里只负责加载。
   不放进 CHAR_ANIMS：它不是一个可播的动作（只有一帧），放进去
   setupAnimations 会多注册一整排用不到的动画 key —— 叠加层当初也是这么处理的。 */
const CHAR_FORM_SHEETS = ['sorc-ward', 'sorc-dark'];

/* 可玩角色的图集排布说明见下方 CHAR_ANIMS。
   加载已经合并进 SHEET_ATLAS（loadSheetAtlas），这里不再单独发请求。 */

/* 新增的四张图：爆炸、火花、鞭炮、炸药。
   帧尺寸 = 图片宽 ÷ 列数、图片高 ÷ 行数，必须和素材实际尺寸一致。
   ⚠️ 这里曾经把前三张按 16×16 切，而它们的单帧实际是 32×32 ——
   96×96 的鞭炮会被切成 6×6 共 36 帧，每帧只取到原图的四分之一，
   子弹显示成一块认不出来的红色碎片。改这张表之前先用工具量一遍图片尺寸。 */
const FX_SHEETS = {
  'fx-explosion':       { w: 32, h: 32 },  // 96×64 → 3 列 × 2 行 = 6 帧，从中心扩散到消散
  'fx-sparks':          { w: 32, h: 32 },  // 64×32 → 2 列 × 1 行 = 2 帧
  'item-dynamite':      { w: 32, h: 32 },  // 96×96 → 3 列 × 3 行 = 9 帧（鞭炮引线闪动）
  'item-dynamite-pack': { w: 32, h: 32 },  // 96×96 → 3 列 × 3 行 = 9 帧（炸药包引线闪动）
};

/* 图集类子弹（鞭炮 / 炸药）的显示参数。
   为什么需要这张表：程序化子弹是 16×16 的圆（内容撑满 16 px），
   而鞭炮 / 炸药的素材单帧是 32×32、内容只有 20~24 px ——
   按 1:1 直接显示会比普通子弹大一圈，缩放后才和手枪弹一个量级。
   angleOffset 是"素材本身画歪了多少"的补偿：鞭炮是斜着画的
   （实测主轴 -45.7°，即引线朝右上），不补的话朝右打出去的鞭炮
   会一直保持右上的姿态，看着像在侧着飘。炸药包接近正方形，不用补。 */
const BULLET_LOOK = {
  'item-dynamite':      { scale: 0.70, angleOffset: Math.PI / 4 },
  'item-dynamite-pack': { scale: 0.75, angleOffset: 0 },
  // 骷髅射出的箭。列进这张表有两个副作用，两个都是想要的：
  //   1) 混合模式走 NORMAL 而不是 ADD —— 箭是实体道具，
  //      用 ADD 会变成半透明的亮条，压在草地上像一道光而不是一支箭；
  //   2) 会跟着飞行方向 setRotation（见 fireBullet 的 spin 判断）。
  // 素材基准朝右，所以 angleOffset 给 0。
  // 亡灵弹（bullet-necro）故意不列进来：它是能量体，要的就是 ADD 发光
  'bullet-arrow':       { scale: 1.0,  angleOffset: 0 },
};

/* 两种爆炸特效的适配参数。
   contentW 是"素材里真正有像素的那部分宽度"，不是帧宽 ——
   fx-explosion 最盛的一帧内容撑满 32 px，fx-sparks 的星芒只占中间 13 px，
   32 px 的帧里一大半是空白。用帧宽当基准算缩放，火花会缩得比判定圈小一半，
   看着像"炸了个寂寞"。cover 决定视觉圈比判定圈大还是小：
   爆炸要压过判定范围一点才有打击感，火花是发散的星芒，小一点反而自然。 */
const FX_FIT = {
  explosion: { anim: 'fx-explosion-anim', tex: 'fx-explosion', contentW: 32, cover: 1.15 },
  sparks:    { anim: 'fx-sparks-anim',    tex: 'fx-sparks',    contentW: 13, cover: 0.90 },
};

/* 特效图集的加载同样合并进 SHEET_ATLAS，这里只留规格表 */

/* ============================================================================
   BOSS —— 骷髅王（Foozle Lucifer Skeleton King）
   ----------------------------------------------------------------------------
   排布和其它图集完全一致（四行 下 / 上 / 左 / 右），但单帧尺寸逐张不同 ——
   这包作者按"这个动作需要多大画布"裁图：
     Idle / Walk / Jump / Land / Hurt / Death   → 48×48
     Attack01（双劈砍）/ Attack03（落地砸地）    → 64×64（角色整体比 48 版下移 8px，
                                                    正好是 48 帧上下各留 8 的居中结果）
     Attack02（旋转斩，白弧甩得很开）            → 128×128
   所以帧尺寸必须逐张写。拿 48 去切 64 的图会切出半个身子。
   ============================================================================ */
const BOSS_ANIMS = {
  idle:  { file: 'boss-idle',  frames: 6,  rate: 8,  repeat: -1 },
  walk:  { file: 'boss-walk',  frames: 10, rate: 11, repeat: -1 },
  jump:  { file: 'boss-jump',  frames: 6,  rate: 11, repeat: 0 },
  land:  { file: 'boss-land',  frames: 4,  rate: 12, repeat: 0 },
  hurt:  { file: 'boss-hurt',  frames: 4,  rate: 14, repeat: 0 },
  death: { file: 'boss-death', frames: 13, rate: 9,  repeat: 0 },
  atk1:  { file: 'boss-atk1',  frames: 10, rate: 10, repeat: 0 },
  atk2:  { file: 'boss-atk2',  frames: 4,  rate: 7,  repeat: -1 },
  atk3:  { file: 'boss-atk3',  frames: 12, rate: 13, repeat: 0 },
};

const BOSS_SHEET_DIMS = {
  'boss-idle':  { w: 48,  h: 48 },
  'boss-walk':  { w: 48,  h: 48 },
  'boss-jump':  { w: 48,  h: 48 },
  'boss-land':  { w: 48,  h: 48 },
  'boss-hurt':  { w: 48,  h: 48 },
  'boss-death': { w: 48,  h: 48 },
  'boss-atk1':  { w: 64,  h: 64 },
  'boss-atk2':  { w: 128, h: 128 },
  'boss-atk3':  { w: 64,  h: 64 },
};

/* 每个动作"地面线在帧内的 y"。
   素材自带投影（全图唯一的半透明色，alpha=131），量出投影下沿就是地面线：
   48 帧落在 y=40、64 帧 y=48、128 帧 y=80。
   originY 取 groundY / 帧高，保证所有动作的脚踩在同一个世界坐标上 ——
   不这么做，boss 从待机切到攻击会整体下沉 8px，3 倍缩放下就是 24px 的跳变。 */
const BOSS_GROUND_Y = {
  'boss-idle': 40, 'boss-walk': 40, 'boss-jump': 40, 'boss-land': 40,
  'boss-hurt': 40, 'boss-death': 40,
  'boss-atk1': 48, 'boss-atk3': 48,
  'boss-atk2': 80,
};

/* 骷髅王的九张图集同样已合并进 SHEET_ATLAS，这里只留 BOSS_ANIMS / BOSS_SHEET_DIMS */

/* ============================================================================
   BOSS 二号 —— 哥布林飞骑（蝙蝠骑士），第 1 / 2 张图用
   ----------------------------------------------------------------------------
   素材原本是"每方向一条横图"，由 .workbuddy-ai/tmp/build-goblin.js 拼成
   和骷髅王一样的"方向按行"图集（下 / 上 / 左 / 右），已逐字节校验过。
   比骷髅王省心：四个方向 × 六个动作单帧全是 80×80，
   地面线（素材自带投影的下沿）也全是 y=68 —— 只要一个常量，不用逐张写帧尺寸。

   动作用途（对应"飞上棋盘 → 三连猛冲 → 甩月牙"这套固定流程）：
     idle  停顿 / 转向
     move  飞上棋盘
     wind  猛冲前摇（atk1 前 3 帧：收翅膀蓄势）
     dive  猛冲本体（atk1 后 3 帧：俯冲 + 翅膀白光 + 掠影）
     cast  甩反月牙（atk2：月牙从身下甩出去）
     hurt / death
   ============================================================================ */
const GOBLIN_FRAME = 80;
const GOBLIN_GROUND_Y = 68;

/* 每张图集"每向多少帧"。这个数写错**不会报错**：只会让上 / 左 / 右三个方向
   整体错行（第 0 行"下"永远是对的，所以只看下方向根本发现不了）。
   必须和 build-goblin.js 的输出保持一致 */
const GOBLIN_SHEET_COLS = {
  'goblin-idle': 5, 'goblin-move': 4, 'goblin-atk1': 6,
  'goblin-atk2': 5, 'goblin-hurt': 4, 'goblin-death': 10,
};

/* from / to 是"本方向那一行内"的帧下标（不是图集绝对帧号）。
   猛冲必须拆成前摇和俯冲两段：光靠一个 frames 数切不开 ——
   前摇要慢（让玩家看清它朝哪边），俯冲要快（跟位移同步） */
const GOBLIN_ANIMS = {
  idle:  { file: 'goblin-idle',  from: 0, to: 4, rate: 9,  repeat: -1 },
  move:  { file: 'goblin-move',  from: 0, to: 3, rate: 12, repeat: -1 },
  wind:  { file: 'goblin-atk1',  from: 0, to: 2, rate: 5,  repeat: 0 },
  dive:  { file: 'goblin-atk1',  from: 3, to: 5, rate: 7,  repeat: -1 },
  cast:  { file: 'goblin-atk2',  from: 0, to: 4, rate: 8,  repeat: 0 },
  hurt:  { file: 'goblin-hurt',  from: 0, to: 3, rate: 14, repeat: 0 },
  death: { file: 'goblin-death', from: 0, to: 9, rate: 9,  repeat: 0 },
};

/* 飞骑的六张图集已合并进 SHEET_ATLAS；
   反月牙投射物 goblin-wave 仍在 loadSheetAtlas 里单独加载（它不能进图集，见 SHEET_ATLAS 注释） */

/* 哥布林飞骑的数值与时间轴。和 BOSS 一样分两组：
   上面几个"跟动画帧硬对齐"的不参与狂暴，下面那组按 rage 在两端之间插值 */
const GOBLIN = {
  name: '哥 布 林 飞 骑',
  scale: 1.5,          // 帧 80px、翼展约 76px → 屏幕上 114px，是玩家（34px）的三倍多
  bodyR: 24,           // 物理半径（帧内像素，会被 sprite 缩放再乘一次）
  bodyUp: 22,          // 判定圆心比地面线高 22px。
                       // 蝙蝠是悬在投影上方的：只扣身体的话，玩家走到影子底下会
                       // "从它肚子下面穿过去"，猛冲撞不到人 —— 判定圈必须罩到地面线附近
  hpBase: 170,         // 第 1 张图
  hpPerMap: 250,       // 第 1 / 2 张图 = 170 / 420（骷髅王仍是 180 + 280×2 = 740）
  scorePerHp: 5,
  killScore: 1200,

  /* ---- 跟动画帧硬对齐的固定值，不参与狂暴 ---- */
  telegraphMs: 900,    // 出场黑影。比骷髅王短：飞骑是从场外飞进来的，不是砸下来
  flyinMargin: 140,    // 起飞点在屏幕外这么远（按屏幕边算，不是按落点算 ——
                       // 见 enterBossState('flyin') 里的说明）
  flyinMinMs: 700,     // 进场时长下限
  flyinMaxMs: 1400,    // 进场时长上限。进场按"恒定速度"算时长再夹到这个区间：
                       // 太短读不出"飞进来"，太长玩家会干等
  flySpeed: 560,       // 进场速度（px/s）
  dashWindupMs: 600,   // 猛冲前摇（wind = atk1 前 3 帧 @5fps = 600ms）
  dashCount: 3,        // 一次猛冲段冲几次（用户指定：固定 3 次）
  dashEdgeInset: 24,   // 冲到离棋盘边缘多少像素处停下。
                       // 棋盘外到屏幕边只有 64px，而它翼展 114px ——
                       // 停在 24 处时翅膀刚好探出边缘一点点，读起来像"撞在墙上"
  dashMinDist: 150,    // 猛冲距离短于这个值就掉头冲对面那条边。
                       // 玩家贴在它那一侧的边上时，否则会出现"冲 20px 就停"的假动作
  waveReleaseMs: 200,  // cast 播到第 200ms 时把月牙甩出去（对齐第 1 帧的甩尾动作）
  waveCastMs: 640,     // cast 全长 5 帧 @8fps = 625ms，留一点缓冲。
                       // 两发之间的间隔 = waveWindupMs + waveCastMs
  waveLifeMs: 2600,    // 月牙存活上限（飞出棋盘外 150px 就回收，这个只是兜底）
  deathMs: 1400,
  /* 挨打时抖一下（用 hurt 图集）。只在"停顿类"状态里播 ——
     猛冲 / 甩月牙的判定点跟动画帧硬对齐，中途插一段受伤动画会让后面全错位。
     gap 是节流：射速堆起来后 90ms 就一发，不节流的话受伤动作会卡在第一帧上抖 */
  flinchMs: 220,
  flinchGapMs: 760,

  /* ---- 节奏类：按 rage 在"温和端 → 狂暴端"之间线性插值 ---- */
  dashSpeed: 620, dashSpeedRage: 880,
  dashStopMs: 820, dashStopMsRage: 560,      // 三次猛冲之间的间隔
  segIdleMs: 1300, segIdleMsRage: 800,       // 猛冲段 ⇄ 月牙段之间的停顿
  waveCount: 3, waveCountRage: 4,            // 一次放几发月牙
  waveWindupMs: 560, waveWindupMsRage: 400,  // 每发之前的转向 + 蓄力
  waveSpeed: 300, waveSpeedRage: 400,        // 月牙飞行速度（比玩家慢，能跑得掉）
  waveOffset: 30,                            // 月牙出生点离身体中心的距离
};

/* 月牙投射物的固定规格。
   所有长度都是"纹理帧内像素"，乘 sprite 的 scale 才是屏幕值 ——
   而 scale 允许 x / y 分开给（巫妖王的三种月牙就是靠非等比缩放做出来的）。

   ⚠️ axis0 = "月牙长轴在纹理帧内的角度"。
   这张图是从 Attack02 那一帧**横着**抠出来的（bbox 66×12），长轴在帧内是水平的，
   所以 axis0 = 0。判定用的胶囊轴 = sprite.rotation + axis0 —— 这个值写错，
   整个判定框会转 90°：横着飞的月牙用一根竖着的胶囊去判，只有 45% 的像素判得中。 */
const GOBLIN_WAVE = {
  tex: 'goblin-wave',
  sx: 2.0, sy: 2.0,   // 72×72 画布 → 144×144；月牙本体 66×12 → 屏幕上 132×24
  halfW: 33,          // 长半轴（66/2）
  halfH: 6,           // 半厚（12/2）
  axis0: 0,
};

/* ============================================================================
   BOSS 三号 —— 巫妖王（AncientSkeleton），第 2 张图用
   ----------------------------------------------------------------------------
   素材由 .workbuddy-ai/tmp/build-lich.js 拼成"方向按行"（下 / 上 / 左 / 右），
   八个动作的单帧**统一 80×80**，比骷髅王省心（那个 48 / 64 / 128 三种混着来）。

   三个素材坑，构建脚本里已经处理掉：
     1) Left 目录的 Idle 叫 `AncientSkeletonLefttIdle.png`（多一个 t），
        照常规拼文件名会直接读不到；
     2) Left/Right 的 Walk 是 768×96（96 高的帧），和其余全部 80×80 不一致 ——
        所以 **Walk 整个不导出**。巫妖王是"定点漂浮施法"的，本来就不需要走路，
        而它一旦混进来，"整张图集统一 80×80"这个前提就不成立了；
     3) 素材自带投影（alpha=179 的小椭圆）会被**剥掉**。
        巫妖王要漂浮，投影烘在帧里会跟着本体一起升空，看着像踩在空气上。
        剥掉之后由游戏在**地面线**上另画一个程序化影子。

   动作与用途：
     idle        漂浮待机（循环）
     jump        出场用：素材是"离地 → 腾空"画的，倒着播才是"从天而降"
     rise        飘起来：同一张图集正向播
     land        落地姿态（素材本身就是"腾空 → 落地"）
     atk1        甩大月牙波（第 6 帧甩出）
     atk2        三段劈斩（第 4 / 7 / 10 帧各甩一道竖月牙）
     atk3        召唤小巫妖王 + 连续落雷（第 5 帧爆白光）
     hurt / death
   ============================================================================ */
const LICH_FRAME = 80;

/* 每张图集"每向多少帧"。和哥布林一样，这个数写错**不会报错**，
   只会让上 / 左 / 右三行整体错行（第 0 行"下"永远是对的，只看下方向发现不了）。
   必须和 build-lich.js 的输出保持一致 */
const LICH_SHEET_COLS = {
  'lich-idle': 7, 'lich-jump': 5, 'lich-land': 4, 'lich-atk1': 7,
  'lich-atk2': 13, 'lich-atk3': 7, 'lich-hurt': 4, 'lich-death': 9,
};

/* 每条动作"地面线在帧内的 y"（= 素材投影下沿的中位数，构建时逐帧量出来的）。
   originY 取 groundY / 帧高，保证切动作时本体不会上下跳。
   ⚠️ 这几个值差得不小（58~68）：素材是按"这个动作里本体抬多高"画的，
   全用一个数会把"抬手召唤时整个人往上浮"这个表演抹掉。
   ⚠️ 投影已经剥掉了，所以这些值现在只用来定位本体，看不见投影本身。 */
const LICH_GROUND_Y = {
  'lich-idle': 62, 'lich-jump': 66, 'lich-land': 68, 'lich-atk1': 62,
  'lich-atk2': 59, 'lich-atk3': 58, 'lich-hurt': 60, 'lich-death': 62,
};

/* 每条动作"躯干质心在帧内的 x"（构建时按 y∈[8,50] 的不透明像素质心量的）。
   为什么需要它：这套素材没有把角色严格居中 —— 躯干质心在 38.5~43.8 之间飘，
   按帧心 40 对齐的话，从 idle 切到 atk3 时整个本体横移 4px
   （3.4 倍缩放下就是 14px），看着像瞬移了一下。
   originX 取 cx / 帧宽，物理体偏移取 cx - r —— 两个都跟着它走，
   本体和判定圈就同时钉在同一个点上。 */
const LICH_BODY_CX = {
  'lich-idle': 38.5, 'lich-jump': 38.7, 'lich-land': 39.4, 'lich-atk1': 39.9,
  'lich-atk2': 42.8, 'lich-atk3': 43.8, 'lich-hurt': 40.2, 'lich-death': 39.2,
};

/* from / to 是"本方向那一行内"的帧下标（不是图集绝对帧号）。
   reverse: true 表示这一套的帧序要翻过来播 —— 只有 jump 需要（见上面第 2 条）。 */
const LICH_ANIMS = {
  idle:  { file: 'lich-idle',  from: 0, to: 6,  rate: 8,  repeat: -1 },
  jump:  { file: 'lich-jump',  from: 0, to: 4,  rate: 10, repeat: 0, reverse: true },
  rise:  { file: 'lich-jump',  from: 0, to: 4,  rate: 10, repeat: 0 },
  land:  { file: 'lich-land',  from: 0, to: 3,  rate: 10, repeat: 0 },
  atk1:  { file: 'lich-atk1',  from: 0, to: 6,  rate: 9,  repeat: 0 },
  atk2:  { file: 'lich-atk2',  from: 0, to: 12, rate: 8,  repeat: 0 },
  atk3:  { file: 'lich-atk3',  from: 0, to: 6,  rate: 9,  repeat: 0 },
  hurt:  { file: 'lich-hurt',  from: 0, to: 3,  rate: 14, repeat: 0 },
  death: { file: 'lich-death', from: 0, to: 8,  rate: 9,  repeat: 0 },
};

/* 巫妖王的八张图集同样已合并进 SHEET_ATLAS，这里只留 LICH_SHEET_COLS / LICH_ANIMS */

/* 巫妖王的数值与时间轴。和另外两个 BOSS 一样分两组：
   上面几个"跟动画帧硬对齐"的不参与狂暴，下面那组按 rage 在两端之间插值 */
const LICH = {
  name: '巫 妖 王',
  // 3.4：帧 80px、本体 35×55px → 屏幕上 119×187，比骷髅王（本体 87 宽）
  // 和飞骑（114 宽）都大一圈 —— 用户明确要"大点"
  scale: 3.4,
  bodyR: 15,           // 物理半径（帧内像素，会被 sprite 缩放再乘一次）
  bodyUp: 26,          // 判定圆心比地面线高 26px：躯干在帧内 y 约 20~48，
                       // 圆心落在 y=36（地面线 62 - 26）正好罩住胸口
  hpBase: 210,         // 第 2 张图 = 210 + 300×1 = 510
  hpPerMap: 300,       // （第 1 张图飞骑 170，第 3 张图骷髅王 740）
  scorePerHp: 5,
  killScore: 1500,

  /* ---- 跟动画帧硬对齐的固定值，不参与狂暴 ---- */
  telegraphMs: 1150,   // 出场黑影。和骷髅王一模一样（用户要求"出场方式一样"）
  fallMs: 660,         // 从天而降
  landMs: 480,         // 落地姿态
  shockR: 170,         // 落地冲击波半径。骷髅王是 300 —— 用户要求"范围小点"
  // 漂浮高度：素材 Jump 第 5 帧比第 1 帧整体高 8px（逐帧量过像素），
  // 用户要求"用这个跳起来的高度作为漂浮"。3.4 倍缩放下就是 27px
  floatUp: 8,
  bobAmp: 3.5,         // 漂浮起伏的振幅（帧内像素）。纯视觉，判定圈跟着一起动
  bobCycleMs: 2200,    // 起伏一个来回的时长
  riseMs: 560,         // 从地面线飘到漂浮高度
  waveMarkMs: 560,     // atk1 播到第几毫秒甩出大月牙（第 6 帧 @9fps = 556ms）
  waveCastMs: 800,     // atk1 全长 7 帧 @9fps = 778ms，留一点缓冲
  waveOffset: 72,      // 月牙出生点离本体中心的距离（屏幕像素）。
                       // 不往前推的话第一帧和本体叠在一起，看不出是"飞出去"
  // atk2 三个出手点：第 4 / 7 / 10 帧 @8fps = 375 / 750 / 1125ms。
  // 三点之间各差 375ms，所以"第二轮提前重播"也提前 375ms（见 slashRewindMs）
  slashMarks: [375, 750, 1125],
  // 狂暴版：两轮六刀。第二轮紧贴着第一轮（1525 = 1125 + 400），
  // 间隔刻意只留 400ms 而不是"等第一轮动画播完"——
  // 一旦把第二轮推得太晚，一轮循环反而变长，就违背了"频率随时间变高"。
  // 第二轮的三刀间距从 275ms 收到 230ms：这一段是纯重播，不像第一轮那样
  // 被动画帧钉死，收紧它才能让"六刀"不把整轮循环拖得比三刀还长
  slashMarksRage: [375, 750, 1125, 1525, 1755, 1985],
  slashRewindMs: 375,
  slashCastMs: 1700,   // atk2 全长 13 帧 @8fps = 1625ms，留一点缓冲
  slashCastMsRage: 2200, // 两轮：最后一刀在 1985ms
  slashDoubleAt: 0.75, // rage 到这条线，三段劈斩变两轮六刀。
                       // 巫妖王的 rage 上限只到 1.1（第 2 张图），
                       // 用骷髅王那条 1.0 的线要打到 104 秒才触发，太晚
  summonMarkMs: 450,   // atk3 播到第几毫秒爆白光、召唤小巫妖（第 5 帧 @9fps = 444ms）
  summonCastMs: 800,   // atk3 全长 7 帧 @9fps = 778ms
  // 最后一发落雷之后的收尾时长。不需要等它真的劈下来 ——
  // 落雷是独立于状态机跑的（updateLichBolts 在主循环里），
  // 状态机等它只会白等，把"越打越快"的循环拖长
  boltTailMs: 200,
  waveLifeMs: 2600,
  minionWaveLifeMs: 2200,
  deathMs: 1500,
  // 挨打抖一下（用 hurt 图集）。和飞骑同一套机制，见 damageBoss
  flinchMs: 220,
  flinchGapMs: 760,

  /* ---- 节奏类：按 rage 在"温和端 → 狂暴端"之间线性插值 ----
     两端刻意拉得比骷髅王开得多：巫妖王只在第 2 张图出场，
     rage 只到 1.1 / 1.8（插值权重 k≈0.61，也就是说狂暴端只能吃到六成），
     端点不拉到极限就感觉不到"越打越凶" —— 悬停 1400 → 140，
     全程实际能拿到的缩短量才 1400 - (1400-1260×0.61) ≈ 770ms */
  hoverMs: 1400, hoverMsRage: 140,             // 两次出招之间的漂浮停顿
  waveWindMs: 620, waveWindMsRage: 170,        // 甩大月牙前的转向蓄力（前摇）
  waveCount: 1, waveCountRage: 2,              // 一次甩几道大月牙
  waveSpeed: 250, waveSpeedRage: 340,
  slashWindMs: 700, slashWindMsRage: 180,      // 三段劈斩前的前摇
  slashSpeed: 400, slashSpeedRage: 540,
  minionCount: 3, minionCountRage: 7,          // 一次召唤几只小巫妖
  minionFireMs: 1700, minionFireMsRage: 1000,  // 小巫妖的射击间隔
  minionLifeMs: 9000, minionLifeMsRage: 6200,  // 小巫妖活多久自己消失
  minionSpeed: 44, minionSpeedRage: 68,        // 小巫妖朝玩家漂的速度
  minionWaveSpeed: 260, minionWaveSpeedRage: 330,
  boltCount: 3, boltCountRage: 5,              // 一轮几道落雷
  boltGapMs: 380, boltGapMsRage: 150,          // 落雷之间的间隔
  boltWarnMs: 620, boltWarnMsRage: 400,        // 落雷的预警时长（这就是它的前摇）
  boltR: 40,                                   // 落雷判定半径（判定时再 + 玩家半径容差）
  boltFlashMs: 150,                            // 劈下来之后那道光柱的余韵

  /* ---- 下面这几个是"表演节奏"，不参与狂暴 ---- */
  // 一次甩几道大月牙时，每道之间错开多久。不靠"一次同时出"，
  // 而是让它们一前一后飞出去 —— 同时出会变成一坨，玩家读不出是两道
  waveStaggerMs: 240,
  landDropMs: 420,      // B 段收尾的落地姿态总时长（Land 图集 4 帧 @10fps = 400ms）
  landShockAtMs: 300,   // 落地姿态播到这一毫秒才真的砸地
  landShockR: 120,      // B 段落地的小冲击波。比出场那个 170 还小 ——
                        // 这一下是"节奏重音"，不是杀招，不该逼玩家每次都跑
};

/* 巫妖王"处于漂浮高度"的状态集合。
   在里面的状态，本体会停在地面线上方 floatUp×scale 处并轻轻起伏；
   不在里面的（落地 / 砸地 / 飘起 / 天降）由状态自己管 y。
   单独列一张表而不是在 updateLichFloat 里写一长串 || —— 加状态时漏一个，
   表现就是"这个招式里巫妖王突然落地了"，而且很难看出是漏了哪个 */
const LICH_FLOAT_STATES = {
  idle: true, waveWind: true, waveCast: true,
  slashWind: true, slashCast: true, summonWind: true, summonCast: true,
};

/* 巫妖王的三种月牙。
   形状直接复用哥布林那张 `goblin-wave`（66×12 的细月牙，逐字节校验过），
   只改**非等比缩放 + 冰蓝染色** ——
   为什么不从巫妖王自己的 Attack01 / Attack02 里抠：那两帧的月牙大到撑满整帧、
   被帧边界裁掉（实测 Attack01 那道的包围盒是 68×73，比 80×80 的帧还大），
   而且和剑刃叠在一起，抠出来必然缺一块。骷髅王的砍影当初就是因为同样的原因
   改成程序化绘制的，这里沿用同一条思路。

   三档尺寸（乘完缩放后的屏幕尺寸）：
     big    大月牙波（atk1）：102×25，又宽又厚
     blade  竖月牙（atk2）：129×15，细长，立起来像一把刀刃
     mini   小月牙（小巫妖王）：56×14，比玩家的判定圈（直径 34）大一点，躲得掉

   spin 决定长轴朝向，这是"大月牙"和"竖月牙"能一眼分清的**唯一**依据 ——
   两档要是写成同一个值，玩家只会觉得"同一招放了两次"：
     across —— 长轴 ⊥ 飞行方向（和哥布林反月牙同一套）。宽弧波推过来
     along  —— 长轴 ∥ 飞行方向。巫妖王朝下方的玩家劈下去时，
               129px 的长轴正好立在屏幕上，像一把竖着的刀锋横扫过来

   三个的 axis0 都是 0（goblin-wave 的长轴在纹理帧内是水平的）。 */
const LICH_WAVE = {
  big:   { tex: 'goblin-wave', tint: 0x9fe8ff, sx: 1.55, sy: 2.10, halfW: 33, halfH: 6, axis0: 0, spin: 'across' },
  blade: { tex: 'goblin-wave', tint: 0xd8f4ff, sx: 1.95, sy: 1.25, halfW: 33, halfH: 6, axis0: 0, spin: 'along' },
  mini:  { tex: 'goblin-wave', tint: 0x9fe8ff, sx: 0.85, sy: 1.15, halfW: 33, halfH: 6, axis0: 0, spin: 'across' },
};

/* 小巫妖王（atk3 召唤出来的杂兵）。
   用户要求：随机位置召唤、只发射小月牙波、一滴血、过一段时间自己消失。
   它们是"会追着玩家飘的炮台"，不是冲脸的怪 —— 所以三条纪律：
     · 不进 enemies 的绕场循环（updateEnemies 里按 isMinion 跳过）
     · 不撞人掉血（onEnemyHitsPlayer 里按 isMinion 跳过）——
       用户明确说它们"只会发射小月牙波"，被一只主动飘过来的东西撞死会很难受
     · 但可以被玩家打死，也吃爆炸 / 冲击波 —— 它们就挂在 enemies 组里，
       子弹 / 爆炸 / 冲击波那三条判定全是白捡的（和 BOSS 本体同一个套路） */
const LICH_MINION = {
  scale: 0.85,      // 帧 80px、本体 35×55 → 屏幕上 30×47，比玩家（34）大一点
  bodyR: 14,
  bodyUp: 26,
  floatUp: 8,       // 和本体一样飘 8px
  standoff: 150,    // 离玩家近于这个距离就不再往前飘，免得糊在玩家脸上
  hp: 1,
  score: 30,
};


const BOSS = {
  name: '骷 髅 王',
  scale: 3.0,           // 本体约 29px 宽 → 屏幕上约 87px，玩家（34px）的两倍半
  bodyR: 13,            // 物理半径，单位是"帧内像素"（会被 sprite 缩放再乘一次，见 spawnBossBody）
  bodyUp: 15,           // 物理圆心比地面线高多少（帧内像素），让判定圈罩住躯干而不是脚
  hpBase: 180,          // 240 → 180：第 1 张图的 BOSS 是教学关（教会你躲弹幕/冲击波/月牙），不是筛人关
  hpPerMap: 280,        // 260 → 280：第 1 张图让出去的血量，在第 2 / 3 张图补回来
  scorePerHp: 5,        // 每打掉 1 点血给的分 —— 打 boss 本身也是刷分手段
  killScore: 1200,

  /* ---- 跟动画帧硬对齐的固定值，不参与狂暴 ----
     这几个改了动作就和动画错位（比如 shockAtMs 必须落在 atk3 第 9 帧上），
     所以狂暴只驱动下面那组"节奏类"参数 */
  telegraphMs: 1150,    // 黑影从无到最大（950 → 1150：给玩家足够时间走到安全位）
  fallMs: 660,          // 从天而降的位移时长（520 → 660，下落看得更清楚）
  landMs: 480,          // 落地姿态（4 帧 @12fps = 333ms，剩下的时间定住最后一帧）
  shockAtMs: 620,       // 砸地动画播到第几毫秒时放冲击波（对齐 atk3 第 9 帧）
  // 落地冲击波半径。提到表里而不是写在 updateBoss 里，是为了让
  // "巫妖王的出场冲击波比骷髅王小"这件事**可被断言** ——
  // 原来 300 是硬编码在 case 'smash' 里的，两边根本没法比较
  shockR: 300,
  smashMs: 923,         // atk3 全长 12 帧 @13fps
  spinSpeed: 200,       // 弹幕飞行速度
  slashSpeed: 440,
  slashLifeMs: 1700,
  jumpBackMs: 620,
  deathMs: 1500,

  /* ---- 节奏类：每个值都有"温和"和"狂暴"两端，中间按 rage 线性插值 ----
     温和端是 BOSS 一登场（rage=0）时的取值，狂暴端是 rage 拉满时的取值。
     第 1 张图开局全取温和端，所以新手面对的是一个慢一倍的 BOSS；
     第 3 张图打满时全取狂暴端，弹幕密度是开局的 3 倍以上。
     插值在 refreshBossTune() 里算，结果缓存在 this.bossTune */
  idleMs: 1150,            // 动作之间的停顿。原来 620 —— 人的反应约 250ms，
  idleMsRage: 640,         // 加上移动到位还要 300~500ms，620 根本不够新手反应
  outIdleMs: 1050,         // 走到场外后的待机
  outIdleMsRage: 580,
  spinWaves: 3,            // 旋转弹幕波数（原来固定 4）
  spinWavesRage: 6,
  spinGapMs: 620,          // 波间隔。原来 420 太密，玩家来不及挪位就吃第二圈
  spinGapMsRage: 420,
  spinBullets: 10,         // 每波弹数（原来 12）
  spinBulletsRage: 16,
  walkSpeed: 190,          // 走位速度。这段路同时是玩家的输出窗口，走得越快窗口越短
  walkSpeedRage: 290,
  // 劈砍时间点（对齐 atk1 的帧）。atk1 已从 13fps 降到 10fps（全长 1000ms），
  // 所以这些点必须跟着重算：原来 230/660 是按 13fps 的第 3 / 第 8 帧算的。
  // 10fps 下每帧 100ms → 第 3 帧 300ms、第 8 帧 800ms，两刀间隔 430ms → 500ms
  slashMarks: [300, 800],
  // 两轮四刀。第二轮不是"到点才重播"——那会在月牙飞出去的同一下才起手，
  // 看着像凭空冒出来的。提前 slashRewindMs 重播，让"抬镰刀"先被看见
  slashMarksRage: [300, 800, 1500, 2000],
  slashRewindMs: 300,      // 第二轮提前这么久重播 atk1（正好是第 3 帧的位置）
  slashMs: 1100,           // 一轮 10 帧 @10fps = 1000ms，留 100ms 缓冲
  slashMsRage: 2300,       // 两轮的时长（第二轮最后一刀在 2000ms）
};

/* 肉鸽模式的总配置 */
const ROGUE = {
  maps: 3,
  // 每张图的小怪阶段时长。
  // 原来 30/38/46 太短：难度每 20 秒才升一级，30 秒里难度几乎不动（0 级 → 1 级），
  // 玩家感觉不到"压力在爬"，而且攒不够分抽卡就进 BOSS 了
  waveMs: [60000, 75000, 90000],

  /* 抽卡阈值改成递增：第 1 张卡只要 300 分，之后每张多要 150，封顶 900。
     固定 900 的问题是"前松后紧"—— 新手一局只够抽 1 次卡，肉鸽
     "越打越强"的核心循环根本跑不起来。
     按第 1 张图小怪阶段 60 秒能打 600 分上下算，300 分保证第一张图必出卡 */
  buffStepBase: 300,
  buffStepGrow: 150,
  buffStepMax: 900,

  diffPerMap: 5,          // 每张图的难度起点往上抬这么多级（第 1/2/3 张图 = 0 / 5 / 10 级）
  // 图内难度爬升的斜率加成：越后面的图，升级间隔缩得越快。
  // 0.02 意味着第 3 张图的间隔衰减速度约是第 1 张图的 1.8 倍
  diffDecayPerMap: 0.02,

  /* 每张图的 BOSS 是谁。第 1 张是哥布林飞骑（飞行 + 三连猛冲 + 反月牙），
     第 2 张是巫妖王（漂浮 + 大月牙 / 竖劈 / 召唤 + 落雷），
     最后一张才是骷髅王。三只 BOSS 走同一套状态机外壳
     （bossState / bossT / bossTune / 血条 / 死亡结算），
     只是 enterBossState / updateBoss / playBossAnim 里按 bossKind 分流 */
  bossKind: ['goblin', 'lich', 'skull'],

  /* BOSS 狂暴系数：
       rage = rageBase[图] + min(1, 缠斗秒数 / rageSpanMs) × rageSlope[图]
     图基准让第 2 / 3 张图的 BOSS 一登场就比上一张凶；
     斜率让越后面的图在图内涨得越猛。三张图分别能到 0.5 / 1.1 / 1.7 */
  rageSpanMs: 120000,     // 单场 BOSS 缠斗多久把"图内进度"拉满
  rageBase: [0, 0.35, 0.70],
  rageSlope: [0.5, 0.75, 1.0],
  rageMax: 1.8,
  rageFourSlashAt: 1.0,   // 骷髅王：狂暴到这条线，场外劈砍从两刀变两轮四刀

  strongBase: 0.15,               // 打完 boss 时强力卡的基础概率
  strongPerStep: 0.07,            // 积分每多跨一个 buffStep，强力卡概率再加
  strongMax: 0.85,
};

/* 增幅卡池。
   tier 1 = 阶段增幅（攒够积分就弹，数值温和）；
   tier 2 = BOSS 增幅（打完 boss 才进池，数值明显更狠，出现率随积分上涨）。
   mod 里的键都是乘区 / 加区，同一张卡可以重复获得，叠起来不会互相覆盖。
   icon 用单个汉字而不是符号字形 —— 符号字体在部分系统上缺字会显示成方框 */
const ROGUE_BUFFS = [
  { key: 'dmg',    tier: 1, name: '火力增幅', icon: '力', color: 0xff8a4a,
    desc: '子弹伤害 +18%', mod: { dmgMul: 1.18 } },
  { key: 'rate',   tier: 1, name: '急速射击', icon: '速', color: 0x4ac2ff,
    desc: '射速 +14%', mod: { intervalMul: 0.86 } },
  { key: 'move',   tier: 1, name: '疾风靴',   icon: '风', color: 0x7fffa0,
    desc: '移动速度 +12%', mod: { moveMul: 1.12 } },
  { key: 'bspeed', tier: 1, name: '高速弹',   icon: '迅', color: 0xffe066,
    desc: '子弹飞行速度 +22%', mod: { bspeedMul: 1.22 } },
  { key: 'pierce', tier: 1, name: '穿甲弹',   icon: '穿', color: 0xc2e8ff,
    desc: '子弹穿透 +1', mod: { pierceAdd: 1 } },
  { key: 'life',   tier: 1, name: '生命上限', icon: '命', color: 0xff5c6e,
    desc: '生命上限 +1，并立刻回复 1 点', mod: { lifeAdd: 1 } },
  { key: 'score',  tier: 1, name: '贪婪之眼', icon: '财', color: 0xffd54a,
    desc: '积分获取 +15%', mod: { scoreMul: 1.15 } },
  { key: 'heal',   tier: 1, name: '血祭',     icon: '血', color: 0xd94a4a,
    desc: '每击杀 30 个敌人回复 1 点生命', mod: { healEvery: 30 } },

  { key: 'dmg2',    tier: 2, name: '超载核心', icon: '核', color: 0xff6a2a,
    desc: '子弹伤害 +40%', mod: { dmgMul: 1.40 } },
  { key: 'rate2',   tier: 2, name: '弹幕风暴', icon: '暴', color: 0x4ac2ff,
    desc: '射速 +26%', mod: { intervalMul: 0.74 } },
  { key: 'multi',   tier: 2, name: '三叉戟',   icon: '叉', color: 0x8fd0ff,
    desc: '每次射击额外增加 1 条弹道', mod: { multiShot: 1 } },
  { key: 'pierce2', tier: 2, name: '弑神穿透', icon: '贯', color: 0xc2e8ff,
    desc: '穿透 +3，子弹飞行速度 +20%', mod: { pierceAdd: 3, bspeedMul: 1.2 } },
  { key: 'life2',   tier: 2, name: '不灭之躯', icon: '恒', color: 0xff5c6e,
    desc: '生命上限 +2，并立刻回复 2 点', mod: { lifeAdd: 2 } },
  { key: 'boss2',   tier: 2, name: '弑神之刃', icon: '刃', color: 0xff9a6a,
    desc: '对 BOSS 造成的伤害 ×1.8', mod: { bossDmgMul: 1.8 } },
  { key: 'boom',    tier: 2, name: '亡者烙印', icon: '爆', color: 0xff7a2a,
    desc: '击杀敌人时有 22% 概率引发爆炸', mod: { boomChance: 0.22 } },
  { key: 'crit',    tier: 2, name: '混沌弹',   icon: '混', color: 0xffd54a,
    desc: '命中时 18% 概率造成 2.5 倍伤害', mod: { critChance: 0.18 } },
  { key: 'heal2',   tier: 2, name: '血怒',     icon: '怒', color: 0xd94a4a,
    desc: '每击杀 12 个敌人回复 1 点生命', mod: { healEvery: 12 } },
  { key: 'phantom', tier: 2, name: '幻影步',   icon: '影', color: 0x7fffa0,
    desc: '移动速度 +22%，受击后的无敌时间 +60%', mod: { moveMul: 1.22, invMul: 1.6 } },
];

/* 特殊兵权重加成上限：普通权重合计 82，特殊合计 13
   → 出现率 13.7% 起步，封顶 19.5/101.5 ≈ 19.2% */
const SPECIAL_BONUS_MAX = 1.5;

