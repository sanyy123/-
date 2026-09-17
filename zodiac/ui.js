// ===== 成就 UI =====
function renderAchievements() {
achieveListEl.innerHTML = ''; let unlockedCount = 0;
ACHIEVEMENTS.forEach(a => {
const isUnlocked = unlocked.includes(a.id); if (isUnlocked) unlockedCount++;
const progress = a.progress(); const item = document.createElement('div');
item.className = 'achieve-item' + (isUnlocked ? ' unlocked' : '');
item.innerHTML = '<div class="achieve-icon">'+a.icon+'</div><div class="achieve-info"><div class="achieve-name">'+(isUnlocked ? a.name : '？？？')+'</div><div class="achieve-desc">'+a.desc+'</div>'+( !isUnlocked ? '<div class="achieve-progress"><div class="achieve-progress-bar" style="width:'+(progress*100)+'%"></div></div>' : '' )+'</div>';
achieveListEl.appendChild(item);
});
achieveCountEl.textContent = unlockedCount + '/' + ACHIEVEMENTS.length;
}
function checkAchievements() {
// 双人与合作模式都不参与普通成就
if (gameMode === 'double' || gameMode === 'coop') { renderAchievements(); return; }
let newly = [];
ACHIEVEMENTS.forEach(a => { if (!unlocked.includes(a.id) && a.check()) { unlocked.push(a.id); newly.push(a); } });
if (newly.length) { saveAchievements(); renderAchievements(); newly.forEach((a,i)=>setTimeout(()=>showAchieveToast(a), i*1800)); } else renderAchievements();
}
function showAchieveToast(a) { toastIcon.textContent = a.icon; toastName.textContent = a.name; achieveToast.classList.add('show'); setTimeout(()=>achieveToast.classList.remove('show'), 2800); }

function showCheatToast(msg, duration) {
const t = document.createElement('div');
t.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg,#00f5d4,#9b5de5);color:#0a0e17;padding:16px 32px;border-radius:16px;font-weight:800;font-size:1.1rem;z-index:200;box-shadow:0 15px 40px rgba(0,245,212,0.5);pointer-events:none;transition:opacity 0.5s;max-width:80%;text-align:center;';
t.textContent = msg;
document.body.appendChild(t);
const dur = duration || 1800;
setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(), 500); }, dur);
}
function cheatUnlockSkins() {
Object.values(SKINS).forEach(s => { if (s.unlockId) cheatSkins.add(s.unlockId); });
SM.setJSON('snakeCheatSkins', [...cheatSkins]);
renderSkins(); draw();
showCheatToast('🐉 520 作弊成功 · 全部皮肤已解锁！');
}
function cheatUnlockAll() {
  // 1) 解锁全部成就
  ACHIEVEMENTS.forEach(a => { if (!unlocked.includes(a.id)) unlocked.push(a.id); });
  saveAchievements();

  // 2) 解锁全部皮肤（作弊皮肤集合）
  Object.values(SKINS).forEach(s => { if (s.unlockId) cheatSkins.add(s.unlockId); });
  SM.setJSON('snakeCheatSkins', [...cheatSkins]);

  // 3) 解锁全部称号
  const allTitleIds = TITLES.map(t => t.id);
  unlockedTitles = [...new Set([...unlockedTitles, ...allTitleIds])];
  SM.setJSON(TITLES_KEY, unlockedTitles);

  // 4) 好感度全满
  const maxAff = {};
  Object.keys(INN_CHARACTERS).forEach(k => { maxAff[k] = INN_MAX_AFFINITY; });
  SM.setJSON(INN_AFFINITY_KEY, maxAff);

  // 5) 刷新 UI
  renderAchievements();
  renderSkins();
  if (typeof renderTitles === 'function') renderTitles();
  draw();

  showCheatToast('✨ 1314 作弊成功 · 皮肤 + 成就 + 称号 + 好感度 全解锁！', 2200);
}

// ★ 单独解锁全部好感度（作弊码 521）
function cheatUnlockAffinity() {
  const maxAff = {};
  Object.keys(INN_CHARACTERS).forEach(k => { maxAff[k] = INN_MAX_AFFINITY; });
  SM.setJSON(INN_AFFINITY_KEY, maxAff);
  showCheatToast('💗 521 作弊成功 · 全部生肖好感度已满！', 2000);
}

// ==================== ★ AI 评语配置（从 data.js 统一读取）★ ====================
// AI_API_KEY / AI_BASE_URL / AI_MODEL 已在 data.js 中定义，此处不再重复声明

const AI_SYSTEM_PROMPT = [
'你是"小江湖"，是十二生肖闯江湖客栈的老板娘，性格古灵精怪、说话带江湖气。',
'',
'【身份设定】',
'- 你开着一家叫"江湖客栈"的酒馆，玩家是你的老熟客。',
'- 你爱叫他/她"宝宝"，语气亲切，但不会谄媚。',
'- 你会用武侠梗，比如"内力深厚"、"走位如风"、"差点走火入魔"、"江湖上又要传开了"。',
'',
'【四种游戏模式 - 必须区分对待】',
'1. 单人模式：玩家一个人闯江湖。点评他一个人的表现，可以夸走位、内力、胆识。',
'2. 双人对战：P1 和 P2 互相竞争，先到 300 分或对方先死获胜。点评必须强调"两个人""对决""谁压过谁""分出高下"，用"德比""宿敌""死斗"这类词，不要说"配合"。',
'3. 合作模式：P1/P2 是队友，共享 3 条命，一起闯江湖。点评必须强调"两个人""并肩""默契""共患难"，用"双剑合璧""同生共死"这类词，不要挑拨两人对立。',
'4. 种子局挑战：固定随机序列的公平竞争地图，每张图有全球排行榜。点评要提"这张图""挑战""刷分""榜上"，可以调侃他"这张图又栽了几次"。',
'',
'【点评规则 - 必须严格遵守】',
'1. 每次点评必须严格基于本次玩家数据（积分、体长、吃掉食物数、游戏模式），结合数据给出针对性的一句话。',
'2. 禁止使用之前用过的点评角度、句式或梗，每次都要换一个切入点。',
'3. 每次点评的语气必须按照【本次语气要求】来，不能自己乱换。',
'4. 如果系统提供了【最近几次评语】，必须避开那些表达方式，不许和它们相似。',
'5. 评语不超过30字，直接输出评语，不加引号、不加前缀、不加表情符号。'
].join('\n');

const TONE_POOL = [
{ id: '傲娇',   desc: '嘴上嫌弃，其实是在夸；用"哼"、"才不是"、"勉强"等词。' },
{ id: '毒舌',   desc: '犀利吐槽但不伤人；用夸张对比、反话正说。' },
{ id: '装傻',   desc: '假装看不懂，瞎猜玩家在干什么；用"咦"、"难道"、"所以是"。' },
{ id: '江湖',   desc: '武侠旁白腔；用"此子"、"果然"、"不出所料"、"江湖传闻"。' },
{ id: '吃货',   desc: '一切从吃的角度点评；用食物作比喻。' },
{ id: '惊叹',   desc: '夸张惊讶；用"天呐"、"不可能"、"绝了"、"这谁敢信"。' },
{ id: '温柔',   desc: '像大姐姐一样温柔鼓励；用"没关系"、"慢慢来"、"进步了"。' },
{ id: '腹黑',   desc: '表面夸奖，暗地埋梗；用"呵呵"、"果然如此"、"我早说过"。' }
];

let recentComments = [];

async function generateAIComment(prompt, targetEl) {
if (!targetEl) return;
if (!AI_API_KEY || AI_API_KEY === '你的Groq_Key') {
targetEl.textContent = getFallbackComment();
return;
}
targetEl.textContent = '🤖 AI 正在思考...';
targetEl.style.opacity = '0.7';

try {
const response = await fetch(AI_BASE_URL + '/chat/completions', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'Authorization': 'Bearer ' + AI_API_KEY
},
body: JSON.stringify({
model: AI_MODEL,
messages: [
{ role: 'system', content: AI_SYSTEM_PROMPT },
{ role: 'user', content: prompt }
],stream: true,
temperature: 0.9,
max_tokens: 80
})
});

if (!response.ok) {
console.warn('Groq API 返回错误:', response.status);
throw new Error('API ' + response.status);
}

const reader = response.body.getReader();
const decoder = new TextDecoder('utf-8');
let buffer = '';
let fullText = '';
targetEl.textContent = '';
targetEl.style.opacity = '1';

while (true) {
const { done, value } = await reader.read();
if (done) break;
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split('\n');
buffer = lines.pop() || '';
for (const line of lines) {
const trimmed = line.trim();
if (!trimmed || !trimmed.startsWith('data:')) continue;
const dataStr = trimmed.slice(5).trim();
if (dataStr === '[DONE]') continue;
try {
const json = JSON.parse(dataStr);
const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
if (delta) { fullText += delta; targetEl.textContent = fullText; }
} catch (e) {}
}
}
if (!fullText.trim()) {
const fb = getFallbackComment();
targetEl.textContent = fb;
recentComments.push(fb);
if (recentComments.length > 5) recentComments.shift();
} else {
recentComments.push(fullText);
if (recentComments.length > 5) recentComments.shift();
}
} catch (err) {
console.warn('AI 评语失败:', err);
const fb = getFallbackComment();
targetEl.textContent = fb;
recentComments.push(fb);
if (recentComments.length > 5) recentComments.shift();
}
}

function getFallbackComment() {
const list = [
'宝宝，这走位江湖上怕是要传开了！',
'差一点就破纪录，下次一定行！',
'这蛇走的，比隔壁老王家的猫还溜。',
'积分不错，离大侠就差那么一点点。',
'哎哟，这操作看得我眼花缭乱！'
];
return list[Math.floor(Math.random() * list.length)];
}

function buildAIPrompt() {
  const tone = TONE_POOL[Math.floor(Math.random() * TONE_POOL.length)];
  window.__currentTone = tone.id;

  const isSeed   = (currentSeedId !== null && gameMode === 'single');
  const isDouble = (gameMode === 'double');
  const isCoop   = (gameMode === 'coop');

  let modeIntro = '';
  let dataLine = '';

  if (isSeed) {
    // ---- 种子局 ----
    const seedLevel = SEED_LEVELS.find(s => s.id === currentSeedId);
    const seedName  = seedLevel ? seedLevel.name : '未知图';
    const seedEmoji = seedLevel ? seedLevel.emoji : '🌱';
    const p = (snakes && snakes[0]) || {};
    modeIntro = '【本次模式】种子局挑战。玩家在固定随机序列的地图「' + seedName + '」' + seedEmoji +
                '上刷分，全球排行榜公平竞争。请点评这次挑战表现，可以提到这张地图、刷分、排行榜、公平竞争等关键词。\n';
    dataLine = '【本次玩家数据】积分 ' + (p.score || 0) +
               '，体长 ' + ((p.body && p.body.length) || 3) +
               '，吃掉食物 ' + (p.foodsEaten || 0) + ' 个。\n';
  } else if (isDouble) {
    // ---- 双人对战 ----
    const p1 = snakes[0] || {};
    const p2 = snakes[1] || {};
    const winner = (p1.score || 0) === (p2.score || 0) ? '平局' :
                   ((p1.score || 0) > (p2.score || 0) ? 'P1 领先' : 'P2 领先');
    modeIntro = '【本次模式】双人对战。P1 和 P2 互相竞争，先到 300 分或对方先死获胜。请点评这场对决，必须强调两人的对抗、胜负、谁压过谁。可以用"德比""宿敌""分出高下""死斗"这类词，绝对不要说"配合""默契"。\n';
    dataLine = '【本次玩家数据】P1 积分 ' + (p1.score || 0) +
               '，体长 ' + ((p1.body && p1.body.length) || 3) +
               '，吃掉食物 ' + (p1.foodsEaten || 0) + ' 个；' +
               'P2 积分 ' + (p2.score || 0) +
               '，体长 ' + ((p2.body && p2.body.length) || 3) +
               '，吃掉食物 ' + (p2.foodsEaten || 0) + ' 个。' +
               '当前比分：' + winner + '。\n';
  } else if (isCoop) {
    // ---- 合作模式 ----
    const p1 = snakes[0] || {};
    const p2 = snakes[1] || {};
    const total = (p1.score || 0) + (p2.score || 0);
    const reasonText = (typeof overlayMsg !== 'undefined' && overlayMsg && overlayMsg.textContent) ? overlayMsg.textContent : '';
    const isClear = reasonText.includes('合作达成');
    modeIntro = '【本次模式】合作模式。P1/P2 是队友，共享 3 条命，一起闯江湖。请点评这次合作，必须强调两人的配合、默契、共患难。可以用"并肩""同生共死""双剑合璧""一条心"这类词，绝对不要挑拨两人对立。\n';
    dataLine = '【本次玩家数据】P1 积分 ' + (p1.score || 0) +
               '，体长 ' + ((p1.body && p1.body.length) || 3) +
               '，吃掉食物 ' + (p1.foodsEaten || 0) + ' 个；' +
               'P2 积分 ' + (p2.score || 0) +
               '，体长 ' + ((p2.body && p2.body.length) || 3) +
               '，吃掉食物 ' + (p2.foodsEaten || 0) + ' 个。' +
               '双人合计积分 ' + total + '。' +
               (isClear ? '本局合作达成！' : '本局未能通关。') + '\n';
  } else {
    // ---- 单人模式 ----
    const p = (snakes && snakes[0]) || {};
    modeIntro = '【本次模式】单人模式。玩家一个人闯江湖。\n';
    dataLine = '【本次玩家数据】积分 ' + (p.score || 0) +
               '，体长 ' + ((p.body && p.body.length) || 3) +
               '，吃掉食物 ' + (p.foodsEaten || 0) + ' 个。\n';
  }

  let prompt = '';
  prompt += modeIntro;
  prompt += dataLine;
  prompt += '【本次语气要求】以"' + tone.id + '"的语气点评：' + tone.desc + '\n';

  if (recentComments.length > 0) {
    prompt += '【最近几次评语 - 必须避开，不许雷同】\n';
    recentComments.slice(-3).forEach((c, i) => { prompt += (i+1) + '. ' + c + '\n'; });
    prompt += '请用完全不同的角度、句式和梗，重新写一句评语。';
  } else {
    prompt += '请写一句评语。';
  }

  return prompt;
}
// ===== 皮肤解锁判断 =====
function isSkinUnlocked(skin) { return !skin.unlockId || unlocked.includes(skin.unlockId) || cheatSkins.has(skin.unlockId); }

// ===== 单人皮肤 UI =====
function renderSkins() {
skinListEl.innerHTML = '';
Object.values(SKINS).forEach(skin => {
const unlockedSkin = isSkinUnlocked(skin);
const card = document.createElement('div');
card.className = 'skin-card' + (currentSkinId === skin.id ? ' active' : '') + (!unlockedSkin ? ' locked' : '');
// ★ 棋盘风格标签：让玩家一眼看出每套皮肤是「暖派 / 冷派 / 暗派」，
//   这样"不同风格"是刻意设计而不是杂乱（未解锁时不显示，避免信息过载）
card.innerHTML = '<div class="skin-emoji">'+skin.emoji+'</div><div class="skin-name">'+skin.name+'</div>'
+ (unlockedSkin && skin.boardStyle ? '<div class="skin-style">'+skin.boardStyle+'</div>' : '')
+ ( !unlockedSkin ? '<div class="skin-lock">🔒 未解锁</div>' : (currentSkinId === skin.id ? '<div class="skin-lock" style="color:#00f5d4">使用中</div>' : '') );
if (unlockedSkin) card.addEventListener('click', () => {
if (isPaused || (loopActive && !isGameOver)) {
showCheatToast('⏸️ 游戏中无法换皮肤，请结束本局后再试', 1200);
return;
}
currentSkinId = skin.id;
boardSkinId = skin.id;
SM.safeSet('snakeCurrentSkin', currentSkinId);
SM.safeSet('snakeBoardSkin', boardSkinId);
renderSkins();
if (!isGameOver && snakes[0]) {
const skinObj = SKINS[currentSkinId] || SKINS.default;
snakes[0].headColors = skinObj.headColors || ['#5efce8','#00f5d4','#00bbf9'];
snakes[0].bodyHue = skinObj.bodyHue || {r:0,g:235,b:220};
snakes[0].skinId = currentSkinId;
}
draw();
});
skinListEl.appendChild(card);
});
}

// ===== 指南 UI =====
let currentGuideKey = 'basic';
function renderGuideNav() {
guideNavEl.innerHTML = '';
GUIDE_DATA.forEach(g => {
const btn = document.createElement('button');
btn.className = 'guide-nav-btn' + (currentGuideKey === g.id ? ' active' : '');
btn.innerHTML = g.icon + ' ' + g.title;
btn.addEventListener('click', () => { currentGuideKey = g.id; renderGuideNav(); renderGuideContent(); });
guideNavEl.appendChild(btn);
});
}
function renderGuideContent() {
const g = GUIDE_DATA.find(x => x.id === currentGuideKey) || GUIDE_DATA[0];
guideContentEl.innerHTML = g.content;
}

// ===== 数据统计面板 =====
function renderStats() {
const listEl = document.getElementById('statsList');
if (!listEl) return;
const fmtTime = (s) => {
s = Math.floor(s || 0);
if (s < 60) return s + ' 秒';
const m = Math.floor(s / 60), r = s % 60;
return m + ' 分 ' + r + ' 秒';
};
const deathTotal = Object.values(stats.deaths).reduce((a,b)=>a+b, 0) || 1;
const pct = (n) => deathTotal > 0 ? Math.round(n / deathTotal * 100) : 0;

let html = '';
html += '<div class="stats-section">';
html += '<div class="stats-section-title">📊 生涯总览</div>';
html += '<div class="stats-row"><span class="stats-label">🎮 总游玩局数</span><span class="stats-value">' + stats.totalGames + ' 局</span></div>';
html += '<div class="stats-row"><span class="stats-label">👤 单人局数</span><span class="stats-value">' + stats.singleGames + ' 局</span></div>';
html += '<div class="stats-row"><span class="stats-label">👥 双人局数</span><span class="stats-value">' + stats.doubleGames + ' 局</span></div>';
html += '<div class="stats-row"><span class="stats-label">⏱️ 累计游戏时长</span><span class="stats-value">' + fmtTime(stats.totalPlayTime) + '</span></div>';
html += '<div class="stats-row"><span class="stats-label">🍎 累计吃食物</span><span class="stats-value">' + stats.totalFoodsEaten + ' 个</span></div>';
html += '<div class="stats-row"><span class="stats-label">💰 累计总分</span><span class="stats-value">' + totalScoreAccum + ' 分</span></div>';
html += '</div>';

html += '<div class="stats-section">';
html += '<div class="stats-section-title">🏆 最高纪录</div>';
html += '<div class="stats-row"><span class="stats-label">🥇 最高分</span><span class="stats-value gold">' + highScore + ' 分</span></div>';
html += '<div class="stats-row"><span class="stats-label">📏 最长体长</span><span class="stats-value gold">' + stats.bestLength + ' 节</span></div>';
html += '<div class="stats-row"><span class="stats-label">⏳ 最长生存</span><span class="stats-value gold">' + fmtTime(stats.bestSurvivalTime) + '</span></div>';
html += '<div class="stats-row"><span class="stats-label">🔥 最高连击</span><span class="stats-value gold">' + stats.bestCombo + ' 连</span></div>';
html += '<div class="stats-row"><span class="stats-label">🍽️ 单局最多食物</span><span class="stats-value gold">' + stats.bestFoodsEaten + ' 个</span></div>';
html += '</div>';

html += '<div class="stats-section">';
html += '<div class="stats-section-title">💀 死因分布</div>';
html += '<div class="stats-row"><span class="stats-label">🧱 撞墙</span><span class="stats-value pink">' + stats.deaths.wall + ' 次 · ' + pct(stats.deaths.wall) + '%</span></div>';
html += '<div class="stats-row"><span class="stats-label">🐍 咬到自己</span><span class="stats-value pink">' + stats.deaths.self + ' 次 · ' + pct(stats.deaths.self) + '%</span></div>';
html += '<div class="stats-row"><span class="stats-label">💥 撞到对方</span><span class="stats-value pink">' + stats.deaths.other + ' 次 · ' + pct(stats.deaths.other) + '%</span></div>';
html += '<div class="stats-row"><span class="stats-label">🐱 被猫抓住</span><span class="stats-value pink">' + stats.deaths.cat + ' 次 · ' + pct(stats.deaths.cat) + '%</span></div>';
html += '<div class="stats-row"><span class="stats-label">✂️ 被猫咬断</span><span class="stats-value pink">' + stats.deaths.catBite + ' 次 · ' + pct(stats.deaths.catBite) + '%</span></div>';
html += '<div class="stats-row"><span class="stats-label">🪨 撞到石头</span><span class="stats-value pink">' + stats.deaths.obstacle + ' 次 · ' + pct(stats.deaths.obstacle) + '%</span></div>';
html += '</div>';

listEl.innerHTML = html;
}

// ===== 种子局 UI =====
function openSeedSelect() {
  renderSeedList();
  const m = document.getElementById('seedModal');
  if (m) m.classList.add('show');
}
function renderSeedList() {
  const list = document.getElementById('seedList');
  if (!list) return;
  list.innerHTML = '';
  SEED_LEVELS.forEach(level => {
    const key = SEED_HIGH_KEY_PREFIX + level.id;
    let best = 0;
    best = SM.getInt(key, 0, 0, 99999999);
    const card = document.createElement('div');
    card.className = 'seed-card';
    const tags = [];
    if (level.hasObstacle) tags.push('<span class="tag tag-obs">🚧 障碍</span>');
    if (level.hasCat) tags.push('<span class="tag tag-cat">🐱 猫</span>');
    card.innerHTML =
      '<div class="seed-num">' + level.id + '</div>' +
      '<div class="seed-info">' +
        '<div class="seed-name">' + level.emoji + ' ' + level.name + '</div>' +
        '<div class="seed-tags">' + tags.join('') + '</div>' +
        '<div class="seed-best">' + (best > 0 ? '最高分 <span class="best-score">' + best + '</span>' : '尚未挑战') + '</div>' +
      '</div>' +
      '<button class="seed-lb-icon" data-seed="' + level.id + '" title="查看本关排行榜">🏆</button>';
    // 点卡片本身 → 开始游戏
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('seed-lb-icon')) return; // 点图标不进入游戏
      const m = document.getElementById('seedModal');
      if (m) m.classList.remove('show');
      if (typeof window.__startSeedGame === 'function') {
        window.__startSeedGame(level.id);
      }
    });
    list.appendChild(card);
  });
  // 绑定每张卡片的 🏆 排行榜按钮
  list.querySelectorAll('.seed-lb-icon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const seedId = parseInt(btn.dataset.seed, 10);
      const m = document.getElementById('seedModal');
      if (m) m.classList.remove('show');
      openLeaderboard(seedId);
    });
  });
}

// ===== 商城 UI =====
let currentShopTab = 'shop';

function openShop() {
  currentShopTab = 'shop';
  renderShop();
  shopModal.classList.add('show');
}

function renderShop() {
  const coinsEl = document.getElementById('shopCoins');
  if (coinsEl) coinsEl.textContent = coins;

  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentShopTab);
  });

  const contentEl = document.getElementById('shopContent');
  if (!contentEl) return;

  // ★ 合作模式与双人对战一样，道具按 P1/P2 各自背包管理
  if (gameMode === 'double' || gameMode === 'coop') {
    contentEl.innerHTML = currentShopTab === 'shop' ? renderShopItemsDouble() : renderInventoryItemsDouble();
  } else {
    contentEl.innerHTML = currentShopTab === 'shop' ? renderShopItemsSingle() : renderInventoryItemsSingle();
  }
  bindShopEvents();
}

function renderShopItemsSingle() {
  let html = '';
  SHOP_ITEMS.forEach(item => {
    const owned = inventory[item.id] || 0;
    const canAfford = coins >= item.price;
    html += '<div class="shop-item">';
    html += '<div class="shop-item-emoji">' + item.emoji + '</div>';
    html += '<div class="shop-item-info">';
    html += '<div class="shop-item-name">' + item.name + (owned > 0 ? ' <span class="shop-item-owned">拥有 ×' + owned + '</span>' : '') + '</div>';
    html += '<div class="shop-item-desc">' + item.desc + '</div>';
    html += '</div>';
    html += '<button class="shop-item-btn' + (canAfford ? '' : ' disabled') + '" data-buy="' + item.id + '">' + item.price + ' 🪙</button>';
    html += '</div>';
  });
  return html;
}

function renderShopItemsDouble() {
  let html = '';
  SHOP_ITEMS.forEach(item => {
    const ownedP1 = inventoryP1[item.id] || 0;
    const ownedP2 = inventoryP2[item.id] || 0;
    const canAfford = coins >= item.price;
    html += '<div class="shop-item double">';
    html += '<div class="shop-item-emoji">' + item.emoji + '</div>';
    html += '<div class="shop-item-info">';
    html += '<div class="shop-item-name">' + item.name + '</div>';
    html += '<div class="shop-item-desc">' + item.desc + '</div>';
    html += '</div>';
    html += '<div class="shop-item-actions">';
    html += '<button class="shop-item-btn p1' + (canAfford ? '' : ' disabled') + '" data-buy-p1="' + item.id + '">P1<br>' + item.price + '🪙' + (ownedP1 > 0 ? ' ×' + ownedP1 : '') + '</button>';
    html += '<button class="shop-item-btn p2' + (canAfford ? '' : ' disabled') + '" data-buy-p2="' + item.id + '">P2<br>' + item.price + '🪙' + (ownedP2 > 0 ? ' ×' + ownedP2 : '') + '</button>';
    html += '</div>';
    html += '</div>';
  });
  return html;
}

function renderInventoryItemsSingle() {
  const keys = Object.keys(inventory).filter(k => inventory[k] > 0);
  if (keys.length === 0) {
    return '<div class="shop-empty">🎒 背包空空如也<br>快去道具商店买点东西吧～</div>';
  }
  let html = '';
  keys.forEach(id => {
    const item = SHOP_ITEMS.find(x => x.id === id);
    if (!item) return;
    const count = inventory[id];
    const isEquipped = equippedItem === id;
    html += '<div class="shop-item' + (isEquipped ? ' equipped' : '') + '">';
    html += '<div class="shop-item-emoji">' + item.emoji + '</div>';
    html += '<div class="shop-item-info">';
    html += '<div class="shop-item-name">' + item.name + ' <span class="shop-item-owned">×' + count + '</span></div>';
    html += '<div class="shop-item-desc">' + item.desc + '</div>';
    html += '</div>';
    if (isEquipped) html += '<button class="shop-item-btn equipped" data-unequip="1">已装备</button>';
    else html += '<button class="shop-item-btn equip" data-equip="' + id + '">装备</button>';
    html += '</div>';
  });
  html += '<div class="shop-tip">💡 装备后下一局自动使用，一局只能装备一个道具。</div>';
  return html;
}

function renderInventoryItemsDouble() {
  let html = '';

  html += '<div class="inv-player-section"><div class="inv-player-title p1">P1 的背包</div>';
  const keys1 = Object.keys(inventoryP1).filter(k => inventoryP1[k] > 0);
  if (keys1.length === 0) {
    html += '<div class="shop-empty small">背包空空</div>';
  } else {
    keys1.forEach(id => {
      const item = SHOP_ITEMS.find(x => x.id === id);
      if (!item) return;
      const count = inventoryP1[id];
      const isEquipped = equippedItemP1 === id;
      html += '<div class="shop-item small' + (isEquipped ? ' equipped p1' : '') + '">';
      html += '<div class="shop-item-emoji">' + item.emoji + '</div>';
      html += '<div class="shop-item-info"><div class="shop-item-name">' + item.name + ' <span class="shop-item-owned">×' + count + '</span></div></div>';
      if (isEquipped) html += '<button class="shop-item-btn equipped" data-unequip-p1="1">已装备</button>';
      else html += '<button class="shop-item-btn equip" data-equip-p1="' + id + '">装备</button>';
      html += '</div>';
    });
  }
  html += '</div>';

  html += '<div class="inv-player-section"><div class="inv-player-title p2">P2 的背包</div>';
  const keys2 = Object.keys(inventoryP2).filter(k => inventoryP2[k] > 0);
  if (keys2.length === 0) {
    html += '<div class="shop-empty small">背包空空</div>';
  } else {
    keys2.forEach(id => {
      const item = SHOP_ITEMS.find(x => x.id === id);
      if (!item) return;
      const count = inventoryP2[id];
      const isEquipped = equippedItemP2 === id;
      html += '<div class="shop-item small' + (isEquipped ? ' equipped p2' : '') + '">';
      html += '<div class="shop-item-emoji">' + item.emoji + '</div>';
      html += '<div class="shop-item-info"><div class="shop-item-name">' + item.name + ' <span class="shop-item-owned">×' + count + '</span></div></div>';
      if (isEquipped) html += '<button class="shop-item-btn equipped" data-unequip-p2="1">已装备</button>';
      else html += '<button class="shop-item-btn equip" data-equip-p2="' + id + '">装备</button>';
      html += '</div>';
    });
  }
  html += '</div>';

  html += '<div class="shop-tip">💡 P1 和 P2 的背包独立，装备后下一局自动使用。铜钱是共用的。</div>';
  return html;
}

function bindShopEvents() {
  document.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.buy;
      const item = SHOP_ITEMS.find(x => x.id === id);
      if (!item) return;
      if (coins < item.price) { showCheatToast('🪙 铜钱不够啦', 700); return; }
      coins -= item.price;
      inventory[id] = (inventory[id] || 0) + 1;
      saveCoins(); saveInventory();
      renderShop();
      showCheatToast('✅ 购买成功「' + item.name + '」', 700);
    });
  });

  document.querySelectorAll('[data-buy-p1]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.buyP1;
      const item = SHOP_ITEMS.find(x => x.id === id);
      if (!item) return;
      if (coins < item.price) { showCheatToast('🪙 铜钱不够啦', 700); return; }
      coins -= item.price;
      inventoryP1[id] = (inventoryP1[id] || 0) + 1;
      saveCoins(); saveInventoryP1();
      renderShop();
      showCheatToast('✅ P1 购买「' + item.name + '」', 700);
    });
  });

  document.querySelectorAll('[data-buy-p2]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.buyP2;
      const item = SHOP_ITEMS.find(x => x.id === id);
      if (!item) return;
      if (coins < item.price) { showCheatToast('🪙 铜钱不够啦', 700); return; }
      coins -= item.price;
      inventoryP2[id] = (inventoryP2[id] || 0) + 1;
      saveCoins(); saveInventoryP2();
      renderShop();
      showCheatToast('✅ P2 购买「' + item.name + '」', 700);
    });
  });

  document.querySelectorAll('[data-equip]').forEach(btn => {
    btn.addEventListener('click', () => {
      equippedItem = btn.dataset.equip;
      SM.safeSet(EQUIPPED_KEY, equippedItem);
      renderShop();
      const item = SHOP_ITEMS.find(x => x.id === equippedItem);
      showCheatToast('✨ 已装备「' + (item ? item.name : '') + '」', 700);
    });
  });
  document.querySelectorAll('[data-unequip]').forEach(btn => {
    btn.addEventListener('click', () => {
      equippedItem = '';
      SM.safeRemove(EQUIPPED_KEY);
      renderShop();
    });
  });

  document.querySelectorAll('[data-equip-p1]').forEach(btn => {
    btn.addEventListener('click', () => {
      equippedItemP1 = btn.dataset.equipP1;
      SM.safeSet(EQUIPPED_P1_KEY, equippedItemP1);
      renderShop();
      const item = SHOP_ITEMS.find(x => x.id === equippedItemP1);
      showCheatToast('✨ P1 装备「' + (item ? item.name : '') + '」', 700);
    });
  });
  document.querySelectorAll('[data-unequip-p1]').forEach(btn => {
    btn.addEventListener('click', () => {
      equippedItemP1 = '';
      SM.safeRemove(EQUIPPED_P1_KEY);
      renderShop();
    });
  });

  document.querySelectorAll('[data-equip-p2]').forEach(btn => {
    btn.addEventListener('click', () => {
      equippedItemP2 = btn.dataset.equipP2;
      SM.safeSet(EQUIPPED_P2_KEY, equippedItemP2);
      renderShop();
      const item = SHOP_ITEMS.find(x => x.id === equippedItemP2);
      showCheatToast('✨ P2 装备「' + (item ? item.name : '') + '」', 700);
    });
  });
  document.querySelectorAll('[data-unequip-p2]').forEach(btn => {
    btn.addEventListener('click', () => {
      equippedItemP2 = '';
      SM.safeRemove(EQUIPPED_P2_KEY);
      renderShop();
    });
  });
}

// ===== 猫模式按钮 =====
function updateCatModeBtn() {
// ★ 双人模式下没有猫；合作模式保留猫（两人都是队友，猫是共同威胁）
if (gameMode === 'double') {
catModeEnabled = false;
SM.safeSet('snakeCatMode', '0');
catModeBtn.textContent = '🐱 猫咪: 关(双人)';
catModeBtn.classList.remove('cat-on');
catModeBtn.classList.add('cat-off');
catModeBtn.disabled = true;
return;
}
catModeBtn.disabled = false;
if (catModeEnabled) { catModeBtn.textContent = '🐱 猫咪: 开'; catModeBtn.classList.remove('cat-off'); catModeBtn.classList.add('cat-on'); }
else { catModeBtn.textContent = '🐱 猫咪: 关'; catModeBtn.classList.remove('cat-on'); catModeBtn.classList.add('cat-off'); }
}
catModeBtn.addEventListener('click', () => {
if (gameMode === 'double') return;
catModeEnabled = !catModeEnabled;
SM.safeSet('snakeCatMode', catModeEnabled ? '1' : '0');
updateCatModeBtn();
if (catModeEnabled && score >= CAT_ACTIVATE_SCORE && !catActive && !isGameOver) { spawnCat(); }
if (!catModeEnabled) { catActive = false; cat = null; catTrail = []; }
});

// ===== 障碍模式按钮 =====
function updateObsModeBtn() {
if (obstacleModeEnabled) { obsModeBtn.textContent = '🚧 障碍: 开'; obsModeBtn.classList.remove('obs-off'); obsModeBtn.classList.add('obs-on'); }
else { obsModeBtn.textContent = '🚧 障碍: 关'; obsModeBtn.classList.remove('obs-on'); obsModeBtn.classList.add('obs-off'); }
}
obsModeBtn.addEventListener('click', () => {
obstacleModeEnabled = !obstacleModeEnabled;
SM.safeSet('snakeObstacleMode', obstacleModeEnabled ? '1' : '0');
updateObsModeBtn();
if (!obstacleModeEnabled) { obstacles = []; portals = []; }
});

// ===== 模式选择按钮 =====
const modeSingleBtn = document.getElementById('modeSingle');
const modeDoubleBtn = document.getElementById('modeDouble');
const modeCoopBtn = document.getElementById('modeCoop');

const isMobileDevice = ('ontouchstart' in window) && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
if (isMobileDevice) {
  // ★ 按钮文字保持短标签。
  //   原来写成「👥 双人(手机不支持)」，在窄屏的三列模式网格里会把整格撑变形、
  //   文字溢出到邻居身上（安卓截图里就是这个现象）。
  //   信息改由按钮下方 .mode-hint 一行小字承担，反而更清楚。
  modeDoubleBtn.disabled = true;
  modeDoubleBtn.textContent = '👥 双人';
  modeDoubleBtn.title = '手机端暂不支持双人模式';
  if (modeCoopBtn) {
    modeCoopBtn.disabled = true;
    modeCoopBtn.title = '手机端暂不支持合作模式';
  }
  const modeHintEl = document.getElementById('modeHint');
  if (modeHintEl) modeHintEl.textContent = '双人 / 合作模式需在电脑上玩';
}

function updateModeButtons() {
modeSingleBtn.classList.toggle('active', gameMode === 'single' && currentSeedId === null);
modeDoubleBtn.classList.toggle('active', gameMode === 'double');
if (modeCoopBtn) modeCoopBtn.classList.toggle('active', gameMode === 'coop');
}
modeSingleBtn.addEventListener('click', () => {
if (gameMode === 'single' && currentSeedId === null) return;
gameMode = 'single';
// ★ 清空种子模式
if (typeof window.__clearSeedMode === 'function') window.__clearSeedMode();
updateModeButtons();
updateCatModeBtn();
overlayTitle.textContent = '十二生肖闯江湖';
overlayMsg.textContent = '单人模式 · 准备好踏入江湖了吗？';
startBtn.textContent = '开始修炼';
});
modeDoubleBtn.addEventListener('click', () => {
if (gameMode === 'double') return;
if (isMobileDevice) return;
gameMode = 'double';
if (typeof window.__clearSeedMode === 'function') window.__clearSeedMode();
updateModeButtons();
updateCatModeBtn();
overlayTitle.textContent = '👥 双人对战';
overlayMsg.textContent = 'P1 = WASD  ·  P2 = 方向键  ·  先到 300 分或对方先死获胜';
startBtn.textContent = '开始对战';
});
// 💞 合作模式：两人各控一条蛇，但共享 3 条命，命用完才结束
if (modeCoopBtn) {
  modeCoopBtn.addEventListener('click', () => {
    if (gameMode === 'coop') return;
    if (isMobileDevice) return;
    gameMode = 'coop';
    if (typeof window.__clearSeedMode === 'function') window.__clearSeedMode();
    updateModeButtons();
    updateCatModeBtn();
    overlayTitle.textContent = '💞 合作模式';
    overlayMsg.textContent = 'P1 = WASD  ·  P2 = 方向键  ·  两人共用 3 条命，死一次扣一命，命用完才结束';
    startBtn.textContent = '一起出发';
  });
}
// 🗺️ 迷宫模式入口（带跳转加载遮罩）
const modeMazeBtn = document.getElementById('modeMaze');
if (modeMazeBtn) {
  modeMazeBtn.addEventListener('click', () => {
    const el = document.getElementById('globalLoading');
    const txt = document.getElementById('globalLoadingText');
    const bar = document.getElementById('globalLoadingProgress');
    if (el && txt && bar) {
      txt.textContent = '🗺️ 正在进入迷宫...';
      el.classList.remove('hidden');
      bar.style.width = '0%';
      requestAnimationFrame(() => {
        bar.style.width = '60%';
        setTimeout(() => { bar.style.width = '100%'; }, 250);
      });
      setTimeout(() => { window.location.href = 'maze.html'; }, 650);
    } else {
      window.location.href = 'maze.html';
    }
  });
}

// 🏮 江湖客栈入口（棋盘区推门动画 → 加载遮罩 → 跳转）
const innDoorBtn = document.getElementById('innDoorBtn');
if (innDoorBtn) {
  innDoorBtn.addEventListener('click', () => {
    if (innDoorBtn.classList.contains('opening')) return;
    innDoorBtn.classList.add('opening');

    const dt = document.getElementById('innDoorTransition');
    if (dt) {
      // 两扇门合上覆盖棋盘，然后向两侧滑开，露出金光
      dt.classList.add('active');
      // 双 rAF 确保 transition 生效
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          dt.classList.add('opening');
        });
      });
      // 动画播完（约 650ms）后跳转
      setTimeout(() => {
        const el = document.getElementById('globalLoading');
        const txt = document.getElementById('globalLoadingText');
        const bar = document.getElementById('globalLoadingProgress');
        if (el && txt && bar) {
          txt.textContent = '🏮 正在走进客栈...';
          el.classList.remove('hidden');
          bar.style.width = '0%';
          requestAnimationFrame(() => {
            bar.style.width = '60%';
            setTimeout(() => { bar.style.width = '100%'; }, 250);
          });
          setTimeout(() => { window.location.href = 'inn.html'; }, 650);
        } else {
          window.location.href = 'inn.html';
        }
      }, 650);
    } else {
      // 没找到过渡元素就直接跳
      window.location.href = 'inn.html';
    }
  });
}
// 🌱 种子局入口
const modeSeedBtn = document.getElementById('modeSeed');
if (modeSeedBtn) {
  modeSeedBtn.addEventListener('click', () => {
    openSeedSelect();
  });
}
// 种子弹窗关闭
const seedModalEl = document.getElementById('seedModal');
if (seedModalEl) {
  const closeSeedBtn = document.getElementById('closeSeed');
  if (closeSeedBtn) closeSeedBtn.addEventListener('click', () => seedModalEl.classList.remove('show'));
  seedModalEl.addEventListener('click', (e) => { if (e.target === seedModalEl) seedModalEl.classList.remove('show'); });
}
updateModeButtons();
updateCatModeBtn();
updateObsModeBtn();

// ===== 双人皮肤选择弹窗 =====
let dualStep = 'board';

function openDualSkinModal() {
dualStep = 'board';
dualSelectedBoardId = boardSkinId;
dualSelectedP1 = p1SkinId || 'default';
dualSelectedP2 = p2SkinId || 'default';
dualPageBoard.style.display = 'block';
dualPageSnake.style.display = 'none';
dualSkinTitle.textContent = '🎨 第一步：选择棋盘皮肤';
dualNextBtn.textContent = '下一步 →';
renderDualBoard();
dualSkinModal.classList.add('show');
}

function renderDualBoard() {
dualBoardGrid.innerHTML = '';
Object.values(SKINS).forEach(skin => {
const unlocked = isSkinUnlocked(skin);
const card = document.createElement('div');
card.className = 'dual-skin-card' + (dualSelectedBoardId === skin.id ? ' active' : '') + (!unlocked ? ' locked' : '');
card.innerHTML = '<div class="ds-emoji">'+skin.emoji+'</div><div class="ds-name">'+skin.name+'</div>';
if (unlocked) card.addEventListener('click', () => { dualSelectedBoardId = skin.id; renderDualBoard(); });
dualBoardGrid.appendChild(card);
});
}

function renderDualSnakeGrid(which) {
const grid = which === 'p1' ? dualP1Grid : dualP2Grid;
const selected = which === 'p1' ? dualSelectedP1 : dualSelectedP2;
grid.innerHTML = '';
Object.values(SKINS).forEach(skin => {
const unlocked = isSkinUnlocked(skin);
const card = document.createElement('div');
card.className = 'dual-skin-card' + (selected === skin.id ? ' active' : '') + (!unlocked ? ' locked' : '');
card.innerHTML = '<div class="ds-emoji">'+skin.emoji+'</div><div class="ds-name">'+skin.name+'</div>';
if (unlocked) card.addEventListener('click', () => {
if (which === 'p1') dualSelectedP1 = skin.id; else dualSelectedP2 = skin.id;
renderDualSnakeGrid(which);
});
grid.appendChild(card);
});
}
function renderDualSnake() { renderDualSnakeGrid('p1'); renderDualSnakeGrid('p2'); }

dualNextBtn.addEventListener('click', () => {
if (dualStep === 'board') {
dualStep = 'snake';
dualPageBoard.style.display = 'none';
dualPageSnake.style.display = 'block';
dualSkinTitle.textContent = '🐍 第二步：选择各自的蛇皮肤';
dualNextBtn.textContent = '开始游戏';
renderDualSnake();
} else {
boardSkinId = dualSelectedBoardId;
currentSkinId = boardSkinId;
p1SkinId = dualSelectedP1;
p2SkinId = dualSelectedP2;
SM.safeSet('snakeBoardSkin', boardSkinId);
SM.safeSet('snakeCurrentSkin', boardSkinId);
SM.safeSet('snakeP1Skin', p1SkinId);
SM.safeSet('snakeP2Skin', p2SkinId);
dualSkinModal.classList.remove('show');
startBtn.style.display = 'block';
stopLoop();
// ★ 合作模式走 __startCoopGame（会顺带把共享生命 HUD 打开）
if (gameMode === 'coop' && typeof window.__startCoopGame === 'function') {
  window.__startCoopGame();
} else {
  initGame();
  applyEquippedItem();
  startLoop();
}
if (window.__updateSkillBtn) window.__updateSkillBtn();
}
});

closeDualSkinBtn.addEventListener('click', () => { dualSkinModal.classList.remove('show'); });
dualSkinModal.addEventListener('click', (e) => { if (e.target === dualSkinModal) dualSkinModal.classList.remove('show'); });

// ===== 手机端作弊：连点标题 5 次 =====
let titleTapCount = 0;
let titleTapTimer = null;
document.querySelector('h1').addEventListener('click', () => {
titleTapCount++;
clearTimeout(titleTapTimer);
if (titleTapCount >= 5) { titleTapCount = 0; cheatUnlockAll(); return; }
titleTapTimer = setTimeout(() => { titleTapCount = 0; }, 2000);
});

// ===== 键盘 =====
let cheatBuffer = '';
document.addEventListener('keydown', (e) => {
const key = e.key.toLowerCase();
if (['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','e','p'].includes(key)) e.preventDefault();
if (key === ' ') { togglePause(); return; }
if (key === 'e') {
  if (typeof triggerActiveSkill === 'function') triggerActiveSkill(0);
}
if (key === 'p' && (gameMode === 'double' || gameMode === 'coop')) {
  if (typeof triggerActiveSkill === 'function') triggerActiveSkill(1);
}
// ★ 单人模式下方向键也给 P1 用。
//   原来只有 WASD 控 P1、方向键只给 P2，于是单人局里按方向键完全没反应 ——
//   而绝大多数人（尤其是接了键盘的平板、或者用电脑玩的时候）第一反应就是按方向键。
//   双人 / 合作模式下方向键仍然专属 P2，不会串。
const arrowsGoToP1 = (gameMode === 'single');
if (key === 'w' || (arrowsGoToP1 && key === 'arrowup')) setDirection(0, 'up');
else if (key === 's' || (arrowsGoToP1 && key === 'arrowdown')) setDirection(0, 'down');
else if (key === 'a' || (arrowsGoToP1 && key === 'arrowleft')) setDirection(0, 'left');
else if (key === 'd' || (arrowsGoToP1 && key === 'arrowright')) setDirection(0, 'right');
if (gameMode === 'double' || gameMode === 'coop') {
if (key === 'arrowup') setDirection(1, 'up');
else if (key === 'arrowdown') setDirection(1, 'down');
else if (key === 'arrowleft') setDirection(1, 'left');
else if (key === 'arrowright') setDirection(1, 'right');
}
if (e.key >= '0' && e.key <= '9') {
cheatBuffer += e.key;
if (cheatBuffer.length > 6) cheatBuffer = cheatBuffer.slice(-6);
if (cheatBuffer.endsWith('520')) { cheatUnlockSkins(); cheatBuffer=''; }
else if (cheatBuffer.endsWith('521')) { cheatUnlockAffinity(); cheatBuffer=''; }
else if (cheatBuffer.endsWith('1314')) { cheatUnlockAll(); cheatBuffer=''; }
}
});
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

// ===== 方向键 =====
const dpadButtons = document.querySelectorAll('.dpad button[data-dir]');
if (window.PointerEvent) {
dpadButtons.forEach(btn => {
btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); btn.classList.add('pressed'); setDirection(0, btn.dataset.dir); });
btn.addEventListener('pointerup', () => btn.classList.remove('pressed'));
btn.addEventListener('pointercancel', () => btn.classList.remove('pressed'));
});
} else {
dpadButtons.forEach(btn => {
btn.addEventListener('touchstart', e => { e.preventDefault(); btn.classList.add('pressed'); setDirection(0, btn.dataset.dir); }, { passive: false });
btn.addEventListener('touchend', () => btn.classList.remove('pressed'));
btn.addEventListener('touchcancel', () => btn.classList.remove('pressed'));
btn.addEventListener('mousedown', e => { e.preventDefault(); setDirection(0, btn.dataset.dir); });
});
}
document.getElementById('mobilePause').addEventListener('click', togglePause);
document.getElementById('pauseFloat').addEventListener('click', togglePause);

// fitBoard 的防抖定时器。声明必须放在这里（而不是和 scheduleFitBoard 挨着）：
// 下面的方向键折叠初始化会调 scheduleFitBoard，而 let 有暂时性死区，
// 声明放在后面会直接抛 ReferenceError。
let fitBoardTimer = null;

// ---- 方向键折叠 ----
// 为什么要有这个东西：棋盘是正方形，边长由 fitBoard() 按「屏幕可见高 − 其余控件实测高」算出来。
// 方向键（3×3 格）要吃掉 150px 以上，矮屏上它占得越多棋盘越小；
// 而棋盘越小，菜单/结算的遮罩内容（标题+战报+点评+称号+模式区+客栈门）就越放不下。
// 实测 iPhone 8 上棋盘只有 240px，结算内容要 339px，客栈门被切掉 92px。
// 滑动手势已经是主控，所以矮屏默认把方向键收起来，把高度让给棋盘。
(function setupDpadToggle() {
  const controls = document.querySelector('.mobile-controls');
  const toggle = document.getElementById('dpadToggle');
  const dpad = document.getElementById('dpad');
  if (!controls || !toggle || !dpad) return;

  const PREF_KEY = 'snakeDpadCollapsed';
  // 低于这个高度就默认收起。700 是实测分界：
  // 667(iPhone 8)/640(安卓小屏)/568(SE1) 展开时结算会溢出，740 及以上展开没问题。
  const SHORT_SCREEN = 700;

  // 玩家手动点过之后，以他的选择为准，不再随屏幕尺寸自动改 —— 否则一转屏就把选择抹掉，很烦。
  const saved = SM.safeGet(PREF_KEY, null);
  let userChose = (saved === '0' || saved === '1');

  function apply(collapsed, persist) {
    controls.classList.toggle('collapsed', collapsed);
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    if (persist) {
      userChose = true;
      SM.safeSet(PREF_KEY, collapsed ? '1' : '0');
    }
    // 收起/展开改变了「其余控件」的总高度，棋盘要重新量一次。
    // 布局要等一帧才落定，所以走 scheduleFitBoard（内部有 80ms 防抖）。
    scheduleFitBoard();
  }

  // 初始状态
  apply(userChose ? saved === '1' : window.innerHeight < SHORT_SCREEN, false);

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    apply(!controls.classList.contains('collapsed'), true);
  });

  // 没手动选过的人，转屏 / 改窗口大小时跟着屏幕走。
  // ★ 但游玩中绝不动 —— 手机上地址栏伸缩（手指一划就会触发）能改变 innerHeight 上百像素，
  //   正好跨过 700 阈值时方向键会突然收起、棋盘跟着跳一下，蛇看起来像瞬移。
  //   要换控制方式，等回菜单再说。
  const autoFollow = () => {
    if (userChose) return;
    if (document.body.classList.contains('playing')) return;
    apply(window.innerHeight < SHORT_SCREEN, false);
  };
  window.addEventListener('resize', autoFollow);
  // 转屏后浏览器要过一会儿才把新尺寸报上来
  window.addEventListener('orientationchange', () => setTimeout(autoFollow, 260));
})();

// ==========================================================================
// 📱 手机端操作增强
// --------------------------------------------------------------------------
// ① 棋盘滑动转向 —— 手机主控方式。
//    方向键在屏幕最下方，大拇指要来回移动；直接在棋盘上滑动更顺手，
//    也符合贪吃蛇这类网格游戏的直觉。可以一笔连续换向，不用抬手。
// ② 游玩中锁住页面滚动 —— 不然手指在棋盘上一划，整页跟着滚，操作直接崩。
// ③ 切后台 / 锁屏自动暂停 —— 手机切走时蛇还在跑，回来已经死了。
// ④ 棋盘尺寸自适应 —— 按"真实可见高度 - 其它控件实测高度"算出棋盘能有多大，
//    保证手机竖屏下方向键也在首屏之内，不用滚动就能玩。
// ⑤ body.playing 状态标记 —— 给 CSS 用（游玩中禁用棋盘上的触摸滚动）。
// ==========================================================================

// ---- ①②：棋盘滑动转向 ----
(function setupSwipeControls() {
  const board = document.querySelector('.canvas-inner');
  if (!board) return;
  const MIN_SWIPE = 20;   // 触发一次转向的最小滑动距离（px）。太小会误触，太大划不动
  let sx = 0, sy = 0, tracking = false;

  // 只有在真正游玩中才响应滑动。菜单 / 暂停 / 结算界面上划棋盘不应该改变方向。
  function canControl() { return loopActive && !isPaused && !isGameOver; }
  function start(x, y) { sx = x; sy = y; tracking = true; }
  function move(x, y) {
    if (!tracking) return;
    const dx = x - sx, dy = y - sy;
    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(0, dx > 0 ? 'right' : 'left');
    else setDirection(0, dy > 0 ? 'down' : 'up');
    // ★ 把起点挪到当前点，而不是结束本次跟踪。
    //   这样玩家可以「上→左→下」一笔划出连续转向，不用每转一次就抬手重按 ——
    //   配合 setDirection 里的输入队列，快速连转不再丢指令。
    sx = x; sy = y;
  }
  function end() { tracking = false; }

  board.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;   // 多指（缩放等）不参与转向
    start(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  board.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    if (canControl()) {
      // 游玩中必须阻止默认行为，否则页面会跟着手指滚
      if (e.cancelable) e.preventDefault();
      move(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  board.addEventListener('touchend', end, { passive: true });
  board.addEventListener('touchcancel', end, { passive: true });

  // 鼠标拖拽同样支持（桌面调试 / 触屏笔记本）
  let mouseDown = false;
  board.addEventListener('mousedown', (e) => { mouseDown = true; start(e.clientX, e.clientY); });
  board.addEventListener('mousemove', (e) => { if (mouseDown && canControl()) move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { mouseDown = false; end(); });
})();

// ---- ③：切后台 / 锁屏自动暂停 ----
function autoPauseIfPlaying() {
  if (loopActive && !isPaused && !isGameOver) togglePause();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPauseIfPlaying(); });
window.addEventListener('blur', autoPauseIfPlaying);

// ---- ④：棋盘尺寸自适应 ----
// 手机竖屏最尴尬的是"方向键跑到屏幕外"：棋盘是正方形，屏宽 360 时它就要占 340px 高，
// 加上标题、工具条、状态栏，方向键必然掉到折叠线以下。
// 这里实测所有非棋盘控件一共占掉多少高度（含它们之间的间距），把剩下的全给棋盘。
// 用实测而不是 CSS calc()，是因为文字换行、按钮排几行都会让高度变，
// 只有量出来的才准。
function fitBoard() {
  const wrap = document.querySelector('.game-wrapper');
  const first = document.querySelector('.title-area');
  const uiEl = document.querySelector('.ui');
  if (!wrap || !first) return;

  const landscapeShort = window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches;
  // 桌面 / 宽屏：交回 CSS 的 max-width:600px
  if (window.innerWidth > 640 && !landscapeShort) { wrap.style.maxWidth = ''; return; }

  // 最后一个"下方控件"：竖屏是方向键区，横屏它被隐藏了，退回到状态栏
  const last = (() => {
    const cands = ['.mobile-controls', '.music-hint', '.controls', '.ui'];
    for (let i = 0; i < cands.length; i++) {
      const el = document.querySelector(cands[i]);
      if (el && el.getBoundingClientRect().height > 0) return el;
    }
    return uiEl || first;
  })();

  const top = first.getBoundingClientRect().top;
  const bottom = last.getBoundingClientRect().bottom;
  // 首控件顶部 → 末控件底部 的整段高度，减去棋盘自身高度，
  // 就是"其它所有控件 + 它们之间所有间距"的总和。
  // 注意 .game-wrapper 夹在 .top-bar 和 .ui 中间，直接逐个累加会把棋盘高度算进去，
  // 所以这里用"整段跨度 - 棋盘高度"的算法，天然绕开顺序问题。
  const used = Math.max(0, (bottom - top) - wrap.getBoundingClientRect().height);

  const cs = getComputedStyle(document.body);
  const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const padH = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const vv = window.visualViewport;
  const vh = Math.round((vv && vv.height) || window.innerHeight || 0);
  const avail = vh - padV - used - 6;   // 6px 安全余量，避免差一像素就冒出滚动条
  const maxW = (document.documentElement.clientWidth || window.innerWidth) - padH;
  const size = Math.max(190, Math.min(avail, maxW, 600));
  wrap.style.maxWidth = size + 'px';
}

function scheduleFitBoard() {
  if (fitBoardTimer) clearTimeout(fitBoardTimer);
  fitBoardTimer = setTimeout(() => { fitBoardTimer = null; fitBoard(); }, 80);
}
window.addEventListener('resize', scheduleFitBoard);
// 转屏后浏览器要过一会儿才把新的视口尺寸报上来，稍等一下再量
window.addEventListener('orientationchange', () => setTimeout(fitBoard, 250));
// 地址栏伸缩、软键盘弹出都会触发 visualViewport 变化，这个比 resize 更灵敏
if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFitBoard);
window.addEventListener('load', scheduleFitBoard);
fitBoard();

// ---- ⑤：游玩状态标记 ----
// 跟着遮罩的 hidden 类走，比在每个"开始 / 暂停 / 结算"分支里手动加类更不容易漏。
// CSS 用 body.playing 在游玩中禁掉棋盘上的触摸滚动。
const overlayEl = document.getElementById('overlay');
if (overlayEl) {
  const syncPlayingClass = () => {
    document.body.classList.toggle('playing', overlayEl.classList.contains('hidden'));
  };
  if (window.MutationObserver) {
    new MutationObserver(syncPlayingClass).observe(overlayEl, { attributes: true, attributeFilter: ['class'] });
  }
  syncPlayingClass();
}

// ===== 按钮绑定 =====
startBtn.addEventListener('click', () => {
// ★ 合作模式与双人模式共用皮肤选择弹窗（都要选两套蛇皮肤）
if (gameMode === 'double' || gameMode === 'coop') { openDualSkinModal(); }
else { startBtn.style.display='block'; startGame(); }
});
document.getElementById('achieveBtn').addEventListener('click', () => { renderAchievements(); achieveModal.classList.add('show'); });
document.getElementById('closeAchieve').addEventListener('click', () => achieveModal.classList.remove('show'));
achieveModal.addEventListener('click', (e) => { if (e.target === achieveModal) achieveModal.classList.remove('show'); });
skinBtn.addEventListener('click', () => { renderSkins(); skinModal.classList.add('show'); });
document.getElementById('closeSkin').addEventListener('click', () => skinModal.classList.remove('show'));
skinModal.addEventListener('click', (e) => { if (e.target === skinModal) skinModal.classList.remove('show'); });
guideBtn.addEventListener('click', () => { currentGuideKey = 'basic'; renderGuideNav(); renderGuideContent(); guideModal.classList.add('show'); });
document.getElementById('closeGuide').addEventListener('click', () => guideModal.classList.remove('show'));
guideModal.addEventListener('click', (e) => { if (e.target === guideModal) guideModal.classList.remove('show'); });
musicBtn.addEventListener('click', () => {
musicEnabled = !musicEnabled;
if (musicEnabled) { musicBtn.textContent = '🎵 音乐开'; musicBtn.classList.remove('active-music'); if (isGameOver || isPaused || !loopActive) playBgm('menu'); else updateGameBgm(); }
else { musicBtn.textContent = '🔇 音乐关'; musicBtn.classList.add('active-music'); stopBgm(); }
});

// ===== 数据统计按钮绑定 =====
const statsBtnEl = document.getElementById('statsBtn');
const statsModalEl = document.getElementById('statsModal');
if (statsBtnEl && statsModalEl) {
  statsBtnEl.addEventListener('click', () => { renderStats(); statsModalEl.classList.add('show'); });
  const closeStatsBtn = document.getElementById('closeStats');
  if (closeStatsBtn) closeStatsBtn.addEventListener('click', () => statsModalEl.classList.remove('show'));
  statsModalEl.addEventListener('click', (e) => { if (e.target === statsModalEl) statsModalEl.classList.remove('show'); });
}

// ===== 存档管理面板 =====
function showSaveStatus(msg, isError) {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'save-status show ' + (isError ? 'err' : 'ok');
}

function renderSaveDiag() {
  const el = document.getElementById('saveDiag');
  if (!el || !SM) return;
  const d = SM.diagnose();
  const kb = (d.approxBytes / 1024).toFixed(1);
  let html = '';
  html += '<div class="diag-row"><span>存储状态</span><span class="diag-val">' +
    (d.persistent ? '✅ 正常持久化' : '⚠️ 仅内存（刷新会丢）') + '</span></div>';
  html += '<div class="diag-row"><span>存档体积</span><span class="diag-val">' + kb + ' KB</span></div>';
  html += '<div class="diag-row"><span>数据损坏</span><span class="diag-val">' +
    (d.corrupted.length ? '⚠️ ' + d.corrupted.length + ' 项已重置' : '✅ 无') + '</span></div>';
  if (d.issues.length) {
    html += '<div class="diag-row" style="flex-direction:column;align-items:flex-start;gap:4px;"><span>提示</span><span class="diag-val" style="text-align:left;">' +
      d.issues.join('<br>') + '</span></div>';
  }
  el.innerHTML = html;
}

function openSaveModal() {
  const modal = document.getElementById('saveModal');
  if (!modal) return;
  // 每次打开都收起表单、清掉上次的提示，避免残留误导
  const ef = document.getElementById('saveExportField');
  const inf = document.getElementById('saveImportField');
  const st = document.getElementById('saveStatus');
  if (ef) ef.style.display = 'none';
  if (inf) inf.style.display = 'none';
  if (st) st.className = 'save-status';
  renderSaveDiag();
  modal.classList.add('show');
}

function bindSaveModal() {
  const modal = document.getElementById('saveModal');
  if (!modal || !SM) return;

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.addEventListener('click', openSaveModal);

  const closeBtn = document.getElementById('closeSave');
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

  // 点遮罩以外的地方不处理；ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) modal.classList.remove('show');
  });

  // --- 导出 ---
  const exportBtn = document.getElementById('saveExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const field = document.getElementById('saveExportField');
    const ta = document.getElementById('saveExportText');
    const importField = document.getElementById('saveImportField');
    try {
      const text = SM.exportSave();
      if (ta) ta.value = text;
      if (field) field.style.display = 'block';
      if (importField) importField.style.display = 'none';
      showSaveStatus('✅ 存档已生成，请完整复制保存', false);
    } catch (e) {
      console.warn('导出失败:', e);
      showSaveStatus('❌ 导出失败，请重试', true);
    }
  });

  // --- 复制到剪贴板（带降级方案） ---
  const copyBtn = document.getElementById('saveCopyBtn');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const ta = document.getElementById('saveExportText');
    if (!ta || !ta.value) { showSaveStatus('请先点「导出存档」', true); return; }
    const done = () => showSaveStatus('✅ 已复制到剪贴板', false);
    const fallback = () => {
      // 老浏览器 / 非 HTTPS 环境不支持 clipboard API 时，退回手动全选
      try {
        ta.removeAttribute('readonly');
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        document.execCommand('copy');
        ta.setAttribute('readonly', 'readonly');
        done();
      } catch (e) {
        ta.setAttribute('readonly', 'readonly');
        showSaveStatus('⚠️ 复制失败，请手动全选文本框内容复制', true);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(done).catch(fallback);
    } else {
      fallback();
    }
  });

  // --- 打开导入区 ---
  const importBtn = document.getElementById('saveImportBtn');
  if (importBtn) importBtn.addEventListener('click', () => {
    const inf = document.getElementById('saveImportField');
    const ef = document.getElementById('saveExportField');
    if (inf) inf.style.display = 'block';
    if (ef) ef.style.display = 'none';
    const ta = document.getElementById('saveImportText');
    if (ta) { ta.value = ''; ta.focus(); }
    showSaveStatus('把存档内容粘贴到上面的框里，再点「确认导入」', false);
  });

  // --- 确认导入 ---
  const confirmBtn = document.getElementById('saveConfirmImportBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', () => {
    const ta = document.getElementById('saveImportText');
    if (!ta || !ta.value.trim()) { showSaveStatus('请先粘贴存档内容', true); return; }
    const res = SM.importSave(ta.value);
    if (res.ok) {
      showSaveStatus('✅ 成功导入 ' + res.count + ' 项，正在刷新...', false);
      setTimeout(() => window.location.reload(), 900);
    } else {
      showSaveStatus('❌ ' + res.error, true);
    }
  });

  // --- 清空存档（二次确认） ---
  const clearBtn = document.getElementById('saveClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    const ok = confirm('⚠️ 确定要清空所有存档吗？\n\n成就、皮肤、铜钱、背包、统计数据、迷宫进度、排行榜名字都会被清除，且无法恢复。\n\n建议先「导出存档」备份。');
    if (!ok) return;
    SM.clearAll();
    showSaveStatus('🗑️ 已清空，正在刷新...', false);
    setTimeout(() => window.location.reload(), 800);
  });
}

bindSaveModal();

// ===== 商城按钮绑定 =====
const shopBtnEl = document.getElementById('shopBtn');
if (shopBtnEl && shopModal) {
  shopBtnEl.addEventListener('click', openShop);
  document.getElementById('closeShop').addEventListener('click', () => shopModal.classList.remove('show'));
  shopModal.addEventListener('click', (e) => { if (e.target === shopModal) shopModal.classList.remove('show'); });
  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentShopTab = btn.dataset.tab;
      renderShop();
    });
  });
}

// ===== 技能按钮（手机端） =====
const skillBtnEl = document.getElementById('skillBtn');
const skillCountEl = document.getElementById('skillCount');

function updateSkillBtn() {
  if (!skillBtnEl) return;
  const p = snakes && snakes[0];
  // 手机端的技能按钮只服务单人（双人/合作要两套按钮与两套按键，暂不提供）
  if (!p || (gameMode !== 'single' && gameMode !== 'coop') || isGameOver) {
    skillBtnEl.style.display = 'none';
    return;
  }
  if (gameMode === 'coop') { skillBtnEl.style.display = 'none'; return; }
  const skin = p.skinId;
  let left = 0, emoji = '✨';
  if (skin === 'she') { left = p.ghostLeft || 0; emoji = '🐍'; }
  else if (skin === 'hu') { left = p.phantomLeft || 0; emoji = '🐯'; }
  else if (skin === 'long') { left = p.longLeft || 0; emoji = '🐲'; }
  else if (skin === 'yang') { left = p.yangLeft || 0; emoji = '🐑'; }
  else { skillBtnEl.style.display = 'none'; return; }
  skillBtnEl.firstChild.textContent = emoji;
  if (left <= 0) skillBtnEl.classList.add('disabled');
  else skillBtnEl.classList.remove('disabled');
  skillBtnEl.style.display = '';
  skillCountEl.textContent = left;
}

function triggerSkillFromButton() {
  if (typeof triggerActiveSkill === 'function') triggerActiveSkill(0);
}

if (skillBtnEl) {
  if (window.PointerEvent) {
    skillBtnEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); triggerSkillFromButton(); });
  } else {
    skillBtnEl.addEventListener('touchstart', (e) => { e.preventDefault(); triggerSkillFromButton(); }, { passive: false });
    skillBtnEl.addEventListener('mousedown', (e) => { e.preventDefault(); triggerSkillFromButton(); });
  }
}

setInterval(updateSkillBtn, 300);
window.__updateSkillBtn = updateSkillBtn;

// ===== BGM 解锁 =====
let bgmUnlocked = false;
function unlockBgm() { if (bgmUnlocked) return; bgmUnlocked = true; if (musicEnabled) playBgm('menu'); }
document.addEventListener('click', unlockBgm, { once: true });
document.addEventListener('keydown', unlockBgm, { once: true });
document.addEventListener('touchstart', unlockBgm, { once: true });

// ===== 加载与启动 =====
// 唯一需要等待的资源是本地图集 assets/atlas.png（atlas.js 已通过 <script> 同步加载）。
// 加载成功 → 进入游戏；加载失败/超时 → 仍然进入游戏，画面会自动退化为矢量图形。
function startLoadingScreen() {
const loadingScreen = document.getElementById('loadingScreen');
const progressBar = document.getElementById('loadingProgress');
const loadingText = document.getElementById('loadingText');
loadingScreen.style.display = 'flex';
document.getElementById('overlay').classList.add('hidden');
const total = 1;
let finished = false;
function updateProgress() { progressBar.style.width = '100%'; loadingText.textContent = '100%'; }
function finish() {
if (finished) return;
finished = true;
updateProgress();
setTimeout(() => {
loadingScreen.style.display = 'none';
p1SkinId = readSkinId('snakeP1Skin') || 'default';
p2SkinId = readSkinId('snakeP2Skin') || 'default';
initGame();
renderAchievements();
draw();
document.getElementById('overlay').classList.remove('hidden');
document.getElementById('overlayTitle').textContent = '十二生肖闯江湖';
document.getElementById('overlayMsg').textContent = '准备好踏入江湖了吗？';
document.getElementById('startBtn').textContent = '开始修炼';
document.getElementById('startBtn').style.display = 'block';
updateModeButtons();
updateCatModeBtn();
if (window.__updateSkillBtn) window.__updateSkillBtn();
}, 300);
}
let done = false;
const complete = () => { if (done) return; done = true; finish(); };
const timer = setTimeout(() => { console.warn('atlas.png 加载超时，使用矢量兜底图形'); complete(); }, 8000);
atlasImg.onload = () => { clearTimeout(timer); complete(); };
atlasImg.onerror = () => { console.warn('atlas.png 加载失败，使用矢量兜底图形'); clearTimeout(timer); complete(); };
atlasImg.src = ATLAS_IMAGE_URL;
}

// ★ 关键性能修复：原来这里会 new 出 4 个 Audio 对象、把全部 BGM 一次性预加载，
// 合计 6.1MB。首屏和每次页面跳转都在抢这部分带宽，是手机上"加载很久"的头号原因。
// 现在改成：首屏完全不碰 BGM；等页面空闲后再预取「菜单」这一首（约 490KB）。
// 既不和首屏抢带宽，又能让玩家第一次点击时几乎立刻听到音乐。
function prefetchMenuBgm() {
  try { if (!audio.src) audio.src = BGM.menu; } catch (e) {}
}
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(prefetchMenuBgm, { timeout: 2500 });
} else {
  setTimeout(prefetchMenuBgm, 1200);
}
startLoadingScreen();

// ==================== ★ 排行榜前端逻辑 ★ ====================
const LEADERBOARD_API = 'https://zhipu.wange5232.workers.dev/leaderboard';

let currentLbSeedId = null;
let lbRequestToken = 0;   // 防止快速切换关卡时，旧请求把新结果覆盖掉

// HTML 转义，避免玩家名里的特殊字符破坏页面结构
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 打开排行榜弹窗
function openLeaderboard(seedId) {
  seedId = parseInt(seedId, 10);
  if (!seedId || !SEED_LEVELS.some(s => s.id === seedId)) seedId = SEED_LEVELS[0].id;
  currentLbSeedId = seedId;

  const modal = document.getElementById('leaderboardModal');
  const content = document.getElementById('leaderboardContent');
  const title = document.getElementById('leaderboardTitle');
  if (!modal || !content) return;

  const seedInfo = SEED_LEVELS.find(s => s.id === seedId);
  if (title) title.textContent = '🏆 ' + (seedInfo ? seedInfo.name : '种子局') + ' 排行榜';

  // 关卡切换条：让玩家不用退回种子局列表就能翻看别的排行榜
  content.innerHTML =
    '<div class="lb-tabs">' +
      SEED_LEVELS.map(l =>
        '<button class="lb-tab' + (l.id === seedId ? ' active' : '') + '" data-seed="' + l.id + '">' +
          l.emoji + ' ' + escapeHtml(l.name) +
        '</button>'
      ).join('') +
    '</div>' +
    '<div class="leaderboard-loading">加载中...</div>';

  modal.classList.add('show');
  fetchLeaderboard(seedId);
}

// 拉取数据并渲染
async function fetchLeaderboard(seedId) {
  const content = document.getElementById('leaderboardContent');
  if (!content) return;

  const token = ++lbRequestToken;
  // 保留切换条，只替换下面的列表区
  const tabsHtml = content.querySelector('.lb-tabs')
    ? content.querySelector('.lb-tabs').outerHTML
    : '';
  const body = document.createElement('div');
  body.className = 'lb-body';

  try {
    const res = await fetch(LEADERBOARD_API + '/list?seedId=' + seedId + '&limit=20');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    // 如果用户已经切到别的关卡了，这次结果作废
    if (token !== lbRequestToken) return;

    if (!data.leaderboard || data.leaderboard.length === 0) {
      body.innerHTML = '<div class="leaderboard-empty">🏜️ 暂无记录，快来抢第一！</div>';
    } else {
      const myName = SM.getString('snakePlayerName', '');
      let html = '<div class="leaderboard-list">';
      data.leaderboard.forEach(item => {
        const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '#' + item.rank;
        const isMe = item.playerName === myName ? ' is-me' : '';
        // ★ 称号徽章：显示在名字上方
        let titleHtml = '';
        if (item.title) {
          const t = TITLES.find(x => x.name === item.title);
          const tierClass = t ? 'tier-' + t.tier : 'tier-bronze';
          titleHtml = '<span class="lb-title title-badge ' + tierClass + '">' + escapeHtml(item.title) + '</span>';
        }
        html += '<div class="leaderboard-row' + isMe + '">' +
          '<span class="lb-rank">' + medal + '</span>' +
          '<div class="lb-info">' +
            titleHtml +
            '<span class="lb-name">' + escapeHtml(item.playerName) + '</span>' +
          '</div>' +
          '<span class="lb-score">' + escapeHtml(item.score) + '</span>' +
        '</div>';
      });
      html += '</div>';
      body.innerHTML = html;
    }
  } catch (e) {
    if (token !== lbRequestToken) return;
    console.warn('排行榜拉取失败:', e);
    body.innerHTML = '<div class="leaderboard-empty">📡 加载失败，请检查网络后重试</div>';
  }

  if (token !== lbRequestToken) return;
  content.innerHTML = tabsHtml;
  content.appendChild(body);
}

// 绑定排行榜弹窗事件
// 说明：HTML 里并没有 openLeaderboardBtn 这个元素（排行榜是从种子局卡片的 🏆 进入的），
// 所以这里改用事件委托，既能覆盖当前的关闭按钮，日后新增入口按钮也能直接生效。
document.addEventListener('DOMContentLoaded', () => {
  const lbModal = document.getElementById('leaderboardModal');
  if (!lbModal) return;

  // ① 关卡切换：委托监听，按钮是动态生成的也有效
  lbModal.addEventListener('click', (e) => {
    const tab = e.target.closest('.lb-tab');
    if (tab) {
      const seedId = parseInt(tab.dataset.seed, 10);
      if (seedId && seedId !== currentLbSeedId) openLeaderboard(seedId);
      return;
    }
    // 点击遮罩空白处关闭
    if (e.target === lbModal) lbModal.classList.remove('show');
  });

  // ② 关闭按钮：委托 + 兜底绑定（id 为 closeLeaderboard）
  lbModal.addEventListener('click', (e) => {
    if (e.target.closest('#closeLeaderboard')) lbModal.classList.remove('show');
  });

  // ③ 兼容：若日后 HTML 里补上了「排行榜」入口按钮，这里自动生效，无需再改代码
  document.addEventListener('click', (e) => {
    const entry = e.target.closest('[data-open-leaderboard]');
    if (!entry) return;
    const seedModal = document.getElementById('seedModal');
    if (seedModal) seedModal.classList.remove('show');
    openLeaderboard(entry.dataset.openLeaderboard || SEED_LEVELS[0].id);
  });

  // ④ ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lbModal.classList.contains('show')) lbModal.classList.remove('show');
  });
});
// ==================== ★ 江湖称号面板 ★ ====================
// 设计原则：按难度排序展示，已解锁的可以点击佩戴/取消，未解锁的显示进度条。
// 佩戴状态直接写 localStorage，刷新后保留。

const TITLE_TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond', 'legend', 'inn'];

let currentTitleFilter = 'all';

function renderTitles() {
  const listEl = document.getElementById('titleList');
  const countEl = document.getElementById('titleCount');
  const currentEl = document.getElementById('titleCurrent');
  const filterEl = document.getElementById('titleFilter');
  if (!listEl) return;

  // ★ 筛选栏：只有元素存在时才渲染，避免 HTML 没加就报错
  if (filterEl) {
    const tiers = [
      { id: 'all',     name: '全部' },
      { id: 'bronze',  name: '青铜' },
      { id: 'silver',  name: '白银' },
      { id: 'gold',    name: '黄金' },
      { id: 'diamond', name: '钻石' },
      { id: 'legend',  name: '王者' },
      { id: 'inn',     name: '客栈' }
    ];
    filterEl.innerHTML = tiers.map(t =>
      '<button class="title-filter-btn' + (currentTitleFilter === t.id ? ' active' : '') +
      '" data-tier="' + t.id + '">' + t.name + '</button>'
    ).join('');
    filterEl.querySelectorAll('.title-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTitleFilter = btn.dataset.tier;
        renderTitles();
      });
    });
  }

  if (countEl) countEl.textContent = unlockedTitles.length + '/' + TITLES.length;

  // 当前佩戴
  if (currentEl) {
    const t = TITLES.find(x => x.id === equippedTitle);
    if (t) {
      currentEl.innerHTML = '<span class="title-badge tier-' + t.tier + '">🏅 ' + t.name + '</span>' +
        '<span class="title-current-tip">佩戴中 · 点击下方卡片可更换或取消</span>';
    } else {
      currentEl.innerHTML = '<span class="title-current-tip">未佩戴称号 · 点击下方已解锁的称号即可佩戴</span>';
    }
  }

  // ★ 先按筛选过滤，再按难度排序
  const filtered = currentTitleFilter === 'all'
    ? [...TITLES]
    : TITLES.filter(t => t.tier === currentTitleFilter);

  const sorted = filtered.sort((a, b) =>
    TITLE_TIER_ORDER.indexOf(a.tier) - TITLE_TIER_ORDER.indexOf(b.tier)
  );

  listEl.innerHTML = '';
  let lastTier = '';
  sorted.forEach(t => {
    if (t.tier !== lastTier) {
      lastTier = t.tier;
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'title-section-title tier-' + t.tier;
      sectionTitle.textContent = TITLE_TIERS[t.tier].name;
      listEl.appendChild(sectionTitle);
    }

    const isUnlocked = unlockedTitles.includes(t.id);
    const isEquipped = equippedTitle === t.id;
    const progress = t.progress ? Math.min(Math.max(t.progress(), 0), 1) : (isUnlocked ? 1 : 0);

    const card = document.createElement('div');
    card.className = 'title-card tier-' + t.tier +
      (isUnlocked ? ' unlocked' : ' locked') +
      (isEquipped ? ' equipped' : '');

    let html = '<div class="title-card-top">' +
      '<span class="title-badge tier-' + t.tier + '">' + t.name + '</span>' +
      (isEquipped ? '<span class="title-equipped-tag">佩戴中</span>' : '') +
      (isUnlocked ? '<span class="title-unlocked-tag">✅ 已解锁</span>' : '<span class="title-locked-tag">🔒 未解锁</span>') +
    '</div>';
    html += '<div class="title-card-desc">' + t.desc + '</div>';
    if (!isUnlocked) {
      html += '<div class="title-progress"><div class="title-progress-bar" style="width:' + (progress * 100).toFixed(0) + '%"></div></div>';
      html += '<div class="title-progress-text">' + (progress * 100).toFixed(0) + '%</div>';
    }
    card.innerHTML = html;

    if (isUnlocked) {
      card.addEventListener('click', () => {
        if (isEquipped) {
          equippedTitle = '';
          SM.safeRemove(EQUIPPED_TITLE_KEY);
          showCheatToast('已取消佩戴称号', 900);
        } else {
          equippedTitle = t.id;
          SM.safeSet(EQUIPPED_TITLE_KEY, equippedTitle);
          showCheatToast('✨ 已佩戴「' + t.name + '」', 900);
        }
        renderTitles();
      });
    }

    listEl.appendChild(card);
  });
}

// 绑定称号按钮与弹窗关闭
document.addEventListener('DOMContentLoaded', () => {
  const titleBtn = document.getElementById('titleBtn');
  const titleModal = document.getElementById('titleModal');
  const closeTitle = document.getElementById('closeTitle');
  if (!titleBtn || !titleModal) return;

  titleBtn.addEventListener('click', () => {
    renderTitles();
    titleModal.classList.add('show');
  });
  if (closeTitle) closeTitle.addEventListener('click', () => titleModal.classList.remove('show'));
  titleModal.addEventListener('click', (e) => {
    if (e.target === titleModal) titleModal.classList.remove('show');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && titleModal.classList.contains('show')) {
      titleModal.classList.remove('show');
    }
  });
});