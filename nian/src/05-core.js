/* ============================================================================
   Storage —— localStorage 统一收口，读写都吞异常
   （file:// 下或隐私模式下 localStorage 可能直接抛错，不能让它打断游戏）
   ============================================================================ */
const Storage = {
  KEY_BEST: 'boardShooterBest',
  KEY_MUTE: 'boardShooterMute',
  KEY_HISTORY: 'boardShooterHistory',
  KEY_COINS: 'boardShooterCoins',
  KEY_LOADOUT: 'boardShooterLoadout',
  HISTORY_MAX: 5,

  _get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  _set(key, v) { try { localStorage.setItem(key, v); } catch (e) {} },

  readBest() { return Number(this._get(this.KEY_BEST)) || 0; },
  writeBest(v) { this._set(this.KEY_BEST, String(v)); },

  readMute() { return this._get(this.KEY_MUTE) === '1'; },
  writeMute(v) { this._set(this.KEY_MUTE, v ? '1' : '0'); },

  readHistory() {
    try { return JSON.parse(this._get(this.KEY_HISTORY) || '[]'); }
    catch (e) { return []; }
  },
  pushHistory(entry) {
    const list = this.readHistory();
    list.unshift(entry);
    while (list.length > this.HISTORY_MAX) list.pop();
    this._set(this.KEY_HISTORY, JSON.stringify(list));
  },

  readCoins() { return Math.max(0, Number(this._get(this.KEY_COINS)) || 0); },
  writeCoins(v) { this._set(this.KEY_COINS, String(Math.max(0, Math.floor(v)))); },

  /* 整备存档：角色 / 武器 / 两个技能槽 / 已解锁清单。
     存档结构以后还会变，所以读的时候逐字段兜底 —— 只要有一个字段不认识，
     就退回默认值，绝不能因为一份旧存档让整个商城打不开 */
  readLoadout() {
    const fresh = () => JSON.parse(JSON.stringify(DEFAULT_LOADOUT));
    const raw = this._get(this.KEY_LOADOUT);
    if (!raw) return fresh();

    let obj = null;
    try { obj = JSON.parse(raw); } catch (e) { obj = null; }
    if (!obj || typeof obj !== 'object') return fresh();

    const out = fresh();

    // 先还原"已拥有"，再校验"已装备"。顺序反了会读出"装备着但没买过"的死状态
    if (obj.owned && typeof obj.owned === 'object') {
      for (const cat in SHOP_CATEGORIES) {
        const list = obj.owned[cat];
        if (!Array.isArray(list)) continue;
        for (const id of list) {
          if (SHOP_CATEGORIES[cat].table[id] && out.owned[cat].indexOf(id) < 0) {
            out.owned[cat].push(id);
          }
        }
      }
    }

    const owns = (cat, id) => out.owned[cat].indexOf(id) >= 0;
    if (CHARACTERS[obj.character] && owns('character', obj.character)) out.character = obj.character;
    if (WEAPONS[obj.weapon] && owns('weapon', obj.weapon)) out.weapon = obj.weapon;

    if (Array.isArray(obj.skills)) {
      for (let i = 0; i < SKILL_SLOTS; i++) {
        const k = obj.skills[i];
        // 专属技能不许进槽位：它跟着角色走，塞进槽里会变成双倍效果
        if (k && SKILLS[k] && !SKILLS[k].innate && owns('skill', k)) out.skills[i] = k;
      }
    }
    return out;
  },
  writeLoadout(obj) { this._set(this.KEY_LOADOUT, JSON.stringify(obj)); },
};

/* ============================================================================
   场地派生常量
   ============================================================================ */
const BOARD = (() => {
  const w = CONFIG.cols * CONFIG.cell;
  const h = CONFIG.rows * CONFIG.cell;
  return {
    w, h,
    x: (CONFIG.width - w) / 2,
    y: (CONFIG.height - h) / 2 + 16,
  };
})();

const DIRS = {
  up:    { x: 0,  y: -1, name: 'up' },
  down:  { x: 0,  y: 1,  name: 'down' },
  left:  { x: -1, y: 0,  name: 'left' },
  right: { x: 1,  y: 0,  name: 'right' },
};

/* ============================================================================
   坐标换算工具
   逻辑层一律用 (col, row)，渲染层才转像素，两边不混算
   ============================================================================ */
const Utils = {
  colCenter: c => BOARD.x + c * CONFIG.cell + CONFIG.cell / 2,
  rowCenter: r => BOARD.y + r * CONFIG.cell + CONFIG.cell / 2,

  nearestColCenter(x) {
    return this.colCenter(
      Phaser.Math.Clamp(Math.floor((x - BOARD.x) / CONFIG.cell), 0, CONFIG.cols - 1));
  },
  nearestRowCenter(y) {
    return this.rowCenter(
      Phaser.Math.Clamp(Math.floor((y - BOARD.y) / CONFIG.cell), 0, CONFIG.rows - 1));
  },

  insideBoard(x, y, margin = 0) {
    return x >= BOARD.x - margin && x <= BOARD.x + BOARD.w + margin &&
           y >= BOARD.y - margin && y <= BOARD.y + BOARD.h + margin;
  },

  lerp: (a, b, t) => a + (b - a) * t,

  weightedPick(rolls) {
    let total = 0;
    for (const r of rolls) total += r.w;
    let roll = Math.random() * total;
    for (const r of rolls) {
      roll -= r.w;
      if (roll <= 0) return r.key;
    }
    return rolls[rolls.length - 1].key;
  },

  vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  },
};

/* ============================================================================
   音效 —— 全部用 WebAudio 现场合成，不依赖任何音频文件
   ============================================================================ */
const SoundSys = (() => {
  let ctx = null, master = null, muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  function installUnlockOnFirstGesture() {
    const unlock = () => {
      SoundSys.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }
  function setMuted(m) { muted = m; }
  function isMuted() { return muted; }

  /* 0.5 秒的噪声源，按需建一次就复用。
     WebAudio 允许同一个 AudioBuffer 同时喂给多个 BufferSource，
     所以没必要每次发声都重新生成 —— 建一个 0.5s@48k 的 buffer 要跑两万多次循环，
     呼吸声和打雷都是低频触发，但也没必要白烧这个 CPU */
  function getNoise(c) {
    if (noiseBuffer) return noiseBuffer;
    const len = Math.floor(c.sampleRate * 0.5);
    noiseBuffer = c.createBuffer(1, len, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function blip(opt) {
    if (muted) return;
    const c = ensure();
    if (!c || c.state !== 'running') return;
    const t0 = c.currentTime + (opt.delay || 0);
    const dur = opt.dur || 0.12;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = opt.type || 'square';
    osc.frequency.setValueAtTime(opt.freq, t0);
    if (opt.sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opt.sweep), t0 + dur);
    const peak = opt.gain != null ? opt.gain : 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  return {
    unlock, setMuted, isMuted, installUnlockOnFirstGesture,

    uiClick() { blip({ freq: 660, type: 'square', dur: 0.05, gain: 0.15, sweep: 880 }); },
    shoot() { blip({ freq: 880, type: 'square', dur: 0.06, gain: 0.16, sweep: 660 }); },
    enemyShoot() { blip({ freq: 300, type: 'triangle', dur: 0.05, gain: 0.045, sweep: 240 }); },
    // step 传当前连击层数：越高音调越尖，连击的"涨潮感"靠它撑起来
    kill(step = 0) {
      const f = 560 * Math.pow(1 + CONFIG.comboPitchStep, Math.min(step, CONFIG.comboPitchMaxStep));
      blip({ freq: f, type: 'square', dur: 0.12, gain: 0.22, sweep: f * 0.21 });
    },
    // 擦弹：一声很轻的高频"嗖"。音量压到极低，因为它触发频繁，
    // 太响会盖过开火和击杀这两个主音
    graze() { blip({ freq: 2100, type: 'sine', dur: 0.07, gain: 0.05, sweep: 900 }); },
    heavyKill() { blip({ freq: 320, type: 'sawtooth', dur: 0.18, gain: 0.24, sweep: 80 }); },
    // 结界反弹：短促上扬的金属声。要能和"嗖"的擦弹声、闷响的受伤声区分开，
    // 否则玩家分不清这一下是躲过去了还是被弹回去了
    deflect() { blip({ freq: 1250, type: 'square', dur: 0.07, gain: 0.14, sweep: 1750 }); },
    hurt() { blip({ freq: 220, type: 'sawtooth', dur: 0.28, gain: 0.3, sweep: 55 }); },
    comboBreak() { blip({ freq: 240, type: 'triangle', dur: 0.14, gain: 0.12, sweep: 140 }); },
    pickup() {
      blip({ freq: 720, type: 'square', dur: 0.07, gain: 0.18, sweep: 1080 });
      blip({ freq: 1080, type: 'square', dur: 0.1, gain: 0.16, delay: 0.06 });
    },
    heartbeat() {
      blip({ freq: 68, type: 'sine', dur: 0.14, gain: 0.45, sweep: 42 });
      blip({ freq: 58, type: 'sine', dur: 0.18, gain: 0.32, sweep: 36, delay: 0.18 });
    },
    breathe() {
      if (muted) return;
      const c = ensure();
      if (!c || c.state !== 'running') return;
      const src = c.createBufferSource();
      src.buffer = getNoise(c);
      const filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 720;
      filt.Q.value = 1.4;
      const g = c.createGain();
      const t0 = c.currentTime;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.12);
      g.gain.linearRampToValueAtTime(0, t0 + 0.42);
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + 0.5);
    },
    /* 打雷：低频轰鸣 + 一条从亮到暗的噪声撕裂声。
       刻意不做得太响 —— 它每个雷天要响十几次，音量上去就变成噪音了 */
    thunder() {
      if (muted) return;
      const c = ensure();
      if (!c || c.state !== 'running') return;
      const t0 = c.currentTime;

      const osc = c.createOscillator();
      const og = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(96, t0);
      osc.frequency.exponentialRampToValueAtTime(26, t0 + 0.9);
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.32, t0 + 0.04);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
      osc.connect(og); og.connect(master);
      osc.start(t0); osc.stop(t0 + 1.25);

      const src = c.createBufferSource();
      src.buffer = getNoise(c);
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(2800, t0);
      filt.frequency.exponentialRampToValueAtTime(240, t0 + 0.7);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + 0.95);
    },
    start() {
      blip({ freq: 440, type: 'square', dur: 0.08, gain: 0.18 });
      blip({ freq: 660, type: 'square', dur: 0.08, gain: 0.18, delay: 0.09 });
      blip({ freq: 880, type: 'square', dur: 0.14, gain: 0.2, delay: 0.18 });
    },
    over() {
      blip({ freq: 440, type: 'sawtooth', dur: 0.18, gain: 0.28, sweep: 110 });
      blip({ freq: 220, type: 'sawtooth', dur: 0.32, gain: 0.26, sweep: 70, delay: 0.16 });
    },
    levelup() {
      blip({ freq: 660, type: 'triangle', dur: 0.1, gain: 0.18 });
      blip({ freq: 990, type: 'triangle', dur: 0.14, gain: 0.2, delay: 0.1 });
    },
  };
})();

