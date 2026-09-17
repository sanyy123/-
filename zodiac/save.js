// ==========================================================================
// 存档管理模块 (SaveManager)
// --------------------------------------------------------------------------
// 目标：让存档更健壮、可迁移、可备份。
//
// 【解决的问题】
// 1. 原来的存档散落在各处，每处都手写 try/catch，格式错了就静默失败；
// 2. 存档被写坏（值不是合法 JSON）时，游戏会拿到 null/NaN 到处传，产生难查的 bug；
// 3. 换设备 / 清缓存后进度全丢，没有备份手段（要发给朋友玩尤其需要）；
// 4. 浏览器隐私模式下 localStorage 会直接抛异常，游戏无法启动。
//
// 【提供的保障】
// - safeGet / safeSet：永不抛异常，读写失败有明确返回值
// - getJSON：自动识别损坏的存档，损坏时返回默认值并标记待修复
// - 数据校验：读出来的数值会做范围钳制（负数、NaN、超大值一律修正）
// - 导出 / 导入：一键导出整份存档为文本，换设备粘贴即可恢复
//
// 【设计原则】
// 本模块只负责"安全地存取原始值"，不参与游戏逻辑判断，
// 因此接入过程不会改变任何现有游戏行为。
// ==========================================================================

const SaveManager = (function () {

  // ---------- 可用的存储后端探测 ----------
  // 隐私模式 / 禁用 Cookie 时 localStorage 会抛异常，降级为内存存储，
  // 保证游戏能正常玩，只是刷新后不保留进度。
  let backend = null;
  let backendIsPersistent = false;

  const memoryFallback = {};
  const memoryBackend = {
    getItem: k => (k in memoryFallback ? memoryFallback[k] : null),
    setItem: (k, v) => { memoryFallback[k] = String(v); },
    removeItem: k => { delete memoryFallback[k]; },
    key: i => Object.keys(memoryFallback)[i] || null,
    get length() { return Object.keys(memoryFallback).length; }
  };

  try {
    const probe = '__snake_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    backend = window.localStorage;
    backendIsPersistent = true;
  } catch (e) {
    console.warn('[存档] localStorage 不可用，已降级为内存存储（本次游玩不保存）');
    backend = memoryBackend;
    backendIsPersistent = false;
  }

  // ---------- 基础读写（永不抛异常） ----------
  function safeGet(key, fallback = null) {
    try {
      const v = backend.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      console.warn('[存档] 读取失败:', key, e);
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      backend.setItem(key, value);
      return true;
    } catch (e) {
      // 超出配额时给出明确提示，而不是静默丢数据
      console.warn('[存档] 写入失败:', key, e);
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        console.warn('[存档] 存储空间已满，建议清理旧存档');
      }
      return false;
    }
  }

  function safeRemove(key) {
    try { backend.removeItem(key); return true; }
    catch (e) { console.warn('[存档] 删除失败:', key, e); return false; }
  }

  // ---------- 类型安全的读取 ----------
  // 读整数：非法值 / NaN / 越界一律回退到默认值
  function getInt(key, fallback = 0, min = null, max = null) {
    const raw = safeGet(key, null);
    let n = parseInt(raw, 10);
    if (!Number.isFinite(n)) n = fallback;
    if (min !== null && n < min) n = min;
    if (max !== null && n > max) n = max;
    return n;
  }

  // 读浮点数
  function getFloat(key, fallback = 0, min = null, max = null) {
    const raw = safeGet(key, null);
    let n = parseFloat(raw);
    if (!Number.isFinite(n)) n = fallback;
    if (min !== null && n < min) n = min;
    if (max !== null && n > max) n = max;
    return n;
  }

  // 读 JSON 对象：损坏时返回默认值，并记录损坏的键方便后续修复
  const corruptedKeys = new Set();
  function getJSON(key, fallback) {
    const raw = safeGet(key, null);
    if (raw === null || raw === '') return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || parsed === undefined) return fallback;
      return parsed;
    } catch (e) {
      corruptedKeys.add(key);
      console.warn('[存档] "' + key + '" 内容损坏，已重置为默认值');
      return fallback;
    }
  }

  function setJSON(key, obj) {
    try {
      return safeSet(key, JSON.stringify(obj));
    } catch (e) {
      console.warn('[存档] 序列化失败:', key, e);
      return false;
    }
  }

  // 读布尔（存 '0'/'1' 或 'true'/'false' 都能认）
  function getBool(key, fallback = false) {
    const raw = safeGet(key, null);
    if (raw === null) return fallback;
    if (raw === '0' || raw === 'false') return false;
    if (raw === '1' || raw === 'true') return true;
    return fallback;
  }

  function getString(key, fallback = '') {
    const raw = safeGet(key, null);
    if (raw === null || typeof raw !== 'string') return fallback;
    return raw;
  }

  // 数组校验：确保是数组，且元素都落在白名单内（防止脏数据污染 UI）
  function getStringArray(key, whitelist = null) {
    const arr = getJSON(key, []);
    if (!Array.isArray(arr)) return [];
    const cleaned = arr.filter(x => typeof x === 'string');
    return whitelist ? cleaned.filter(x => whitelist.includes(x)) : cleaned;
  }

  function getIntArray(key, min = 0, max = 99) {
    const arr = getJSON(key, []);
    if (!Array.isArray(arr)) return [];
    return arr
      .map(x => parseInt(x, 10))
      .filter(x => Number.isFinite(x) && x >= min && x <= max);
  }

  // ---------- 存档清单 ----------
  // 所有属于"玩家进度"的键。前缀匹配用 * 表示。
  const SAVE_KEYS = [
    'snakeAchievementsV5', 'snakeHighScoreV5', 'snakeTotalScoreV5',
    'snakeStatsV1', 'snakeCoinsV1',
    'snakeInventoryV1', 'snakeInventoryP1V1', 'snakeInventoryP2V1',
    'snakeEquippedV1', 'snakeEquippedP1V1', 'snakeEquippedP2V1',
    'snakeBoardSkin', 'snakeCurrentSkin', 'snakeP1Skin', 'snakeP2Skin',
    'snakeCatMode', 'snakeObstacleMode', 'snakeCheatSkins', 'snakePlayerName',
    'snakeDpadCollapsed',   // 方向键折叠偏好（界面设置，跟着存档走）
    'mazeClearedV1',
    'snakeTitlesV1', 'snakeEquippedTitleV1',
    'snakeInnAffinity', 'snakeInnPendingAffinity', 'snakeInnChatHistory'
  ];
  const SAVE_PREFIXES = ['snakeSeedHigh_', 'mazeHighScoreV1_level'];

  // ---------- 导出 / 导入 ----------
  function collectAll() {
    const data = {};
    SAVE_KEYS.forEach(k => {
      const v = safeGet(k, null);
      if (v !== null) data[k] = v;
    });
    // 前缀键需要遍历全部键名来匹配
    try {
      for (let i = 0; i < backend.length; i++) {
        const k = backend.key(i);
        if (!k) continue;
        if (SAVE_PREFIXES.some(p => k.indexOf(p) === 0)) {
          data[k] = safeGet(k, null);
        }
      }
    } catch (e) { console.warn('[存档] 遍历存储失败:', e); }
    return data;
  }

  function exportSave() {
    const payload = {
      _game: '十二生肖闯江湖',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      data: collectAll()
    };
    return JSON.stringify(payload);
  }

  // 导入：先校验格式，再写入。返回 { ok, count, error }
  function importSave(text) {
    let payload;
    try {
      payload = JSON.parse(String(text || '').trim());
    } catch (e) {
      return { ok: false, count: 0, error: '存档内容格式不正确，请确认粘贴完整' };
    }
    if (!payload || typeof payload !== 'object') {
      return { ok: false, count: 0, error: '存档内容为空' };
    }
    if (!payload.data || typeof payload.data !== 'object') {
      return { ok: false, count: 0, error: '这不是本游戏的存档文件' };
    }

    let count = 0;
    Object.keys(payload.data).forEach(k => {
      const v = payload.data[k];
      // 只导入本游戏认识的键，避免写入无关内容
      const known = SAVE_KEYS.includes(k) || SAVE_PREFIXES.some(p => k.indexOf(p) === 0);
      if (!known) return;
      if (v === null || v === undefined) return;
      if (safeSet(k, String(v))) count++;
    });

    if (count === 0) {
      return { ok: false, count: 0, error: '存档里没有可导入的数据' };
    }
    return { ok: true, count: count, error: null };
  }

  // ---------- 重置 ----------
  function clearAll() {
    SAVE_KEYS.forEach(k => safeRemove(k));
    try {
      const toRemove = [];
      for (let i = 0; i < backend.length; i++) {
        const k = backend.key(i);
        if (k && SAVE_PREFIXES.some(p => k.indexOf(p) === 0)) toRemove.push(k);
      }
      toRemove.forEach(k => safeRemove(k));
    } catch (e) { console.warn('[存档] 清理失败:', e); }
  }

  // ---------- 自检 ----------
  // 返回一份人体可读的诊断信息，方便排查存档问题
  function diagnose() {
    const issues = [];
    if (!backendIsPersistent) {
      issues.push('浏览器存储不可用（可能是隐私模式），本次进度不会被保存');
    }
    corruptedKeys.forEach(k => issues.push('存档项「' + k + '」内容损坏，已重置'));
    let usedBytes = 0;
    try {
      const all = collectAll();
      usedBytes = JSON.stringify(all).length;
    } catch (e) {}
    return {
      persistent: backendIsPersistent,
      corrupted: [...corruptedKeys],
      issues: issues,
      approxBytes: usedBytes
    };
  }

  return {
    isPersistent: () => backendIsPersistent,
    safeGet, safeSet, safeRemove,
    getInt, getFloat, getJSON, setJSON, getBool, getString,
    getStringArray, getIntArray,
    exportSave, importSave, clearAll, diagnose,
    KEYS: SAVE_KEYS, PREFIXES: SAVE_PREFIXES
  };
})();

// 暴露到全局，供其他模块和调试使用
window.SaveManager = SaveManager;
