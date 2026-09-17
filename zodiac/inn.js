// ==========================================================================
// 🏮 江湖客栈 · 页面逻辑
// --------------------------------------------------------------------------
// 职责：
//   1. 读取好感度 & 金币，动态渲染三个（未来更多）房间
//   2. 点击房间 → 弹出详情弹窗（好感度条 + 三档解锁内容）
//   3. 点击「让他说一句」→ 调 AI 生成方言气泡
//   4. 点击「回主菜单」→ 带加载遮罩跳转
// ==========================================================================

const SM = window.SaveManager;
if (!SM) console.error('[客栈] SaveManager 未加载');

// ---------- 状态 ----------
let currentChar = null;
let aiSpeaking = false;

// ---------- 元素引用 ----------
const roomsEl        = document.getElementById('innRooms');
const coinsEl        = document.getElementById('innCoins');
const dialogEl       = document.getElementById('hostessDialog');
const backBtn        = document.getElementById('innBackBtn');

const roomModal      = document.getElementById('roomModal');
const roomModalClose = document.getElementById('roomModalClose');
const rmAvatar       = document.getElementById('rmAvatar');
const rmName         = document.getElementById('rmName');
const rmTitle        = document.getElementById('rmTitle');
const rmAffTier      = document.getElementById('rmAffTier');
const rmAffNum       = document.getElementById('rmAffNum');
const rmAffFill      = document.getElementById('rmAffFill');
const rmUnlocks      = document.getElementById('rmUnlocks');
const rmDialog       = document.getElementById('rmDialog');
const rmSpeakBtn     = document.getElementById('rmSpeakBtn');

const loadingEl      = document.getElementById('innLoading');
const loadingText    = document.getElementById('innLoadingText');
const loadingBar     = document.getElementById('innLoadingProgress');

// ---------- AI 配置（从 data.js 统一读取，不再本地声明）----------

// ---------- 工具函数 ----------
function readAffinity() {
  const raw = SM.getJSON(INN_AFFINITY_KEY, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  Object.keys(raw).forEach(k => {
    const n = parseInt(raw[k], 10);
    if (Number.isFinite(n) && n >= 0) clean[k] = Math.min(n, INN_MAX_AFFINITY);
  });
  return clean;
}

function readUnlockedSkins() {
  // 成就解锁 + 作弊解锁，两类都算
  const ach = SM.getStringArray('snakeAchievementsV5', null);
  const cheat = SM.getStringArray('snakeCheatSkins', null);
  return new Set([...ach, ...cheat]);
}

function isSkinUnlockedForChar(char) {
  if (!char.skinId) return true;
  const skin = (window.SKINS || {})[char.skinId];
  if (!skin || !skin.unlockId) return true;
  return readUnlockedSkins().has(skin.unlockId);
}

// ---------- 应用 pending 好感度（进客栈时播放增长动画）----------
function applyPendingAffinity() {
  const pending = SM.getJSON(INN_PENDING_KEY, {});
  if (!pending || typeof pending !== 'object' || Array.isArray(pending)) return null;
  const keys = Object.keys(pending).filter(k => pending[k] > 0);
  if (keys.length === 0) return null;

  const aff = readAffinity();
  const changes = {};
  const tierUpChars = [];   // 跨节点的角色（用于提示）

  keys.forEach(k => {
    const before = aff[k] || 0;
    const after = Math.min(INN_MAX_AFFINITY, before + pending[k]);
    if (after > before) {
      changes[k] = { before, after };
      const tierBefore = getInnTier(before);
      const tierAfter = getInnTier(after);
      if (tierAfter > tierBefore) {
        tierUpChars.push({ charId: k, tierBefore, tierAfter });
      }
      aff[k] = after;
    }
  });

  SM.setJSON(INN_AFFINITY_KEY, aff);
  SM.setJSON(INN_PENDING_KEY, {});   // 清空

  return { changes, tierUpChars };
}

// ---------- 渲染房间 ----------
function renderRooms(usePending) {
  const affinity = readAffinity();
  const pending = usePending ? SM.getJSON(INN_PENDING_KEY, {}) : {};  const unlocked = readUnlockedSkins();
  roomsEl.innerHTML = '';

  Object.values(INN_CHARACTERS).forEach(char => {
    const aff = affinity[char.id] || 0;
    const tier = getInnTier(aff);
    const isUnlocked = isSkinUnlockedForChar(char);

    const room = document.createElement('div');
    room.className = 'inn-room' + (isUnlocked ? '' : ' locked');
    room.dataset.char = char.id;
    // ★ 坐标写成 CSS 变量，而不是直接写 left/top。
    //   桌面版房间是绝对定位散落的，手机版改成流式网格后 .inn-room 变成 relative ——
    //   此时行内的 left/top 会被当成"相对原位的偏移量"，把每个房间推歪。
    //   交给 CSS 决定这两个变量怎么用，转屏/改窗口时也不用重渲染。
    room.style.setProperty('--room-x', char.roomPos.x + '%');
    room.style.setProperty('--room-y', char.roomPos.y + '%');

    // ★ usePending=true 时，先显示"旧值"（不包含 pending）
    const pendingVal = (pending && pending[char.id]) || 0;
    const displayAff = usePending ? aff : aff;   // renderRooms 中 aff 已是结算后的值
    const pct = Math.min(100, displayAff / INN_MAX_AFFINITY * 100);
    const oldPct = usePending
      ? Math.min(100, Math.max(0, (aff - pendingVal)) / INN_MAX_AFFINITY * 100)
      : pct;
    room.innerHTML =
      // 可点击区 A：点木屋+名字 → 头顶气泡（对白）
      '<div class="room-talk" data-action="talk">' +
        '<div class="room-house">' +
          '<span class="room-emoji">' + char.emoji + '</span>' +
          '<div class="room-body"></div>' +
          (aff >= INN_MAX_AFFINITY ? '<span class="room-badge">🏅</span>' : '') +
        '</div>' +
        '<div class="room-name">' + char.name + '</div>' +
        '<div class="room-title">' + (isUnlocked ? char.title : '🔒 未解锁') + '</div>' +
      '</div>' +
      // 可点击区 B：点好感条 → 弹详情窗
      '<div class="room-aff" data-action="detail" title="点击查看好感详情">' +
        '<div class="room-aff-bar" data-char="' + char.id + '">' +
          '<div class="room-aff-fill" style="width:' + oldPct + '%;"></div>' +
          '<span class="room-aff-mark" style="left:33.3%"></span>' +
          '<span class="room-aff-mark" style="left:66.6%"></span>' +
          '<span class="room-aff-mark" style="left:100%"></span>' +
        '</div>' +
        '<div class="room-aff-num">' +
          '<span class="room-aff-heart">💗</span>' +
          '<span>' + aff + ' / ' + INN_MAX_AFFINITY + '</span>' +
        '</div>' +
      '</div>' +
      // 头顶气泡容器
      '<div class="room-bubble" id="bubble-' + char.id + '"></div>';

    if (isUnlocked) {
      const talkArea = room.querySelector('[data-action="talk"]');
      const detailArea = room.querySelector('[data-action="detail"]');
      talkArea.addEventListener('click', (e) => {
        e.stopPropagation();
        speakFromRoom(char, room);
      });
      detailArea.addEventListener('click', (e) => {
        e.stopPropagation();
        openRoomModal(char);
      });
    }
    roomsEl.appendChild(room);
  });
}

// ---------- 打开详情弹窗 ----------
function openRoomModal(char) {
  currentChar = char;
  const affinity = readAffinity();
  const aff = affinity[char.id] || 0;
  const tier = getInnTier(aff);

  rmAvatar.textContent = char.emoji;
  rmName.textContent = char.name;
  rmTitle.textContent = char.title;
  rmAffTier.textContent = INN_TIER_NAMES[tier];
  rmAffNum.textContent = aff + ' / ' + INN_MAX_AFFINITY;
  rmAffFill.style.width = '0%';
  // 下一帧再设置宽度触发过渡动画
  requestAnimationFrame(() => {
    rmAffFill.style.width = (aff / INN_MAX_AFFINITY * 100) + '%';
  });

  // 三档解锁内容
  const unlocks = [
    { need: 100, icon: '🗣️', title: '方言台词', body: char.dialogs[0] || '' },
    { need: 200, icon: '📖', title: '小故事',   body: char.story },
    { need: 300, icon: '🏅', title: '客栈徽章', body: char.name + ' · 挚友徽章（专属称号）' }
  ];

  // ★ 觉醒预览（暂未实装，仅作设计展示）
  if (char.awakening) {
    unlocks.push({
      need: 300,
      icon: '🌟',
      title: '皮肤觉醒 · ' + char.awakening.name,
      body: char.awakening.desc
    });
  }
  let html = '';
  unlocks.forEach(u => {
    const unlocked = aff >= u.need;
    html +=
      '<div class="rm-unlock' + (unlocked ? ' unlocked' : ' locked') + '">' +
        '<div class="rm-unlock-head">' +
          '<span>' + u.icon + ' ' + u.title + '</span>' +
          '<span class="rm-unlock-tag">' + (unlocked ? '✅ 已解锁' : '还需 ' + (u.need - aff)) + '</span>' +
        '</div>' +
        '<div class="rm-unlock-body">' + (unlocked ? u.body : '好感度达到 ' + u.need + ' 后解锁') + '</div>' +
      '</div>';
  });
  rmUnlocks.innerHTML = html;

  // 重置对话气泡
  rmDialog.classList.remove('show');
  rmDialog.textContent = '';

  // ★ 好感度 < 100 时不能对话（对应第一档「方言台词」解锁）
  if (aff >= 100) {
    rmSpeakBtn.disabled = false;
    rmSpeakBtn.textContent = '💬 让他说一句';
  } else {
    rmSpeakBtn.disabled = true;
    rmSpeakBtn.textContent = '🔒 好感度 100 解锁对话';
  }

  roomModal.classList.add('show');
}

function closeRoomModal() {
  roomModal.classList.remove('show');
  currentChar = null;
  aiSpeaking = false;
}

// ---------- 头顶气泡：点木屋 → 在人物旁边弹一句话 ----------
const roomBubbleBusy = {};   // 每个角色一个忙闲锁，避免连点重复调用

async function speakFromRoom(char, roomEl) {
  if (roomBubbleBusy[char.id]) return;

  const affinity = readAffinity();
  const aff = affinity[char.id] || 0;
  const bubble = roomEl.querySelector('.room-bubble');
  if (!bubble) return;

  // 关闭其他已开的气泡（同时把它们的房间降回普通层级）
  document.querySelectorAll('.room-bubble.show').forEach(b => {
    if (b !== bubble) {
      b.classList.remove('show');
      const r = b.closest('.inn-room');
      if (r) r.classList.remove('bubble-open');
    }
  });

  // ★ 气泡弹出时把本房间提到最上层，否则会被相邻房间的木屋盖住
  roomEl.classList.add('bubble-open');

  // 好感度 < 100：还不能对话，弹一句"我们不熟"
  if (aff < 100) {
    bubble.textContent = '咱们还不熟，等你多来几趟再说～';
    bubble.classList.add('show', 'locked');
    // 用同一个 __hideTimer，避免连点后旧计时器提前把气泡收掉
    clearTimeout(bubble.__hideTimer);
    bubble.__hideTimer = setTimeout(() => {
      bubble.classList.remove('show');
      roomEl.classList.remove('bubble-open');
      setTimeout(() => bubble.classList.remove('locked'), 400);
    }, 2400);
    return;
  }

  roomBubbleBusy[char.id] = true;
  bubble.classList.remove('locked');
  bubble.classList.add('show', 'thinking');
  bubble.textContent = '💭 正在想…';

  await fetchDialectText(char, (text, isFallback) => {
    bubble.textContent = text || '💭 正在想…';
    if (!isFallback) bubble.classList.remove('thinking');
  });
  bubble.classList.remove('thinking');

  // 8 秒后自动收起
  clearTimeout(bubble.__hideTimer);
  bubble.__hideTimer = setTimeout(() => {
    bubble.classList.remove('show');
    roomEl.classList.remove('bubble-open');
    setTimeout(() => { roomBubbleBusy[char.id] = false; }, 400);
  }, 8000);

  roomBubbleBusy[char.id] = false;
}

// ---------- AI 聊天历史（防雷同）----------
function getChatHistory() {
  const h = SM.getJSON(INN_CHAT_HISTORY_KEY, {});
  if (!h || typeof h !== 'object' || Array.isArray(h)) return {};
  return h;
}
function getCharHistory(charId) {
  const h = getChatHistory();
  const arr = h[charId];
  return Array.isArray(arr) ? arr : [];
}
function recordCharComment(charId, text) {
  const h = getChatHistory();
  const arr = getCharHistory(charId);
  arr.push(text);
  // 每个角色最多保留 10 条，避免无限膨胀
  while (arr.length > 10) arr.shift();
  h[charId] = arr;
  SM.setJSON(INN_CHAT_HISTORY_KEY, h);
}

// ---------- 话题角度池（每次点击轮换一个切入角度，避免同一个人连着说同类的话）----------
const INN_ANGLE_POOL = [
  { id: '寒暄', hint: '用你自己的方言跟客人打招呼、寒暄，问问近况。重点是客套话，不要讲往事' },
  { id: '当下', hint: '说说客栈此刻正在发生的事：你手上的活计、今天的天气、堂里的动静、后厨的香味' },
  { id: '往事', hint: '挑一段你自己的过往经历讲给客人听，用回忆的口吻，带一点感慨' },
  { id: '关心', hint: '关心客人本人：气色、走位、有没有吃饭、累不累，像老朋友那样' },
  { id: '心事', hint: '露一点你自己的小毛病、小癖好，或一句没说完的心事，让人觉得你是活人' },
  { id: '江湖', hint: '拿江湖传闻、别家客栈、路上的见闻当话头，最后把话递回给客人' }
];

// 按"历史条数"轮换角度：同一个人连着点，也不会两次都用同一个角度
function pickInnAngle(historyLen) {
  return INN_ANGLE_POOL[historyLen % INN_ANGLE_POOL.length];
}

// 从角色的素材碎片里取 3 条当"灵感种子"（仅供启发，禁止整句照抄）。
// offset 传历史条数，保证同一个角色每次取到的碎片也在轮换。
function pickInnSeeds(char, angleId, offset) {
  const daily = Array.isArray(char.dailyTopics) ? char.dailyTopics : [];
  const past  = Array.isArray(char.pastTales) ? char.pastTales : [];
  const pool  = (angleId === '往事') ? past.concat(daily) : daily.concat(past);
  if (pool.length === 0) return [];
  const picked = [];
  const n = Math.min(3, pool.length);
  for (let i = 0; i < n; i++) picked.push(pool[(offset + i) % pool.length]);
  return picked;
}

// 兜底台词：从 dialogs + extraDialogs 里挑一句"最近没说过的"。
// 旧写法只取 dialogs[tier]，AI 不可用时连点同一个人会一直念同一句 —— 那本身就是雷同。
function pickFallbackLine(char, tier, history) {
  const pool = []
    .concat(Array.isArray(char.dialogs) ? char.dialogs : [])
    .concat(Array.isArray(char.extraDialogs) ? char.extraDialogs : [])
    .filter(t => typeof t === 'string' && t.trim());
  if (pool.length === 0) return '……';
  const tierLine = (char.dialogs && char.dialogs[tier]) ? char.dialogs[tier] : null;
  const unused = pool.filter(t => history.indexOf(t) === -1);
  if (unused.length > 0) {
    if (tierLine && unused.indexOf(tierLine) !== -1 && Math.random() < 0.5) return tierLine;
    return unused[Math.floor(Math.random() * unused.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- 雷同检测：最长公共子串 >= 6 字，就认定"和之前太像了" ----------
function longestCommonSubstr(a, b) {
  if (!a || !b) return 0;
  let best = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;                          // dp[i-1][j-1]
    for (let j = 1; j <= b.length; j++) {
      const old = prev[j];                 // dp[i-1][j]
      if (a.charCodeAt(i - 1) === b.charCodeAt(j - 1)) {
        prev[j] = diag + 1;
        if (prev[j] > best) best = prev[j];
      } else {
        prev[j] = 0;
      }
      diag = old;
    }
  }
  return best;
}

function isTooSimilar(text, history) {
  const t = (text || '').trim();
  if (!t || t.length < 8) return false;    // 太短不判，免得误杀
  return history.slice(-3).some(h => longestCommonSubstr(t, (h || '').trim()) >= 6);
}

// ---------- 发一次请求，逐字回传（失败抛异常）----------
async function requestInnLine(sysPrompt, userPrompt, onDelta) {
  const resp = await fetch(AI_BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + AI_API_KEY
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
      temperature: 0.95,
      max_tokens: 80
    })
  });

  if (!resp.ok) throw new Error('API ' + resp.status);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const json = JSON.parse(dataStr);
        const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
        if (delta) {
          fullText += delta;
          if (onDelta) onDelta(fullText, false);
        }
      } catch (e) {}
    }
  }
  return fullText.trim();
}

// ---------- 通用：调 AI 取一句方言（通过 onDelta 回调逐字返回）----------
async function fetchDialectText(char, onDelta) {
  const affinity = readAffinity();
  const aff = affinity[char.id] || 0;
  const tier = getInnTier(aff);
  const tierName = INN_TIER_NAMES[tier];

  const history = getCharHistory(char.id);

  // ★ 本次的切入角度 + 素材碎片，都按历史条数轮换（12 位住客走的是同一套逻辑）
  const angle = pickInnAngle(history.length);
  const seeds = pickInnSeeds(char, angle.id, history.length);

  const sysPromptLines = [
    '你是《十二生肖闯江湖》客栈中的一位生肖角色，请你完全入戏。',
    '',
    '【角色档案】',
    '名字：' + char.name,
    '身份：' + char.title,
    '人设：' + char.personality
  ];
  if (char.flaw)  sysPromptLines.push('性格弱点：' + char.flaw);
  if (char.quirk) sysPromptLines.push('小癖好：' + char.quirk);
  sysPromptLines.push(
    '方言：' + char.dialect,
    '方言特点：' + char.dialectNote,
    '背景故事：' + char.story,
    '',
    '【当前关系】',
    '客栈客人和你的好感度等级：' + tierName + '（0=初识，1=熟络，2=知己，3=挚友）',
    '· 初识：客气、疏离、礼貌打招呼',
    '· 熟络：热情、自然、带点小调侃',
    '· 知己：亲昵、掏心窝、把客人当自己人',
    '· 挚友：无话不谈、开熟客玩笑、关心客人近况',
    '',
    '【本次切入角度】' + angle.id + ' —— ' + angle.hint,
    '（本次只能用这个角度，不要串到别的角度去）'
  );
  if (seeds.length > 0) {
    sysPromptLines.push(
      '',
      '【可借用的细节碎片 —— 只是灵感，禁止整句照抄，要用你自己的话说出来】'
    );
    seeds.forEach(s => sysPromptLines.push('· ' + s));
  }
  sysPromptLines.push(
    '',
    '【你可以说什么】',
    '· 现在的事：客栈此刻的动静、你手上的活计、天气、吃食',
    '· 寒暄客套：问好、问近况、招呼客人坐下喝口茶',
    '· 过往经历：你从前经历过的事，一两句带过，不要长篇回忆',
    '· 你的小癖好、小抱怨、小得意',
    '· 不要提"好感度""等级""解锁"这类游戏词汇，你就是活在这家客栈里的人',
    '',
    '【输出要求】',
    '1. 用你的第一人称，用你的方言口吻，对客栈的客人说一句话',
    '2. 不超过 40 字',
    '3. 必须体现你的性格和方言特点',
    '4. 必须符合当前好感度等级的语气',
    '5. 直接输出这句话，不要加引号、不要加"他说："、不要加任何前缀',
    '',
    '【严禁雷同 - 最重要】',
    '· 禁止使用和【最近几次聊天】相同或相似的开头词（比如都叫"侬好呀"、"俺是"、"哟"）',
    '· 禁止使用相同或相似的句式结构（比如都是"我是XX，做什么的，你要XX吗"）',
    '· 禁止重复使用之前用过的打招呼语、口头禅、语气词',
    '· 严禁连续两次说话内容雷同，每次都要换一个切入角度',
    '· 禁止照抄【可借用的细节碎片】里的原句，必须换成你自己的说法',
    '· 写完在心里对一遍：只要和上面任意一条有连续 6 个字以上相同，就换一个说法重写',
    '· 宁可换个话题（比如从吃的、天气、客人气色、江湖传言切入），也不要用旧句式'
  );
  const sysPrompt = sysPromptLines.join('\n');

  const userPrompt = '客人刚走进来，跟我说句话吧。这次请从"' + angle.id + '"这个角度切入：' + angle.hint;
  const fallback = pickFallbackLine(char, tier, history);

  if (typeof AI_API_KEY === 'undefined' || !AI_API_KEY || AI_API_KEY.length < 20) {
    if (onDelta) onDelta(fallback, true);
    return fallback;
  }

  // 构造 prompt：附上最近的历史，让 AI 避开
  let fullUserPrompt = userPrompt;
  if (history.length > 0) {
    fullUserPrompt += '\n\n【最近几次聊天 - 必须避开，严禁雷同】\n';
    history.slice(-6).forEach((t, i) => { fullUserPrompt += (i + 1) + '. ' + t + '\n'; });
    fullUserPrompt += '\n请换一个完全不同的角度、句式和梗，重新说一句。尤其是开头词，绝对不能一样。';
  } else {
    fullUserPrompt += '\n\n（这位客人是第一次跟你搭话，你还没对他说过什么。）';
  }

  try {
    if (onDelta) onDelta('', false);

    let text = await requestInnLine(sysPrompt, fullUserPrompt, onDelta);

    // ★ 二次校验：模型偶尔还是会复读，检测到和最近几句太像就让它换一个说法重说一次
    if (text && isTooSimilar(text, history)) {
      const retryUser = fullUserPrompt +
        '\n\n【刚才那句不能用】' + text +
        '\n它和上面【最近几次聊天】太像了。请彻底换一个角度、句式和开头词，重新说一句。';
      const second = await requestInnLine(sysPrompt, retryUser, onDelta);
      if (second) text = second;
    }

    if (text) {
      recordCharComment(char.id, text);
      return text;
    }
    if (onDelta) onDelta(fallback, true);
    recordCharComment(char.id, fallback);
    return fallback;
  } catch (e) {
    console.warn('[客栈 AI] 失败:', e);
    if (onDelta) onDelta(fallback, true);
    recordCharComment(char.id, fallback);
    return fallback;
  }
}


// ---------- 事件绑定 ----------
rmSpeakBtn.addEventListener('click', async () => {
  if (aiSpeaking || !currentChar) return;
  const affinity = readAffinity();
  const aff = affinity[currentChar.id] || 0;
  if (aff < 100) return;

  aiSpeaking = true;
  rmSpeakBtn.disabled = true;
  rmSpeakBtn.textContent = '💭 正在酝酿...';
  rmDialog.classList.add('show', 'thinking');
  rmDialog.textContent = '🤖 AI 正在思考...';

  await fetchDialectText(currentChar, (text, isFallback) => {
    rmDialog.textContent = text || '🤖 AI 正在思考...';
    if (!isFallback) rmDialog.classList.remove('thinking');
  });
  rmDialog.classList.remove('thinking');

  rmSpeakBtn.disabled = false;
  rmSpeakBtn.textContent = '💬 再说一句';
  aiSpeaking = false;
});

roomModalClose.addEventListener('click', closeRoomModal);
roomModal.addEventListener('click', (e) => {
  if (e.target === roomModal) closeRoomModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && roomModal.classList.contains('show')) closeRoomModal();
});

// ---------- 返回主菜单 ----------
backBtn.addEventListener('click', () => {
  if (loadingEl) {
    loadingText.textContent = '🏠 返回主菜单...';
    loadingEl.classList.remove('hidden');
    loadingBar.style.width = '0%';
    requestAnimationFrame(() => {
      loadingBar.style.width = '60%';
      setTimeout(() => { loadingBar.style.width = '100%'; }, 250);
    });
    setTimeout(() => { window.location.href = 'index.html'; }, 650);
  } else {
    window.location.href = 'index.html';
  }
});

// ---------- 老板娘欢迎语（随机轮换）----------
const HOSTESS_GREETINGS = [
  '客官里边请～',
  '稀客稀客，快进来坐～',
  '哟，是宝宝来了呀～',
  '今晚有酒有肉，就差你了～',
  '推门就是江湖，进来歇歇脚～'
];
let greetIdx = 0;
// ★ AI 说完话后的"静默期"截止时间戳：这段时间内不让自动欢迎语抢话
let greetPausedUntil = 0;
const GREET_RESUME_DELAY = 6000;   // AI 说完后隔 6 秒再恢复自动轮换

setInterval(() => {
  if (roomModal.classList.contains('show')) return;
  if (hostessAiBusy) return;                        // AI 正在酝酿，别插嘴
  if (Date.now() < greetPausedUntil) return;        // AI 刚说完，留几秒让玩家看完
  greetIdx = (greetIdx + 1) % HOSTESS_GREETINGS.length;
  dialogEl.style.opacity = '0';
  setTimeout(() => {
    dialogEl.textContent = HOSTESS_GREETINGS[greetIdx];
    dialogEl.style.opacity = '1';
  }, 300);
}, 5000);

// ---------- 老板娘互动：单击 → AI 对话；2 秒内点 5 次 → 作弊码 ----------
let hostessTapCount = 0;
let hostessTapTimer = null;
let hostessAiBusy = false;
const hostessEl = document.querySelector('.inn-hostess');

// 老板娘的"人设"——用于 AI 生成对话
const HOSTESS_PROFILE = {
  name: '小江湖',
  title: '江湖客栈老板娘',
  personality: '古灵精怪、说话带江湖气，爱叫玩家"宝宝"，喜欢用武侠梗（"内力深厚"、"走位如风"、"江湖上又要传开了"）。她是客栈里所有生肖的大家长，对每位住客都了如指掌。',
  story: '江湖客栈的老板娘，没人知道她哪年开的这家店，只知道自从她开门，江湖上三教九流都愿意在这里歇脚。她记得每位客人的口味，也记得每位生肖住客的脾气。'
};

function generateHostessDialog() {
  return new Promise(async (resolve) => {
    const roomsAffinity = readAffinity();
    const totalAff = Object.values(roomsAffinity).reduce((a, b) => a + b, 0);
    const friends = Object.keys(roomsAffinity).filter(k => (roomsAffinity[k] || 0) >= INN_MAX_AFFINITY).length;
    const sysPrompt = [
      '你是《十二生肖闯江湖》客栈的老板娘「小江湖」，请你完全入戏。',
      '',
      '【角色档案】',
      '名字：' + HOSTESS_PROFILE.name,
      '身份：' + HOSTESS_PROFILE.title,
      '人设：' + HOSTESS_PROFILE.personality,
      '背景：' + HOSTESS_PROFILE.story,
      '',
      '【当前客栈状态】',
      // 住客数量动态取，别再写死 —— 之前写死成 7，加满 12 生肖后老板娘会数错人
      '客栈里住着 ' + Object.keys(INN_CHARACTERS).length + ' 位生肖角色。客人和生肖们的好感度总和：' + totalAff,
      '已经和 ' + friends + ' 位生肖结为挚友。',
      '',
      '【输出要求】',
      '1. 用第一人称，对走进客栈的客人说一句话',
      '2. 不超过 40 字',
      '3. 不要提到数据（好感度数值、挚友数量），可以用江湖口吻调侃',
      '4. 直接输出这句话，不要加引号、不要加"她说："、不要加前缀',
      '5. 根据当前好感度状态调整语气：',
      '   · 全 0：刚开业，热情中带点试探',
      '   · 有熟客但无挚友：热络，调侃',
      '   · 已有挚友：亲切，像一家人',
      '   · 全员挚友：骄傲，把客人当自己人'
    ].join('\n');

    const history = getCharHistory('__hostess__');
    let userPrompt = '客人刚走进客栈，跟我说句话吧。';
    if (history.length > 0) {
      userPrompt += '\n\n【最近几次我说过的话 - 必须避开，严禁雷同】\n';
      history.slice(-6).forEach((t, i) => { userPrompt += (i + 1) + '. ' + t + '\n'; });
      userPrompt += '\n请换一个完全不同的角度、句式和梗，尤其是开头词，绝对不能一样。';
    }

    const fallback = HOSTESS_GREETINGS[Math.floor(Math.random() * HOSTESS_GREETINGS.length)];

    if (typeof AI_API_KEY === 'undefined' || !AI_API_KEY || AI_API_KEY.length < 20) {
      resolve(fallback);
      return;
    }

    try {
      const resp = await fetch(AI_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + AI_API_KEY
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          temperature: 1.0,
          max_tokens: 80
        })
      });
      if (!resp.ok) throw new Error('API ' + resp.status);
      const data = await resp.json();
      const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (text && text.trim()) {
        recordCharComment('__hostess__', text.trim());
        resolve(text.trim());
        return;
      }
      resolve(fallback);
    } catch (e) {
      console.warn('[客栈 AI 老板娘] 失败:', e);
      resolve(fallback);
    }
  });
}

if (hostessEl) {
  hostessEl.addEventListener('click', () => {
    hostessTapCount++;
    clearTimeout(hostessTapTimer);

    // 达到 5 次：触发作弊码
    if (hostessTapCount >= 5) {
      hostessTapCount = 0;
      const maxAff = {};
      Object.keys(INN_CHARACTERS).forEach(k => { maxAff[k] = INN_MAX_AFFINITY; });
      SM.setJSON(INN_AFFINITY_KEY, maxAff);
      const tip = document.createElement('div');
      tip.className = 'inn-cheat-toast';
      tip.textContent = '💗 老板娘悄悄告诉你：所有生肖的好感度都满啦～';
      document.body.appendChild(tip);
      requestAnimationFrame(() => tip.classList.add('show'));
      setTimeout(() => {
        tip.classList.remove('show');
        setTimeout(() => tip.remove(), 400);
      }, 2200);
      setTimeout(() => renderRooms(), 300);
      return;
    }

    // 2 秒后判断：如果只是单击（<5 次），就触发 AI 对话
    hostessTapTimer = setTimeout(async () => {
      const finalCount = hostessTapCount;
      hostessTapCount = 0;
      if (finalCount < 5 && !hostessAiBusy) {
        hostessAiBusy = true;
        dialogEl.style.opacity = '0';
        setTimeout(async () => {
          dialogEl.textContent = '💭 让我想想...';
          dialogEl.style.opacity = '1';
          const line = await generateHostessDialog();
          dialogEl.textContent = line;
          // ★ AI 说完后进入静默期，避免自动欢迎语立刻把这句话盖掉
          greetPausedUntil = Date.now() + GREET_RESUME_DELAY;
          hostessAiBusy = false;
        }, 200);
      }
    }, 2000);
  });
}

// ---------- 启动 ----------
(function init() {
  // 金币显示
  if (coinsEl) {
    const c = SM.getInt('snakeCoinsV1', 0, 0, 99999999);
    coinsEl.textContent = c;
  }

  // ★ 先应用 pending，拿到变化数据
  const result = applyPendingAffinity();

  if (!result) {
    // 没有待结算：正常渲染
    renderRooms(false);
    return;
  }

  // 有 pending：先渲染"旧值"版本（把 pending 暂时剔除）
  // 做法：临时把 aff 里的值减掉 pending，渲染后再恢复
  // 更简单的方式：renderRooms 里我们已经支持了 usePending
  renderRooms(true);

  // 800ms 后播放增长动画
  setTimeout(() => {
    // 更新每个房间的进度条宽度到新值（触发 CSS transition）
    result.changes.forEach((_, charId) => {
      const aff = readAffinity();
      const newPct = Math.min(100, (aff[charId] || 0) / INN_MAX_AFFINITY * 100);
      const bar = document.querySelector('.room-aff-bar[data-char="' + charId + '"] .room-aff-fill');
      if (bar) bar.style.width = newPct + '%';

      // 更新数字
      const numEl = document.querySelector('.room-aff-bar[data-char="' + charId + '"]')
        ?.closest('.room-aff')?.querySelector('.room-aff-num span:last-child');
      if (numEl) numEl.textContent = (aff[charId] || 0) + ' / ' + INN_MAX_AFFINITY;

      // 如果跨过了节点，加个闪烁
      const tierInfo = result.tierUpChars.find(t => t.charId === charId);
      if (tierInfo) {
        const barEl = document.querySelector('.room-aff-bar[data-char="' + charId + '"]');
        if (barEl) {
          barEl.classList.add('node-flash');
          setTimeout(() => barEl.classList.remove('node-flash'), 1600);
        }
      }
    });

    // 弹出跨节点的提示
    result.tierUpChars.forEach((t, i) => {
      const name = INN_CHARACTERS[t.charId]?.name || t.charId;
      const tierName = INN_TIER_NAMES[t.tierAfter];
      setTimeout(() => {
        if (t.tierAfter === 3) {
          showCheatToast('🏅 恭喜！' + name + ' 与你结为挚友，获得客栈徽章！', 2800);
        } else {
          showCheatToast('🏮 ' + name + ' 对你的好感度达到「' + tierName + '」！', 2000);
        }
      }, i * 1800);
    });
  }, 800);
})();