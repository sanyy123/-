// ===== DOM 引用 =====
const canvas = document.getElementById('gameCanvas');
// 用 let 而非 const：棋盘缓存构建时需要临时把绘制目标切到离屏画布，
// 构建完会在 finally 里切回主画布。除此之外 ctx 始终指向主画布 2D 上下文。
let ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const score2El = document.getElementById('score2');
const score2Stat = document.getElementById('score2Stat');
const highScoreEl = document.getElementById('highScore');
const lengthEl = document.getElementById('length');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMsg = document.getElementById('overlayMsg');
const startBtn = document.getElementById('startBtn');
const achieveListEl = document.getElementById('achieveList');
const achieveCountEl = document.getElementById('achieveCount');
const achieveToast = document.getElementById('achieveToast');
const toastIcon = document.getElementById('toastIcon');
const toastName = document.getElementById('toastName');
const achieveModal = document.getElementById('achieveModal');
const musicBtn = document.getElementById('musicBtn');
const skinBtn = document.getElementById('skinBtn');
const skinModal = document.getElementById('skinModal');
const skinListEl = document.getElementById('skinList');
const catModeBtn = document.getElementById('catModeBtn');
const obsModeBtn = document.getElementById('obsModeBtn');
const guideBtn = document.getElementById('guideBtn');
const guideModal = document.getElementById('guideModal');
const guideNavEl = document.getElementById('guideNav');
const guideContentEl = document.getElementById('guideContent');
const dualSkinModal = document.getElementById('dualSkinModal');
const dualSkinTitle = document.getElementById('dualSkinTitle');
const dualPageBoard = document.getElementById('dualPageBoard');
const dualPageSnake = document.getElementById('dualPageSnake');
const dualBoardGrid = document.getElementById('dualBoardGrid');
const dualP1Grid = document.getElementById('dualP1Grid');
const dualP2Grid = document.getElementById('dualP2Grid');
const dualNextBtn = document.getElementById('dualNextBtn');
const closeDualSkinBtn = document.getElementById('closeDualSkin');
const shopModal = document.getElementById('shopModal');

const LOGICAL_SIZE = 600, GRID = 20, COLS = 30, ROWS = 30;
// ★ dpr 上限锁 2。
//   棋盘逻辑尺寸固定 600×600，每帧都要把整块底图缩放贴到画布上。
//   iPhone 的 dpr 是 3，画布后备缓冲会变成 1800×1800（324 万像素），
//   每帧一次全屏缩放贴图 + 几十次绘制，中低端机直接掉到 30fps 以下。
//   锁到 2 后像素量降到 44%，肉眼几乎看不出差别，帧率明显更稳。
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = LOGICAL_SIZE * dpr;
canvas.height = LOGICAL_SIZE * dpr;
ctx.scale(dpr, dpr);

// ===== 全局状态 =====
// gameMode 取值：'single' 单人 | 'double' 双人对战 | 'coop' 合作模式（双人共享生命）
let gameMode = 'single';
// ★ 合作模式：两人共用的剩余生命数。任意一条蛇死亡扣 1，扣到 0 才真正结束
let sharedLives = 0;
const COOP_LIVES = 3;
// ★ 合作模式复活塞：记录每条蛇的出生点与初始朝向，死亡后按原样重置
const COOP_SPAWN = {
  p1: { x: 5,  y: 5,  dir: { x: 1,  y: 0 } },
  p2: { x: 24, y: 24, dir: { x: -1, y: 0 } }
};
let snakes = [];
let food = { x: 0, y: 0 };
let score = 0, highScore = 0;
let maxLengthReached = 3;
let maxComboReached = 0;
let foodsEaten = 0;
let survivalTime = 0;
let fastEats = 0;
let cornerEaten = new Set();
let totalScoreAccum = 0;

// ===== 种子局系统 =====
let currentSeedId = null;
let gameRng = Math.random;

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ===== 商城 / 铜钱 / 道具 =====
// 统一走 SaveManager 读取，读取失败/数据损坏时自动回退默认值，不会把 NaN 带进游戏
const SM = window.SaveManager;
if (!SM) console.error('[存档] SaveManager 未加载，请检查 save.js 是否在 game.js 之前引入');
const COIN_MAX = 99999999;   // 铜钱上限，防止脏数据导致显示溢出

let coins = SM.getInt(COINS_KEY, 0, 0, COIN_MAX);

// 背包校验：必须是对象，且每个道具数量都得是合法的非负整数
function readInventory(key) {
  const raw = SM.getJSON(key, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const validIds = SHOP_ITEMS.map(i => i.id);
  const clean = {};
  Object.keys(raw).forEach(id => {
    if (!validIds.includes(id)) return;                 // 丢掉不认识的道具
    const n = parseInt(raw[id], 10);
    if (Number.isFinite(n) && n > 0) clean[id] = Math.min(n, 999); // 数量钳制
  });
  return clean;
}

let inventory = readInventory(INVENTORY_KEY);
// 装备项必须是合法道具 id，否则视为未装备
function readEquipped(key) {
  const id = SM.getString(key, '');
  return SHOP_ITEMS.some(i => i.id === id) ? id : '';
}
let equippedItem = readEquipped(EQUIPPED_KEY);

let inventoryP1 = readInventory(INVENTORY_P1_KEY);
let inventoryP2 = readInventory(INVENTORY_P2_KEY);
let equippedItemP1 = readEquipped(EQUIPPED_P1_KEY);
let equippedItemP2 = readEquipped(EQUIPPED_P2_KEY);

let thisRunHasLuopan = false;
let thisRunHasLuopanP1 = false;
let thisRunHasLuopanP2 = false;
// ★ 已移除 thisRunRecordHintShown，改用实时判断

function saveCoins() { SM.safeSet(COINS_KEY, String(coins)); }
function saveInventory() { SM.setJSON(INVENTORY_KEY, inventory); }
function saveInventoryP1() { SM.setJSON(INVENTORY_P1_KEY, inventoryP1); }
function saveInventoryP2() { SM.setJSON(INVENTORY_P2_KEY, inventoryP2); }

// ===== 数据统计 =====
// 逐字段校验：任何一项损坏都只重置那一项，不会整份统计归零
let stats = (() => {
  const saved = SM.getJSON(STATS_KEY, {});
  const src = (saved && typeof saved === 'object' && !Array.isArray(saved)) ? saved : {};
  const n = (v, d, min) => {
    const x = parseInt(v, 10);
    if (!Number.isFinite(x)) return d;
    return (min !== undefined && x < min) ? min : x;
  };
  const arr = (v) => Array.isArray(v) ? v.filter(x => Number.isFinite(x)) : [];
  const sd = (src.deaths && typeof src.deaths === 'object' && !Array.isArray(src.deaths)) ? src.deaths : {};
  return {
    totalGames:      n(src.totalGames, 0, 0),
    singleGames:     n(src.singleGames, 0, 0),
    doubleGames:     n(src.doubleGames, 0, 0),
    coopGames:       n(src.coopGames, 0, 0),
    totalPlayTime:   n(src.totalPlayTime, 0, 0),
    totalFoodsEaten: n(src.totalFoodsEaten, 0, 0),
    bestLength:      n(src.bestLength, 3, 3),
    bestCombo:       n(src.bestCombo, 0, 0),
    bestSurvivalTime:n(src.bestSurvivalTime, 0, 0),
    bestFoodsEaten:  n(src.bestFoodsEaten, 0, 0),
    catBitesReceived:n(src.catBitesReceived, 0, 0),
    catTrapped:      n(src.catTrapped, 0, 0),
    // ★ 新增：双人 / 合作 / 种子局统计
    doubleWins:      n(src.doubleWins, 0, 0),
    doubleKills:     n(src.doubleKills, 0, 0),
    coopWins:        n(src.coopWins, 0, 0),
    coopPerfectWins: n(src.coopPerfectWins, 0, 0),
    coopBestScore:   n(src.coopBestScore, 0, 0),
    seedGames:       n(src.seedGames, 0, 0),
    seedBestScore:   n(src.seedBestScore, 0, 0),
    seedClears:      arr(src.seedClears),
    deaths: {
      wall:     n(sd.wall, 0, 0),
      self:     n(sd.self, 0, 0),
      other:    n(sd.other, 0, 0),
      cat:      n(sd.cat, 0, 0),
      catBite:  n(sd.catBite, 0, 0),
      obstacle: n(sd.obstacle, 0, 0)
    }
  };
})();
function saveStats() { SM.setJSON(STATS_KEY, stats); }
function classifyDeathReason(reason) {
  if (!reason) return null;
  if (reason.includes('咬断')) return 'catBite';
  if (reason.includes('野猫')) return 'cat';
  if (reason.includes('撞墙')) return 'wall';
  if (reason.includes('咬到自己')) return 'self';
  if (reason.includes('撞到对方')) return 'other';
  if (reason.includes('撞到石头')) return 'obstacle';
  return null;
}

let rafId = null, loopActive = false, lastFrameTs = 0, accumulator = 0;
let isPaused = false, isGameOver = false, isDying = false, speed = 160;
let foodPulse = 0;   // 粒子已改为对象池（见 particlePool / particleCount）
let shakeAmount = 0;
let musicEnabled = true, currentBgmKey = '', bgmRetryTimer = null;
// 作弊解锁的皮肤：只接受合法成就 id，过滤脏数据
const VALID_SKIN_IDS = ACHIEVEMENTS.filter(a => a.id.startsWith('skin_')).map(a => a.id);
let cheatSkins = new Set(SM.getStringArray('snakeCheatSkins', VALID_SKIN_IDS));
let specialFood = null, specialFoodTimer = 0;
const SPECIAL_FOOD_DURATION = 8000;
// ★ 特殊食物持续时间：分数越高越短（8000ms → 5000ms）
function getSpecialFoodDuration() {
  return Math.max(5000, 8000 - Math.floor(score / 200) * 500);
}
let specialFoodCooldown = 0;
let cat = null, catActive = false;
const CAT_ACTIVATE_SCORE = 250;
let catTrail = [], catBiteLosses = 0;
const CAT_BITE_LOSS_LIMIT = 20;
let catModeEnabled = SM.getBool('snakeCatMode', true);
let obstacles = [];
let portals = [];
let portalPairCounter = 0;
let obstacleModeEnabled = SM.getBool('snakeObstacleMode', true);
const OBSTACLE_SCORE = 150, OBSTACLE_MAX = 25;
const PORTAL_SCORE = 200, PORTAL_MAX_PAIRS = 3;
const PORTAL_DURATION = 15000;
const PORTAL_COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a06cd5'];
const WIN_SCORE = 300;

// ★ 棋盘皮肤（全局）+ 双人选择缓存
// 从存档读出来的皮肤 id 必须真实存在，否则回退默认皮肤（避免脏数据导致画面空白）
function readSkinId(key) {
  const id = SM.getString(key, '');
  return SKINS[id] ? id : '';
}
let boardSkinId = readSkinId('snakeBoardSkin') || readSkinId('snakeCurrentSkin') || 'default';
let currentSkinId = boardSkinId;
let p1SkinId = 'default';
let p2SkinId = 'default';
let dualSelectedBoardId = boardSkinId;
let dualSelectedP1 = 'default';
let dualSelectedP2 = 'default';
let dualPage = 'board';

let snake = null, direction = {x:1,y:0}, nextDirection = {x:1,y:0};
let currentPlayer = null;

// ===== 资源 =====
// 所有美术资源统一从本地图集 assets/atlas.png 裁剪，不再使用远程图床图片。
// 每个 key 在 atlas.js 的 window.ATLAS_DATA.frames 中都有对应帧。
const ASSET_KEYS = {
  CAT: 'cat_head',
  TIGER: { head: 'head', body: 'body', food: 'food', leaf: 'leaf' },
  RABBIT: { head: 'rab_head', body: 'rab_body', food: 'rab_food', paw: 'rab_paw' },
  DRAGON: { head: 'dragon_head', decor: 'dragon_decor', food: 'dragon_food', tail: 'dragon_tail' },
  SNAKE: { head: 'snake_head', tail: 'snake_tail', food: 'snake_food', drop: 'snake_drop', leaf: 'snake_leaf' },
  HORSE: { head: 'horse_head', tail: 'horse_tail', food: 'horse_food', decor: 'horse_decor' },
  SHEEP: { head: 'sheep_head', tail: 'sheep_tail', food: 'sheep_food', decor: 'sheep_decor' }
};


// ===== 图集 =====
const atlasImg = new Image();
let atlasData = (typeof window !== 'undefined' && window.ATLAS_DATA) || null;

// 从图集裁剪单帧（处理 trim 偏移）
function drawAtlasFrame(frame, cx, cy, dpx) {
if (!frame || !atlasImg.complete || !atlasImg.naturalWidth) return false;
const fr = frame.frame;
if (!fr) return false;
const src = frame.spriteSourceSize || fr;
const orig = frame.sourceSize || { w: fr.w, h: fr.h };
const s = dpx / orig.w;
const drawW = fr.w * s;
const drawH = fr.h * s;
const offsetX = (src.x + src.w / 2 - orig.w / 2) * s;
const offsetY = (src.y + src.h / 2 - orig.h / 2) * s;
ctx.drawImage(
atlasImg,
fr.x, fr.y, fr.w, fr.h,
cx - drawW / 2 + offsetX,
cy - drawH / 2 + offsetY,
drawW, drawH
);
return true;
}

// 帧查找缓存：drawFromAtlas 每帧被调用几十次（每个身体段一次），
// 每次都要 frames[key] || frames[key+'.png'] 两次哈希查找 + 字符串拼接。
// key 只有固定十几种，缓存后每帧查找降为一次 Map 取值。
// atlasData 由 assets/atlas.js 在 game.js 之前写入 window.ATLAS_DATA，
// 脚本加载后不再变化，因此缓存无需失效；null 结果也一并缓存，避免反复重查。
const atlasFrameLookup = new Map();
function getAtlasFrame(key) {
  if (atlasFrameLookup.has(key)) return atlasFrameLookup.get(key);
  let frame = null;
  if (atlasData && atlasData.frames) {
    frame = atlasData.frames[key] || atlasData.frames[key + '.png'] || null;
  }
  atlasFrameLookup.set(key, frame);
  return frame;
}

// 按 key 从图集查找并绘制（兼容带/不带 .png 的 key）
function drawFromAtlas(key, cx, cy, dpx) {
if (!key) return false;
const frame = getAtlasFrame(key);
if (!frame) return false;
return drawAtlasFrame(frame, cx, cy, dpx);
}

// ★ 咕嘎皮肤专用绘制入口（2026-09-14）
// 那 6 张素材是「从 500×500 大图上裁掉透明边」导出的，各帧长宽比差得很远
// （企鹅全身 216×391、像素女孩 187×188、装饰字 406×337），而 drawAtlasFrame 是按
// sourceSize（500×500）来缩放的 —— 那样算下来这 6 张会被缩得比其它皮肤小一大截，
// 而且两张尾巴图体量还不一样。所以给它们单独一个「最长边对齐到 box」的画法，
// 这样传一个 box 尺寸，6 张素材的视觉大小就自动统一了。
function drawAtlasFrameBox(frame, cx, cy, box) {
if (!frame || !atlasImg.complete || !atlasImg.naturalWidth) return false;
const fr = frame.frame;
if (!fr) return false;
const s = box / Math.max(fr.w, fr.h);
const w = fr.w * s, h = fr.h * s;
ctx.drawImage(atlasImg, fr.x, fr.y, fr.w, fr.h, cx - w / 2, cy - h / 2, w, h);
return true;
}
function drawBoxHelper(key, cx, cy, box) {
if (!key) return false;
const frame = getAtlasFrame(key);
if (!frame) return false;
return drawAtlasFrameBox(frame, cx, cy, box);
}


const audio = new Audio(); audio.loop = true; audio.volume = 0.45; audio.preload = 'auto';
audio.addEventListener('ended', () => { if (musicEnabled && currentBgmKey) { audio.currentTime = 0; audio.play().catch(()=>{}); } });
// 加载失败重试：最多 3 次。原来是无上限重试，一旦 bgm 文件缺失（比如部署时漏传目录）
// 就会每 1.5 秒重试一次、永远不停。
let bgmRetryCount = 0;
audio.addEventListener('error', () => {
  if (!musicEnabled || !currentBgmKey) return;
  if (bgmRetryCount >= 3) return;
  bgmRetryCount++;
  clearTimeout(bgmRetryTimer);
  bgmRetryTimer = setTimeout(() => {
    const url = BGM[currentBgmKey];
    if (url) { audio.src = url; audio.play().catch(()=>{}); }
  }, 1500);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && musicEnabled && currentBgmKey && audio.paused) audio.play().catch(()=>{}); });
// 切换 BGM。
// ★ 关键：同一首时只确保它在播，绝不重新赋 src —— 重新赋值会让浏览器丢弃已解码的音频、
//   从头再下一次，这正是"切阶段 / 切页面时音乐卡一下"的来源。
function playBgm(key) {
  if (!musicEnabled || !BGM[key]) return;
  if (key === currentBgmKey) {
    if (audio.paused) { const p = audio.play(); if (p) p.catch(()=>{}); }
    return;
  }
  currentBgmKey = key;
  bgmRetryCount = 0;
  audio.src = BGM[key];   // 赋 src 本身就会触发加载，不必再调 load()
  const p = audio.play();
  if (p) p.catch(()=>{});
}
function stopBgm() { audio.pause(); currentBgmKey = ''; }
// BGM 阶段。
// ★ 单人看 score；双人/合作模式下 score 只代表 P1（其余玩家的分不写进它），
//   所以取场上最高分来判断，否则双人局会永远停在 stage0、音乐不随进度升燃。
function getGameStageKey() {
  let s = score;
  if (gameMode !== 'single' && snakes.length > 0) {
    for (let i = 0; i < snakes.length; i++) {
      const ps = snakes[i].score || 0;
      if (ps > s) s = ps;
    }
  }
  return s >= 600 ? 'stage2' : (s >= 250 ? 'stage1' : 'stage0');
}
function updateGameBgm() { if (musicEnabled && !isGameOver && !isPaused) playBgm(getGameStageKey()); }

// 成就列表：只保留真实存在的成就 id（防止脏数据让"已解锁 3/19"这类数字失真）
const VALID_ACHIEVE_IDS = ACHIEVEMENTS.map(a => a.id);
let unlocked = SM.getStringArray(ACHIEVE_KEY, VALID_ACHIEVE_IDS);
highScore = SM.getInt(HIGH_KEY, 0, 0, 99999999);
totalScoreAccum = SM.getInt(TOTAL_KEY, 0, 0, 999999999);
highScoreEl.textContent = highScore;
// ★ 称号解锁列表（只保留合法 id，防止脏数据）
const VALID_TITLE_IDS = TITLES.map(t => t.id);
let unlockedTitles = SM.getStringArray(TITLES_KEY, VALID_TITLE_IDS);
// ★ 当前佩戴的称号：必须已解锁，否则视为未佩戴
let equippedTitle = SM.getString(EQUIPPED_TITLE_KEY, '');
if (!unlockedTitles.includes(equippedTitle)) equippedTitle = '';

// ★ 称号解锁检查：与成就同节奏，在游戏结束时统一调用
function checkTitles() {
  let newly = [];
  TITLES.forEach(t => {
    if (unlockedTitles.includes(t.id)) return;
    try {
      if (t.check()) { unlockedTitles.push(t.id); newly.push(t); }
    } catch (e) { console.warn('称号检查失败:', t.id, e); }
  });
  if (newly.length) {
    SM.setJSON(TITLES_KEY, unlockedTitles);
    newly.forEach((t, i) => setTimeout(() => showTitleToast(t), i * 1500));
  }
  return newly.length;
}

// ★ 称号解锁提示（独立于成就 toast，避免同屏重叠）
function showTitleToast(title) {
  const toast = document.createElement('div');
  toast.className = 'title-toast tier-' + title.tier;
  toast.innerHTML =
    '<div class="tt-icon">🏅</div>' +
    '<div class="tt-text"><h4>称号解锁</h4><p>' + title.name + '</p></div>';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 2600);
}
function saveAchievements() {
  SM.setJSON(ACHIEVE_KEY, unlocked);
  SM.safeSet(TOTAL_KEY, String(totalScoreAccum));
}

// 最高分统一入口：只在真正破纪录时写盘并刷新界面
// （种子局与双人模式不参与普通最高分，由调用处过滤）
function updateHighScore(newScore) {
  if (gameMode !== 'single' || currentSeedId !== null) return;
  const s = parseInt(newScore, 10);
  if (!Number.isFinite(s) || s <= highScore) return;
  highScore = s;
  if (highScoreEl) highScoreEl.textContent = highScore;
  SM.safeSet(HIGH_KEY, String(highScore));
}

const BASE_SPEED = 160, MIN_SPEED = 60;
function calcSpeed() {
  // ★ 分数越高，速度衰减越快（每 50 分加速步长从 6ms 提到 7ms）
  const step = Math.floor(score / 50);
  const extra = score >= 500 ? Math.floor((score - 500) / 100) * 2 : 0;
  return Math.max(MIN_SPEED, BASE_SPEED - step * 6 - extra);
}
function vibrate(pattern) {
  if (!navigator.vibrate) return;
  try {
    setTimeout(() => { try { navigator.vibrate(pattern); } catch(e) {} }, 0);
  } catch (e) {}
}

// ===== 吃食物音效 =====
// 为什么原来的 <audio> 元素池在手机上会"慢半拍"：
//   1) 移动端 snd.currentTime = 0 是一次**异步 seek**，紧跟其后的 play() 必须等 seek 完成；
//   2) iOS/Android 对同时活跃的 <audio> 元素数量有硬限制，池子越大越容易排队；
//   3) 每次改 playbackRate 都要让音频管线重新处理一遍。
// 三者叠加，就是"吃到食物，声音晚一拍"。
// 改用 Web Audio：音频预解码成 AudioBuffer 常驻内存，播放只需新建一个极轻量的
// SourceNode，从调用到出声通常 < 5ms，且没有并发数限制。
// 老浏览器或解码还没完成时，自动退回原来的 <audio> 池，保证一定有声音。
const SFX_URLS = { eat1: './eat1.mp3', eat2: './eat2.mp3' };
const EAT_POOL_SIZE = 6;
const eatPool = { normal: [], special: [] };
let eatPoolIdx = 0;
let eatPoolReady = false;

// 兜底音频池改为"按需创建"：Web Audio 正常工作时，移动端就不必常驻 12 个 <audio> 元素
function ensureEatPool() {
  if (eatPoolReady) return;
  eatPoolReady = true;
  for (let i = 0; i < EAT_POOL_SIZE; i++) {
    const a1 = new Audio('./eat1.mp3'); a1.preload = 'auto'; a1.volume = 0.5;
    const a2 = new Audio('./eat2.mp3'); a2.preload = 'auto'; a2.volume = 0.5;
    eatPool.normal.push(a1);
    eatPool.special.push(a2);
  }
}

let audioCtx = null;
const sfxBuffers = { eat1: null, eat2: null };

function getAudioCtx() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { audioCtx = new AC(); } catch (e) { audioCtx = null; }
  return audioCtx;
}

// decodeAudioData 在新浏览器返回 Promise，老 Safari 只认回调 —— 两种写法都兼容
function decodeAudio(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (b) => { if (!settled) { settled = true; resolve(b); } };
    const fail = (e) => { if (!settled) { settled = true; reject(e); } };
    const ret = ctx.decodeAudioData(arrayBuffer, done, fail);
    if (ret && typeof ret.then === 'function') ret.then(done, fail);
  });
}

// 预解码音效（每个文件只做一次）。在首次用户交互后调用，避开浏览器自动播放限制。
function preloadSfx() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  Object.keys(SFX_URLS).forEach(key => {
    if (sfxBuffers[key]) return;
    fetch(SFX_URLS[key])
      .then(r => r.arrayBuffer())
      .then(buf => decodeAudio(ctx, buf))
      .then(decoded => { sfxBuffers[key] = decoded; })
      .catch(() => {});   // 失败无所谓，后续自动走 <audio> 兜底
  });
}

// 用已解码的 AudioBuffer 播一声；成功返回 true
function playSfxBuffer(key, rate, volume) {
  const ctx = getAudioCtx();
  const buf = sfxBuffers[key];
  if (!ctx || !buf) return false;
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
    return true;
  } catch (e) {
    return false;
  }
}

// 首次用户交互：解锁音频上下文 + 预解码音效
let sfxUnlocked = false;
function unlockSfx() {
  if (sfxUnlocked) return;
  sfxUnlocked = true;
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  preloadSfx();
}
document.addEventListener('touchstart', unlockSfx, { once: true, passive: true });
document.addEventListener('mousedown', unlockSfx, { once: true });
document.addEventListener('keydown', unlockSfx, { once: true });

function playEatSound(playerId, isSpecial, comboCount) {
  const key = isSpecial ? 'eat2' : 'eat1';
  const comboPitch = 1 + Math.min((comboCount || 0), 10) * 0.05;
  const rate = (playerId === 'p2' ? 1.15 : 1.0) * comboPitch;

  // 主路径：Web Audio，几乎零延迟
  if (playSfxBuffer(key, rate, 0.5)) return;

  // 兜底路径：Web Audio 不可用 / 还没解码完，退回 <audio> 池
  try {
    ensureEatPool();
    const pool = isSpecial ? eatPool.special : eatPool.normal;
    const snd = pool[eatPoolIdx % EAT_POOL_SIZE];
    eatPoolIdx++;
    snd.currentTime = 0;
    snd.playbackRate = rate;
    const p = snd.play();
    if (p) p.catch(() => {});
  } catch (e) {}
}
document.addEventListener('touchstart', () => { try { if (navigator.vibrate) navigator.vibrate(1); } catch(e) {} }, { once: true });

// 统一的素材绘制入口：传入图集 key，从本地图集裁剪出对应画面。
// 图集未就绪或该帧缺失时返回 false，调用方用矢量图形兜底。
function drawImageHelper(key, cx, cy, dpx) {
return drawFromAtlas(key, cx, cy, dpx);
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function isWarmSkin(skinId) { return ['shu','niu','hu','tu','long','she','ma','yang','hou','ji','gou','zhu','guga'].includes(skinId); }

function createPlayer(id, headColors, bodyHue, startX, startY, startDir, skinId) {
const body = [{x:startX, y:startY}];
for (let i = 1; i <= 2; i++) {
  body.push({ x: startX - startDir.x * i, y: startY - startDir.y * i });
}
return {
  id: id, body: body,
  dir: {...startDir}, nextDir: {...startDir},
  // 待执行方向队列（手机滑动 / 方向键快速连转时防止丢指令，见 setDirection）
  dirQueue: [],
  alive: true, score: 0,
  headColors: headColors, bodyHue: bodyHue,
  shield: false, speedBoost: 0,
  ghostTrail: [],
  foodsEaten: 0, maxLen: 3, survivalTime: 0, fastEats: 0,
  cornerEaten: new Set(),
  skinId: skinId || 'default',
  comboCount: 0,
  comboTimer: 0,
  maxCombo: 0,
  hasXuming: false,
  xumingUsed: false,
  invincibleUntil: 0,
  speedMultiplier: 1,
  niuShieldLeft: 0,
  hasRevive: false,
  reviveUsed: false,
  ghostLeft: 0,
  ghostMode: false,
  ghostUntil: 0,
  phantomLeft: 0,
  phantomUntil: 0,
  phantomData: null,
  longLeft: 0,
  longCdUntil: 0,
  longHitCatCount: 0,
  longFireUntil: 0,
  longFireCells: null,
  yangLeft: 0,
  coopWaiting: false   // ★ 合作模式复活等待：true 时停在出生点不动，等玩家按方向
};
}

function applySkinPassive(p) {
  if (!p) return;
  if (p.skinId === 'tu') p.speedMultiplier = 1.1;
  if (p.skinId === 'niu') p.niuShieldLeft = isSkinAwakened('niu') ? 5 : 3;
  if (p.skinId === 'ma') { p.hasRevive = true; p.reviveUsed = false; }
  if (p.skinId === 'she') { p.ghostLeft = 3; }
  if (p.skinId === 'hu') { p.phantomLeft = 2; }
  if (p.skinId === 'long') { p.longLeft = 2; }
  if (p.skinId === 'yang') { p.yangLeft = 3; }
}

// ★ 咕嘎皮肤：吃到食物时蛇会长一节。这个引擎里"长出来"的那一节就是数组的最后一节
//   （先 unshift 加新头，不吃才 pop，所以吃的那一步尾巴原地留下 = 多出来的一节）。
//   用户要的就是「每次尾部变长的那一节随机出现」，所以在这一节上重掷一次随机图。
//   ⚠️ 必须用 Math.random，不能用 gameRng —— gameRng 是种子局共用的随机流，
//   多消耗一个数会改变后续食物/石头的落点，把固定地图和排行榜成绩全打乱。
function rerollGugaTail(snakeArr) {
  if (!snakeArr || snakeArr.length === 0) return;
  const tailSeg = snakeArr[snakeArr.length - 1];
  if (tailSeg) tailSeg.tex = Math.random() < 0.5 ? 0 : 1;
}

function startLoop() { stopLoop(); lastFrameTs=0; accumulator=0; loopActive=true; rafId=requestAnimationFrame(frame); }
function stopLoop() { loopActive=false; if (rafId) { cancelAnimationFrame(rafId); rafId=null; } }
function frame(timestamp) {
if (!loopActive) return;
if (!lastFrameTs) lastFrameTs = timestamp;
let delta = timestamp - lastFrameTs;
lastFrameTs = timestamp;
if (delta > 100) delta = 100;
// 用 for 而不是 forEach：这里是每帧都跑的热路径，省掉每帧一个闭包分配
for (let i = 0; i < snakes.length; i++) { const p = snakes[i]; if (p.speedBoost > 0) p.speedBoost -= delta; }
if (!isPaused && !isGameOver) {
accumulator += delta;
const curSpeed = speed;
let steps = 0;
while (accumulator >= curSpeed && steps < 5) { update(); accumulator -= curSpeed; steps++; if (isGameOver) break; }
if (steps >= 5) accumulator = 0;
}
updateParticles(); draw();
if (loopActive && (!isGameOver || isDying)) { rafId = requestAnimationFrame(frame); } else { stopLoop(); }
}

function initGame() {
// ★ 种子模式：强制猫/障碍开关
if (currentSeedId !== null) {
  const seedLevel = SEED_LEVELS.find(s => s.id === currentSeedId);
  if (seedLevel) {
    catModeEnabled = seedLevel.hasCat;
    obstacleModeEnabled = seedLevel.hasObstacle;
  }
}
snakes = [];
if (gameMode === 'single') {
const skinObj = SKINS[boardSkinId] || SKINS.default;
snakes.push(createPlayer('p1', skinObj.headColors || ['#5efce8','#00f5d4','#00bbf9'], skinObj.bodyHue || {r:0,g:235,b:220}, 12, 15, {x:1,y:0}, boardSkinId));
if (scoreEl.parentElement) { const lbl = scoreEl.parentElement.querySelector('.label'); if (lbl) lbl.textContent = '积分'; }
score2Stat.style.display = 'none';
} else {
// ★ 合作模式与双人对战共用同一套出生点与皮肤配置，区别只在于生命结算规则
const s1 = SKINS[p1SkinId] || SKINS.default;
const s2 = SKINS[p2SkinId] || SKINS.default;
snakes.push(createPlayer('p1', s1.headColors || ['#5efce8','#00f5d4','#00bbf9'], s1.bodyHue || {r:0,g:235,b:220}, 5, 5, {x:1,y:0}, p1SkinId));
snakes.push(createPlayer('p2', s2.headColors || P2_HEAD_COLORS, s2.bodyHue || P2_BODY_HUE, 24, 24, {x:-1,y:0}, p2SkinId));
if (scoreEl.parentElement) { const lbl = scoreEl.parentElement.querySelector('.label'); if (lbl) lbl.textContent = 'P1 积分'; }
score2Stat.style.display = 'flex';
score2El.textContent = '0';
}
snakes.forEach(p => applySkinPassive(p));
score = 0; speed = BASE_SPEED;
isPaused = false; isGameOver = false; isDying = false; particleCount = 0;   // 清空粒子（池对象保留复用）
foodPulse = 0; shakeAmount = 0;
accumulator = 0;
cat = null; catActive = false; catTrail = []; catBiteLosses = 0;
specialFood = null; specialFoodTimer = 0; specialFoodCooldown = 0;
obstacles = []; portals = []; portalPairCounter = 0;
obstacleCells.clear();   // 同步清空石头查表，避免残留上一局的坐标
snakes.forEach(p => { p.__cellSet = null; });
maxLengthReached = 3; foodsEaten = 0; survivalTime = 0; fastEats = 0; cornerEaten = new Set();
maxComboReached = 0;
// ★ 合作模式：每局重置共享生命与复活冷却
sharedLives = COOP_LIVES;
snakes.forEach(p => { p.coopWaiting = false; });
updateCoopLivesHud();
thisRunHasLuopan = false;
thisRunHasLuopanP1 = false;
thisRunHasLuopanP2 = false;
// ★ 每局开始清掉破纪录提示（不显示）
const hintEl0 = document.getElementById('recordHint');
if (hintEl0) hintEl0.classList.remove('show');
scoreEl.textContent = '0'; lengthEl.textContent = '3';
placeFood(); overlay.classList.add('hidden');
updateGameBgm(); renderAchievements();
if (window.__updateSkillBtn) window.__updateSkillBtn();
}

function applyItemToPlayer(player, itemId, which) {
  if (!player || !itemId) return null;
  const item = SHOP_ITEMS.find(x => x.id === itemId);
  if (!item) return null;

  let inv;
  if (which === 'single') inv = inventory;
  else if (which === 'p1') inv = inventoryP1;
  else inv = inventoryP2;

  if (!inv[itemId] || inv[itemId] <= 0) return null;
  inv[itemId]--;
  if (inv[itemId] <= 0) delete inv[itemId];

  if (which === 'single') saveInventory();
  else if (which === 'p1') saveInventoryP1();
  else saveInventoryP2();

  if (itemId === 'fu') {
    player.shield = true;
  } else if (itemId === 'zhaocai') {
    player.score += 30;
    if (which === 'single') {
      score = player.score;
      scoreEl.textContent = player.score;
    } else {
      if (player.id === 'p1') scoreEl.textContent = player.score;
      else score2El.textContent = player.score;
    }
  } else if (itemId === 'jifeng') {
    player.speedBoost = 5000;
  } else if (itemId === 'luopan') {
    if (which === 'single') thisRunHasLuopan = true;
    else if (which === 'p1') thisRunHasLuopanP1 = true;
    else thisRunHasLuopanP2 = true;
  } else if (itemId === 'xuming') {
    player.hasXuming = true;
    player.xumingUsed = false;
  }
  return item;
}

function applyEquippedItem() {
  // ★ 种子模式不消耗道具（公平竞争）
  if (currentSeedId !== null) return;
  if (gameMode === 'single') {
    if (!equippedItem) return;
    const item = applyItemToPlayer(snakes[0], equippedItem, 'single');
    equippedItem = '';
    SM.safeRemove(EQUIPPED_KEY);
    if (item) showCheatToast('✨ 使用了「' + item.name + '」', 700);
  } else {
    const names = [];
    if (equippedItemP1) {
      const item = applyItemToPlayer(snakes[0], equippedItemP1, 'p1');
      if (item) names.push('P1「' + item.name + '」');
      equippedItemP1 = '';
      SM.safeRemove(EQUIPPED_P1_KEY);
    }
    if (equippedItemP2) {
      const item = applyItemToPlayer(snakes[1], equippedItemP2, 'p2');
      if (item) names.push('P2「' + item.name + '」');
      equippedItemP2 = '';
      SM.safeRemove(EQUIPPED_P2_KEY);
    }
    if (names.length) showCheatToast('✨ 使用了 ' + names.join(' · '), 800);
  }
}

function placeFood() {
let valid = false, attempts = 0;
while (!valid && attempts < 500) {
attempts++;
food = { x: Math.floor(gameRng()*COLS), y: Math.floor(gameRng()*ROWS) };
valid = !snakes.some(p => p.body && p.body.some(s => s.x === food.x && s.y === food.y));
if (valid && specialFood) valid = !(specialFood.x === food.x && specialFood.y === food.y);
if (valid && obstacles.some(o => o.x === food.x && o.y === food.y)) valid = false;
if (valid && portals.some(p => p.x === food.x && p.y === food.y)) valid = false;
}
}
function spawnSpecialFood() {
if (specialFood || specialFoodCooldown > 0) return;
let valid = false, sf, attempts = 0;
while (!valid && attempts < 200) {
attempts++;
sf = { x: Math.floor(gameRng()*COLS), y: Math.floor(gameRng()*ROWS), type:'gold' };
const r = gameRng();
if (r < 0.30) sf.type = 'gold';
else if (r < 0.55) sf.type = 'speed';
else if (r < 0.85) sf.type = 'shield';
else sf.type = 'shrink';
valid = !snakes.some(p => p.body && p.body.some(s => s.x === sf.x && s.y === sf.y));
if (valid && food) valid = !(food.x === sf.x && food.y === sf.y);
if (valid && obstacles.some(o => o.x === sf.x && o.y === sf.y)) valid = false;
if (valid && portals.some(p => p.x === sf.x && p.y === sf.y)) valid = false;
}
if (valid) { specialFood = sf; specialFoodTimer = getSpecialFoodDuration(); }
}
function trySpawnObstacle() {
if (!obstacleModeEnabled || score < OBSTACLE_SCORE) return;
// ★ 石头数量上限：300 分 18 块 → 600 分 30 块 → 1000 分 40 块
const maxObstacles = Math.min(45, 10 + Math.floor(score / 30));
if (obstacles.length >= maxObstacles) return;
// ★ 生成概率：分数越高越容易刷石头
const spawnChance = Math.min(0.6, 0.25 + score / 2000);
if (gameRng() > spawnChance) return;
if (!snakes[0] || !snakes[0].body || !snakes[0].body[0]) return;
const head = snakes[0].body[0];
let attempts = 0;
while (attempts < 100) {
attempts++;
const x = Math.floor(gameRng()*COLS);
const y = Math.floor(gameRng()*ROWS);
if (Math.abs(x-head.x)+Math.abs(y-head.y) < 5) continue;
if (snakes.some(p => p.body && p.body.some(s => s.x===x && s.y===y))) continue;
if (food.x===x && food.y===y) continue;
if (specialFood && specialFood.x===x && specialFood.y===y) continue;
if (obstacles.some(o=>o.x===x&&o.y===y)) continue;
if (portals.some(p=>p.x===x&&p.y===y)) continue;
if (cat && cat.x===x && cat.y===y) continue;
obstacles.push({x,y});
obstacleCells.add(obstacleKey(x, y));   // 同步查表
break;
}
}
function trySpawnPortal() {
if (!obstacleModeEnabled || score < PORTAL_SCORE || portals.length >= PORTAL_MAX_PAIRS*2) return;
// ★ 传送门出现概率随分数提升（0.3 → 最高 0.8）
const chance = Math.min(0.8, 0.3 + score / 1500);
if (gameRng() > chance) return;
if (!snakes[0] || !snakes[0].body || !snakes[0].body[0]) return;
const positions = []; let attempts = 0;
const head = snakes[0].body[0];
while (positions.length < 2 && attempts < 300) {
attempts++;
const x = Math.floor(gameRng()*COLS);
const y = Math.floor(gameRng()*ROWS);
if (Math.abs(x-head.x)+Math.abs(y-head.y) < 4) continue;
if (snakes.some(p=>p.body&&p.body.some(s=>s.x===x&&s.y===y))) continue;
if (food.x===x&&food.y===y) continue;
if (specialFood && specialFood.x===x&&specialFood.y===y) continue;
if (obstacles.some(o=>o.x===x&&o.y===y)) continue;
if (portals.some(p=>p.x===x&&p.y===y)) continue;
if (cat && cat.x===x&&cat.y===y) continue;
if (positions.some(p=>Math.abs(p.x-x)+Math.abs(p.y-y)<8)) continue;
positions.push({x,y});
}
if (positions.length < 2) return;
portalPairCounter++;
const color = PORTAL_COLORS[(portalPairCounter-1)%PORTAL_COLORS.length];
positions.forEach(pos => portals.push({x:pos.x, y:pos.y, pairId:portalPairCounter, color:color, timer:PORTAL_DURATION}));
showCheatToast('🌀 传送门出现！');
}
// ===== 粒子系统（对象池）=====
// 原来每颗粒子都 new 一个对象、死亡时用 splice 从数组中挖掉，
// 导致频繁的小对象分配和数组搬移，长时间游玩会出现周期性 GC 尖刺。
// 现在改为：预分配固定大小的粒子池，用"存活数量 + 原地压缩"管理，
// 粒子对象从头到尾只创建一次，永不 new、永不 splice。
// 视觉表现与原来完全一致：同一套速度/生命衰减/半径公式。
const PARTICLE_POOL_MAX = 420;
const particlePool = new Array(PARTICLE_POOL_MAX);
for (let i = 0; i < PARTICLE_POOL_MAX; i++) {
  particlePool[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0, size: 0, color: '#fff' };
}
let particleCount = 0;   // 当前存活粒子数，始终占用 particlePool 的前 count 个

function spawnParticles(x, y, color) {
  for (let i = 0; i < 14; i++) {
    // 池满时丢弃新粒子（比无限增长更安全，正常玩法下 420 足够）
    if (particleCount >= PARTICLE_POOL_MAX) break;
    const pt = particlePool[particleCount++];
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.5;
    const s = 1.8 + Math.random() * 2.8;
    pt.x = x * GRID + GRID / 2;
    pt.y = y * GRID + GRID / 2;
    pt.vx = Math.cos(a) * s;
    pt.vy = Math.sin(a) * s;
    pt.life = 1;
    pt.decay = 0.022 + Math.random() * 0.02;
    pt.size = 2.5 + Math.random() * 3.5;
    pt.color = color;
  }
}

function updateParticles() {
  // 原地压缩：把还活着的粒子往前挪，最后把 count 收缩到存活数量。
  // 不使用 splice，避免每次删除都搬移后半段数组。
  let write = 0;
  for (let read = 0; read < particleCount; read++) {
    const p = particlePool[read];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.95; p.vy *= 0.95;
    p.life -= p.decay;
    if (p.life > 0) {
      if (write !== read) {
        const t = particlePool[write];
        t.x = p.x; t.y = p.y; t.vx = p.vx; t.vy = p.vy;
        t.life = p.life; t.decay = p.decay; t.size = p.size; t.color = p.color;
      }
      write++;
    }
  }
  particleCount = write;
}

function spawnCat() {
let valid = false, catX = 5, catY = 5, attempts = 0;
while (!valid && attempts < 200) {
attempts++;
catX = Math.floor(gameRng()*COLS);
catY = Math.floor(gameRng()*ROWS);
if (snakes.some(p=>p.body&&p.body.some(s=>Math.abs(s.x-catX)+Math.abs(s.y-catY)<5))) continue;
if (Math.abs(food.x-catX)+Math.abs(food.y-catY) < 3) continue;
if (specialFood && Math.abs(specialFood.x-catX)+Math.abs(specialFood.y-catY)<3) continue;
if (obstacles.some(o=>o.x===catX&&o.y===catY)) continue;
if (portals.some(p=>p.x===catX&&p.y===catY)) continue;
valid = true;
}
cat = { x:catX, y:catY, dir:{x:0,y:0}, moveTimer:0, stunLeft:0 };
catActive = true; catBiteLosses = 0;
showCheatToast('🐱 野猫出现！小心尾巴！');
}

function updateCat() {
if (!catActive || !cat || isPaused || isGameOver) return;
if (gameMode === 'double') { catActive = false; cat = null; return; }
if (cat.stunLeft > 0) { cat.stunLeft--; return; }
cat.moveTimer++;
if (cat.moveTimer < 2) return;
cat.moveTimer = 0;
const player = snakes[0];
if (!player || !player.alive || !player.body || player.body.length === 0) return;
let targetHead = player.body[0];
if (player.phantomData && performance.now() < player.phantomUntil && player.phantomData.body && player.phantomData.body[0]) {
  targetHead = player.phantomData.body[0];
}
if (!targetHead) return;
if (targetHead.x === cat.x && targetHead.y === cat.y) {
  if (player.phantomData && performance.now() < player.phantomUntil) {
    player.phantomUntil = 0;
    player.phantomData = null;
    // ★ 虎觉醒：幻影挡刀，给玩家 1.5 秒无敌
    if (isSkinAwakened('hu')) {
      player.invincibleUntil = performance.now() + 1500;
      showCheatToast('👻 幻影替你挡了一刀！获得 1.5 秒无敌（觉醒）', 1000);
    } else {
      showCheatToast('👻 幻影被猫击碎！', 700);
    }
    return;
  }
  if (player.shield) { player.shield = false; player.invincibleUntil = performance.now() + 1200; showCheatToast('🛡️ 护盾抵挡了野猫！', 700); catActive=false; cat=null; catTrail=[]; return; }
  else { killPlayer(player, '被野猫正面抓住'); return; }
}
const dx = targetHead.x-cat.x, dy = targetHead.y-cat.y;
let moveX=0, moveY=0;
if (Math.abs(dx) >= Math.abs(dy)) moveX = dx>0?1:(dx<0?-1:0);
else moveY = dy>0?1:(dy<0?-1:0);
const newX = cat.x+moveX, newY = cat.y+moveY;
if (newX>=0 && newX<COLS && newY>=0 && newY<ROWS) {
  const blockedByRealBody = player.body.some(s=>s.x===newX&&s.y===newY);
  if (!blockedByRealBody && !obstacles.some(o=>o.x===newX&&o.y===newY)) {
    cat.x=newX; cat.y=newY; cat.dir={x:moveX,y:moveY};
  }
}
catTrail.push({x:cat.x,y:cat.y});
if (catTrail.length > 6) catTrail.shift();
if (targetHead.x===cat.x && targetHead.y===cat.y) {
  if (player.phantomData && performance.now() < player.phantomUntil) {
    player.phantomUntil = 0;
    player.phantomData = null;
    // ★ 虎觉醒：幻影挡刀，给玩家 1.5 秒无敌
    if (isSkinAwakened('hu')) {
      player.invincibleUntil = performance.now() + 1500;
      showCheatToast('👻 幻影替你挡了一刀！获得 1.5 秒无敌（觉醒）', 1000);
    } else {
      showCheatToast('👻 幻影被猫击碎！', 700);
    }
    return;
  }
  if (player.shield) { player.shield=false; player.invincibleUntil = performance.now() + 1200; showCheatToast('🛡️ 护盾抵挡了野猫！', 700); catActive=false; cat=null; catTrail=[]; return; }
  else { killPlayer(player, '被野猫正面抓住'); return; }
}
if (player.body.length > 3) {
for (let i=player.body.length-1; i>=3; i--) {
if (player.body[i] && player.body[i].x === cat.x && player.body[i].y === cat.y) {
const biteIndex = i;
const removedCount = player.body.length - biteIndex;
player.body = player.body.slice(0, biteIndex);
catBiteLosses += removedCount;
stats.catBitesReceived = (stats.catBitesReceived || 0) + 1;   // ★ 称号「猫粮」计数
vibrate([120,60,120,60,120]); shakeAmount = 28;
spawnParticles(cat.x, cat.y, '#ff4444'); spawnParticles(cat.x, cat.y, '#ffaa00');
lengthEl.textContent = player.body.length;
if (catBiteLosses >= CAT_BITE_LOSS_LIMIT) { showCheatToast('🐱 尾巴被咬断！累计损失 '+catBiteLosses+' 节，力竭而亡！'); killPlayer(player, '被野猫咬断尾巴'); }
else { showCheatToast('🐱 尾巴被咬断！失去 '+removedCount+' 节（累计 '+catBiteLosses+'/'+CAT_BITE_LOSS_LIMIT+'）'); }
break;
}
}
}
}
function isCatTrapped() {
if (!catActive || !cat) return false;
const startX = cat.x, startY = cat.y;
if (startX===0 || startX===COLS-1 || startY===0 || startY===ROWS-1) return false;
const visited = new Set(); const queue = [{x:startX,y:startY}];
visited.add(startX+','+startY);
const dirs = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
const player = snakes[0];
if (!player || !player.body) return false;
while (queue.length > 0) {
const { x, y } = queue.shift();
if (x===0 || x===COLS-1 || y===0 || y===ROWS-1) return false;
for (const d of dirs) {
const nx = x+d.x, ny = y+d.y;
if (nx<0 || nx>=COLS || ny<0 || ny>=ROWS) continue;
const key = nx+','+ny;
if (visited.has(key)) continue;
if (player.body.some(s => s.x===nx && s.y===ny)) continue;
if (obstacles.some(o => o.x===nx && o.y===ny)) continue;
visited.add(key); queue.push({x:nx,y:ny});
}
}
return true;
}

// ===== 合作模式共享生命 HUD =====
// 三条生命用 ❤ / 🤍 显示，进游戏才出现，单人与双人模式下自动隐藏
function setCoopLivesHudVisible(visible) {
  const el = document.getElementById('coopLives');
  if (!el) return;
  el.style.display = visible ? 'flex' : 'none';
}
function updateCoopLivesHud() {
  if (gameMode !== 'coop') { setCoopLivesHudVisible(false); return; }
  const el = document.getElementById('coopLives');
  if (!el) return;
  const hearts = document.getElementById('coopHearts');
  if (hearts) {
    let s = '';
    for (let i = 0; i < COOP_LIVES; i++) s += (i < sharedLives ? '❤️' : '🤍');
    hearts.textContent = s;
  }
  const num = document.getElementById('coopLivesNum');
  if (num) num.textContent = sharedLives;
  setCoopLivesHudVisible(true);
}
window.__updateCoopLivesHud = updateCoopLivesHud;

function killPlayer(player, reason) {
if (!player || !player.alive) return;
// ★ 合作模式：按玩家 id 取出生点，死亡后原地重置回出生位置
function coopSpawnOf(p) { return COOP_SPAWN[p.id] || { x: 12, y: 15, dir: { x: 1, y: 0 } }; }
// ★ 合作模式复活的统一处理：重置蛇身到出生点、清空尾巴痕迹、给一段无敌时间防连死
function coopRespawn(p) {
  const sp = coopSpawnOf(p);
  p.body = [{ x: sp.x, y: sp.y }];
  for (let i = 1; i <= 2; i++) p.body.push({ x: sp.x - sp.dir.x * i, y: sp.y - sp.dir.y * i });
  p.dir = { ...sp.dir }; p.nextDir = { ...sp.dir }; p.dirQueue = [];
  p.body.forEach(s => { if (s.x < 0 || s.x >= COLS || s.y < 0 || s.y >= ROWS) { s.x = Math.max(0, Math.min(COLS-1, s.x)); s.y = Math.max(0, Math.min(ROWS-1, s.y)); } });
  p.alive = true;
  p.shield = false;
  // 复活后 3 秒无敌：足够玩家重新观察局面并瞄准方向，避免"刚回来又被秒"
  p.invincibleUntil = performance.now() + 3000;
  // 复活等待：这段时间内蛇停在出生点不动，等玩家按出方向再启动，
  // 否则默认朝出生朝向直冲，几格之后就撞墙，等于白送一条命。
  p.coopWaiting = true;
  p.ghostTrail = [];
  p.comboCount = 0; p.comboTimer = 0;
  p.__cellSet = null;
  spawnParticles(sp.x, sp.y, p.id === 'p1' ? '#00f5d4' : '#f15bb5');
  spawnParticles(sp.x, sp.y, '#ffffff');
}
if (player.hasXuming && !player.xumingUsed) {
  player.xumingUsed = true;
  player.score = Math.floor(player.score / 2);
  if (player.id === 'p1') { if (gameMode === 'single') score = player.score; scoreEl.textContent = player.score; }
  else { score2El.textContent = player.score; }
  const startX = player.id === 'p1' ? (gameMode === 'single' ? 12 : 5) : 24;
  const startY = player.id === 'p1' ? (gameMode === 'single' ? 15 : 5) : 24;
  player.body = [{x:startX, y:startY}];
  for (let i = 1; i <= 2; i++) player.body.push({ x: startX - i, y: startY });
  player.dir = {x:1,y:0}; player.nextDir = {x:1,y:0}; player.dirQueue = [];
  player.shield = true;
  player.invincibleUntil = performance.now() + 1500;
  player.ghostTrail = [];
  shakeAmount = 30;
  vibrate([200,100,200]);
  if (reason && reason.includes('野猫')) { catActive = false; cat = null; catTrail = []; catBiteLosses = 0; }
  showCheatToast('💖 续命丹生效！原地复活，分数减半');
  return;
}
if (player.hasRevive && !player.reviveUsed) {
  player.reviveUsed = true;
  const startX = player.id === 'p1' ? (gameMode === 'single' ? 12 : 5) : 24;
  const startY = player.id === 'p1' ? (gameMode === 'single' ? 15 : 5) : 24;
  player.body = [{x:startX, y:startY}];
  for (let i = 1; i <= 2; i++) player.body.push({ x: startX - i, y: startY });
  player.dir = {x:1,y:0}; player.nextDir = {x:1,y:0}; player.dirQueue = [];
  player.invincibleUntil = performance.now() + 1500;
  player.ghostTrail = [];
  shakeAmount = 30;
  vibrate([200,100,200]);
  spawnParticles(startX, startY, '#66ff99');
  spawnParticles(startX, startY, '#ffffff');
  if (reason && reason.includes('野猫')) { catActive = false; cat = null; catTrail = []; catBiteLosses = 0; }
  showCheatToast('🐴 马符咒·回春！原地复活，分数保留', 1400);
  return;
}
player.alive = false;
vibrate([500, 150, 500, 150, 500]);
shakeAmount = 35;
if (player.body && player.body.length) {
player.body.forEach((s,i) => { if (s && i%2===0) spawnParticles(s.x, s.y, player.id === 'p1' ? '#00f5d4' : '#f15bb5'); });
}
if (gameMode === 'single') { gameOver(reason); return; }
// ★ 合作模式：不立即结束，先扣共享生命；还有命就把蛇放回出生点继续打
if (gameMode === 'coop') {
  sharedLives--;
  updateCoopLivesHud();
  // 顺手清掉咬死玩家的野猫，避免复活瞬间又被同一只猫秒杀
  if (reason && reason.includes('野猫')) { catActive = false; cat = null; catTrail = []; catBiteLosses = 0; }
  if (sharedLives <= 0) {
    gameOver((reason || '阵亡') + ' · 共享生命耗尽 · 双人合计 ' + snakes.reduce((a,p)=>a+(p.score||0),0) + ' 分');
    return;
  }
  showCheatToast('💔 ' + player.id.toUpperCase() + ' 阵亡！共享生命剩余 ' + sharedLives + ' 条，即将复活', 1400);
  coopRespawn(player);
  return;
}
const alive = snakes.filter(p => p.alive);
if (alive.length <= 1) {
const winner = alive[0];
if (winner) gameOver(reason + ' · ' + winner.id.toUpperCase() + ' 获胜！');
else gameOver(reason + ' · 平局！');
}
}

// ===== 生肖客栈 · 觉醒判定 =====
// 好感度达到 INN_MAX_AFFINITY（300）时，该生肖皮肤的技能强化。
// 判定数据来自 data.js 的 INN_CHARACTERS[skinId].awakening。
function isSkinAwakened(skinId) {
  if (!skinId || typeof INN_CHARACTERS === 'undefined') return false;
  if (!INN_CHARACTERS[skinId]) return false;
  const aff = SM.getJSON(INN_AFFINITY_KEY, {});
  if (!aff || typeof aff !== 'object') return false;
  return (aff[skinId] || 0) >= INN_MAX_AFFINITY;
}

// ===== 生肖客栈 · 好感度累加 =====
// 只在单人普通模式累加；种子局不加（公平竞争），双人/合作不加（用的是 p1/p2 皮肤配置）。
// 好感度上限 INN_MAX_AFFINITY=300，超出不涨。
function accumulateInnAffinity() {
  if (gameMode !== 'single' || currentSeedId !== null) return;
  const skinId = boardSkinId;
  if (!skinId || skinId === 'default') return;
  const skinObj = SKINS[skinId];
  if (!skinObj || !skinObj.unlockId) return;
  if (!INN_CHARACTERS[skinId]) return;

  const p = snakes[0];
  if (!p) return;
  let gain = 10;
  if ((p.foodsEaten || 0) >= 20) gain += 5;
  if ((p.survivalTime || 0) >= 120) gain += 5;
  if (score > 0 && score === highScore) gain += 20;

  // ★ 读 aff + pending，算"有效当前值"
  const aff = SM.getJSON(INN_AFFINITY_KEY, {});
  const cleanAff = (aff && typeof aff === 'object' && !Array.isArray(aff)) ? aff : {};
  const pending = SM.getJSON(INN_PENDING_KEY, {});
  const cleanPending = (pending && typeof pending === 'object' && !Array.isArray(pending)) ? pending : {};

  const effectiveBefore = Math.min(INN_MAX_AFFINITY, (cleanAff[skinId] || 0) + (cleanPending[skinId] || 0));
  if (effectiveBefore >= INN_MAX_AFFINITY) return;   // 已满，不再累积

  // ★ 写入 pending 时也要钳制到上限，避免溢出
  const newPending = Math.min(gain, INN_MAX_AFFINITY - effectiveBefore);
  cleanPending[skinId] = (cleanPending[skinId] || 0) + newPending;
  SM.setJSON(INN_PENDING_KEY, cleanPending);
}

function gameOver(reason) {
if (isGameOver) return;
// ★ 死亡/结束时立刻隐藏破纪录提示
const hintEl = document.getElementById('recordHint');
if (hintEl) hintEl.classList.remove('show');
isGameOver = true; isDying = true;
// ★ 标记「结算态」。窄屏（安卓 360 宽）棋盘内部只有约 320px 高，而结算界面
//   要塞下：标题 + 战报 + 猫咪点评 + 称号徽章 + 再次入世 + 5 个模式按钮 + 客栈门。
//   其中「双人/合作需在电脑上玩」那句提示只在**选模式**时有用，结算时纯属占位。
//   靠这个类把它收掉，客栈门就不会被挤到折叠线以下。两个结算分支（普通/挑战）
//   都走这里，所以标记放在入口，而不是各分支里各写一遍。
overlay.classList.add('gameover');
// ★ 结算界面不再显示共享生命条，避免和结算文案重复
setCoopLivesHudVisible(false);

const finalScore = gameMode === 'single' ? score : snakes.reduce((a,p)=>a+(p.score||0),0);

// ★ 种子模式：独立结算，不写金币/统计/成就
if (currentSeedId !== null && gameMode === 'single') {
  const key = SEED_HIGH_KEY_PREFIX + currentSeedId;
  const oldBest = SM.getInt(key, 0, 0, 99999999);
  const isNewRecord = score > oldBest;
  if (isNewRecord) SM.safeSet(key, String(score));
  const seedLevel = SEED_LEVELS.find(s => s.id === currentSeedId);
  const best = isNewRecord ? score : oldBest;

  // ★ 更新种子局称号统计
  stats.seedGames++;
  if (!stats.seedClears.includes(currentSeedId)) stats.seedClears.push(currentSeedId);
  stats.seedBestScore = Math.max(stats.seedBestScore, score);
  saveStats();

  setTimeout(() => {
    isDying = false;
    stopLoop();
    overlayTitle.textContent = '修炼失败';
    overlayMsg.textContent =
      (reason || '本局结束') +
      ' · 积分 ' + score +
      ' · 本图最高 ' + best +
      (isNewRecord ? ' 🏆 新纪录！' : '') +
      (seedLevel ? ' · ' + seedLevel.emoji + ' ' + seedLevel.name : '');
    startBtn.textContent = '再次挑战';
    overlay.classList.remove('hidden');
    playBgm('menu');
    if (window.__updateSkillBtn) window.__updateSkillBtn();

    setTimeout(() => {
      const el = document.getElementById('aiComment');
      if (el && typeof generateAIComment === 'function') {
        generateAIComment(buildAIPrompt(), el);
      }
    }, 200);

    // ★ 种子模式专属：提交排行榜成绩
    setTimeout(() => {
      let playerName = SM.getString('snakePlayerName', '');
      if (!playerName) {
        playerName = prompt('🏆 恭喜完成挑战！输入你的江湖名号，登上排行榜吧：', '无名侠客');
      }
      // 名字做长度限制，避免超长名字撑破排行榜布局
      const cleanName = (playerName || '').trim().slice(0, 15);
      if (cleanName) {
        SM.safeSet('snakePlayerName', cleanName);
        const titleName = equippedTitle ? (TITLES.find(t => t.id === equippedTitle) || {}).name || '' : '';
        submitLeaderboardScore(currentSeedId, cleanName, score, snakes[0] ? snakes[0].body.length : 3, titleName);
      }
    }, 500);
  }, 1200);
  return;
}

// 普通模式：原逻辑
let coinBonus = 0;
// ★ 鼠觉醒：+20% → +30%
const shuBonus = isSkinAwakened('shu') ? 0.30 : 0.20;
if (gameMode === 'single' && boardSkinId === 'shu') coinBonus = shuBonus;
else if (gameMode === 'double' && (p1SkinId === 'shu' || p2SkinId === 'shu')) coinBonus = shuBonus;
else if (gameMode === 'coop' && (p1SkinId === 'shu' || p2SkinId === 'shu')) coinBonus = shuBonus;

const earnedCoins = Math.floor(finalScore / 10 * (1 + coinBonus));
coins += earnedCoins;
saveCoins();

stats.totalGames++;
if (gameMode === 'single') stats.singleGames++;
else if (gameMode === 'coop') stats.coopGames++;
else stats.doubleGames++;

// ★ 双人 / 合作模式的胜负统计
if (gameMode === 'double') {
  if ((reason || '').includes('获胜')) stats.doubleWins++;
}
if (gameMode === 'coop') {
  if ((reason || '').includes('合作达成')) {
    stats.coopWins++;
    if (sharedLives === COOP_LIVES) stats.coopPerfectWins++;
    stats.coopBestScore = Math.max(stats.coopBestScore, finalScore);
  }
}

if (gameMode === 'single') {
  totalScoreAccum += score;
  if (snakes[0]) {
    const p = snakes[0];
    stats.totalPlayTime += Math.floor(p.survivalTime || 0);
    stats.totalFoodsEaten += p.foodsEaten || 0;
    stats.bestSurvivalTime = Math.max(stats.bestSurvivalTime, Math.floor(p.survivalTime || 0));
    stats.bestFoodsEaten = Math.max(stats.bestFoodsEaten, p.foodsEaten || 0);
    stats.bestLength = Math.max(stats.bestLength, p.maxLen || 3);
    stats.bestCombo = Math.max(stats.bestCombo, p.maxCombo || 0);
  }
} else {
  snakes.forEach(p => totalScoreAccum += (p.score || 0));
  snakes.forEach(p => {
    stats.totalPlayTime += Math.floor(p.survivalTime || 0);
    stats.totalFoodsEaten += p.foodsEaten || 0;
    stats.bestSurvivalTime = Math.max(stats.bestSurvivalTime, Math.floor(p.survivalTime || 0));
    stats.bestFoodsEaten = Math.max(stats.bestFoodsEaten, p.foodsEaten || 0);
    stats.bestLength = Math.max(stats.bestLength, p.maxLen || 3);
    stats.bestCombo = Math.max(stats.bestCombo, p.maxCombo || 0);
  });
}
const dtype = classifyDeathReason(reason);
if (dtype) stats.deaths[dtype] = (stats.deaths[dtype] || 0) + 1;
saveStats();

saveAchievements(); checkAchievements();
accumulateInnAffinity();   // ★ 先累加好感度
checkTitles();             // ★ 再检查称号（含客栈徽章）

setTimeout(() => {
  isDying = false;
  stopLoop();
  overlayTitle.textContent = '修炼失败';
  let awakenText = '';
  if (gameMode === 'single' && isSkinAwakened(boardSkinId)) {
    const w = (typeof INN_CHARACTERS !== 'undefined' && INN_CHARACTERS[boardSkinId]) ? INN_CHARACTERS[boardSkinId] : null;
    if (w && w.awakening) awakenText = ' · 🌟 ' + w.awakening.name + '生效';
  }
  overlayMsg.textContent = (reason || '本局结束') + (gameMode === 'single' && snakes[0] && snakes[0].body ? (' · 积分 '+score+' · 体长 '+snakes[0].body.length) : (gameMode === 'coop' ? (' · 双人合计积分 '+finalScore) : '')) + ' · 🪙 +' + earnedCoins + awakenText;
  startBtn.textContent = '再次入世';
  // ★ 结算界面显示佩戴中的称号
  const titleBadgeEl = document.getElementById('resultTitleBadge');
  if (titleBadgeEl) {
    const t = TITLES.find(x => x.id === equippedTitle);
    titleBadgeEl.innerHTML = t
      ? '<span class="title-badge tier-' + t.tier + '">🏅 ' + t.name + '</span>'
      : '';
  }
  overlay.classList.remove('hidden');
  playBgm('menu');
  if (window.__updateSkillBtn) window.__updateSkillBtn();

  setTimeout(() => {
    const el = document.getElementById('aiComment');
    if (el && typeof generateAIComment === 'function') {
      generateAIComment(buildAIPrompt(), el);
    }
  }, 200);
}, 1200);
}

// ===== 碰撞查表 =====
// 原来的碰撞检测每走一步都要线性扫描石头数组和整条蛇身（body.some），
// 石头 25 块 + 蛇长 60 时，单步就是 85 次比较，双人模式还要再翻倍。
// 这里维护一个 "x,y" → true 的 Set，把每次比较降到 O(1)。
// 关键：Set 必须与实际数组保持一致，因此所有增删石头的地方都会同步更新它。
const obstacleCells = new Set();
function obstacleKey(x, y) { return x + ',' + y; }
function rebuildObstacleCells() {
  obstacleCells.clear();
  for (let i = 0; i < obstacles.length; i++) obstacleCells.add(obstacleKey(obstacles[i].x, obstacles[i].y));
}
function hasObstacleAt(x, y) { return obstacleCells.has(obstacleKey(x, y)); }
// 原地删除石头：先标记再剔除，避免 filter 每步新建数组；同时同步查表
function removeObstacleAt(x, y) {
  const k = obstacleKey(x, y);
  if (!obstacleCells.has(k)) return;
  obstacleCells.delete(k);
  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].x === x && obstacles[i].y === y) obstacles.splice(i, 1);
  }
}
// 蛇身查表：每个玩家一条，身体每步都会变化，因此按需重建
function buildBodySet(body) {
  const s = new Set();
  if (body) for (let i = 0; i < body.length; i++) s.add(obstacleKey(body[i].x, body[i].y));
  return s;
}

function update() {
if (isPaused || isGameOver) return;
if (specialFood) { specialFoodTimer -= speed; if (specialFoodTimer <= 0) { specialFood = null; specialFoodTimer = 0; specialFoodCooldown = 1500; } }
if (specialFoodCooldown > 0) { specialFoodCooldown -= speed; if (specialFoodCooldown < 0) specialFoodCooldown = 0; }
if (portals.length > 0) {
const pairsToRemove = new Set();
portals.forEach(p => { p.timer -= speed; if (p.timer <= 0) pairsToRemove.add(p.pairId); });
if (pairsToRemove.size > 0) portals = portals.filter(p => !pairsToRemove.has(p.pairId));
}
if (!catActive && catModeEnabled && (gameMode === 'single' || gameMode === 'coop') && score >= CAT_ACTIVATE_SCORE) spawnCat();
const alivePlayers = snakes.filter(p => p.alive);
if (alivePlayers.length === 0) return;
// ★ 合作模式：如果对方已经在出生点附近，就再多给一点无敌余量，
//    避免复活瞬间被队友的身体直接顶死（两人同时复活时尤其需要）。
if (gameMode === 'coop') {
  for (let gi = 0; gi < snakes.length; gi++) {
    const gp = snakes[gi];
    if (!gp.alive || !gp.coopWaiting) continue;
    const sp = COOP_SPAWN[gp.id];
    if (!sp) continue;
    const other = snakes.find(o => o !== gp && o.alive && o.body && o.body[0]);
    if (other && Math.abs(other.body[0].x - sp.x) + Math.abs(other.body[0].y - sp.y) < 6) {
      gp.invincibleUntil = Math.max(gp.invincibleUntil, performance.now() + 500);
    }
  }
}
const nowTs = performance.now();
for (let idx = 0; idx < snakes.length; idx++) {
const p = snakes[idx];
if (!p.alive) continue;
if (!p.body || p.body.length === 0) continue;
// ★ 合作模式复活等待：蛇停在出生点不动，等玩家主动按下方向键才重新出发。
//    这样新增的共享生命才是"救人"而不是"送命"，也不会因为默认朝向直冲撞墙而连死。
if (p.coopWaiting) {
  p.survivalTime += 0;   // 等待期间不累计生存时间
  continue;
}
snake = p.body; direction = p.dir; currentPlayer = p;
// ★ 输入队列消费：每 tick 只取一个待执行方向，剩下的留到下一 tick。
//   改版前 setDirection 直接写 p.nextDir，且用 p.dir（上一次真正走的方向）
//   判反向 —— 于是「上→左」这种连转里，第二个输入会被当成"反向"直接丢掉，
//   手机上快速连划就是"划了没反应"。现在改为排队，最多缓存 2 个方向。
if (p.dirQueue && p.dirQueue.length) p.nextDir = p.dirQueue.shift();
nextDirection = p.nextDir;
let curSpeed = speed;
if (p.speedMultiplier && p.speedMultiplier > 1) curSpeed = curSpeed / p.speedMultiplier;
if (p.speedBoost > 0) curSpeed = curSpeed * 0.6;
p.survivalTime += curSpeed / 1000;
if (p.comboTimer > 0) {
  p.comboTimer -= speed;
  if (p.comboTimer <= 0) { p.comboTimer = 0; p.comboCount = 0; }
}
if (p.ghostMode && nowTs >= p.ghostUntil) {
  p.ghostMode = false;
  if (p.body && p.body[0]) {
    const hx = p.body[0].x, hy = p.body[0].y;
    if (hasObstacleAt(hx, hy)) {
      removeObstacleAt(hx, hy);
      spawnParticles(hx, hy, '#a06cd5');
    }
  }
  if (window.__updateSkillBtn) window.__updateSkillBtn();
}
if (p.phantomData && nowTs >= p.phantomUntil) {
  p.phantomData = null;
  if (window.__updateSkillBtn) window.__updateSkillBtn();
}
if (p.longFireCells && nowTs >= p.longFireUntil) {
  p.longFireCells = null;
}
const isGhost = p.ghostMode && nowTs < p.ghostUntil;
direction = { ...nextDirection };
if (!snake[0]) continue;
const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
const isInvincible = nowTs < (p.invincibleUntil || 0);

// ★ 本步的碰撞查表：
//   selfBodySet 用"加头之前"的身体构建，这样蛇尾让出的格子仍可进入（和原来 some() 行为一致）；
//   同时把这条蛇的查表挂到 p.__cellSet 上，供其他玩家做"撞到对方"的 O(1) 判断。
const selfBodySet = buildBodySet(snake);
p.__cellSet = selfBodySet;

if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
if (isInvincible) { p.dir = direction; p.nextDir = nextDirection; continue; }
if (p.shield) { p.shield = false; p.invincibleUntil = nowTs + 1200; showCheatToast('🛡️ 护盾抵挡了墙壁！', 700); p.dir = direction; p.nextDir = nextDirection; continue; }
else { killPlayer(p, '撞墙了'); continue; }
}
const enteredPortal = portals.find(pt => pt.x === head.x && pt.y === head.y);
if (enteredPortal) {
const pair = portals.find(pt => pt.pairId === enteredPortal.pairId && (pt.x !== enteredPortal.x || pt.y !== enteredPortal.y));
if (pair) {
head.x = pair.x; head.y = pair.y;
vibrate([60,30,60]); shakeAmount = 15;
spawnParticles(enteredPortal.x, enteredPortal.y, enteredPortal.color);
spawnParticles(pair.x, pair.y, pair.color);
showCheatToast('🌀 传送门穿越！');
}
}
if (hasObstacleAt(head.x, head.y)) {
if (isGhost) {
  spawnParticles(head.x, head.y, '#a06cd5');
} else if (isInvincible) { p.dir = direction; p.nextDir = nextDirection; continue; }
else if (p.shield) {
p.shield = false;
p.invincibleUntil = nowTs + 1200;
removeObstacleAt(head.x, head.y);
showCheatToast('🛡️ 护盾撞碎了石头！', 700);
p.dir = direction; p.nextDir = nextDirection; continue;
} else if (p.niuShieldLeft > 0) {
p.niuShieldLeft--;
removeObstacleAt(head.x, head.y);
shakeAmount = 22;
vibrate([80,40,80]);
spawnParticles(head.x, head.y, '#ffaa00');
spawnParticles(head.x, head.y, '#ff6b6b');
// ★ 牛觉醒：撞碎石头额外 +5 分
let niuBonusText = '';
if (isSkinAwakened('niu')) {
  p.score += 5;
  if (gameMode === 'single') score = p.score;
  if (p.id === 'p1') scoreEl.textContent = p.score; else score2El.textContent = p.score;
  niuBonusText = ' · 觉醒 +5 分';
}
showCheatToast('🐮 牛符咒·铁壁！撞碎石头（剩余 ' + p.niuShieldLeft + ' 次）' + niuBonusText, 1000);
p.dir = direction; p.nextDir = nextDirection; continue;
}
} // ← 修复：闭合 L1282 的 if (hasObstacleAt)，原代码缺失此括号导致语法错误
if (selfBodySet.has(obstacleKey(head.x, head.y))) {
if (isGhost) {
  spawnParticles(head.x, head.y, '#a06cd5');
} else if (isInvincible) { p.dir = direction; p.nextDir = nextDirection; continue; }
else if (p.shield) { p.shield = false; p.invincibleUntil = nowTs + 1200; showCheatToast('🛡️ 护盾抵挡了自咬！', 700); p.dir = direction; p.nextDir = nextDirection; continue; }
else { killPlayer(p, '咬到自己了'); continue; }
}
let hitOther = false;
for (let j = 0; j < snakes.length; j++) {
if (j === idx) continue;
const other = snakes[j];
if (!other.alive || !other.body) continue;
// 优先走查表；若对方本帧还没建立查表（例如刚复活/首帧），回退到线性扫描兜底，
// 保证判定结果与原来完全一致，不会漏判。
if (other.__cellSet) {
  if (other.__cellSet.has(obstacleKey(head.x, head.y))) { hitOther = true; break; }
} else if (other.body.some(s => s.x === head.x && s.y === head.y)) { hitOther = true; break; }
}
if (hitOther) {
if (isGhost) {
  spawnParticles(head.x, head.y, '#a06cd5');
} else if (isInvincible) { p.dir = direction; p.nextDir = nextDirection; continue; }
else if (p.shield) { p.shield = false; p.invincibleUntil = nowTs + 1200; showCheatToast('🛡️ 护盾抵挡了对方！', 700); p.dir = direction; p.nextDir = nextDirection; continue; }
    else {
      // ★ 统计：对方被撞死，给存活方加一次 doubleKills（仅双人模式）
      if (gameMode === 'double') stats.doubleKills++;
      killPlayer(p, '撞到对方了');
      continue;
    }
}
snake.unshift(head);
let ateSomething = false;
if (head.x === food.x && head.y === food.y) {
ateSomething = true; p.foodsEaten++;
if (p.skinId === 'guga') rerollGugaTail(snake);
playEatSound(p.id, false, p.comboCount);
shakeAmount = 18;
vibrate([100,40,100]);
p.comboCount++;
p.comboTimer = (p.skinId === 'tu') ? (COMBO_WINDOW + 500) : COMBO_WINDOW;
p.maxCombo = Math.max(p.maxCombo, p.comboCount);
const multiplier = getComboMultiplier(p.comboCount);

if (p.skinId === 'hu' && p.comboCount > 0 && p.comboCount % 5 === 0) {
  p.score += 30;
  showCheatToast('🐯 虎符咒·阴阳！连击 ' + p.comboCount + ' · +30 分', 900);
  if (gameMode === 'single') score = p.score;
  if (p.id === 'p1') scoreEl.textContent = p.score; else score2El.textContent = p.score;
}

let baseScore = 10;
if (p.speedBoost > 0) baseScore *= 2;
baseScore = Math.floor(baseScore * multiplier);
p.score += baseScore;
if (gameMode === 'single') score = p.score;
if (p.id === 'p1') scoreEl.textContent = p.score; else score2El.textContent = p.score;
p.maxLen = Math.max(p.maxLen, snake.length);
const isCorner = (food.x===0||food.x===COLS-1) && (food.y===0||food.y===ROWS-1);
if (isCorner) p.cornerEaten.add(food.x+','+food.y);
if (curSpeed <= MIN_SPEED+5) p.fastEats++;
showScorePop(food.x, food.y, p.id, baseScore, multiplier);
spawnParticles(food.x, food.y, '#ff6b6b'); spawnParticles(food.x, food.y, '#00f5d4');
placeFood();
let specialChance = 0.35;
if (gameMode === 'single' && thisRunHasLuopan) specialChance = 0.7;
else if ((gameMode === 'double' || gameMode === 'coop') && (thisRunHasLuopanP1 || thisRunHasLuopanP2)) specialChance = 0.7;
if (!specialFood && gameRng() < specialChance) spawnSpecialFood();
if (p.foodsEaten % 2 === 0) trySpawnObstacle();
if (p.foodsEaten % 8 === 0) trySpawnPortal();
updateHighScore(p.score);
if (gameMode === 'double' && p.score >= WIN_SCORE) { const other = snakes.find(x=>x.id!==p.id); if (other) killPlayer(other, p.id.toUpperCase() + ' 率先到达 300 分'); }
// ★ 合作模式没有"率先到达"的胜负概念，双方同队，达到目标分直接失败结束
if (gameMode === 'coop' && p.score >= WIN_SCORE) { gameOver('合作达成！双人合计突破 ' + WIN_SCORE + ' 分目标 · 剩余生命 ' + sharedLives); return; }
lengthEl.textContent = p.body.length;
} else if (specialFood && head.x === specialFood.x && head.y === specialFood.y) {
ateSomething = true; p.foodsEaten++;
if (p.skinId === 'guga') rerollGugaTail(snake);
playEatSound(p.id, true, p.comboCount);
shakeAmount = 22;
vibrate([100,50,100]);
p.comboCount++;
p.comboTimer = (p.skinId === 'tu') ? (COMBO_WINDOW + 500) : COMBO_WINDOW;
p.maxCombo = Math.max(p.maxCombo, p.comboCount);
const multiplier = getComboMultiplier(p.comboCount);

if (p.skinId === 'hu' && p.comboCount > 0 && p.comboCount % 5 === 0) {
  p.score += 30;
  showCheatToast('🐯 虎符咒·阴阳！连击 ' + p.comboCount + ' · +30 分', 900);
  if (gameMode === 'single') score = p.score;
  if (p.id === 'p1') scoreEl.textContent = p.score; else score2El.textContent = p.score;
}

let baseScore = 10;
if (p.speedBoost > 0) baseScore *= 2;
if (specialFood.type === 'gold') { baseScore = 20; showCheatToast('💰 金元宝！积分双倍！'); }
else if (specialFood.type === 'speed') {
  const duration = (p.skinId === 'tu') ? 8000 : 5000;
  p.speedBoost = duration;
  showCheatToast('⚡ 加速药水！' + (duration/1000) + ' 秒加速，分数翻倍！');
}
else if (specialFood.type === 'shield') { p.shield = true; showCheatToast('🛡️ 护盾铃铛！免疫一次死亡！'); }
else if (specialFood.type === 'shrink') { const newLen = Math.max(3, Math.floor(snake.length/2)); p.body = snake.slice(0, newLen); snake = p.body; lengthEl.textContent = p.body.length; showCheatToast('🧪 缩小药水！身体缩短一半！'); }
baseScore = Math.floor(baseScore * multiplier);
p.score += baseScore;
if (gameMode === 'single') score = p.score;
if (p.id === 'p1') scoreEl.textContent = p.score; else score2El.textContent = p.score;
p.maxLen = Math.max(p.maxLen, p.body.length);
showScorePop(specialFood.x, specialFood.y, p.id, baseScore, multiplier);
spawnParticles(specialFood.x, specialFood.y, '#ffaa00'); spawnParticles(specialFood.x, specialFood.y, '#ffffff');
updateHighScore(p.score);
if (gameMode === 'double' && p.score >= WIN_SCORE) { const other = snakes.find(x=>x.id!==p.id); if (other) killPlayer(other, p.id.toUpperCase() + ' 率先到达 300 分'); }
// ★ 合作模式：同样以 300 分作为目标达成条件（达到即通关结算）
if (gameMode === 'coop' && p.score >= WIN_SCORE) { gameOver('合作达成！双人合计突破 ' + WIN_SCORE + ' 分目标 · 剩余生命 ' + sharedLives); return; }
specialFood = null; specialFoodTimer = 0; specialFoodCooldown = 3000;
}
if (!ateSomething && snake.length > 0) snake.pop();
p.body = snake; p.dir = direction; p.nextDir = nextDirection;
if (snake.length > 0) {
p.ghostTrail.push(snake.map(s => ({x:s.x, y:s.y})));
if (p.ghostTrail.length > 8) p.ghostTrail.shift();
}
}
if (snakes[0]) {
maxLengthReached = snakes[0].maxLen;
foodsEaten = snakes[0].foodsEaten;
fastEats = snakes[0].fastEats;
survivalTime = Math.floor(snakes[0].survivalTime);
cornerEaten = snakes[0].cornerEaten;
maxComboReached = snakes[0].maxCombo;
}
updateCat();
if (catActive && cat && isCatTrapped()) {
const cx = cat.x, cy = cat.y;
catActive = false; cat = null; catTrail = []; catBiteLosses = 0;
vibrate([200,100,200]); shakeAmount = 25;
const p = snakes[0];
  if (p) {
    p.score += 50;
    if (gameMode === 'single') score = p.score;
    scoreEl.textContent = p.score;
    updateHighScore(p.score);
  }
  stats.catTrapped = (stats.catTrapped || 0) + 1;   // ★ 称号「猫见愁」计数
  showCheatToast('🎉 你围死了野猫！奖励 50 分！');
spawnParticles(cx, cy, '#ffaa00'); spawnParticles(cx, cy, '#ff4444');
}
const aliveNow = snakes.filter(p => p.alive);
// ★ 合作模式的结束条件由 sharedLives 在 killPlayer 里负责，这里不再判"只剩一人"
if (gameMode === 'double' && aliveNow.length <= 1) {
if (aliveNow.length === 1) gameOver('对手已阵亡 · ' + aliveNow[0].id.toUpperCase() + ' 获胜！');
else gameOver('双方阵亡 · 平局！');
}
// ★ 每次逻辑推进后刷新破纪录提示（实时更新 + 自动隐藏）
updateRecordHint();
}

// ★ 破纪录提示：只有「距最高分 100 分以内、且还没破纪录」时才显示
function updateRecordHint() {
  const el = document.getElementById('recordHint');
  if (!el) return;
  // 单人 + 非种子局 + 游戏进行中 + 有历史最高分 + 差距 1~100
  if (gameMode !== 'single' || currentSeedId !== null || isGameOver || isDying || isPaused || highScore <= 0) {
    el.classList.remove('show');
    return;
  }
  const gap = highScore - score;
  if (gap > 0 && gap <= 100) {
    const txt = '🏆 还有 ' + gap + ' 分就破记录啦！';
    if (el.textContent !== txt) el.textContent = txt;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

function showScorePop(gx, gy, playerId, score, multiplier) {
const pop = document.createElement('div');
pop.className = 'score-pop';
pop.textContent = '+' + score + (multiplier > 1 ? ' ×' + multiplier : '');
if (multiplier > 1) pop.classList.add('combo');
pop.style.left = ((gx+0.5)/COLS*100)+'%';
pop.style.top = ((gy+0.5)/ROWS*100)+'%';
if (playerId === 'p2') pop.style.color = '#f15bb5';
const inner = document.querySelector('.canvas-inner');
if (inner) inner.appendChild(pop);
setTimeout(()=>pop.remove(), 850);
}

// 本帧统一时间戳：绘制阶段有近十处需要"当前时间"，原来每处各调一次
// performance.now()，重复且结果不一致。现在在 draw() 开头取一次，
// 本帧内所有动画相位（传送门旋转、闪烁透明度、火焰/幻影剩余时间）统一用它。
let drawNowTs = 0;

function draw() {
drawNowTs = performance.now();
ctx.save();
let shakeX=0, shakeY=0;
if (shakeAmount > 0.1) { shakeX = (Math.random()-0.5)*shakeAmount; shakeY = (Math.random()-0.5)*shakeAmount; shakeAmount *= 0.90; } else { shakeAmount = 0; }
ctx.translate(shakeX, shakeY);
const boardSkin = SKINS[boardSkinId] || SKINS.default;
if (isWarmSkin(boardSkinId)) {
drawWarmBoard(boardSkinId);
} else {
drawPlainBoard(boardSkin);
}
obstacles.forEach(o => drawObstacle(o));
portals.forEach(p => drawPortal(p));
foodPulse += 0.09;
drawFood(food, boardSkin);
if (specialFood) drawSpecialFood(specialFood);

snakes.forEach(p => {
  if (!p.longFireCells || drawNowTs >= p.longFireUntil) return;
  const now = drawNowTs;
  const life = Math.max(0, (p.longFireUntil - now) / 400);
  p.longFireCells.forEach((cell, i) => {
    const fx = cell.x * GRID + GRID/2;
    const fy = cell.y * GRID + GRID/2;
    const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, GRID * 1.1);
    glow.addColorStop(0, 'rgba(255,180,0,' + (0.9*life) + ')');
    glow.addColorStop(0.5, 'rgba(255,80,0,' + (0.6*life) + ')');
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(fx, fy, GRID * 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,' + (0.8*life) + ')';
    ctx.beginPath(); ctx.arc(fx, fy, GRID * 0.28, 0, Math.PI * 2); ctx.fill();
  });
});

snakes.forEach(p => {
  if (!p.phantomData || drawNowTs >= p.phantomUntil) return;
  const now = drawNowTs;
  const remain = (p.phantomUntil - now) / 5000;
  const alpha = 0.25 + 0.35 * remain;
  const ph = p.phantomData;
  if (!ph.body) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ph.body.forEach((seg, i) => {
    const x = seg.x * GRID, y = seg.y * GRID;
    const cx = x + GRID/2, cy = y + GRID/2;
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, GRID*0.6);
    grad.addColorStop(0, '#ffcc66');
    grad.addColorStop(1, '#ff8800');
    ctx.fillStyle = grad;
    if (i === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, GRID*0.5, 0, Math.PI*2); ctx.fill();
    } else {
      roundRect(ctx, x + 3, y + 3, GRID - 6, GRID - 6, 5);
      ctx.fill();
    }
  });
  ctx.restore();
});

snakes.forEach((p, idx) => {
if (!p.alive || !p.body || p.body.length === 0) return;
snake = p.body;
drawPlayer(p, idx);
});
snakes.forEach(p => { if (p.alive && p.shield && p.body && p.body[0]) drawShield(p); });
if (catActive && cat) drawCat();
snakes.forEach((p) => {
  if (!p.alive || p.comboCount < 2 || !p.body || !p.body[0]) return;
  const head = p.body[0];
  const hx = head.x * GRID + GRID/2;
  const hy = head.y * GRID + GRID/2;
  const color = getComboColor(p.comboCount);
  const ratio = Math.max(0, p.comboTimer / COMBO_WINDOW);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Nunito, sans-serif';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillText('×' + p.comboCount, hx, hy - GRID * 1.15);
  ctx.shadowBlur = 0;
  const barW = 44, barH = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(hx - barW/2, hy - GRID * 0.95, barW, barH);
  ctx.fillStyle = color;
  ctx.fillRect(hx - barW/2, hy - GRID * 0.95, barW * ratio, barH);
  ctx.restore();
});
// 粒子绘制：直接遍历池的前 count 个（无需 slice，零分配）
for (let pi = 0; pi < particleCount; pi++) {
  const p = particlePool[pi];
  ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
}
ctx.globalAlpha = 1;
ctx.restore();
}

// ★ 棋盘缓存：
//   暖色棋盘每个皮肤的画法是纯静态的（棋盘格、网格线、装饰图案都不随时间变化），
//   但原来每帧都要重画 900 个格子 + 几十个装饰图形，实测「兔」皮肤单帧要 5.5ms，
//   一帧预算才 16.6ms，光背景就吃掉三分之一。
//   现在改成：首次绘制某个皮肤时离屏渲染一张整版画布缓存起来，之后每帧只做一次
//   drawImage 贴图。视觉输出与原来逐像素一致，只是不再重复算。
const warmBoardCache = {};
// 图集未加载完成时不建缓存：否则会把"图集兜底的圆形占位"永久烤进缓存，
// 等图集加载好也不会自动更新。等图集就绪后再建缓存即可。
function atlasReadyForCache() {
  return !!(atlasImg && atlasImg.complete && atlasImg.naturalWidth);
}
function getWarmBoardCanvas(skinId) {
  if (warmBoardCache[skinId]) return warmBoardCache[skinId];
  const off = document.createElement('canvas');
  off.width = LOGICAL_SIZE;
  off.height = LOGICAL_SIZE;
  const octx = off.getContext('2d');
  // 复用原画法，只是把绘制目标从主画布临时换成离屏画布
  const mainCtx = ctx;
  ctx = octx;
  try {
    drawWarmBoardDirect(skinId);
  } finally {
    ctx = mainCtx;
  }
  warmBoardCache[skinId] = off;
  return off;
}

// 棋盘变化时（关卡/皮肤切换）清缓存
function invalidateWarmBoardCache(skinId) {
  if (skinId) delete warmBoardCache[skinId];
  else Object.keys(warmBoardCache).forEach(k => delete warmBoardCache[k]);
}

// 图集加载完成后，把此前可能用兜底图形烤出来的暖色棋盘缓存全部清掉重建
if (atlasImg) {
  atlasImg.addEventListener('load', () => invalidateWarmBoardCache());
}

// 对外保持同名同签名：命中缓存就直接贴图，未命中则先构建缓存
function drawWarmBoard(skinId) {
  // 用到了图集但图集还没就绪 → 直接实时绘制，不写缓存（避免烤入兜底图形）
  const usesAtlas = skinId !== 'shu' && skinId !== 'niu';
  if (usesAtlas && !atlasReadyForCache()) {
    drawWarmBoardDirect(skinId);
    return;
  }
  const cached = warmBoardCache[skinId];
  if (cached) { ctx.drawImage(cached, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE); return; }
  ctx.drawImage(getWarmBoardCanvas(skinId), 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
}

// 普通棋盘缓存：纯色底 + 网格线，同样是静态内容，只画一次
const plainBoardCache = {};
function drawPlainBoard(boardSkin) {
  const key = (boardSkin && (boardSkin.id || boardSkin.boardBg)) || 'default';
  let off = plainBoardCache[key];
  if (!off) {
    off = document.createElement('canvas');
    off.width = LOGICAL_SIZE;
    off.height = LOGICAL_SIZE;
    const octx = off.getContext('2d');
    octx.fillStyle = boardSkin.boardBg;
    octx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    octx.strokeStyle = boardSkin.gridColor;
    octx.lineWidth = 1.2;
    for (let i = 0; i <= COLS; i++) { octx.beginPath(); octx.moveTo(i * GRID, 0); octx.lineTo(i * GRID, LOGICAL_SIZE); octx.stroke(); }
    for (let i = 0; i <= ROWS; i++) { octx.beginPath(); octx.moveTo(0, i * GRID); octx.lineTo(LOGICAL_SIZE, i * GRID); octx.stroke(); }
    plainBoardCache[key] = off;
  }
  ctx.drawImage(off, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
}

// 原逐帧画法，改名保留：只用于构建缓存
//
// ★ 美术重做（统一深色基调）：
//   旧版 8 套皮肤里有 7 套是米黄/粉白这类「浅色奶油棋盘」，只有 default 是深色。
//   结果就是：玩 default 是深夜霓虹风，一切到「鼠」整个画布突然泛白，
//   和四周深色 UI 面板撞在一起，非常跳。
//   现在改成：所有棋盘都是深色底，只调色相与明度——
//     鼠=暖棕  牛=墨绿  虎=琥珀  兔=玫红  龙=青碧  蛇=苔绿  马=栗棕  羊=藕紫
//   这样每套皮肤依然有明显辨识度，但整机视觉是一个体系。

// ★ 咕嘎棋盘装饰的位置表（用户要求：「咕」「嘎」两个装饰字随机分布在棋盘上）。
//   只在第一次绘制时随机生成一次并缓存，因为棋盘本身是离屏缓存（warmBoardCache），
//   每帧重新随机会让装饰疯狂跳动。用固定种子的 mulberry32 生成 ——
//   同一局内位置稳定，刷新页面会换一批布局，既满足「随机」又不会闪。
let gugaDecorSpots = null;
function getGugaDecorSpots() {
  if (gugaDecorSpots) return gugaDecorSpots;
  const rnd = mulberry32(20260914);
  const spots = [];
  let guard = 0;
  // 拒绝采样：取 16 个位置，两两至少隔 5 格，避免装饰挤成一坨；
  // guard 是兜底上限，防止边界情况下死循环。
  while (spots.length < 16 && guard++ < 4000) {
    const gx = 1 + Math.floor(rnd() * (COLS - 2));
    const gy = 1 + Math.floor(rnd() * (ROWS - 2));
    if (spots.some(s => Math.abs(s.gx - gx) < 5 && Math.abs(s.gy - gy) < 5)) continue;
    spots.push({ gx: gx, gy: gy, key: rnd() < 0.5 ? 'guga_decor_gu' : 'guga_decor_ga' });
  }
  gugaDecorSpots = spots;
  return spots;
}

function drawWarmBoardDirect(skinId) {
// ---- 每套皮肤的深色双色格 ----
// ★ 美术二次调整（按用户要求：不要统一风格，要「每套皮肤各有各的样子」）：
//   上一版把所有棋盘都压成深色，虽然协调但丢了个性 —— 用户明确要的是「不同风格」。
//   现在改为「保留亮暗两派 + 强化材质与配色差异」：
//     · 亮派（暖）：鼠=米黄宣纸 / 虎=橙木 / 兔=樱粉 / 马=奶油
//     · 亮派（冷）：牛=奶绿 / 龙=青瓷 / 蛇=薄荷 / 羊=藕荷
//     · 暗派：经典青蛇=深夜霓虹
//   亮派棋盘依然保留上一版新加的「径向纵深光 + 内描边 + 装饰」三层结构，
//   所以它自己是完整的、不发灰；只是不再强行跟暗派统一。
const BOARD_THEME = {
  // ---- 亮派（暖）----
  shu:  { mode:'light', light:'#f7ecd8', dark:'#efe1c6', grid:'rgba(168,124,72,0.30)', tint:'#c89b5a', deep:'#e6d3b0' },
  hu:   { mode:'light', light:'#fff1e0', dark:'#ffe3c9', grid:'rgba(214,138,74,0.32)', tint:'#e0a55c', deep:'#f5d5b5' },
  tu:   { mode:'light', light:'#fff2f5', dark:'#ffe4ea', grid:'rgba(224,124,156,0.30)', tint:'#e07fa8', deep:'#f7d6de' },
  ma:   { mode:'light', light:'#fdf4e6', dark:'#f5e6d0', grid:'rgba(186,138,88,0.30)', tint:'#d99b57', deep:'#eeddc4' },
  // ---- 亮派（冷）----
  niu:  { mode:'light', light:'#f4f8ec', dark:'#e6efd8', grid:'rgba(122,166,88,0.30)', tint:'#6fbf8c', deep:'#dae8c8' },
  long: { mode:'light', light:'#eef8f6', dark:'#dcefeb', grid:'rgba(70,168,152,0.30)', tint:'#4fd6c0', deep:'#c9e6e0' },
  she:  { mode:'light', light:'#f1f8ea', dark:'#e2efd4', grid:'rgba(118,166,80,0.30)', tint:'#8fc860', deep:'#d5e8c2' },
  yang: { mode:'light', light:'#f6f1fb', dark:'#eae1f7', grid:'rgba(148,116,196,0.30)', tint:'#a98cd8', deep:'#ded2f0' },
  hou:  { mode:'light', light:'#fff4e6', dark:'#ffe6cc', grid:'rgba(214,146,74,0.32)', tint:'#e0a55c', deep:'#f7dcb8' },
  ji:   { mode:'light', light:'#fff8e0', dark:'#ffefb8', grid:'rgba(230,180,60,0.32)', tint:'#e0b830', deep:'#f7e090' },
  gou:  { mode:'light', light:'#f0e8dc', dark:'#e4d6c0', grid:'rgba(160,120,80,0.32)', tint:'#a87a48', deep:'#d8c4a0' },
  zhu:  { mode:'light', light:'#fdeef0', dark:'#fadde2', grid:'rgba(220,130,150,0.30)', tint:'#e07a90', deep:'#f5c8d0' },
  // ---- 咕嘎（用户自制皮肤，暖橙橘子色，配色跟着素材走）----
  guga: { mode:'light', light:'#fff6ea', dark:'#ffe8ce', grid:'rgba(240,150,60,0.30)', tint:'#f0932e', deep:'#f7dcbc' },
  // ---- 暗派 ----
  default: { mode:'dark', light:'#111826', dark:'#0c121d', grid:'rgba(0,200,220,0.10)', tint:'#00d4c0', deep:'#070a10' }
}[skinId] || { mode:'dark', light:'#111826', dark:'#0c121d', grid:'rgba(0,200,220,0.10)', tint:'#00d4c0', deep:'#070a10' };
const IS_LIGHT_BOARD = BOARD_THEME.mode === 'light';

// 1) 打底：中心的径向光 + 边缘压深，给棋盘纵深。
//    亮派和暗派的「压深终点」不同：暗派压到近黑，亮派只压到同色系更饱和的一档，
//    这样亮派棋盘依然是「亮」的，只是四周比中间略沉，不会糊成一块死白。
const vign = ctx.createRadialGradient(LOGICAL_SIZE/2, LOGICAL_SIZE/2, LOGICAL_SIZE*0.15, LOGICAL_SIZE/2, LOGICAL_SIZE/2, LOGICAL_SIZE*0.78);
vign.addColorStop(0, BOARD_THEME.light);
vign.addColorStop(0.55, BOARD_THEME.dark);
vign.addColorStop(1, BOARD_THEME.deep);   // ← 不再硬编码 #070a10，改由皮肤自带
ctx.fillStyle = vign;
ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

// 2) 棋盘格：只画「亮格」，暗格留给底色，用半透明叠加而不是实心填色。
//    叠加色必须分派：深色底用白色叠加（提亮），亮色底用深色叠加（压深），
//    否则在米黄棋盘上用白叠等于没画，棋盘格会彻底消失。
ctx.fillStyle = IS_LIGHT_BOARD ? 'rgba(120,92,56,0.055)' : 'rgba(255,255,255,0.022)';
for (let gy=0; gy<ROWS; gy++) for (let gx=0; gx<COLS; gx++) {
  if ((gx+gy)%2 === 0) ctx.fillRect(gx*GRID, gy*GRID, GRID, GRID);
}

// 3) 网格线：带皮肤色相的极细线（亮/暗派各自的不透明度已写在 BOARD_THEME.grid 里）
ctx.strokeStyle = BOARD_THEME.grid;
ctx.lineWidth = IS_LIGHT_BOARD ? 0.9 : 0.7;
for (let i=0; i<=COLS; i++) { ctx.beginPath(); ctx.moveTo(i*GRID,0); ctx.lineTo(i*GRID,LOGICAL_SIZE); ctx.stroke(); }
for (let i=0; i<=ROWS; i++) { ctx.beginPath(); ctx.moveTo(0,i*GRID); ctx.lineTo(LOGICAL_SIZE,i*GRID); ctx.stroke(); }

// 4) 内描边：给棋盘一圈淡淡的皮肤色内发光，像「框住了这个场」
//    亮派底浅，要让描边更实一点才看得见，所以提高不透明度。
ctx.strokeStyle = BOARD_THEME.tint + (IS_LIGHT_BOARD ? '5c' : '30');
ctx.lineWidth = 2;
ctx.strokeRect(1, 1, LOGICAL_SIZE-2, LOGICAL_SIZE-2);

// 5) 各皮肤的装饰图案
//    ★ 亮派底上的装饰不能用「低透明度深色」（会发灰发脏），
//      这里统一走 DECO_ALPHA：亮派 0.62、暗派 0.50，
//      具体图案内部的颜色在下面各自按明暗微调。
const DECO_ALPHA = IS_LIGHT_BOARD ? 0.62 : 0.50;
if (skinId === 'shu') {
// 鼠：脚印 + 小米粒，暖棕低饱和
ctx.fillStyle = IS_LIGHT_BOARD ? 'rgba(176,132,78,0.42)' : 'rgba(200,155,100,0.20)';
const paws = [[2,3],[6,10],[11,5],[17,14],[8,20],[23,8],[4,25],[20,22],[14,11],[26,17],[9,7],[18,26]];
paws.forEach(([gx,gy]) => { const cx=gx*GRID+GRID/2, cy=gy*GRID+GRID/2; ctx.beginPath(); ctx.arc(cx,cy,3.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx-3.8,cy-2.8,1.8,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+3.8,cy-2.8,1.8,0,Math.PI*2); ctx.fill(); });
ctx.fillStyle = IS_LIGHT_BOARD ? 'rgba(214,158,74,0.55)' : 'rgba(240,196,110,0.30)';
[[5,6],[12,18],[19,4],[25,12],[3,16],[15,25],[22,20]].forEach(([gx,gy]) => { const cx=gx*GRID+GRID/2, cy=gy*GRID+GRID/2; ctx.beginPath(); for (let s=0;s<5;s++){const a=(s*4*Math.PI/5)-Math.PI/2; const r=s%2===0?3.5:1.5; ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r);} ctx.closePath(); ctx.fill(); });
} else if (skinId === 'niu') {
const grassSpots = [[3,4],[8,12],[15,6],[21,18],[5,22],[24,9],[10,25],[18,3],[26,15],[12,16],[1,10],[28,5]];
const leafPath = (w,h) => { ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(-w/2,-h*0.22,-w/2,-h*0.74,0,-h); ctx.bezierCurveTo(w/2,-h*0.74,w/2,-h*0.22,0,0); ctx.closePath(); };
// 草叶在深色底上要降低饱和、提一点亮度，否则会糊成一团黑
const bladeSet = [{x:-5.5,h:7.5,w:4.2,rot:-0.78,c1:'#8fbf6a',c2:'#5b8b3a'},{x:5.5,h:7.5,w:4.2,rot:0.78,c1:'#8fbf6a',c2:'#5b8b3a'},{x:-3,h:10.5,w:4.8,rot:-0.40,c1:'#9bca74',c2:'#659442'},{x:3,h:10.5,w:4.8,rot:0.40,c1:'#9bca74',c2:'#659442'},{x:0,h:14,w:5.4,rot:0,c1:'#a6d47e',c2:'#6f9e4a'}];
grassSpots.forEach(([gx,gy]) => { const bx=gx*GRID+GRID/2; const by=gy*GRID+GRID/2+6; ctx.save(); ctx.translate(bx,by); ctx.scale(0.9,0.9); ctx.lineJoin='round'; ctx.globalAlpha=IS_LIGHT_BOARD?0.72:0.5; ctx.fillStyle=IS_LIGHT_BOARD?'rgba(70,110,50,0.28)':'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(2,1,8.5,2.6,0,0,Math.PI*2); ctx.fill(); bladeSet.forEach(b => { ctx.save(); ctx.translate(b.x,0); ctx.rotate(b.rot); leafPath(b.w,b.h); ctx.fillStyle=IS_LIGHT_BOARD?'#7fae5c':'#0e1714'; ctx.strokeStyle=IS_LIGHT_BOARD?'#7fae5c':'#0e1714'; ctx.lineWidth=3.4; ctx.fill(); ctx.stroke(); ctx.restore(); }); bladeSet.forEach(b => { ctx.save(); ctx.translate(b.x,0); ctx.rotate(b.rot); leafPath(b.w,b.h); ctx.strokeStyle=IS_LIGHT_BOARD?'rgba(96,140,66,0.9)':'rgba(14,23,20,0.9)'; ctx.lineWidth=2.2; ctx.stroke(); const lg=ctx.createLinearGradient(-b.w/2,0,b.w/2,0); lg.addColorStop(0,b.c1); lg.addColorStop(1,b.c2); leafPath(b.w,b.h); ctx.fillStyle=lg; ctx.fill(); ctx.restore(); }); ctx.restore(); });
} else if (skinId === 'hu') {
[[2,5],[7,14],[14,3],[20,18],[24,7],[10,25],[18,10],[5,21]].forEach(([gx,gy]) => { const bx=gx*GRID+GRID/2; const by=gy*GRID+GRID/2; ctx.globalAlpha=DECO_ALPHA; if (!drawImageHelper('leaf',bx,by,GRID*1.6)) { ctx.fillStyle='rgba(214,150,72,0.55)'; ctx.beginPath(); ctx.arc(bx,by,8,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; });
} else if (skinId === 'tu') {
[[3,4],[9,12],[16,5],[22,18],[6,22],[25,9],[11,25],[19,3],[27,15],[13,16],[2,10],[29,6]].forEach(([gx,gy]) => { const bx=gx*GRID+GRID/2; const by=gy*GRID+GRID/2; ctx.globalAlpha=DECO_ALPHA; if (!drawImageHelper('rab_paw',bx,by,GRID*1.4)) { ctx.fillStyle='rgba(214,116,158,0.6)'; ctx.beginPath(); ctx.arc(bx,by,7,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; });
} else if (skinId === 'long') {
[[3,5],[8,15],[15,4],[22,17],[5,23],[25,8],[11,26],[19,4],[27,14],[12,18],[2,11],[28,7]].forEach(([gx,gy]) => { const bx=gx*GRID+GRID/2; const by=gy*GRID+GRID/2; ctx.globalAlpha=DECO_ALPHA; if (!drawImageHelper('dragon_decor',bx,by,GRID*1.5)) { ctx.fillStyle='rgba(64,180,164,0.55)'; ctx.beginPath(); ctx.arc(bx-6,by,5,0,Math.PI*2); ctx.arc(bx,by-4,6,0,Math.PI*2); ctx.arc(bx+6,by,5,0,Math.PI*2); ctx.arc(bx,by+3,5,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; });
} else if (skinId === 'she') {
[[3,4],[9,12],[16,5],[22,18],[6,22],[25,9],[11,25],[19,3],[27,15],[13,16],[2,10],[29,6]].forEach(([gx,gy], idx) => {
const bx=gx*GRID+GRID/2; const by=gy*GRID+GRID/2;
ctx.globalAlpha=DECO_ALPHA;
if (idx%2===0) { if (!drawImageHelper('snake_drop',bx,by,GRID*1.3)) { ctx.fillStyle=IS_LIGHT_BOARD?'rgba(122,178,76,0.6)':'rgba(143,200,96,0.5)'; ctx.beginPath(); ctx.ellipse(bx,by,5,7,0,0,Math.PI*2); ctx.fill(); } }
else { if (!drawImageHelper('snake_leaf',bx,by,GRID*1.3)) { ctx.fillStyle=IS_LIGHT_BOARD?'rgba(104,162,70,0.6)':'rgba(120,180,90,0.5)'; ctx.beginPath(); ctx.ellipse(bx,by,5,8,0.5,0,Math.PI*2); ctx.fill(); } }
ctx.globalAlpha=1;
});
} else if (skinId === 'ma') {
[[3,4],[9,12],[16,5],[22,18],[6,22],[25,9],[11,25],[19,3],[27,15],[13,16],[2,10],[29,6]].forEach(([gx,gy]) => { const bx=gx*GRID+GRID/2; const by=gy*GRID+GRID/2; ctx.globalAlpha=DECO_ALPHA; if (!drawImageHelper('horse_decor',bx,by,GRID*1.4)) { ctx.fillStyle=IS_LIGHT_BOARD?'#b87d3c':'#d99b57'; ctx.beginPath(); ctx.arc(bx,by,6,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; });
} else if (skinId === 'yang') {
[[3,4],[9,12],[16,5],[22,18],[6,22],[25,9],[11,25],[19,3],[27,15],[13,16],[2,10],[29,6]].forEach(([gx,gy]) => { const bx=gx*GRID+GRID/2; const by=gy*GRID+GRID/2; ctx.globalAlpha=DECO_ALPHA; if (!drawImageHelper('sheep_decor',bx,by,GRID*1.4)) { ctx.fillStyle=IS_LIGHT_BOARD?'#8a68c0':'#a98cd8'; ctx.beginPath(); ctx.moveTo(bx-5,by+3); ctx.quadraticCurveTo(bx-6,by-5,bx,by-6); ctx.quadraticCurveTo(bx+6,by-5,bx+5,by+3); ctx.closePath(); ctx.fill(); } ctx.globalAlpha=1; });
} else if (skinId === 'guga') {
// 咕嘎：把「咕」「嘎」两个装饰字按 getGugaDecorSpots() 的位置撒到棋盘上。
// 用 drawBoxHelper 按最长边统一缩放，两个字的视觉大小才一致（原图一个 406×337 一个 388×351）。
getGugaDecorSpots().forEach(sp => {
const bx = sp.gx*GRID + GRID/2, by = sp.gy*GRID + GRID/2;
ctx.globalAlpha = DECO_ALPHA;
if (!drawBoxHelper(sp.key, bx, by, GRID*1.5)) {
  ctx.fillStyle = IS_LIGHT_BOARD ? 'rgba(240,150,60,0.55)' : 'rgba(255,170,80,0.40)';
  ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI*2); ctx.fill();
}
ctx.globalAlpha = 1;
});
}
}

function drawObstacle(o) {
const bx = o.x * GRID + GRID/2, by = o.y * GRID + GRID/2;
// ★ 美术重做：石头加「投影 + 冷调岩体 + 顶部受光 + 底部暗面 + 两道裂纹」，
//    从前的纯灰渐变在深色棋盘上灰成一片，现在靠冷暖对比立起来
// 地面投影
ctx.fillStyle = 'rgba(0,0,0,0.5)';
ctx.beginPath(); ctx.ellipse(bx, by + GRID*0.40, GRID*0.44, GRID*0.16, 0, 0, Math.PI*2); ctx.fill();
const pts = [[-0.45,-0.15],[-0.30,-0.42],[0.05,-0.45],[0.35,-0.30],[0.45,0.05],[0.30,0.40],[-0.05,0.45],[-0.35,0.30],[-0.45,0.10]];
const tracePath = () => {
  ctx.beginPath();
  pts.forEach((p, i) => { if (i===0) ctx.moveTo(bx+p[0]*GRID, by+p[1]*GRID); else ctx.lineTo(bx+p[0]*GRID, by+p[1]*GRID); });
  ctx.closePath();
};
// 岩体：偏冷的蓝灰，和新棋盘的冷底调统一
const stoneGrad = ctx.createRadialGradient(bx - GRID*0.22, by - GRID*0.28, 2, bx, by, GRID*0.68);
stoneGrad.addColorStop(0, '#a8b0be'); stoneGrad.addColorStop(0.42, '#6b7484'); stoneGrad.addColorStop(0.78, '#454d5c'); stoneGrad.addColorStop(1, '#272d38');
ctx.fillStyle = stoneGrad; tracePath(); ctx.fill();
// 描边
ctx.strokeStyle = 'rgba(10,14,22,0.7)'; ctx.lineWidth = 1.2; tracePath(); ctx.stroke();
// 顶部受光边：只描上半圈
ctx.save(); tracePath(); ctx.clip();
const rimGrad = ctx.createLinearGradient(0, by-GRID*0.45, 0, by+GRID*0.1);
rimGrad.addColorStop(0, 'rgba(255,255,255,0.42)');
rimGrad.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = rimGrad; ctx.fillRect(bx-GRID*0.5, by-GRID*0.5, GRID, GRID*0.6);
// 底部暗面
const botGrad = ctx.createLinearGradient(0, by+GRID*0.1, 0, by+GRID*0.48);
botGrad.addColorStop(0, 'rgba(0,0,0,0)');
botGrad.addColorStop(1, 'rgba(0,0,0,0.38)');
ctx.fillStyle = botGrad; ctx.fillRect(bx-GRID*0.5, by+GRID*0.1, GRID, GRID*0.4);
ctx.restore();
// 高光点
ctx.fillStyle = 'rgba(255,255,255,0.34)';
ctx.beginPath(); ctx.arc(bx - GRID*0.17, by - GRID*0.20, GRID*0.09, 0, Math.PI*2); ctx.fill();
// 两道裂纹：让石头看起来"硬"
ctx.strokeStyle = 'rgba(16,20,28,0.5)'; ctx.lineWidth = 0.9; ctx.lineCap='round';
ctx.beginPath(); ctx.moveTo(bx+GRID*0.06, by-GRID*0.22); ctx.lineTo(bx-GRID*0.04, by+GRID*0.06); ctx.lineTo(bx+GRID*0.10, by+GRID*0.26); ctx.stroke();
ctx.beginPath(); ctx.moveTo(bx-GRID*0.26, by+GRID*0.10); ctx.lineTo(bx-GRID*0.14, by+GRID*0.24); ctx.stroke();
}

function drawPortal(p) {
const px = p.x * GRID + GRID/2, py = p.y * GRID + GRID/2;
const rotation = drawNowTs/1000 * 2;
const pulse = 0.9 + Math.sin(drawNowTs/1000 * 4) * 0.1;
// ★ 美术重做：传送门加了「漩涡底盘 + 双向旋转环 + 中心亮点 + 外圈倒计时」四层
//    从前只有两段弧线，在深色棋盘上很单薄；现在做成一个能看见深度的"洞"
// 外层柔光
const glow = ctx.createRadialGradient(px, py, GRID*0.1, px, py, GRID*1.0);
glow.addColorStop(0, p.color + 'ff'); glow.addColorStop(0.42, p.color + '77'); glow.addColorStop(1, p.color + '00');
ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, GRID*1.0, 0, Math.PI*2); ctx.fill();
// 漩涡底盘：越靠中心越暗，制造"往里吸"的错觉
const hole = ctx.createRadialGradient(px, py, GRID*0.05, px, py, GRID*0.52);
hole.addColorStop(0, 'rgba(6,10,18,0.95)');
hole.addColorStop(0.62, p.color + '55');
hole.addColorStop(1, p.color + '11');
ctx.fillStyle = hole; ctx.beginPath(); ctx.arc(px, py, GRID*0.52, 0, Math.PI*2); ctx.fill();
// 双向旋转环
ctx.save(); ctx.translate(px, py); ctx.rotate(rotation);
ctx.strokeStyle = p.color; ctx.lineWidth = 2.6; ctx.lineCap='round';
ctx.beginPath(); ctx.arc(0, 0, GRID*0.42*pulse, 0, Math.PI*1.5); ctx.stroke();
ctx.rotate(-rotation*1.7);
ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.8;
ctx.beginPath(); ctx.arc(0, 0, GRID*0.29*pulse, 0, Math.PI*1.2); ctx.stroke();
ctx.restore();
// 中心亮点
const core = ctx.createRadialGradient(px, py, 0, px, py, GRID*0.18);
core.addColorStop(0, '#ffffff'); core.addColorStop(1, p.color + '00');
ctx.fillStyle = core; ctx.beginPath(); ctx.arc(px, py, GRID*0.18, 0, Math.PI*2); ctx.fill();
// 外圈倒计时
const timerRatio = Math.max(0, p.timer/PORTAL_DURATION);
ctx.beginPath(); ctx.arc(px, py, GRID*0.62, -Math.PI/2, -Math.PI/2 + Math.PI*2*timerRatio);
ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawFood(fd, boardSkin) {
if (!fd) return;
const pulse = 0.82 + Math.sin(foodPulse)*0.18;
const fx = fd.x*GRID + GRID/2, fy = fd.y*GRID + GRID/2, fc = boardSkin.foodColors || ['#ff9a9a','#ff6b6b','#e03131'];
const glow = ctx.createRadialGradient(fx,fy,2,fx,fy,GRID*1.3);
glow.addColorStop(0, 'rgba(255,200,50,'+(0.4*pulse)+')'); glow.addColorStop(1, 'rgba(255,200,50,0)');
ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(fx,fy,GRID*1.3,0,Math.PI*2); ctx.fill();
if (boardSkinId === 'shu') {
ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.15,pulse*1.15);
ctx.fillStyle='#ffd54a'; ctx.beginPath(); ctx.moveTo(-2,-9); ctx.lineTo(10,6); ctx.lineTo(-10,6); ctx.closePath(); ctx.fill();
ctx.fillStyle='#e6b800'; ctx.beginPath(); ctx.moveTo(-2,-9); ctx.lineTo(-10,6); ctx.lineTo(-8,8); ctx.lineTo(0,-7); ctx.closePath(); ctx.fill();
ctx.fillStyle='#ffe9a0'; ctx.beginPath(); ctx.arc(-1,0,2.4,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(3.5,3,1.8,0,Math.PI*2); ctx.fill();
ctx.restore();
} else if (boardSkinId === 'niu') {
ctx.save(); ctx.translate(fx,fy); ctx.rotate(Math.sin(foodPulse*1.3)*0.10-0.18); ctx.scale(pulse*1.08,pulse*1.08); ctx.lineJoin='round';
const BELL_LINE='#7a4a1a';
const bellPath = () => { ctx.beginPath(); ctx.moveTo(-7,3.5); ctx.bezierCurveTo(-7.6,-5,-4,-9,0,-9); ctx.bezierCurveTo(4,-9,7.6,-5,7,3.5); ctx.quadraticCurveTo(0,6.6,-7,3.5); ctx.closePath(); };
ctx.fillStyle='#fffdf5'; ctx.strokeStyle='#fffdf5'; ctx.lineWidth=3.2;
ctx.beginPath(); ctx.arc(0,-11,3.1,0,Math.PI*2); ctx.fill(); ctx.stroke(); bellPath(); ctx.fill(); ctx.stroke();
const bellFill = ctx.createLinearGradient(-5,-9,5,6); bellFill.addColorStop(0,'#ffefb0'); bellFill.addColorStop(0.42,'#ffce3d'); bellFill.addColorStop(1,'#ef9c05');
bellPath(); ctx.fillStyle=bellFill; ctx.fill(); bellPath(); ctx.strokeStyle=BELL_LINE; ctx.lineWidth=1.5; ctx.stroke();
ctx.beginPath(); ctx.arc(0,5.6,2.5,0,Math.PI*2); ctx.fillStyle='#ffd75e'; ctx.fill(); ctx.strokeStyle=BELL_LINE; ctx.lineWidth=1.3; ctx.stroke();
ctx.restore();
} else if (boardSkinId === 'hu') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); if (!drawImageHelper('food',0,0,GRID*1.8)) { ctx.fillStyle='#ff9b7a'; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (boardSkinId === 'tu') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); if (!drawImageHelper('rab_food',0,0,GRID*1.8)) { ctx.fillStyle='#ff8c00'; ctx.beginPath(); ctx.moveTo(0,-10); ctx.quadraticCurveTo(8,-2,0,12); ctx.quadraticCurveTo(-8,-2,0,-10); ctx.fill(); } ctx.restore(); }
else if (boardSkinId === 'long') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); if (!drawImageHelper('dragon_food',0,0,GRID*1.8)) { ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (boardSkinId === 'she') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); if (!drawImageHelper('snake_food',0,0,GRID*1.9)) { ctx.fillStyle='#8b5a2b'; ctx.beginPath(); ctx.ellipse(0,2,9,10,0,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (boardSkinId === 'ma') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); if (!drawImageHelper('horse_food',0,0,GRID*1.8)) { ctx.fillStyle='#8b5a2b'; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (boardSkinId === 'yang') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); if (!drawImageHelper('sheep_food',0,0,GRID*1.8)) { ctx.fillStyle='#ffb6c1'; ctx.fillRect(-8,-8,16,16); ctx.fillStyle='#ffe4a0'; ctx.fillRect(-8,-5,16,4); ctx.fillStyle='#b8e6b8'; ctx.fillRect(-8,-1,16,4); } ctx.restore(); }
else if (boardSkinId === 'hou') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); ctx.fillStyle='#ffb088'; ctx.beginPath(); ctx.arc(0,2,9,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#c96060'; ctx.beginPath(); ctx.arc(0,2,2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#5a9c50'; ctx.beginPath(); ctx.ellipse(4,-6,3,2,-0.5,0,Math.PI*2); ctx.fill(); ctx.restore(); }
else if (boardSkinId === 'ji') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); ctx.fillStyle='#ffd54a'; ctx.beginPath(); ctx.ellipse(0,0,8,10,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff8d0'; ctx.beginPath(); ctx.ellipse(-2,-2,2,3,-0.3,0,Math.PI*2); ctx.fill(); ctx.restore(); }
else if (boardSkinId === 'gou') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); ctx.fillStyle='#e8c9a0'; ctx.beginPath(); ctx.ellipse(0,0,9,7,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#a87a48'; ctx.beginPath(); ctx.ellipse(-3,0,2.5,3,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(3,0,2.5,3,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
else if (boardSkinId === 'zhu') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); ctx.fillStyle='#ffc8d4'; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#e07a90'; ctx.beginPath(); ctx.arc(-3,-2,2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(3,-2,2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-2.2,-2.8,0.8,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(3.8,-2.8,0.8,0,Math.PI*2); ctx.fill(); ctx.restore(); }
else if (boardSkinId === 'guga') { ctx.save(); ctx.translate(fx,fy); ctx.scale(pulse*1.1,pulse*1.1); if (!drawBoxHelper('guga_food',0,0,GRID*1.35)) { ctx.fillStyle='#ff9a2e'; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#5a9c50'; ctx.beginPath(); ctx.ellipse(0,-8.5,2,3.2,0,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else {
// ★ 美术重做：默认食物从「一个圆 + 一个小白点」升级为「带立体感的果实」
//    ① 主体径向渐变，光源在左上
//    ② 深色描边，在深色棋盘上有轮廓
//    ③ 左上高光斑 + 底部反光，做出球形体积
//    ④ 一颗小蒂，暗示这是"长出来的"食物而不是色块
const fr = (GRID/2-2.5)*pulse;
const foodGrad = ctx.createRadialGradient(fx-fr*0.36,fy-fr*0.36,fr*0.08,fx,fy,fr);
foodGrad.addColorStop(0, fc[0]); foodGrad.addColorStop(0.55, fc[1]); foodGrad.addColorStop(1, fc[2]);
ctx.fillStyle = foodGrad; ctx.beginPath(); ctx.arc(fx,fy,fr,0,Math.PI*2); ctx.fill();
ctx.strokeStyle = 'rgba(60,8,12,0.55)'; ctx.lineWidth = 1;
ctx.beginPath(); ctx.arc(fx,fy,fr,0,Math.PI*2); ctx.stroke();
// 左上高光
ctx.fillStyle = 'rgba(255,255,255,0.78)';
ctx.beginPath(); ctx.ellipse(fx-fr*0.36, fy-fr*0.40, fr*0.30, fr*0.22, -0.6, 0, Math.PI*2); ctx.fill();
// 底部反光（环境光）
ctx.fillStyle = 'rgba(255,220,220,0.22)';
ctx.beginPath(); ctx.ellipse(fx+fr*0.14, fy+fr*0.52, fr*0.36, fr*0.18, 0.2, 0, Math.PI*2); ctx.fill();
// 小蒂
ctx.strokeStyle = 'rgba(120,200,140,0.9)'; ctx.lineWidth = 1.6; ctx.lineCap='round';
ctx.beginPath(); ctx.moveTo(fx, fy-fr*0.92); ctx.quadraticCurveTo(fx+fr*0.28, fy-fr*1.22, fx+fr*0.52, fy-fr*1.05); ctx.stroke();
}
}

function drawSpecialFood(sf) {
const sfx = sf.x*GRID + GRID/2, sfy = sf.y*GRID + GRID/2;
const sPulse = 0.9 + Math.sin(foodPulse*1.6)*0.15;
// ★ 美术重做：特殊食物加「双层光晕 + 地面投影 + 外圈倒计时 + 主体」，
//    让它在棋盘上第一眼就被看到，因为它是限时的（8 秒消失）
// 外层大光晕
const sGlow = ctx.createRadialGradient(sfx,sfy,2,sfx,sfy,GRID*1.75);
sGlow.addColorStop(0,'rgba(255,255,255,0.55)');
sGlow.addColorStop(0.4,'rgba(255,215,90,0.22)');
sGlow.addColorStop(1,'rgba(255,215,90,0)');
ctx.fillStyle = sGlow; ctx.beginPath(); ctx.arc(sfx,sfy,GRID*1.75,0,Math.PI*2); ctx.fill();
// 地面投影
ctx.fillStyle = 'rgba(0,0,0,0.4)';
ctx.beginPath(); ctx.ellipse(sfx, sfy+GRID*0.42, GRID*0.36, GRID*0.12, 0, 0, Math.PI*2); ctx.fill();
// 外圈倒计时：颜色随剩余时间从绿转黄再转红
const timerRatio = Math.max(0, specialFoodTimer / getSpecialFoodDuration());
let rR, rG, rB;
if (timerRatio > 0.5) { const t = (timerRatio-0.5)/0.5; rR = Math.floor(255*(1-t)); rG = 255; rB = 0; }
else { const t = timerRatio/0.5; rR = 255; rG = Math.floor(255*t); rB = 0; }
// 倒计时底环（暗），再叠进度弧（亮），即使剩余极少也能看清还剩一点
ctx.beginPath(); ctx.arc(sfx, sfy, GRID*0.85, 0, Math.PI*2);
ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 3.5; ctx.stroke();
ctx.beginPath(); ctx.arc(sfx, sfy, GRID*0.85, -Math.PI/2, -Math.PI/2 + Math.PI*2*timerRatio);
ctx.strokeStyle = 'rgba('+rR+','+rG+','+rB+',0.95)'; ctx.lineWidth = 3.5; ctx.lineCap='round'; ctx.stroke();
ctx.save(); ctx.translate(sfx,sfy); ctx.scale(sPulse,sPulse);
if (sf.type === 'gold') {
// 金元宝：主体 + 底部暗面 + 顶面高光 + 描边，做出金属感
ctx.fillStyle='#c99000'; ctx.beginPath(); ctx.ellipse(0,1.5,10,7,0,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#ffd700'; ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.fill();
ctx.strokeStyle='rgba(120,80,0,0.7)'; ctx.lineWidth=1; ctx.beginPath(); ctx.ellipse(0,0,10,7,0,0,Math.PI*2); ctx.stroke();
ctx.fillStyle='#ffaa00'; ctx.beginPath(); ctx.ellipse(0,2.5,8,4,0,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#fff6c0'; ctx.beginPath(); ctx.ellipse(-2.5,-2.5,4,2.4,-0.3,0,Math.PI*2); ctx.fill();
} else if (sf.type === 'speed') {
// 加速：闪电加双层描边 + 高光，像在发光
ctx.fillStyle='#ffe14d'; ctx.strokeStyle='#8a5d00'; ctx.lineWidth=1.2;
ctx.beginPath(); ctx.moveTo(2,-10); ctx.lineTo(-5,1); ctx.lineTo(-1,1); ctx.lineTo(-3,10); ctx.lineTo(5,-1); ctx.lineTo(1,-1); ctx.closePath(); ctx.fill(); ctx.stroke();
ctx.fillStyle='rgba(255,255,255,0.85)';
ctx.beginPath(); ctx.moveTo(1,-7); ctx.lineTo(-3.4,0); ctx.lineTo(-0.6,0); ctx.lineTo(-1.8,6); ctx.lineTo(3.4,-0.4); ctx.lineTo(0.6,-0.4); ctx.closePath(); ctx.fill();
} else if (sf.type === 'shield') {
// 护盾：金属盾牌 + 内嵌十字 + 顶部受光
ctx.fillStyle='#3a9fd8';
ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(9,-6); ctx.lineTo(9,2); ctx.quadraticCurveTo(9,9,0,11); ctx.quadraticCurveTo(-9,9,-9,2); ctx.lineTo(-9,-6); ctx.closePath(); ctx.fill();
ctx.fillStyle='#5bc0ff';
ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(8,-5.4); ctx.lineTo(8,1.8); ctx.quadraticCurveTo(8,8,0,10); ctx.quadraticCurveTo(-8,8,-8,1.8); ctx.lineTo(-8,-5.4); ctx.closePath(); ctx.fill();
ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.5;
ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,6); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke();
ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1;
ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(9,-6); ctx.lineTo(9,2); ctx.quadraticCurveTo(9,9,0,11); ctx.quadraticCurveTo(-9,9,-9,2); ctx.lineTo(-9,-6); ctx.closePath(); ctx.stroke();
} else if (sf.type === 'shrink') {
// 缩小药水：瓶身 + 瓶口 + 内液 + 高光
ctx.fillStyle='#7b3fb8'; ctx.strokeStyle='rgba(30,8,55,0.8)'; ctx.lineWidth=1;
ctx.beginPath(); ctx.moveTo(-4,-10); ctx.lineTo(4,-10); ctx.lineTo(4,-5); ctx.lineTo(6,-2); ctx.lineTo(6,9); ctx.quadraticCurveTo(6,11,4,11); ctx.lineTo(-4,11); ctx.quadraticCurveTo(-6,11,-6,9); ctx.lineTo(-6,-2); ctx.lineTo(-4,-5); ctx.closePath(); ctx.fill(); ctx.stroke();
ctx.fillStyle='#c07dff';
ctx.beginPath(); ctx.moveTo(-5,-1); ctx.lineTo(5,-1); ctx.lineTo(5,9); ctx.quadraticCurveTo(5,10,4,10); ctx.lineTo(-4,10); ctx.quadraticCurveTo(-5,10,-5,9); ctx.closePath(); ctx.fill();
// 玻璃高光
ctx.fillStyle='rgba(255,255,255,0.55)';
ctx.beginPath(); ctx.ellipse(-3.2,3,1.3,4,0.16,0,Math.PI*2); ctx.fill();
}
ctx.restore();
}

// 牛皮肤身体上的牛奶高光渐变：坐标是局部的（在 translate/rotate 之后），
// 每个身体段都一样，原来每段都新建一次，现在只建一次反复用。
let __niuMilkGrad = null;
function getNiuMilkGradient() {
  if (__niuMilkGrad) return __niuMilkGrad;
  __niuMilkGrad = ctx.createLinearGradient(0, 0, 0, 11);
  __niuMilkGrad.addColorStop(0, '#fffdf6');
  __niuMilkGrad.addColorStop(1, '#ffeed2');
  return __niuMilkGrad;
}

function drawPlayer(p, idx) {
if (!p || !p.body || p.body.length === 0) return;
const pSkinId = p.skinId || 'default';
const pSkin = SKINS[pSkinId] || SKINS.default;
const bodyHue = p.bodyHue;
const headColors = p.headColors;
const ghostColor = p.id === 'p1' ? getGhostColorP1(p.score) : getGhostColorP2(p.score);

p.ghostTrail.forEach((gs, index) => {
if (!gs || gs.length === 0) return;
const t = (index+1)/p.ghostTrail.length;
const tSq = t * t;
const alpha = tSq * 0.9; const scale = tSq;
ctx.globalAlpha = alpha;
ctx.globalCompositeOperation = 'lighter';
const col = 'rgba('+ghostColor.r+','+ghostColor.g+','+ghostColor.b+',1)';
ctx.strokeStyle = col;
ctx.shadowColor = col;
ctx.shadowBlur = 28 * scale;
ctx.lineWidth = GRID*(0.08 + 0.62*scale);
ctx.lineCap = 'round'; ctx.lineJoin = 'round';
ctx.beginPath();
gs.forEach((seg, i) => {
if (!seg) return;
const gx = seg.x*GRID+GRID/2; const gy = seg.y*GRID+GRID/2;
if (i===0) ctx.moveTo(gx,gy);
else { const prev = gs[i-1]; if (!prev) return; const px = prev.x*GRID+GRID/2; const py = prev.y*GRID+GRID/2; const midX = (px+gx)/2; const midY = (py+gy)/2; ctx.quadraticCurveTo(px,py,midX,midY); }
});
ctx.stroke();
ctx.shadowBlur = 0;
ctx.strokeStyle = 'rgba(255,255,255,0.85)';
ctx.lineWidth = GRID*(0.04 + 0.22*scale);
ctx.stroke();
ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
});

const isInvincibleNow = drawNowTs < (p.invincibleUntil || 0);
const isGhostNow = p.ghostMode && drawNowTs < p.ghostUntil;
if (isGhostNow) {
  ctx.globalAlpha = 0.4 + Math.sin(drawNowTs/80)*0.2;
} else if (isInvincibleNow) {
  ctx.globalAlpha = 0.35 + Math.sin(drawNowTs/60)*0.25;
}

p.body.forEach((seg, i) => {
if (!seg) return;
const x = seg.x*GRID, y = seg.y*GRID, isHead = i===0;
const cx = x+GRID/2, cy = y+GRID/2;
if (isHead) {
if (pSkinId === 'shu') {
ctx.fillStyle='#e8c9a0'; ctx.beginPath(); ctx.ellipse(cx-9,cy-8,7,8,-0.3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx+9,cy-8,7,8,0.3,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#f5d5b5'; ctx.beginPath(); ctx.ellipse(cx-9,cy-8,4,5,-0.3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx+9,cy-8,4,5,0.3,0,Math.PI*2); ctx.fill();
const hg = ctx.createRadialGradient(cx-3,cy-3,2,cx,cy,12); hg.addColorStop(0,'#f0e0c8'); hg.addColorStop(1,'#d4b896');
ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(cx,cy,11,0,Math.PI*2); ctx.fill();
ctx.fillStyle='rgba(255,160,140,0.45)'; ctx.beginPath(); ctx.ellipse(cx-7,cy+3,3.5,2.5,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx+7,cy+3,3.5,2.5,0,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#4a3020'; ctx.beginPath(); ctx.arc(cx-4,cy-1,2.8,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+4,cy-1,2.8,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx-3.2,cy-1.8,1.1,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+4.8,cy-1.8,1.1,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#e89a8a'; ctx.beginPath(); ctx.ellipse(cx,cy+4,2.2,1.6,0,0,Math.PI*2); ctx.fill();
ctx.strokeStyle='rgba(80,50,30,0.55)'; ctx.lineWidth=1.1; ctx.beginPath(); ctx.moveTo(cx-3,cy+3); ctx.lineTo(cx-12,cy+1); ctx.moveTo(cx-3,cy+5); ctx.lineTo(cx-11,cy+6); ctx.moveTo(cx+3,cy+3); ctx.lineTo(cx+12,cy+1); ctx.moveTo(cx+3,cy+5); ctx.lineTo(cx+11,cy+6); ctx.stroke();
} else if (pSkinId === 'niu') {
const STROKE='#6b3f22'; ctx.lineJoin='round';
const drawHorn = (dir) => { ctx.beginPath(); ctx.moveTo(cx+dir*3.6,cy-9.5); ctx.bezierCurveTo(cx+dir*6.2,cy-15.5,cx+dir*9.2,cy-17.6,cx+dir*11.4,cy-18.2); ctx.bezierCurveTo(cx+dir*13.4,cy-14.5,cx+dir*10.8,cy-10,cx+dir*8.0,cy-7); ctx.closePath(); const hg=ctx.createLinearGradient(cx+dir*4,cy-15,cx+dir*12,cy-9); hg.addColorStop(0,'#fbe49e'); hg.addColorStop(1,'#f1bf4c'); ctx.fillStyle=hg; ctx.fill(); ctx.strokeStyle=STROKE; ctx.lineWidth=1.3; ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx+dir*5.6,cy-10.8); ctx.quadraticCurveTo(cx+dir*8.4,cy-12.6,cx+dir*9.8,cy-15.6); ctx.strokeStyle='rgba(122,74,34,0.45)'; ctx.lineWidth=0.9; ctx.stroke(); };
drawHorn(-1); drawHorn(1);
[[-1,-0.35],[1,0.35]].forEach(([dir,rot]) => { ctx.beginPath(); ctx.ellipse(cx+dir*11.6,cy-1.0,5.3,4.9,rot,0,Math.PI*2); ctx.fillStyle='#fff6e6'; ctx.fill(); ctx.strokeStyle=STROKE; ctx.lineWidth=1.4; ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx+dir*12.4,cy-0.2,3.0,2.3,rot,0,Math.PI*2); ctx.fillStyle='#ff9eb5'; ctx.fill(); });
const facePath = () => { ctx.beginPath(); ctx.ellipse(cx,cy+1.5,11.5,11,0,0,Math.PI*2); };
facePath(); ctx.fillStyle='#fffaf5'; ctx.fill();
ctx.save(); facePath(); ctx.clip(); ctx.beginPath(); ctx.ellipse(cx+5.5,cy-4.2,6.2,5.2,0.28,0,Math.PI*2); ctx.fillStyle='#e8903f'; ctx.fill(); ctx.restore();
facePath(); ctx.strokeStyle=STROKE; ctx.lineWidth=1.8; ctx.stroke();
[[-1],[1]].forEach(([dir]) => { ctx.beginPath(); ctx.arc(cx+dir*4.3,cy-0.6,3.6,0,Math.PI*2); ctx.fillStyle='#4a2c1a'; ctx.fill(); ctx.beginPath(); ctx.arc(cx+dir*3.2,cy-1.9,1.5,0,Math.PI*2); ctx.fillStyle='#ffffff'; ctx.fill(); });
ctx.beginPath(); ctx.ellipse(cx,cy+4.2,2.5,1.8,0,0,Math.PI*2); ctx.fillStyle='#ff9eb5'; ctx.fill();
ctx.beginPath(); ctx.arc(cx,cy+5.6,2.9,0.22,Math.PI-0.22); ctx.strokeStyle=STROKE; ctx.lineWidth=1.4; ctx.lineCap='round'; ctx.stroke();
} else if (pSkinId === 'hu') { ctx.save(); ctx.translate(cx,cy); if (direction.x===1) { ctx.scale(-1,1); } else if (direction.x===-1) {} else if (direction.y===-1) { ctx.rotate(Math.PI/2); } else if (direction.y===1) { ctx.rotate(-Math.PI/2); } if (!drawImageHelper('head',0,0,GRID*1.9)) { ctx.fillStyle='#f5b06c'; ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (pSkinId === 'tu') { if (!drawImageHelper('rab_head',cx,cy,GRID*1.9)) { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill(); } }
else if (pSkinId === 'long') { ctx.save(); ctx.translate(cx,cy); if (direction.x===1) { ctx.scale(-1,1); } else if (direction.x===-1) {} else if (direction.y===-1) { ctx.rotate(Math.PI/2); } else if (direction.y===1) { ctx.rotate(-Math.PI/2); } if (!drawImageHelper('dragon_head',0,0,GRID*2.0)) { ctx.fillStyle='#e0f5ec'; ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (pSkinId === 'she') { if (!drawImageHelper('snake_head',cx,cy,GRID*1.9)) { ctx.fillStyle='#c5e8b8'; ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill(); } }
else if (pSkinId === 'ma') { ctx.save(); ctx.translate(cx,cy); if (direction.x===1) { ctx.scale(-1,1); } else if (direction.x===-1) {} else if (direction.y===-1) { ctx.rotate(Math.PI/2); } else if (direction.y===1) { ctx.rotate(-Math.PI/2); } if (!drawImageHelper('horse_head',0,0,GRID*1.9)) { ctx.fillStyle='#fdf0e0'; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (pSkinId === 'yang') { ctx.save(); ctx.translate(cx,cy); if (direction.x===1) { ctx.scale(-1,1); } else if (direction.x===-1) {} else if (direction.y===-1) { ctx.rotate(Math.PI/2); } else if (direction.y===1) { ctx.rotate(-Math.PI/2); } if (!drawImageHelper('sheep_head',0,0,GRID*2.0)) { ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (pSkinId === 'hou') { ctx.save(); ctx.translate(cx,cy); if (direction.x===1) { ctx.scale(-1,1); } else if (direction.x===-1) {} else if (direction.y===-1) { ctx.rotate(Math.PI/2); } else if (direction.y===1) { ctx.rotate(-Math.PI/2); } const hg = ctx.createRadialGradient(-3,-3,2,0,0,12); hg.addColorStop(0,'#ffd4a8'); hg.addColorStop(1,'#e08a3c'); ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#ffc8a0'; ctx.beginPath(); ctx.ellipse(-9,-3,4,5,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(9,-3,4,5,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#ffb088'; ctx.beginPath(); ctx.ellipse(0,3,7,6,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#4a3020'; ctx.beginPath(); ctx.arc(-4,-2,2.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4,-2,2.2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-3.2,-2.8,0.9,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4.8,-2.8,0.9,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#c96060'; ctx.beginPath(); ctx.arc(0,5,1.6,0,Math.PI*2); ctx.fill(); ctx.restore(); }
else if (pSkinId === 'ji') { ctx.save(); ctx.translate(cx,cy); if (direction.x===1) { ctx.scale(-1,1); } else if (direction.x===-1) {} else if (direction.y===-1) { ctx.rotate(Math.PI/2); } else if (direction.y===1) { ctx.rotate(-Math.PI/2); } ctx.fillStyle='#d02020'; ctx.beginPath(); ctx.moveTo(-3,-10); ctx.lineTo(-1,-16); ctx.lineTo(2,-13); ctx.lineTo(5,-17); ctx.lineTo(6,-11); ctx.closePath(); ctx.fill(); const hg = ctx.createRadialGradient(-3,-3,2,0,0,12); hg.addColorStop(0,'#fff0a0'); hg.addColorStop(1,'#e0b030'); ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#ffd54a'; ctx.beginPath(); ctx.moveTo(6,3); ctx.lineTo(13,5); ctx.lineTo(6,7); ctx.closePath(); ctx.fill(); ctx.fillStyle='#4a3020'; ctx.beginPath(); ctx.arc(-3.5,-1,2.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(3.5,-1,2.2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-2.8,-1.8,0.9,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4.2,-1.8,0.9,0,Math.PI*2); ctx.fill(); ctx.restore(); }
else if (pSkinId === 'gou') { ctx.save(); ctx.translate(cx,cy); if (direction.x===1) { ctx.scale(-1,1); } else if (direction.x===-1) {} else if (direction.y===-1) { ctx.rotate(Math.PI/2); } else if (direction.y===1) { ctx.rotate(-Math.PI/2); } ctx.fillStyle='#b08050'; ctx.beginPath(); ctx.moveTo(-9,-4); ctx.lineTo(-12,-13); ctx.lineTo(-4,-8); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(9,-4); ctx.lineTo(12,-13); ctx.lineTo(4,-8); ctx.closePath(); ctx.fill(); const hg = ctx.createRadialGradient(-3,-3,2,0,0,12); hg.addColorStop(0,'#f0d8b8'); hg.addColorStop(1,'#c09060'); ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#f0d8b8'; ctx.beginPath(); ctx.ellipse(0,4,7,6,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#3a2c20'; ctx.beginPath(); ctx.arc(-3.5,-1,2.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(3.5,-1,2.2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-2.8,-1.8,0.9,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4.2,-1.8,0.9,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#3a2c20'; ctx.beginPath(); ctx.ellipse(0,5,2.4,1.8,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
else if (pSkinId === 'zhu') { ctx.save(); ctx.translate(cx,cy); if (direction.x===1) { ctx.scale(-1,1); } else if (direction.x===-1) {} else if (direction.y===-1) { ctx.rotate(Math.PI/2); } else if (direction.y===1) { ctx.rotate(-Math.PI/2); } ctx.fillStyle='#e07a90'; ctx.beginPath(); ctx.moveTo(-8,-4); ctx.lineTo(-10,-11); ctx.lineTo(-4,-7); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(8,-4); ctx.lineTo(10,-11); ctx.lineTo(4,-7); ctx.closePath(); ctx.fill(); const hg = ctx.createRadialGradient(-3,-3,2,0,0,12); hg.addColorStop(0,'#ffe0e8'); hg.addColorStop(1,'#e89cb0'); ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#ffb8c8'; ctx.beginPath(); ctx.ellipse(0,4,7,5.5,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#c96080'; ctx.beginPath(); ctx.arc(-2.2,4.5,1,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(2.2,4.5,1,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#3a2c20'; ctx.beginPath(); ctx.arc(-3.5,-1,2.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(3.5,-1,2.2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-2.8,-1.8,0.9,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4.2,-1.8,0.9,0,Math.PI*2); ctx.fill(); ctx.restore(); }
// 咕嘎的头部是一张正面朝前的 Q 版脸，跟「兔/蛇/羊」一样**不跟随方向旋转**——
// 把它转 90° 会变成一个躺着的头，很怪。要方向感就靠身体和食物的位置去判断。
// box 取 GRID*1.65：别的皮肤头 dpx 是按 sourceSize 缩放的，实际可见宽度只有
// 27~34px（虎 27 / 龙 33 / 羊 34），所以这里也用 33px 对齐，不然咕嘎的头会明显偏大。
else if (pSkinId === 'guga') { if (!drawBoxHelper('guga_head',cx,cy,GRID*1.65)) { const hg = ctx.createRadialGradient(cx-3,cy-3,2,cx,cy,12); hg.addColorStop(0,'#ffd9a8'); hg.addColorStop(1,'#e07a2e'); ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(cx,cy,11,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#3a2c20'; ctx.beginPath(); ctx.arc(cx-3.5,cy-1,2.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+3.5,cy-1,2.2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx-2.8,cy-1.8,0.9,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+4.2,cy-1.8,0.9,0,Math.PI*2); ctx.fill(); } }
else { const headGrad = ctx.createLinearGradient(x,y,x+GRID,y+GRID); headGrad.addColorStop(0, headColors[0]); headGrad.addColorStop(0.5, headColors[1]); headGrad.addColorStop(1, headColors[2]); 
// ★ 美术重做：蛇头把「光晕 + 主色块 + 描边 + 高光 + 眼睛」拆开画，层次分明
// 外层柔光：用 P1/P2 主题色，让蛇头在深色棋盘上自带光源
const glowCol = p.id === 'p2' ? 'rgba(241,91,181,' : 'rgba(0,245,212,';
const headGlow = ctx.createRadialGradient(cx,cy,2,cx,cy,GRID*1.35);
headGlow.addColorStop(0, glowCol + '0.30)');
headGlow.addColorStop(1, glowCol + '0)');
ctx.fillStyle=headGlow; ctx.fillRect(x-8,y-8,GRID+16,GRID+16);
// 主色块
ctx.fillStyle=headGrad; roundRect(ctx,x+1.5,y+1.5,GRID-3,GRID-3,7); ctx.fill();
// 深色描边
ctx.strokeStyle='rgba(4,10,16,0.55)'; ctx.lineWidth=1.2;
roundRect(ctx,x+2.1,y+2.1,GRID-4.2,GRID-4.2,6.5); ctx.stroke();
// 顶部高光弧：只盖住上半部分，做出「圆润的头顶」
ctx.save();
roundRect(ctx,x+1.5,y+1.5,GRID-3,GRID-3,7); ctx.clip();
const hhGrad = ctx.createLinearGradient(0, y+1.5, 0, y+GRID*0.62);
hhGrad.addColorStop(0,'rgba(255,255,255,0.42)');
hhGrad.addColorStop(1,'rgba(255,255,255,0)');
ctx.fillStyle = hhGrad;
ctx.fillRect(x+1.5, y+1.5, GRID-3, GRID*0.6);
ctx.restore();
// 眼睛：白眼球 + 深色瞳，朝向随移动方向，有眼神才像活物
const eyeOff = GRID*0.17;
const perpX = direction.y !== 0 ? 1 : 0;
const perpY = direction.x !== 0 ? 1 : 0;
const lookX = (direction.x || 0) * GRID*0.10;
const lookY = (direction.y || 0) * GRID*0.10;
const e1x = cx + perpX*eyeOff + lookX, e1y = cy + perpY*eyeOff + lookY;
const e2x = cx - perpX*eyeOff + lookX, e2y = cy - perpY*eyeOff + lookY;
ctx.fillStyle='rgba(255,255,255,0.95)';
ctx.beginPath(); ctx.arc(e1x,e1y,GRID*0.155,0,Math.PI*2); ctx.fill();
ctx.beginPath(); ctx.arc(e2x,e2y,GRID*0.155,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#0a1018';
ctx.beginPath(); ctx.arc(e1x+lookX*0.5,e1y+lookY*0.5,GRID*0.082,0,Math.PI*2); ctx.fill();
ctx.beginPath(); ctx.arc(e2x+lookX*0.5,e2y+lookY*0.5,GRID*0.082,0,Math.PI*2); ctx.fill();
}
} else {
if (pSkinId === 'shu') {
const scx=x+GRID/2, scy=y+GRID/2;
ctx.fillStyle='#f0e0c8'; ctx.beginPath(); ctx.arc(scx,scy,8.5,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#e8c9a0'; ctx.beginPath(); ctx.ellipse(scx-6,scy-5,3.5,4,-0.2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(scx+6,scy-5,3.5,4,0.2,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#5a4030'; ctx.beginPath(); ctx.arc(scx-3,scy-1,1.6,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(scx+3,scy-1,1.6,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(scx-2.5,scy-1.5,0.6,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(scx+3.5,scy-1.5,0.6,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#e89a8a'; ctx.beginPath(); ctx.arc(scx,scy+2.5,1.3,0,Math.PI*2); ctx.fill();
} else if (pSkinId === 'niu') {
const scx=x+GRID/2, scy=y+GRID/2;
let angle = -Math.PI/2;
if (i>0 && p.body[i-1]) { const prev = p.body[i-1]; angle = Math.atan2(prev.y-seg.y, prev.x-seg.x); }
ctx.save(); ctx.translate(scx,scy); ctx.rotate(angle+Math.PI/2);
const STROKE='#7a4a24'; ctx.lineJoin='round';
const bodyPath = () => { ctx.beginPath(); ctx.moveTo(-6.4,-2); ctx.lineTo(-6.4,6); ctx.quadraticCurveTo(-6.4,10.4,-2,10.4); ctx.lineTo(2,10.4); ctx.quadraticCurveTo(6.4,10.4,6.4,6); ctx.lineTo(6.4,-2); ctx.closePath(); };
const capPath = () => { ctx.beginPath(); ctx.moveTo(-5.4,-6.4); ctx.lineTo(-5.4,-2.4); ctx.lineTo(5.4,-2.4); ctx.lineTo(5.4,-6.4); ctx.quadraticCurveTo(0,-8.2,-5.4,-6.4); ctx.closePath(); };
const nipplePath = () => { ctx.beginPath(); ctx.moveTo(-2.5,-6.2); ctx.quadraticCurveTo(-2.3,-10.4,0,-11); ctx.quadraticCurveTo(2.3,-10.4,2.5,-6.2); ctx.closePath(); };
ctx.fillStyle='#fffdf5'; ctx.strokeStyle='#fffdf5'; ctx.lineWidth=3.2; bodyPath(); ctx.fill(); ctx.stroke(); capPath(); ctx.fill(); ctx.stroke(); nipplePath(); ctx.fill(); ctx.stroke();
bodyPath(); ctx.fillStyle='#ffffff'; ctx.fill();
ctx.save(); bodyPath(); ctx.clip(); const milkG=getNiuMilkGradient(); ctx.fillStyle=milkG; ctx.fillRect(-7,0.5,14,11); ctx.restore();
bodyPath(); ctx.strokeStyle=STROKE; ctx.lineWidth=1.2; ctx.stroke();
const capG=ctx.createLinearGradient(0,-7,0,-2); capG.addColorStop(0,'#fbe49e'); capG.addColorStop(1,'#efbb46'); capPath(); ctx.fillStyle=capG; ctx.fill(); ctx.strokeStyle=STROKE; ctx.lineWidth=1.2; ctx.stroke();
nipplePath(); ctx.fillStyle='#ffe0b0'; ctx.fill(); ctx.strokeStyle=STROKE; ctx.lineWidth=1.15; ctx.stroke();
ctx.restore();
} else if (pSkinId === 'hu') { if (!drawImageHelper('body',cx,cy,GRID*1.8)) { ctx.fillStyle='#f5b06c'; ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill(); } }
else if (pSkinId === 'tu') { if (!drawImageHelper('rab_body',cx,cy,GRID*1.9)) { ctx.fillStyle='#ffe4e8'; ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill(); } }
else if (pSkinId === 'long') { const head = p.body[0]; if (!head) return; const a2h = Math.atan2(head.y-seg.y, head.x-seg.x); ctx.save(); ctx.translate(cx,cy); ctx.rotate(a2h+Math.PI/2); if (!drawImageHelper('dragon_tail',0,0,GRID*1.9)) { ctx.fillStyle='#a8e6cf'; ctx.beginPath(); ctx.ellipse(0,0,12,9,0,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (pSkinId === 'she') { const head = p.body[0]; if (!head) return; const a2h = Math.atan2(head.y-seg.y, head.x-seg.x); ctx.save(); ctx.translate(cx,cy); ctx.rotate(a2h); if (Math.abs(a2h)>Math.PI/2) ctx.scale(1,-1); if (!drawImageHelper('snake_tail',0,0,GRID*1.2)) { ctx.fillStyle='#c5e8b8'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (pSkinId === 'ma') { const head = p.body[0]; if (!head) return; const a2h = Math.atan2(head.y-seg.y, head.x-seg.x); ctx.save(); ctx.translate(cx,cy); ctx.rotate(a2h+Math.PI/2); if (!drawImageHelper('horse_tail',0,0,GRID*1.9)) { ctx.fillStyle='#fdf0e0'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); } ctx.restore(); }
else if (pSkinId === 'yang') { if (!drawImageHelper('sheep_tail',cx,cy,GRID*1.9)) { ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill(); } }
else if (pSkinId === 'hou') { if (!drawImageHelper('hou_body',cx,cy,GRID*1.9)) { ctx.fillStyle='#ffb88c'; roundRect(ctx, cx-GRID*0.4, cy-GRID*0.4, GRID*0.8, GRID*0.8, 6); ctx.fill(); } }
else if (pSkinId === 'ji') { if (!drawImageHelper('ji_body',cx,cy,GRID*1.9)) { ctx.fillStyle='#ffcc33'; roundRect(ctx, cx-GRID*0.4, cy-GRID*0.4, GRID*0.8, GRID*0.8, 6); ctx.fill(); } }
else if (pSkinId === 'gou') { if (!drawImageHelper('gou_body',cx,cy,GRID*1.9)) { ctx.fillStyle='#d4a870'; roundRect(ctx, cx-GRID*0.4, cy-GRID*0.4, GRID*0.8, GRID*0.8, 6); ctx.fill(); } }
else if (pSkinId === 'zhu') { if (!drawImageHelper('zhu_body',cx,cy,GRID*1.9)) { ctx.fillStyle='#ff9eb0'; roundRect(ctx, cx-GRID*0.4, cy-GRID*0.4, GRID*0.8, GRID*0.8, 6); ctx.fill(); } }
else if (pSkinId === 'guga') {
// 咕嘎：身体每一节从「像素女孩」「企鹅全身」两张图里随机取一张。
// tex 在首次绘制时定下来就固定住 —— 若每帧都 Math.random()，这一节会疯狂闪烁。
// 真正"随机出现"的时机交给 update()：每次吃到食物，给刚变长的尾节重掷一次。
if (seg.tex === undefined) seg.tex = Math.random() < 0.5 ? 0 : 1;
if (!drawBoxHelper(seg.tex ? 'guga_tail2' : 'guga_tail1', cx, cy, GRID*1.45)) {
  ctx.fillStyle = seg.tex ? '#5b6270' : '#ffb0c8';
  roundRect(ctx, cx-GRID*0.4, cy-GRID*0.4, GRID*0.8, GRID*0.8, 6); ctx.fill();
}
}
else {
const hue = p.bodyHue;
const t = i/Math.max(p.body.length-1,1);
const inset = 2.5+t*1.8;
const bx0 = x+inset, by0 = y+inset, bw = GRID-inset*2, bh = GRID-inset*2;
// ★ 美术重做：默认皮肤的身体段从「一个纯色圆角块」升级成三段式：
//    ① 圆角块 + 深色描边（在深色棋盘上有清晰轮廓，不再糊）
//    ② 上缘一层白色高光条（模拟顶光）
//    ③ 下缘叠加更深的同色（模拟自身投影）
const baseR = Math.floor(hue.r+t*40), baseG = Math.floor(hue.g-t*60), baseB = Math.floor(hue.b-t*40);
// 主色块
ctx.fillStyle = 'rgb('+baseR+','+baseG+','+baseB+')';
roundRect(ctx, bx0, by0, bw, bh, 5.5); ctx.fill();
// 深色描边：用主色压暗 55%，比纯黑描边更和谐
ctx.strokeStyle = 'rgba('+Math.floor(baseR*0.35)+','+Math.floor(baseG*0.35)+','+Math.floor(baseB*0.35)+',0.85)';
ctx.lineWidth = 1.1;
roundRect(ctx, bx0+0.55, by0+0.55, bw-1.1, bh-1.1, 5.2); ctx.stroke();
// 上缘高光条：顶端 35% 高度，白色渐隐
ctx.save();
roundRect(ctx, bx0, by0, bw, bh, 5.5); ctx.clip();
const hlGrad = ctx.createLinearGradient(0, by0, 0, by0+bh*0.6);
hlGrad.addColorStop(0, 'rgba(255,255,255,0.34)');
hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = hlGrad;
ctx.fillRect(bx0, by0, bw, bh*0.6);
// 下缘自阴影
const shGrad = ctx.createLinearGradient(0, by0+bh*0.55, 0, by0+bh);
shGrad.addColorStop(0, 'rgba(0,0,0,0)');
shGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
ctx.fillStyle = shGrad;
ctx.fillRect(bx0, by0+bh*0.55, bw, bh*0.45);
ctx.restore();
}
}
});

if (isInvincibleNow || isGhostNow) ctx.globalAlpha = 1;
}

function getGhostColorP1(s) {
if (s < 80) return { r:0, g:245, b:212 };
if (s < 200) { const t = (s-80)/120; return { r:Math.floor(0+t*255), g:Math.floor(245-t*100), b:Math.floor(212-t*150) }; }
if (s < 400) { const t = (s-200)/200; return { r:255, g:Math.floor(145-t*100), b:Math.floor(62+t*50) }; }
if (s < 700) { const t = (s-400)/300; return { r:Math.floor(255-t*100), g:Math.floor(45-t*45), b:Math.floor(112+t*143) }; }
return { r:155, g:0, b:255 };
}
function getGhostColorP2(s) {
if (s < 80) return { r:255, g:158, b:199 };
if (s < 200) { const t = (s-80)/120; return { r:255, g:Math.floor(158-t*67), b:Math.floor(199+t*56) }; }
return { r:155, g:0, b:255 };
}

function drawShield(p) {
if (!p || !p.body || !p.body[0]) return;
const hx = p.body[0].x * GRID + GRID/2;
const hy = p.body[0].y * GRID + GRID/2;
// ★ 美术重做：护盾从「两个同心圆」升级为「能量罩」——
//    双环反向自转 + 六边形格纹 + 呼吸明暗，看起来像一层真的能量膜
const shieldPulse = 0.85 + Math.sin(foodPulse * 2.5) * 0.15;
const shieldRadius = GRID * 1.1 * shieldPulse;
const spin = drawNowTs / 900;
ctx.save();
ctx.globalAlpha = 0.8;
// 外层光晕
const shGlow = ctx.createRadialGradient(hx, hy, GRID*0.3, hx, hy, shieldRadius*1.8);
shGlow.addColorStop(0, 'rgba(0,255,200,0.48)');
shGlow.addColorStop(0.55, 'rgba(0,200,255,0.20)');
shGlow.addColorStop(1, 'rgba(0,200,255,0)');
ctx.fillStyle = shGlow; ctx.beginPath(); ctx.arc(hx, hy, shieldRadius*1.8, 0, Math.PI*2); ctx.fill();
// 双环反向自转：外环亮青、内环浅白
ctx.save(); ctx.translate(hx, hy);
ctx.rotate(spin);
ctx.strokeStyle = 'rgba(100,255,220,0.95)'; ctx.lineWidth = 2.5; ctx.lineCap='round';
ctx.beginPath(); ctx.arc(0, 0, shieldRadius, 0, Math.PI*1.6); ctx.stroke();
ctx.rotate(-spin*2.1);
ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.4;
ctx.beginPath(); ctx.arc(0, 0, shieldRadius*0.80, 0, Math.PI*1.25); ctx.stroke();
ctx.restore();
// 六边形能量格纹：取 6 个顶点画一个正六边形，弱描边
ctx.strokeStyle = 'rgba(140,255,235,0.34)'; ctx.lineWidth = 1;
ctx.beginPath();
for (let k = 0; k <= 6; k++) {
  const a = spin*0.6 + k * Math.PI / 3;
  const px2 = hx + Math.cos(a) * shieldRadius * 0.62;
  const py2 = hy + Math.sin(a) * shieldRadius * 0.62;
  if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
}
ctx.stroke();
ctx.restore();
}

function drawCat() {
if (!cat) return;
const catCX = cat.x*GRID+GRID/2, catCY = cat.y*GRID+GRID/2;
const stuned = cat.stunLeft > 0;
// ★ 美术重做：野猫的威胁感来自「范围光 + 地面暗影 + 残留爪痕 + 主体」四层。
//    旧版只有一层平涂光晕，看不出这是"猎手"；现在用红色锥形余晖 + 轨迹拖尾强化压迫感。
const isPursuit = !stuned;   // 追猎状态才给红色威慑光，被眩晕时转为紫色
ctx.save();
const catGlow = ctx.createRadialGradient(catCX,catCY,GRID*0.2,catCX,catCY,GRID*2.0);
if (stuned) {
  catGlow.addColorStop(0, 'rgba(160,108,213,0.55)');
  catGlow.addColorStop(0.55, 'rgba(160,108,213,0.18)');
  catGlow.addColorStop(1, 'rgba(160,108,213,0)');
} else {
  catGlow.addColorStop(0, 'rgba(255,70,70,0.50)');
  catGlow.addColorStop(0.45, 'rgba(255,60,60,0.16)');
  catGlow.addColorStop(1, 'rgba(255,60,60,0)');
}
ctx.fillStyle = catGlow; ctx.beginPath(); ctx.arc(catCX,catCY,GRID*2.0,0,Math.PI*2); ctx.fill();
// 地面暗影：让猫看起来贴地而非悬空
ctx.fillStyle = 'rgba(0,0,0,0.42)';
ctx.beginPath(); ctx.ellipse(catCX, catCY+GRID*0.40, GRID*0.48, GRID*0.16, 0, 0, Math.PI*2); ctx.fill();
ctx.restore();
// 轨迹拖尾：从尾到头逐渐加深，形成"冲刺残影"
catTrail.forEach((ct, ci) => {
if (!ct) return;
const t = (ci+1)/catTrail.length;
ctx.globalAlpha = t*0.30;
ctx.fillStyle = stuned ? 'rgba(180,130,235,0.8)' : 'rgba(255,70,70,0.85)';
ctx.beginPath(); ctx.arc(ct.x*GRID+GRID/2, ct.y*GRID+GRID/2, GRID*(0.16+0.26*t), 0, Math.PI*2); ctx.fill();
});
ctx.globalAlpha = 1;
ctx.save(); ctx.translate(catCX, catCY);
if (stuned) {
  // 眩晕：三颗紫色星点绕头顶公转，外加一圈抖动的弧
  const rot = drawNowTs / 200;
  ctx.strokeStyle = 'rgba(200,140,255,0.9)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const a = rot + k * (Math.PI * 2 / 3);
    const sx = Math.cos(a) * GRID * 0.7;
    const sy = Math.sin(a) * GRID * 0.35 - GRID * 0.6;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI*2);
    ctx.stroke();
  }
}
// 朝向翻转（保持原逻辑）
if (cat.dir.x === 1) ctx.scale(-1,1);
else if (cat.dir.x === -1) {}
else if (cat.dir.y === -1) ctx.rotate(Math.PI/2);
else if (cat.dir.y === 1) ctx.rotate(-Math.PI/2);
if (!drawImageHelper('cat_head',0,0,GRID*1.9)) {
// 图集未就绪时的矢量兜底：也画成一只有耳朵、有眼睛的猫头，而不是一个红圆
ctx.fillStyle = stuned ? '#a06cd5' : '#ff4d4d';
ctx.beginPath(); ctx.arc(0,0,GRID*0.45,0,Math.PI*2); ctx.fill();
ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1.2; ctx.stroke();
// 耳朵
ctx.beginPath(); ctx.moveTo(-GRID*0.34,-GRID*0.28); ctx.lineTo(-GRID*0.46,-GRID*0.60); ctx.lineTo(-GRID*0.10,-GRID*0.42); ctx.closePath(); ctx.fill();
ctx.beginPath(); ctx.moveTo(GRID*0.34,-GRID*0.28); ctx.lineTo(GRID*0.46,-GRID*0.60); ctx.lineTo(GRID*0.10,-GRID*0.42); ctx.closePath(); ctx.fill();
// 眼睛
ctx.fillStyle='#ffe94d';
ctx.beginPath(); ctx.ellipse(-GRID*0.16,-GRID*0.05,GRID*0.09,GRID*0.11,0,0,Math.PI*2); ctx.fill();
ctx.beginPath(); ctx.ellipse(GRID*0.16,-GRID*0.05,GRID*0.09,GRID*0.11,0,0,Math.PI*2); ctx.fill();
ctx.fillStyle='#10161f';
ctx.fillRect(-GRID*0.175,-GRID*0.16,GRID*0.03,GRID*0.22);
ctx.fillRect(GRID*0.145,-GRID*0.16,GRID*0.03,GRID*0.22);
}
ctx.restore();
}

function togglePause() {
if (isGameOver) { startGame(); return; }
if (!loopActive && !isPaused) { startGame(); return; }
isPaused = !isPaused;
const backBtn = document.getElementById('backToMenuBtn');
if (isPaused) {
  stopLoop();
  playBgm('menu');
  overlay.classList.add('paused');
  overlayTitle.textContent = '暂时闭关';
  overlayMsg.textContent = '按空格继续修炼';
  startBtn.style.display = 'none';
  if (backBtn) backBtn.style.display = 'block';
  overlay.classList.remove('hidden');
  updateRecordHint();
} else {
  overlay.classList.add('hidden');
  overlay.classList.remove('paused');
  startBtn.style.display = 'block';
  if (backBtn) backBtn.style.display = 'none';
  updateGameBgm();
  startLoop();
}
}

// ★ 方向输入的队列容量。手机上快速连划（上→左→下）时，一帧内可能收到两次转向，
//   只留一个槽位必然丢指令；留两个既够用又不会让操作"迟滞"。
const DIR_QUEUE_MAX = 2;
// ★ 四个方向做成**冻结的共享常量**：队列里存的是这几个对象的引用，
//   而不是每次新建 {x,y} —— 手机上连划时每帧都要 push/shift，
//   新建对象会持续制造垃圾，帧时间出现周期性尖刺（GC 抖动）。
//   冻结是为了把这个前提固化：万一以后有人写 p.nextDir.x = -1，
//   会立刻报错，而不是悄悄把全局常量改掉、让所有蛇一起抽风。
const DIR_VECTORS = Object.freeze({
  up:    Object.freeze({ x: 0,  y: -1 }),
  down:  Object.freeze({ x: 0,  y: 1 }),
  left:  Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1,  y: 0 })
});

function setDirection(playerIdx, dir) {
if (isPaused || isGameOver) return;
if (!snakes[playerIdx] || !snakes[playerIdx].alive) return;
const p = snakes[playerIdx];
// ★ 合作模式复活等待中：玩家第一次按方向就解除等待，从出生点正常起步
if (p.coopWaiting) {
  p.coopWaiting = false;
  p.invincibleUntil = performance.now() + 1500;
}
const nd = DIR_VECTORS[dir];
if (!nd) return;
if (!p.dirQueue) p.dirQueue = [];
const q = p.dirQueue;
// 判反向 / 判重复都以「队列里最后一个待执行方向」为基准，队列空时才回退到当前行进方向。
// 用 p.dir 判的话，一帧内连按两个方向时第二个会被误判成反向而丢弃。
const ref = q.length ? q[q.length - 1] : p.dir;
if (nd.x === ref.x && nd.y === ref.y) return;          // 同向，忽略
if (nd.x === -ref.x && nd.y === -ref.y) return;        // 180° 反向，忽略（撞自己）
if (q.length >= DIR_QUEUE_MAX) q.shift();              // 队列满了就顶掉最旧的一个
q.push(nd);
}

function triggerActiveSkill(playerIdx) {
  const p = snakes[playerIdx];
  if (!p || !p.alive) return;
  if (isPaused || isGameOver) return;
  const now = performance.now();

  if (p.skinId === 'she') {
    if (p.ghostLeft <= 0) return;
    if (p.ghostMode && now < p.ghostUntil) return;
    p.ghostLeft--;
    p.ghostMode = true;
    p.ghostUntil = now + 3000;
    p.invincibleUntil = p.ghostUntil;
    vibrate([60,30,60]);
    if (p.body && p.body[0]) spawnParticles(p.body[0].x, p.body[0].y, '#a06cd5');
    showCheatToast('🐍 蛇符咒·隐踪！幽灵模式 3 秒（剩余 ' + p.ghostLeft + ' 次）', 1000);
    if (window.__updateSkillBtn) window.__updateSkillBtn();
    return;
  }

  if (p.skinId === 'hu') {
    if (p.phantomLeft <= 0) return;
    if (p.phantomData && now < p.phantomUntil) return;
    p.phantomLeft--;
    let placed = false, px = 15, py = 15;
    for (let t = 0; t < 50 && !placed; t++) {
      px = 3 + Math.floor(Math.random() * (COLS - 6));
      py = 3 + Math.floor(Math.random() * (ROWS - 6));
      if (obstacles.some(o => o.x === px && o.y === py)) continue;
      if (p.body.some(s => s.x === px && s.y === py)) continue;
      if (cat && cat.x === px && cat.y === py) continue;
      placed = true;
    }
    const phantomBody = [{x: px, y: py}];
    for (let i = 1; i <= 2; i++) phantomBody.push({ x: px - i, y: py });
    p.phantomData = { body: phantomBody };
    // ★ 虎觉醒：幻影 5 秒 → 8 秒
    const phantomDur = isSkinAwakened('hu') ? 8000 : 5000;
    p.phantomUntil = now + phantomDur;
    vibrate([60,30,60]);
    spawnParticles(px, py, '#ffcc66');
    showCheatToast('🐯 虎符咒·分身！幻影出现 ' + (phantomDur/1000) + ' 秒（剩余 ' + p.phantomLeft + ' 次）' + (isSkinAwakened('hu') ? ' · 觉醒' : ''), 1000);
    if (window.__updateSkillBtn) window.__updateSkillBtn();
    return;
  }

  if (p.skinId === 'long') {
    if (p.longLeft <= 0) return;
    if (now < p.longCdUntil) {
      const left = Math.ceil((p.longCdUntil - now) / 1000);
      showCheatToast('🐲 炎爆冷却中（' + left + ' 秒）', 800);
      return;
    }
    p.longLeft--;
    p.longCdUntil = now + 5000;
    const head = p.body[0];
    const dir = p.dir;
    const cells = [];
    for (let i = 1; i <= 5; i++) {
      const fx = head.x + dir.x * i;
      const fy = head.y + dir.y * i;
      if (fx < 0 || fx >= COLS || fy < 0 || fy >= ROWS) break;
      cells.push({x: fx, y: fy});
      if (hasObstacleAt(fx, fy)) {
        removeObstacleAt(fx, fy);
        spawnParticles(fx, fy, '#ffaa00');
      }
      if (catActive && cat && cat.x === fx && cat.y === fy) {
        cat.stunLeft = (cat.stunLeft || 0) + 1;
        p.longHitCatCount = (p.longHitCatCount || 0) + 1;
        spawnParticles(fx, fy, '#ff4400');
        if (p.longHitCatCount >= 2) {
          catActive = false;
          cat = null;
          catTrail = [];
          p.score += 100;
          if (gameMode === 'single') score = p.score;
          scoreEl.textContent = p.score;
          updateHighScore(p.score);
          showCheatToast('🐲 龙符咒·炎爆！两次全中，野猫被烧死 +100 分！', 1600);
        } else {
          showCheatToast('🐲 炎爆击中野猫！猫停 1 次移动（已击中 ' + p.longHitCatCount + '/2）', 1200);
        }
      }
    }
    p.longFireCells = cells;
    p.longFireUntil = now + 400;
    vibrate([80,30,80]);
    shakeAmount = 15;
    showCheatToast('🐲 龙符咒·炎爆！（剩余 ' + p.longLeft + ' 次）', 1000);
    if (window.__updateSkillBtn) window.__updateSkillBtn();
    return;
  }

  if (p.skinId === 'yang') {
    if (p.yangLeft <= 0) return;
    p.yangLeft--;
    vibrate([60,30,60]);
    if (catActive && cat) {
      cat.stunLeft = (cat.stunLeft || 0) + 3;
      spawnParticles(cat.x, cat.y, '#c8a8e8');
      showCheatToast('🐑 羊符咒·魂游！眩晕野猫 3 次移动（剩余 ' + p.yangLeft + ' 次）', 1200);
    } else {
      p.invincibleUntil = now + 3000;
      if (p.body && p.body[0]) spawnParticles(p.body[0].x, p.body[0].y, '#c8a8e8');
      showCheatToast('🐑 羊符咒·魂游！无敌 3 秒（剩余 ' + p.yangLeft + ' 次）', 1200);
    }
    if (window.__updateSkillBtn) window.__updateSkillBtn();
    return;
  }
}

function triggerGhostSkill(playerIdx) { triggerActiveSkill(playerIdx); }

window.__triggerGhostSkill = triggerGhostSkill;
window.__triggerActiveSkill = triggerActiveSkill;

function startGame() {
  // ★ 种子模式：重置 RNG 到种子初始状态
  if (currentSeedId !== null) {
    const seedLevel = SEED_LEVELS.find(s => s.id === currentSeedId);
    if (seedLevel) {
      gameRng = mulberry32(seedLevel.seed);
    }
  }
  startBtn.style.display='block';
  overlay.classList.remove('paused');
  // 开局就清掉结算态标记，模式提示恢复显示（下一局结束时会再标记上）
  overlay.classList.remove('gameover');
  stopLoop();
  // ★ 合作模式的生命条只在合作局显示，其它模式进来先隐藏干净
  setCoopLivesHudVisible(gameMode === 'coop');
  initGame();
  applyEquippedItem();
  startLoop();
  if (window.__updateSkillBtn) window.__updateSkillBtn();
}

// 暴露给 ui.js 调用的种子模式入口
window.__startSeedGame = function(seedId) {
  currentSeedId = seedId;
  gameMode = 'single';
  setCoopLivesHudVisible(false);
  startGame();
};
// ★ 合作模式入口：与双人模式共用皮肤选择弹窗，选完直接开打
window.__startCoopGame = function() {
  setCoopLivesHudVisible(true);
  startGame();
};
window.__clearSeedMode = function() {
  currentSeedId = null;
  gameRng = Math.random;
};
// ★ 提交排行榜成绩
async function submitLeaderboardScore(seedId, playerName, score, length, titleName) {
  try {
    const res = await fetch('https://zhipu.wange5232.workers.dev/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seedId, playerName, score, length,
        title: titleName || ''   // ★ 称号名（不是 id），未佩戴时为空字符串
      })
    });
    const data = await res.json();
    if (data.error) {
      showCheatToast('⚠️ ' + data.error, 2000);
    } else {
      showCheatToast('🏆 成绩已上传排行榜！', 1500);
    }
  } catch (e) {
    console.warn('排行榜提交失败:', e);
  }
}
// ===== 暂停时 · 返回主菜单 =====
document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backToMenuBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const el = document.getElementById('globalLoading');
      if (el) {
        const txt = document.getElementById('globalLoadingText');
        const bar = document.getElementById('globalLoadingProgress');
        if (txt) txt.textContent = '🏠 返回主菜单...';
        el.classList.remove('hidden');
        if (bar) {
          bar.style.width = '0%';
          requestAnimationFrame(() => {
            bar.style.width = '60%';
            setTimeout(() => { bar.style.width = '100%'; }, 250);
          });
        }
        setTimeout(() => { window.location.reload(); }, 650);
      } else {
        window.location.reload();
      }
    });
  }
});