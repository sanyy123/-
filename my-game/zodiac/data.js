// ===== 常量键 =====
const ACHIEVE_KEY = 'snakeAchievementsV5';
const HIGH_KEY = 'snakeHighScoreV5';
const TOTAL_KEY = 'snakeTotalScoreV5';
const STATS_KEY = 'snakeStatsV1';
const COINS_KEY = 'snakeCoinsV1';
const INVENTORY_KEY = 'snakeInventoryV1';
const EQUIPPED_KEY = 'snakeEquippedV1';
const INVENTORY_P1_KEY = 'snakeInventoryP1V1';
const INVENTORY_P2_KEY = 'snakeInventoryP2V1';
const EQUIPPED_P1_KEY = 'snakeEquippedP1V1';
const EQUIPPED_P2_KEY = 'snakeEquippedP2V1';

// ===== 美术调色板（全局统一）=====
// 设计原则：深色基调 + 收敛的高饱和点缀。
// 之前页面里同时出现青/紫/粉/黄/红五种高亮色互相抢眼，视觉上「吵」。
// 现在把主色收敛为三个：青（primary）、紫（accent）、粉（danger/highlight），
// 黄与红只作为「吃到/危险」的功能色出现，不再用于装饰。
const PALETTE = {
  // 底色三层，由深到浅，用于背景/面板/悬浮
  bgDeep:    '#080b12',   // 页面最深底
  bgBase:    '#0d1117',   // 棋盘底
  bgPanel:   '#151b27',   // 卡片/面板
  bgRaised:  '#1e2635',   // 悬浮卡片
  // 主色
  primary:   '#00f5d4',   // 青 —— 主行动色（P1、按钮、可交互）
  accent:    '#9b5de5',   // 紫 —— 次要强调
  highlight: '#f15bb5',   // 粉 —— 高亮/P2/危险提示
  // 功能色（只在特定语义下使用）
  gold:      '#ffcc00',   // 金 —— 分数/奖励
  danger:    '#ff5757',   // 红 —— 危险/野猫
  // 文本层级
  textHi:    '#e8eef7',
  textMid:   '#94a3b8',
  textLo:    '#5b6b80',
  // 描边
  lineSoft:  'rgba(148,163,184,0.14)',
  lineMid:   'rgba(148,163,184,0.26)'
};

// ===== 种子局 =====
const SEED_HIGH_KEY_PREFIX = 'snakeSeedHigh_';
const SEED_LEVELS = [
  { id: 1,  emoji: '🌱', name: '新手道',   seed: 20260101, hasCat: false, hasObstacle: true,  desc: '轻松热身' },
  { id: 2,  emoji: '🪨', name: '落石谷',   seed: 20260102, hasCat: false, hasObstacle: true,  desc: '石头密集' },
  { id: 3,  emoji: '🌀', name: '传送阵',   seed: 20260103, hasCat: false, hasObstacle: true,  desc: '传送门频繁' },
  { id: 4,  emoji: '🌿', name: '迷宫小径', seed: 20260104, hasCat: false, hasObstacle: true,  desc: '综合难度' },
  { id: 5,  emoji: '⚡', name: '险象环生', seed: 20260105, hasCat: false, hasObstacle: true,  desc: '综合偏难' },
  { id: 6,  emoji: '🐱', name: '猫影初现', seed: 20260106, hasCat: true,  hasObstacle: true,  desc: '250 分出猫' },
  { id: 7,  emoji: '🐈', name: '双猫乱舞', seed: 20260107, hasCat: true,  hasObstacle: true,  desc: '猫 + 石头' },
  { id: 8,  emoji: '🐈‍⬛', name: '猫鼠追击', seed: 20260108, hasCat: true,  hasObstacle: true,  desc: '猫 + 传送门' },
  { id: 9,  emoji: '🕸️', name: '天罗地网', seed: 20260109, hasCat: true,  hasObstacle: true,  desc: '猫 + 石头 + 传送门' },
  { id: 10, emoji: '💀', name: '绝地求生', seed: 20260110, hasCat: true,  hasObstacle: true,  desc: '满配极限挑战' }
];

// ===== 皮肤 =====
// ★ 棋盘风格：刻意保留「亮暗两派」，不强行统一（用户明确要求每套皮肤各有各的样子）
//    亮派（暖）：鼠=米黄宣纸 / 虎=橙木 / 兔=樱粉 / 马=奶油
//    亮派（冷）：牛=奶绿 / 龙=青瓷 / 蛇=薄荷 / 羊=藕荷
//    暗派      ：经典青蛇=深夜霓虹
//    boardBg / gridColor 给「非暖色皮肤」的兜底棋盘用；暖色皮肤的棋盘在 game.js
//    的 drawWarmBoardDirect 里逐套绘制（含纹理与装饰）。
const SKINS = {
default: { id:'default', name:'经典青蛇', emoji:'🐍', unlockId:null, boardBg:'#0d1117', gridColor:'rgba(0,200,220,0.45)', boardStyle:'暗派 · 深夜霓虹', headColors:['#5efce8','#00f5d4','#00bbf9'], bodyHue:{r:0,g:235,b:220}, foodColors:['#ff9a9a','#ff6b6b','#e03131'] },
shu: { id:'shu', name:'鼠来宝', emoji:'🐭', unlockId:'skin_shu', boardBg:'#f7ecd8', gridColor:'rgba(168,124,72,0.30)', boardStyle:'暖派 · 米黄宣纸', skill:{ name:'鼠符咒 · 聚财', type:'passive', desc:'结算铜钱 +15%' } },
niu: { id:'niu', name:'牛气冲天', emoji:'🐮', unlockId:'skin_niu', boardBg:'#f4f8ec', gridColor:'rgba(122,166,88,0.30)', boardStyle:'冷派 · 奶绿草原', skill:{ name:'牛符咒 · 铁壁', type:'passive', desc:'每局 3 次撞碎石头不死' } },
hu: { id:'hu', name:'虎虎生威', emoji:'🐯', unlockId:'skin_hu', boardBg:'#fff1e0', gridColor:'rgba(214,138,74,0.32)', boardStyle:'暖派 · 橙木秋林', skill:{ name:'虎符咒 · 分身', type:'active', desc:'按 E 生成幻影蛇 5 秒，猫优先追幻影，每局 2 次' } },
tu: { id:'tu', name:'玉兔东升', emoji:'🐰', unlockId:'skin_tu', boardBg:'#fff2f5', gridColor:'rgba(224,124,156,0.30)', boardStyle:'暖派 · 樱粉月夜', skill:{ name:'兔符咒 · 疾风', type:'passive', desc:'初始速度 +10%，加速药水 8 秒，连击窗口 +0.5 秒' } },
long: { id:'long', name:'龙腾四海', emoji:'🐲', unlockId:'skin_long', boardBg:'#eef8f6', gridColor:'rgba(70,168,152,0.30)', boardStyle:'冷派 · 青瓷寒潭', skill:{ name:'龙符咒 · 炎爆', type:'active', desc:'按 E 喷火 5 格，清石头、击中猫停 1 次，两次全中猫死，每局 2 次（CD 5 秒）' } },
she: { id:'she', name:'灵蛇出洞', emoji:'🐍', unlockId:'skin_she', boardBg:'#f1f8ea', gridColor:'rgba(118,166,80,0.30)', boardStyle:'冷派 · 薄荷幽谷', skill:{ name:'蛇符咒 · 隐踪', type:'active', desc:'按 E 幽灵模式 3 秒，穿石头/自己/对方，每局 3 次' } },
ma: { id:'ma', name:'一马当先', emoji:'🐴', unlockId:'skin_ma', boardBg:'#fdf4e6', gridColor:'rgba(186,138,88,0.30)', boardStyle:'暖派 · 奶油原野', skill:{ name:'马符咒 · 回春', type:'passive', desc:'死亡后原地复活一次，不扣分，带 1.5 秒无敌虚化' } },
yang: { id:'yang', name:'三羊开泰', emoji:'🐑', unlockId:'skin_yang', boardBg:'#f6f1fb', gridColor:'rgba(148,116,196,0.30)', boardStyle:'冷派 · 藕荷云海', skill:{ name:'羊符咒 · 魂游', type:'active', desc:'有猫时眩晕猫 3 次移动，无猫时自身无敌 3 秒，每局 3 次' } },
hou: { id:'hou', name:'灵猴献瑞', emoji:'🐵', unlockId:'skin_hou', boardBg:'#fff4e6', gridColor:'rgba(214,146,74,0.32)', boardStyle:'暖派 · 蜜桃山林', headColors:['#ffb88c','#ff9a5c','#e07636'], bodyHue:{r:255,g:154,b:92}, foodColors:['#ffc8a0','#ff9a5c','#d26828'], skill:{ name:'猴符咒 · 筋斗云', type:'active', desc:'按 E 闪避一次死亡，向后瞬移 3 格，每局 1 次' } },
ji:  { id:'ji',  name:'金鸡独立', emoji:'🐔', unlockId:'skin_ji', boardBg:'#fff8e0', gridColor:'rgba(230,180,60,0.32)', boardStyle:'暖派 · 金穗稻田', headColors:['#ffe680','#ffcc33','#e0a800'], bodyHue:{r:255,g:204,b:51}, foodColors:['#ffeaa0','#ffd54a','#c99c00'], skill:{ name:'鸡符咒 · 破晓', type:'active', desc:'按 E 全屏照亮，石头短暂显形穿透，持续 5 秒，每局 2 次' } },
gou: { id:'gou', name:'忠犬护主', emoji:'🐶', unlockId:'skin_gou', boardBg:'#f0e8dc', gridColor:'rgba(160,120,80,0.32)', boardStyle:'暖派 · 大地苍原', headColors:['#e8c9a0','#d4a870','#a87a48'], bodyHue:{r:212,g:168,b:112}, foodColors:['#f5d5a8','#d4a870','#a07640'], skill:{ name:'狗符咒 · 守护', type:'passive', desc:'开局自带 1 个护盾，每局首次撞墙不扣命' } },
zhu: { id:'zhu', name:'猪事顺利', emoji:'🐷', unlockId:'skin_zhu', boardBg:'#fdeef0', gridColor:'rgba(220,130,150,0.30)', boardStyle:'暖派 · 樱粉桃源', headColors:['#ffc8d4','#ff9eb0','#e07a90'], bodyHue:{r:255,g:158,b:176}, foodColors:['#ffd0dc','#ff9eb0','#c97090'], skill:{ name:'猪符咒 · 福气', type:'passive', desc:'所有食物分数 +20%，但移动速度 -5%' } },
// ★ 咕嘎（2026-09-14 新增）：用户自己画的皮肤，素材单独打进了图集（见 atlas.js 末尾 6 帧）。
//   它不属于十二生肖体系，所以**故意不给 unlockId**：
//     ① 默认就可用，不用刷成就；② 不参与「十二生肖之主」称号的判定（那里按 unlockId 过滤），
//     ③ 不进客栈（客栈住客固定 12 位，INN_CHARACTERS 里没有 guga，好感度逻辑会自动跳过）。
//   headColors / bodyHue / foodColors 只在图集加载失败、走矢量兜底时才会用到。
guga: { id:'guga', name:'咕嘎', emoji:'🐧', unlockId:null, boardBg:'#fff6ea', gridColor:'rgba(240,150,60,0.30)', boardStyle:'暖派 · 橘子暖阳', headColors:['#ffd9a8','#ffab5e','#e07a2e'], bodyHue:{r:255,g:171,b:94}, foodColors:['#ffc46b','#ff9a2e','#c96a10'] }
};

// ===== 双人模式 P2 的颜色 =====
const P2_HEAD_COLORS = ['#ff9ec7', '#f15bb5', '#9b5de5'];
const P2_BODY_HUE = { r: 241, g: 91, b: 181 };
const P2_FOOD_COLORS = ['#ffb6d9', '#f15bb5', '#9b5de5'];

// ===== 商城道具 =====
const SHOP_ITEMS = [
  { id:'fu',      name:'护身符',  emoji:'🛡️', price:15, desc:'开局自带一个护盾，可免疫一次死亡' },
  { id:'zhaocai', name:'招财符',  emoji:'💰', price:10, desc:'开局直接 +30 分，相当于白吃 3 个食物' },
  { id:'jifeng',  name:'疾风符',  emoji:'⚡', price:12, desc:'开局获得 5 秒加速效果，期间分数翻倍' },
  { id:'luopan',  name:'寻宝罗盘', emoji:'🔮', price:20, desc:'本局特殊食物刷新率翻倍，更容易出金元宝' },
  { id:'xuming',  name:'续命丹',  emoji:'💖', price:50, desc:'本局死亡时原地复活一次，保留一半分数' }
];

// ===== 素材 =====
// 所有美术资源统一走本地图集：assets/atlas.png + assets/atlas.js
// （原 image.arityflow.top 图床链接已移除，备份见 素材备份/原始图床链接.json）
const ATLAS_IMAGE_URL = './assets/atlas.png';

// ===== AI 配置（智谱 GLM，通过 Cloudflare Worker 代理）=====
// 换 key 只改这里，ui.js 和 inn.js 都从这里读
const AI_API_KEY  = '691e8784c6954ae9be22fe6a49bba291.FNecmlca4jQOQoH6';
const AI_BASE_URL = 'https://zhipu.wange5232.workers.dev/v4';
const AI_MODEL    = 'glm-4-Flash';

// ===== BGM =====
// ★ 已全部本地化到 bgm/ 目录（原来是 soundimage.org 上的 4 个外链）。
//   原因：那 4 首合计 6.1MB，放在国外服务器上，国内手机每次跳转页面都要重新拉一遍，
//   是"页面加载很久"的头号元凶。现在改为随站点一起分发：
//   · 从同一个域名（帽子云）加载，不再跨境；
//   · 重新编码为 64kbps 单声道，合计约 1.8MB，体积下降 71%（复古电子乐听感几乎无损）；
//   · 配合 ui.js 的按需加载，首屏只预取菜单这一首，游戏中的曲目等真正切到时才下载。
//   音乐版权：Eric Matyas（soundimage.org），CC BY 4.0，页脚已保留署名。
const BGM = { menu:'bgm/menu.mp3', stage0:'bgm/stage0.mp3', stage1:'bgm/stage1.mp3', stage2:'bgm/stage2.mp3' };

// ===== 成就 =====
const ACHIEVEMENTS = [
{ id:'skin_shu', name:'鼠来宝', desc:'积分达到 30 · 解锁【鼠】皮肤', icon:'🐭', check:()=>score>=30, progress:()=>Math.min(score/30,1) },
{ id:'skin_niu', name:'牛气冲天', desc:'积分达到 70 · 解锁【牛】皮肤', icon:'🐮', check:()=>score>=70, progress:()=>Math.min(score/70,1) },
{ id:'skin_hu', name:'虎虎生威', desc:'积分达到 130 · 解锁【虎】皮肤', icon:'🐯', check:()=>score>=130, progress:()=>Math.min(score/130,1) },
{ id:'skin_tu', name:'玉兔东升', desc:'积分达到 200 · 解锁【兔】皮肤', icon:'🐰', check:()=>score>=200, progress:()=>Math.min(score/200,1) },
{ id:'skin_long', name:'龙腾四海', desc:'积分达到 300 · 解锁【龙】皮肤', icon:'🐲', check:()=>score>=300, progress:()=>Math.min(score/300,1) },
{ id:'skin_she', name:'灵蛇出洞', desc:'体长达到 12 · 解锁【蛇】皮肤', icon:'🐍', check:()=>maxLengthReached>=12, progress:()=>Math.min(maxLengthReached/12,1) },
{ id:'skin_ma', name:'一马当先', desc:'积分达到 450 · 解锁【马】皮肤', icon:'🐴', check:()=>score>=450, progress:()=>Math.min(score/450,1) },
{ id:'skin_yang', name:'三羊开泰', desc:'积分达到 600 · 解锁【羊】皮肤', icon:'🐑', check:()=>score>=600, progress:()=>Math.min(score/600,1) },
{ id:'skin_hou', name:'灵猴献瑞', desc:'单局吃掉 20 个食物 · 解锁【猴】皮肤', icon:'🐵', check:()=>foodsEaten>=20, progress:()=>Math.min(foodsEaten/20,1) },
{ id:'skin_ji', name:'金鸡独立', desc:'体长达到 18 · 解锁【鸡】皮肤', icon:'🐔', check:()=>maxLengthReached>=18, progress:()=>Math.min(maxLengthReached/18,1) },
{ id:'skin_gou', name:'忠犬护主', desc:'积分达到 900 · 解锁【狗】皮肤', icon:'🐶', check:()=>score>=900, progress:()=>Math.min(score/900,1) },
{ id:'skin_zhu', name:'猪事顺利', desc:'积分达到 1300 · 解锁【猪】皮肤', icon:'🐷', check:()=>score>=1300, progress:()=>Math.min(score/1300,1) },
{ id:'fun_corner', name:'角落精灵', desc:'在地图四个角落各吃到一次食物', icon:'✨', check:()=>cornerEaten.size>=4, progress:()=>Math.min(cornerEaten.size/4,1) },
{ id:'fun_long', name:'细水长流', desc:'单局存活超过 90 秒', icon:'⏳', check:()=>survivalTime>=90, progress:()=>Math.min(survivalTime/90,1) },
{ id:'fun_fast', name:'疾如闪电', desc:'在速度达到最快时仍吃到 5 个食物', icon:'⚡', check:()=>fastEats>=5, progress:()=>Math.min(fastEats/5,1) },
{ id:'fun_total', name:'积少成多', desc:'累计历史总分达到 3000', icon:'💰', check:()=>totalScoreAccum>=3000, progress:()=>Math.min(totalScoreAccum/3000,1) },
{ id:'combo_5', name:'连击新星', desc:'单局最高连击达到 5', icon:'🔥', check:()=>maxComboReached>=5, progress:()=>Math.min(maxComboReached/5,1) },
{ id:'combo_10', name:'连击大师', desc:'单局最高连击达到 10', icon:'💥', check:()=>maxComboReached>=10, progress:()=>Math.min(maxComboReached/10,1) },
{ id:'combo_20', name:'连击之神', desc:'单局最高连击达到 20', icon:'⚡', check:()=>maxComboReached>=20, progress:()=>Math.min(maxComboReached/20,1) }
];

// ===== 指南数据 =====
const GUIDE_DATA = [
{ id: 'basic', icon: '🎮', title: '基础操作', content: '<h4>🎮 基础操作</h4><p>使用键盘或屏幕虚拟按键控制蛇的方向。</p><ul><li>电脑端：<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 或 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></li><li>手机端：点击屏幕下方方向键</li><li>暂停/继续：按 <kbd>空格</kbd> 或点击暂停按钮</li><li>皮肤技能：<kbd>E</kbd> 键（双人 P2 为 <kbd>P</kbd> 键，手机端点右下角技能按钮）</li></ul><p>蛇不能掉头，也不能撞墙或咬到自己。</p>' },
{ id: 'mode', icon: '🧭', title: '游戏模式', content: '<h4>🧭 五种游戏模式</h4><p>开始界面底部可以切换模式：</p><div class="card"><div class="title">👤 单人模式</div><div class="desc">经典贪吃蛇玩法，一个人闯江湖，解锁成就、皮肤、称号、铜钱。</div></div><div class="card"><div class="title">👥 双人模式</div><div class="desc">P1 用 WASD，P2 用方向键，先到 300 分或对方先死获胜。<span class="hl">手机端暂不支持</span>。</div></div><div class="card"><div class="title">💞 合作模式</div><div class="desc">P1/P2 各控一条蛇，两人<span class="hl2">共享 3 条命</span>。任意一条蛇死亡扣 1 命，扣到 0 才真正结束。死亡后蛇回出生点，等玩家按方向键才重新出发，复活后 3 秒无敌。</div></div><div class="card"><div class="title">🌱 江湖挑战（种子局）</div><div class="desc">10 张固定地图，公平竞争刷分，每张图有全球排行榜。不消耗道具、不解锁成就，<span class="hl2">但解锁专属称号</span>。</div></div><div class="card"><div class="title">🗺️ 迷宫闯关</div><div class="desc">全新玩法！在迷宫里躲避石墙、吃食物、找出口。共 8 关，逐关解锁。</div></div>' },
{ id: 'double', icon: '👥', title: '双人模式', content: '<h4>👥 双人模式规则</h4><p>在开始界面底部点击<span class="hl">👥 双人模式</span>即可开战。</p><h4>🎮 控制方式</h4><ul><li><span class="hl2">P1</span>：<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>，技能 <kbd>E</kbd></li><li><span class="hl">P2</span>：<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>，技能 <kbd>P</kbd></li><li>暂停：<kbd>空格</kbd></li></ul><h4>📖 术语说明</h4><div class="terms"><strong>头部</strong>：蛇最前面的一节，决定蛇的方向。</div><div class="terms"><strong>身体</strong>：除头部和尾部之外的所有节。</div><div class="terms"><strong>尾部</strong>：蛇的最后一节，是蛇身最短最末的位置。</div><h4>💥 碰撞规则</h4><ul><li>撞墙 → 死亡</li><li>撞到自己身体 → 死亡</li><li>撞到对方身体 → <span class="hl">撞的人死亡</span>（谁主动撞谁死）</li><li>两个头对撞 → 双方同时死亡（平局）</li><li>撞到石头 → 死亡（护盾可抵挡一次）</li></ul><h4>🏆 获胜条件</h4><ul><li>对方先死亡 → 你获胜</li><li>或者自己率先到达 <span class="hl3">300 分</span> → 你获胜</li><li>两个条件先满足哪个算哪个</li></ul><h4>⚠️ 双人模式特殊规则</h4><ul><li>双人模式下<span class="hl">猫鼠大战强制关闭</span></li><li>食物共用，谁先吃到算谁的</li><li>特殊物品共用</li><li>石头和传送门共用（如果开启了障碍）</li><li>护盾只属于吃到的那个玩家</li><li><span class="hl2">双人模式支持商城道具</span>，但 P1、P2 的背包互相独立，铜钱共用</li><li><span class="hl">手机端暂不支持双人模式</span></li></ul><h4>🏅 双人专属称号</h4><p>双人模式可以解锁：<span class="hl2">初试身手</span>、<span class="hl2">双人首胜</span>、<span class="hl2">同室操戈</span>（撞死对方 20 次）、<span class="hl2">德比之王</span>（获胜 10 次）、<span class="hl2">双人封顶</span>（300 分获胜）、<span class="hl2">宿命对决</span>（获胜 50 次）。</p>' },
{ id: 'coop', icon: '💞', title: '合作模式', content: '<h4>💞 合作模式规则</h4><p>在开始界面底部点击<span class="hl">💞 合作</span>，两人各控一条蛇，一起闯江湖。</p><h4>🎮 控制方式</h4><ul><li><span class="hl2">P1</span>：<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>，技能 <kbd>E</kbd></li><li><span class="hl">P2</span>：<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>，技能 <kbd>P</kbd></li></ul><h4>❤️ 共享生命</h4><p>两人共用 <span class="hl3">3 条命</span>。任意一条蛇死亡扣 1 命，扣到 0 才真正结束。屏幕上方会显示共享生命条。</p><h4>🔄 复活机制</h4><ul><li>死亡后蛇回到出生点，进入<span class="hl2">复活等待</span>状态，停在原地不动</li><li>玩家按方向键才重新出发，避免刚复活就撞墙</li><li>复活后 <span class="hl3">3 秒无敌</span>，如果队友在出生点附近，无敌时间额外延长 0.5 秒</li><li>死亡时如果被野猫咬死，野猫会被清除，避免复活瞬间再被秒杀</li></ul><h4>🏆 结束条件</h4><ul><li>共享生命耗尽 → 失败结算</li><li>任意一人达到 <span class="hl3">300 分</span> → 合作达成，通关</li></ul><h4>🏅 合作专属称号</h4><p>合作模式可以解锁：<span class="hl2">并肩作战</span>、<span class="hl2">合作首通</span>、<span class="hl2">双剑合璧</span>（双人合计 600 分）、<span class="hl2">生死与共</span>（通关 10 次）、<span class="hl2">完美配合</span>（零阵亡通关）、<span class="hl2">同生共死</span>（通关 50 次）。</p>' },
{ id: 'seed', icon: '🌱', title: '江湖挑战', content: '<h4>🌱 江湖挑战（种子局）</h4><p>点击模式选择里的 <span class="hl2">🌱 挑战</span>，进入 10 张固定地图的挑战模式。</p><div class="card"><div class="title">🎯 固定随机序列</div><div class="desc">每张图用固定种子生成食物、石头、传送门、猫的位置。<span class="hl">每局都一样，公平竞争</span>。</div></div><div class="card"><div class="title">🏆 独立最高分</div><div class="desc">每张图独立记录你的最高分，互不影响。<span class="hl">种子局不计入普通统计、不消耗道具、不解锁普通成就，但解锁种子专属称号。</span></div></div><div class="card"><div class="title">📋 10 张地图</div><div class="desc">1-5 无猫，6-10 有猫。障碍全开。挑战自己的极限，把每张图的分数刷到最高！</div></div><div class="card"><div class="title">🏆 全球排行榜</div><div class="desc">每张地图都有<span class="hl2">独立的全球排行榜</span>，每张卡片右边的 🏆 按钮可以打开该地图排行榜。结算时输入你的江湖名号，成绩就会上传！</div></div><div class="card"><div class="title">🏅 种子专属称号</div><div class="desc">种子局可以解锁：<span class="hl2">寻道者</span>、<span class="hl2">破图者</span>（单图 300 分）、<span class="hl2">五图通</span>（通关 5 图）、<span class="hl2">种子猎手</span>（单图 500 分）、<span class="hl2">图王</span>（通关全部 10 图）。</div></div>' },
{ id: 'leaderboard', icon: '🏆', title: '全球排行榜', content: '<h4>🏆 全球排行榜</h4><p>种子局的每张地图都有自己的<span class="hl2">全球排行榜</span>，和其他玩家比拼分数。</p><div class="card"><div class="title">📤 如何上榜</div><div class="desc">玩完种子局，结算时会弹出输入框，输入你的<span class="hl">江湖名号</span>（最多 15 字），成绩就会自动上传。名字会记住，下次直接用。</div></div><div class="card"><div class="title">👀 如何查看</div><div class="desc">打开「🌱 挑战」界面，每张地图卡片右边的 <span class="hl3">🏆 按钮</span>，点一下就能看到这张图的全球排行榜。</div></div><div class="card"><div class="title">🥇 榜上显示</div><div class="desc">前 3 名有奖牌图标，之后的显示名次。你自己的名字会<span class="hl2">高亮显示</span>，一眼找到。</div></div><div class="card"><div class="title">🏅 称号同步显示</div><div class="desc">排行榜上会在你的名字<span class="hl2">上方</span>显示当前佩戴的称号，称号徽章会按难度显示不同的特效，让榜单一目了然。</div></div><div class="card"><div class="title">🔒 数据安全</div><div class="desc">排行榜按玩家去重，同一个名字只显示你最高的那次成绩。分数异常（超过 1000）会被拒绝上传。</div></div>' },
{ id: 'maze', icon: '🗺️', title: '迷宫闯关', content: '<h4>🗺️ 迷宫闯关</h4><p>点击模式选择里的 <span class="hl2">🗺️ 迷宫</span>，进入全新的迷宫玩法。</p><div class="card"><div class="title">🎯 玩法规则</div><div class="desc">在迷宫里控制蛇移动，躲避 <span class="hl">石头墙</span>，吃掉 <span class="hl3">食物</span>，找到 <span class="hl2">发光出口</span> 即通关。</div></div><div class="card"><div class="title">❤️ 血量系统</div><div class="desc">初始 <span class="hl">5 点血</span>。撞墙扣 1 血，血量归零就失败。撞墙后会短暂无敌，此时可以选择新方向（可以掉头）。</div></div><div class="card"><div class="title">🍎 食物分数</div><div class="desc">普通食物 <span class="hl2">+10</span>　·　金币 <span class="hl3">+30</span>　·　宝石 <span class="hl3">+50</span>　·　钻石 <span class="hl2">+80</span>。血量每剩 1 点，通关时额外 <span class="hl3">+20 分</span>。</div></div><div class="card"><div class="title">📋 8 个关卡</div><div class="desc">共 8 关，难度从简单到极难递增。通关后解锁下一关，每关独立记录最高分。</div></div><div class="card"><div class="title">🏆 得分技巧</div><div class="desc">尽量<span class="hl2">不撞墙</span>保留血量，同时<span class="hl3">吃光高分食物</span>（钻石、宝石），再通关，这样分数最高。</div></div>' },
{ id: 'food', icon: '🍎', title: '食物与积分', content: '<h4>🍎 普通食物</h4><p>吃掉普通食物 <span class="hl2">+10 积分</span>，身体变长一节，移动速度随分数增加而加快。</p><h4>⭐ 特殊食物（独立刷新）</h4><p>普通食物和特殊食物是<span class="hl">独立存在</span>的，可以同时出现在棋盘上。特殊食物基础存在时间约 <span class="hl3">8 秒</span>，但<span class="hl">分数越高，存在时间越短</span>（1000 分时约 5 秒），需抓紧时间吃。</p><div class="card"><div class="title">💰 金元宝</div><div class="desc">吃掉后直接获得 <span class="hl3">20 积分</span>（双倍）。</div></div><div class="card"><div class="title">⚡ 加速药水</div><div class="desc">吃到后蛇会短暂加速，持续 <span class="hl3">5 秒</span>（兔皮肤 8 秒），期间分数翻倍。</div></div><div class="card"><div class="title">🛡️ 护盾铃铛</div><div class="desc">获得一次免死金牌，撞墙或撞自己可以免疫一次死亡。</div></div><div class="card"><div class="title">🧪 缩小药水</div><div class="desc">蛇身长度减少一半，但分数不变，适合新手救场。</div></div>' },
{ id: 'combo', icon: '🔥', title: '连击系统', content: '<h4>🔥 连击系统</h4><p>连续吃到食物可以累积<span class="hl2">连击数</span>，连击越高，每次得分越多，音调也越高。</p><div class="card"><div class="title">⏱️ 连击窗口</div><div class="desc">每吃到一个食物，连击窗口重置为 <span class="hl3">5 秒</span>游戏时间（兔皮肤 5.5 秒）。窗口内没吃到下一个食物，连击归零。</div></div><div class="card"><div class="title">💯 倍率阶梯</div><div class="desc">5 连 = <span class="hl2">×1.5</span>　·　10 连 = <span class="hl2">×2</span>　·　18 连 = <span class="hl3">×3</span>　·　28 连 = <span class="hl">×4</span>　·　40 连 = <span class="hl">×5</span></div></div><div class="card"><div class="title">🎨 视觉反馈</div><div class="desc">蛇头旁会显示「×连击数」，下方有倒计时条。连击越高颜色越炫：灰 → 青 → 蓝 → 紫 → 粉 → 金。</div></div><div class="card"><div class="title">🎵 音效反馈</div><div class="desc">连击越高，吃食物的音调越高，最高提升 50%。双人模式下 P1、P2 独立计算连击。</div></div>' },
{ id: 'shop', icon: '🏪', title: '商城与道具', content: '<h4>🏪 江湖商城</h4><p>吃掉食物得分，结算时可以换取 <span class="hl3">铜钱</span>。铜钱可以在商城里购买各种道具，帮助你在下一局闯荡江湖。</p><h4>🪙 铜钱获取</h4><div class="card"><div class="title">💰 结算换算</div><div class="desc">每局结束时，按本局总分 <span class="hl">每 10 分 = 1 铜钱</span> 换算。双人模式按两人分数之和计算。</div></div><h4>🎁 道具一览</h4><div class="card"><div class="title">🛡️ 护身符 · 15 铜钱</div><div class="desc">开局自带一个护盾，可免疫一次死亡。</div></div><div class="card"><div class="title">💰 招财符 · 10 铜钱</div><div class="desc">开局直接 +30 分，相当于白吃 3 个食物。</div></div><div class="card"><div class="title">⚡ 疾风符 · 12 铜钱</div><div class="desc">开局获得 5 秒加速效果，期间分数翻倍。</div></div><div class="card"><div class="title">🔮 寻宝罗盘 · 20 铜钱</div><div class="desc">本局特殊食物刷新率翻倍，更容易出金元宝。</div></div><div class="card"><div class="title">💖 续命丹 · 50 铜钱</div><div class="desc">本局死亡时原地复活一次，保留一半分数。</div></div><h4>🎒 如何使用</h4><p>购买的道具会进入 <span class="hl2">背包</span>。在商城切到「我的背包」页，点击道具可以 <span class="hl">装备</span>，下一局开始时会自动使用并消耗。一局只能装备一个道具。</p><h4>👥 双人 / 合作模式下的商城</h4><p>双人和合作模式下打开商城，会显示 <span class="hl2">P1 的背包</span> 和 <span class="hl">P2 的背包</span> 两部分。<span class="hl3">铜钱是共用的</span>，但每个玩家只能装备和使用自己背包里的道具。</p>' },
{ id: 'cat', icon: '🐱', title: '猫鼠大战', content: '<h4>🐱 猫鼠大战（单人 / 合作模式）</h4><p>当单局分数达到 <span class="hl">250 分</span> 后，棋盘上会出现一只野猫。<span class="hl">双人模式下强制关闭。</span></p><div class="card"><div class="title">🐾 猫的追踪</div><div class="desc">猫会朝着蛇头的方向移动，每两步移动一次，速度比蛇稍慢。</div></div><div class="card"><div class="title">💀 猫碰蛇头</div><div class="desc">如果猫正面碰到蛇头，游戏<span class="hl">立即失败</span>！一定要小心走位。</div></div><div class="card"><div class="title">✂️ 猫咬尾巴</div><div class="desc">如果猫碰到蛇尾（从第 4 节开始算），尾巴会被咬断，失去被咬位置之后的所有身体。累计被咬 <span class="hl3">20 节</span> 后游戏失败。</div></div><div class="card"><div class="title">🏆 围死野猫</div><div class="desc">如果你用蛇身把猫围住，让它上下左右都无法移动到边界（没有缺口），猫就会被困死，你获得 <span class="hl3">+50 分</span> 奖励！</div></div><div class="card"><div class="title">🛡️ 护盾抵挡</div><div class="desc">如果身上有护盾，猫碰到蛇头时护盾会抵挡一次，猫会消失。</div></div>' },
{ id: 'obstacle', icon: '🚧', title: '障碍与传送门', content: '<h4>🚧 障碍与传送门</h4><p>当设置里 <span class="hl3">🚧 障碍</span> 按钮开启时，随着分数上升，地图上会随机出现石头和传送门。</p><div class="card"><div class="title">🪨 石头</div><div class="desc">单局分数达到 <span class="hl">150 分</span> 后开始出现。石头会<span class="hl">阻挡蛇和猫</span>的移动，食物和特殊物品也不会生成在石头上。撞到石头会死亡（护盾可以抵挡一次）。<br><span class="hl2">石头数量随分数动态增加</span>：300 分约 18 块，600 分约 30 块，1000 分上限 45 块。撞碎后会继续按概率补充，分数越高补充越快。</div></div><div class="card"><div class="title">🌀 传送门</div><div class="desc">单局分数达到 <span class="hl">200 分</span> 后开始出现。<span class="hl2">分数越高出现概率越高</span>（200 分约 30%，1000 分约 80%）。传送门<span class="hl">成对出现</span>，颜色相同。蛇头从<span class="hl">一个</span>传送门进入，会从<span class="hl">另一个</span>传送门出来。传送门存在时间约 15 秒，最多同时存在 <span class="hl3">3 对</span>。</div></div>' },
{ id: 'skin', icon: '🎨', title: '皮肤与成就', content: '<h4>🎨 皮肤系统</h4><p>通过达成特定成就，可以解锁十二生肖皮肤。点击顶部 <span class="hl3">🎨 皮肤</span> 按钮查看已解锁的皮肤。</p><ul><li>鼠：积分达到 30</li><li>牛：积分达到 70</li><li>虎：积分达到 130</li><li>兔：积分达到 200</li><li>龙：积分达到 300</li><li>蛇：体长达到 12</li><li>马：积分达到 450</li><li>羊：积分达到 600</li><li>猴：单局吃掉 20 个食物</li><li>鸡：体长达到 18</li><li>狗：积分达到 900</li><li>猪：积分达到 1300</li></ul><p><span class="hl2">🐧 咕嘎</span>：新增皮肤，<span class="hl3">无需解锁、默认可用</span>。棋盘上会随机撒落「咕」「嘎」两个装饰字，身体每一节从两张尾巴图里随机取一张。</p><h4>🏆 成就系统</h4><p>点击顶部「📜 成就」按钮查看所有成就及进度。解锁成就会有弹窗提示。</p><h4>✨ 皮肤技能</h4><p>每个十二生肖皮肤都有自己的专属技能，详情见「皮肤技能」页。</p>' },
{ id: 'skill', icon: '✨', title: '皮肤技能', content: '<h4>✨ 皮肤技能系统</h4><p>每个十二生肖皮肤都有自己<span class="hl2">独特的技能</span>，主动或被动。装备该皮肤后自动生效。</p><h4>🐭 鼠符咒 · 聚财（被动）</h4><div class="card"><div class="title">🐭 聚财</div><div class="desc">结算铜钱 <span class="hl3">+20%</span>。一局 300 分原本拿 30 铜钱，装备鼠皮肤后拿 36 铜钱。觉醒后提升至 <span class="hl2">+30%</span>。<br><span class="hl">双人 / 合作模式</span>：只要 P1 或 P2 任意一人装备鼠皮肤，本局铜钱就 +20%（不叠加）。</div></div><h4>🐮 牛符咒 · 铁壁（被动）</h4><div class="card"><div class="title">🐮 铁壁</div><div class="desc">撞到石头时<span class="hl2">不会死</span>，反而把石头撞碎继续前进。每局 <span class="hl3">3 次</span>。觉醒后增至 <span class="hl2">5 次</span>，且撞碎石头额外 +5 分。</div></div><h4>🐯 虎符咒 · 分身（主动）</h4><div class="card"><div class="title">🐯 分身</div><div class="desc">按 <kbd>E</kbd> 键（双人 P2 <kbd>P</kbd> 键，手机端点右下角技能按钮）生成一个<span class="hl3">幻影蛇</span>，持续 5 秒。幻影存在期间，野猫会<span class="hl2">优先追幻影</span>，忽略真身。每局 <span class="hl3">2 次</span>。觉醒后幻影延长至 8 秒，且被猫击碎时给你 1.5 秒无敌。</div></div><h4>🐰 兔符咒 · 疾风（被动）</h4><div class="card"><div class="title">🐰 疾风</div><div class="desc">初始速度 <span class="hl2">+10%</span>；加速药水 5 秒延长到 <span class="hl3">8 秒</span>；连击窗口额外 <span class="hl3">+0.5 秒</span>（5 秒 → 5.5 秒）。觉醒后速度加成提升至 +20%，连击窗口额外 +1 秒。</div></div><h4>🐲 龙符咒 · 炎爆（主动）</h4><div class="card"><div class="title">🐲 炎爆</div><div class="desc">按 <kbd>E</kbd> 键向蛇头前方喷火 <span class="hl3">5 格</span>：<br>· 清除路径上的石头<br>· 击中野猫：猫停止 1 次移动<br>· 本局两次炎爆<span class="hl2">全部击中野猫</span> → 猫直接死亡 +100 分<br>每局 <span class="hl3">2 次</span>，冷却 <span class="hl3">5 秒</span>。觉醒后喷火延长至 7 格，冷却缩短至 3 秒。</div></div><h4>🐍 蛇符咒 · 隐踪（主动）</h4><div class="card"><div class="title">🐍 隐踪</div><div class="desc">按 <kbd>E</kbd> 键进入 <span class="hl3">3 秒幽灵模式</span>。幽灵模式中：<br>· 穿过石头不死<br>· 穿过自己身体不死<br>· 穿过对方身体不死<br>· <span class="hl">不能穿过墙壁</span><br>每局 <span class="hl3">3 次</span>。觉醒后延长至 5 秒，可穿透墙壁一次。</div></div><h4>🐴 马符咒 · 回春（被动）</h4><div class="card"><div class="title">🐴 回春</div><div class="desc">死亡后<span class="hl2">原地复活一次</span>，<span class="hl3">不扣分</span>，带 <span class="hl3">1.5 秒</span> 无敌虚化时间。每局限 1 次。与续命丹可叠加（续命丹优先消耗）。觉醒后复活额外获得 3 秒加速，分数只扣 25%。</div></div><h4>🐑 羊符咒 · 魂游（主动）</h4><div class="card"><div class="title">🐑 魂游</div><div class="desc">按 <kbd>E</kbd> 键：<br>· <span class="hl2">有猫时</span>：眩晕野猫，让猫停止之后 <span class="hl3">3 次移动</span><br>· <span class="hl2">无猫时</span>：自身无敌 <span class="hl3">3 秒</span><br>每局 <span class="hl3">3 次</span>。觉醒后效果时长延长。</div></div><h4>🐵 猴符咒 · 筋斗云（主动）</h4><div class="card"><div class="title">🐵 筋斗云</div><div class="desc">按 <kbd>E</kbd> 键闪避一次死亡，向后瞬移 <span class="hl3">3 格</span>，每局 <span class="hl3">1 次</span>。觉醒后距离增至 <span class="hl2">5 格</span>，冷却减半。</div></div><h4>🐔 鸡符咒 · 破晓（主动）</h4><div class="card"><div class="title">🐔 破晓</div><div class="desc">按 <kbd>E</kbd> 键全屏照亮，石头短暂显形穿透，持续 <span class="hl3">5 秒</span>，每局 <span class="hl3">2 次</span>。觉醒后时长增至 <span class="hl2">8 秒</span>，冷却减半。</div></div><h4>🐶 狗符咒 · 守护（被动）</h4><div class="card"><div class="title">🐶 守护</div><div class="desc">开局自带 1 个护盾，每局首次撞墙不扣命。觉醒后护盾增至 <span class="hl2">2 个</span>，撞墙免死次数增至 <span class="hl2">2 次</span>。</div></div><h4>🐷 猪符咒 · 福气（被动）</h4><div class="card"><div class="title">🐷 福气</div><div class="desc">所有食物分数 <span class="hl3">+20%</span>，但移动速度 <span class="hl">-5%</span>。觉醒后食物加成提升至 <span class="hl2">+35%</span>，速度惩罚降至 <span class="hl2">-2%</span>。</div></div>' },
{ id: 'title', icon: '🏅', title: '江湖称号', content: '<h4>🏅 江湖称号系统</h4><p>点击顶部 <span class="hl3">🏅 称号</span> 按钮，打开称号面板。称号根据你的生涯数据自动解锁，解锁后可以<span class="hl2">随意佩戴或取消</span>，佩戴中的称号会显示在<span class="hl">排行榜和结算界面</span>上。</p><h4>🎖️ 难度分级</h4><p>称号按难度分为 6 档，难度越高，称号特效越华丽：</p><div class="card"><div class="title">🥉 初出茅庐（青铜）</div><div class="desc">朴素灰字。例如：初入江湖、新手上路、小吃货、小蛇一条、初窥门径。</div></div><div class="card"><div class="title">🥈 小有名气（白银）</div><div class="desc">淡青发光。例如：铁头功（撞墙 100 次）、连击狂魔（单局 20 连）、小试牛刀（300 分）、大胃王（累计 500 食物）、老玩家（20 局）、稳如老狗（单局 180 秒）、双人首胜、同室操戈、合作首通、破图者。</div></div><div class="card"><div class="title">🥇 名震一方（黄金）</div><div class="desc">金色强光 + 微闪。例如：猫粮（被猫咬断 50 次）、猫见愁（围死猫 10 次）、一方高手（600 分）、连击之神（40 连）、百战老江湖（100 局）、富甲一方（累计 10000 分）、德比之王、双人封顶、双剑合璧、生死与共、五图通。</div></div><div class="card"><div class="title">💎 威震武林（钻石）</div><div class="desc">粉紫渐变 + 呼吸闪烁。例如：独孤求败（1000 分）、猫王克星（围死猫 50 次）、长寿仙（300 秒）、连击天尊（60 连）、完美配合（合作零阵亡）、同生共死（合作 50 次通关）、宿命对决（双人 50 胜）、种子猎手（单图 500 分）。</div></div><div class="card"><div class="title">👑 武林至尊（王者）</div><div class="desc">彩虹流动 + 光晕。例如：武林至尊（2000 分）、十二生肖之主（解锁全部皮肤）、圆满飞升（解锁全部成就）、图王（通关全部 10 张种子图）。</div></div><div class="card"><div class="title">🏮 客栈挚友（客栈）</div><div class="desc">暖金色调。12 位生肖的专属徽章：鼠来宝·挚友、牛气冲天·挚友、虎虎生威·挚友、玉兔东升·挚友、龙腾四海·挚友、灵蛇出洞·挚友、一马当先·挚友、三羊开泰·挚友、灵猴献瑞·挚友、金鸡独立·挚友、忠犬护主·挚友、猪事顺利·挚友。</div></div><h4>🎮 如何佩戴</h4><p>在称号面板中，点击任意<span class="hl2">已解锁</span>的称号即可佩戴；再点一次可取消佩戴。佩戴状态会保存，刷新后仍然生效。</p><h4>🌟 客栈徽章与觉醒</h4><p>在「🏮 江湖客栈」里把某位生肖的好感度刷到 <span class="hl3">300</span>，即可获得他的<span class="hl2">客栈徽章</span>（会进入称号面板，可佩戴、会显示在排行榜和结算界面），同时解锁该生肖的<span class="hl2">皮肤觉醒</span>，技能获得强化。</p><p>目前客栈有 <span class="hl3">12 位</span>生肖住客，对应的客栈徽章也是 12 个。称号面板里点「客栈」筛选可以快速查看。</p><h4>🏆 排行榜展示</h4><p>种子局排行榜会在你的名字<span class="hl3">上方</span>显示当前佩戴的称号，称号徽章按难度显示不同特效。</p>' },
{ id: 'inn', icon: '🏮', title: '江湖客栈', content: '<h4>🏮 江湖客栈</h4><p>主界面<span class="hl3">右下角</span>有一扇木门，点击「走进客栈」，推门进入生肖们的客栈。</p><div class="card"><div class="title">🎯 好感度怎么涨</div><div class="desc">用某位生肖的皮肤<span class="hl2">玩一局单人</span>即涨好感度：基础 +10，单局吃 ≥20 个食物 +5，存活 ≥120 秒 +5，破纪录 +20。上限 <span class="hl3">300</span>。好感度会累计到下一次进客栈时统一增长（有进度条动画）。</div></div><div class="card"><div class="title">🎖️ 三档解锁</div><div class="desc"><span class="hl2">100</span> → 解锁方言台词（点木屋，头顶弹方言气泡）；<span class="hl2">200</span> → 解锁小故事；<span class="hl2">300</span> → 获得客栈徽章 + 皮肤觉醒。</div></div><div class="card"><div class="title">🏠 客栈住客</div><div class="desc">目前客栈有 <span class="hl3">12 位</span>生肖住客：鼠、牛、虎、兔、龙、蛇、马、羊、猴、鸡、狗、猪。每位都有独立的方言、人设和小故事。</div></div><div class="card"><div class="title">🌟 皮肤觉醒</div><div class="desc">好感度满 300 后，该生肖皮肤技能<span class="hl3">强化</span>：<br>· 🐭 鼠·聚财：+20% → <span class="hl2">+30%</span><br>· 🐮 牛·铁壁：3 次 → <span class="hl2">5 次</span>，撞碎石头 +5 分<br>· 🐯 虎·分身：5 秒 → <span class="hl2">8 秒</span>，幻影挡刀给你 1.5 秒无敌<br>· 🐰 兔·疾风：速度 +10% → <span class="hl2">+20%</span>，连击窗口 +1 秒<br>· 🐲 龙·炎爆：5 格 → <span class="hl2">7 格</span>，冷却 5 秒 → 3 秒<br>· 🐍 蛇·隐踪：3 秒 → <span class="hl2">5 秒</span>，可穿透墙壁一次<br>· 🐴 马·回春：复活后额外 3 秒加速，分数只扣 25%<br>· 🐵 猴·筋斗云：3 格 → <span class="hl2">5 格</span>，冷却减半<br>· 🐔 鸡·破晓：5 秒 → <span class="hl2">8 秒</span>，冷却减半<br>· 🐶 狗·守护：护盾 1 → <span class="hl2">2 个</span>，免死 1 → 2 次<br>· 🐷 猪·福气：+20% → <span class="hl2">+35%</span>，速度惩罚 -5% → -2%<br>· 🐑 羊·魂游：效果时长延长</div></div><div class="card"><div class="title">💬 怎么和角色互动</div><div class="desc">· 点<span class="hl2">木屋或名字</span> → 头顶弹方言气泡（需好感度 ≥100）<br>· 点<span class="hl2">好感条</span> → 弹出详情窗，查看三档解锁进度与觉醒预览</div></div><div class="card"><div class="title">💬 和老板娘对话</div><div class="desc"><span class="hl2">单击老板娘</span> → 延迟 2 秒后，她会用 AI 生成一句专属对话。她记得客栈里每个生肖的状态，会根据整体好感度调整语气。每句话都和之前的<span class="hl">不重样</span>。</div></div><div class="card"><div class="title">🎮 手机端彩蛋</div><div class="desc">在客栈页面 <span class="hl3">2 秒内连点老板娘 5 次</span>，所有生肖好感度直接拉满。</div></div>' },
{ id: 'stats', icon: '📊', title: '数据统计', content: '<h4>📊 数据统计面板</h4><p>点击顶部 <span class="hl3">⚙️ 设置</span> → 「📊 数据」按钮，可以查看你所有的生涯数据。</p><div class="card"><div class="title">📊 生涯总览</div><div class="desc">总游玩局数、单人/双人/合作局数、累计游戏时长、累计吃食物数、累计总分。</div></div><div class="card"><div class="title">🏆 最高纪录</div><div class="desc">历史最高分、最长体长、最长生存时间、最高连击、单局最多吃食物数。</div></div><div class="card"><div class="title">💀 死因分布</div><div class="desc">撞墙、咬到自己、撞到对方、被猫抓住、被猫咬断、撞到石头的次数和占比。</div></div>' },
{ id: 'save', icon: '💾', title: '存档管理', content: '<h4>💾 存档管理</h4><p>点击顶部 <span class="hl3">⚙️ 设置</span> → 「💾 存档」，可以导出、导入、清空存档。</p><div class="card"><div class="title">📤 导出存档</div><div class="desc">把当前所有进度（成就、皮肤、称号、铜钱、背包、统计、迷宫进度、种子最高分、排行榜名字、客栈好感度）导出为一段文本，复制保存好即可。</div></div><div class="card"><div class="title">📥 导入存档</div><div class="desc">把之前导出的存档文本粘贴到输入框，点击「确认导入」，进度就会恢复。换设备、换浏览器时特别有用。</div></div><div class="card"><div class="title">🗑️ 清空存档</div><div class="desc">一键清空所有进度，<span class="hl">不可恢复</span>。清空前建议先导出备份。</div></div><div class="card"><div class="title">🔍 存档诊断</div><div class="desc">存档面板底部会显示存储状态、存档体积、数据损坏情况。如果浏览器处于隐私模式，会提示「仅内存，刷新会丢」。</div></div>' },
{ id: 'settings', icon: '⚙️', title: '江湖设置', content: '<h4>⚙️ 江湖设置</h4><p>点击顶部 <span class="hl3">⚙️ 设置</span> 按钮，打开设置面板。</p><div class="card"><div class="title">🎮 游戏开关</div><div class="desc">🎵 背景音乐开关、🐱 猫鼠大战开关、🚧 障碍与传送门开关。</div></div><div class="card"><div class="title">📋 信息与存档</div><div class="desc">📊 数据（生涯统计）、📖 指南（你正在看的这个）、💾 存档（导出/导入/清空）。</div></div>' },
{ id: 'ai', icon: '🤖', title: '江湖 AI 评语', content: '<h4>🤖 江湖 AI 老板娘</h4><p>每局游戏结束时，客栈老板娘「小江湖」会根据你本局的积分、体长、吃掉的食物数量，给出一句<span class="hl2">专属评语</span>。</p><div class="card"><div class="title">✨ 每局都不一样</div><div class="desc">小江湖每次会用不同的语气点评：有时<span class="hl2">傲娇</span>，有时<span class="hl">毒舌</span>，有时<span class="hl3">装傻</span>，还有江湖旁白、吃货视角、惊叹、温柔、腹黑等多种风格。系统会记住最近几次评语，尽量避开重复。</div></div><div class="card"><div class="title">🏮 老板娘小档案</div><div class="desc">江湖客栈的老板娘，古灵精怪，爱叫你"宝宝"，点评时喜欢用武侠梗。她只点评你这一局的表现，说得对不对全凭心情～</div></div><div class="card"><div class="title">💬 客栈里也能聊</div><div class="desc">在客栈页面<span class="hl2">单击老板娘</span>，她会用 AI 生成一句专属对话。她记得客栈里所有生肖的状态，会根据整体好感度调整语气。每句话都和之前的<span class="hl">不重样</span>。</div></div>' },
{ id: 'tips', icon: '💡', title: '小技巧', content: '<h4>💡 高手小技巧</h4><ul><li><span class="hl2">善用护盾</span>：留一个护盾在身上，被猫追上或撞石头时可以救命。</li><li><span class="hl2">连击冲分</span>：看到食物密集的区域，一口气冲过去连吃 5 个以上，倍率立刻上来。</li><li><span class="hl2">围猫战术</span>：利用蛇身长的优势，绕一个大圈把猫围住，能拿 50 分。</li><li><span class="hl2">龙炎爆清路</span>：装备龙皮肤时，前方石头挡路可以用炎爆清掉；猫追得紧时也能用炎爆击退猫。</li><li><span class="hl2">虎分身骗猫</span>：装备虎皮肤时，被猫追得走投无路就按 E 放分身，猫会去追分身，趁机脱身。</li><li><span class="hl2">传送门逃生</span>：被猫或石头逼到角落时，钻进传送门，瞬间转移到地图另一头。</li><li><span class="hl2">皮肤技能</span>：牛可以撞碎石头、马可以复活、兔可以连击、蛇可以穿墙、虎可以分身、龙可以炎爆、羊可以眩晕猫、猴可以瞬移、鸡可以照亮、狗有护盾、猪加分但慢一点。</li><li><span class="hl2">合作保命</span>：合作模式里，队友死了别急着复活，等野猫走远再按方向键起来，避免刚复活又被秒。</li><li><span class="hl2">迷宫保血</span>：迷宫里血量就是分数，能不撞墙就不撞墙，最后剩的血越多，结算加的分越高。</li><li><span class="hl2">排行榜刷分</span>：种子局每张图都能重复挑战，多试几次找到最优路线，把分数刷到榜一。</li><li><span class="hl3">手机作弊</span>：2 秒内连点标题"🐍 十二生肖闯江湖"5 次，解锁全部皮肤 + 成就！</li></ul>' }
];

// ===== 连击系统 =====
const COMBO_WINDOW = 5000;
const COMBO_TIERS = [
  { count: 5,  multiplier: 1.5, color: '#00f5d4' },
  { count: 10, multiplier: 2,   color: '#00bbf9' },
  { count: 18, multiplier: 3,   color: '#9b5de5' },
  { count: 28, multiplier: 4,   color: '#f15bb5' },
  { count: 40, multiplier: 5,   color: '#ffcc00' }
];
function getComboMultiplier(count) {
  let m = 1;
  for (const t of COMBO_TIERS) { if (count >= t.count) m = t.multiplier; }
  return m;
}
function getComboColor(count) {
  let c = '#94a3b8';
  for (const t of COMBO_TIERS) { if (count >= t.count) c = t.color; }
  return c;
}
// ===== 江湖称号系统 =====
// 难度梯度：bronze → silver → gold → diamond → legend
// 特效逐级华丽（样式定义在 style.css 的 .title-badge.tier-* 系列）
const TITLE_TIERS = {
  bronze:  { name: '初出茅庐', color: '#94a3b8', rank: 1 },
  silver:  { name: '小有名气', color: '#00f5d4', rank: 2 },
  gold:    { name: '名震一方', color: '#ffcc00', rank: 3 },
  diamond: { name: '威震武林', color: '#f15bb5', rank: 4 },
  legend:  { name: '武林至尊', color: '#9b5de5', rank: 5 },
  inn:     { name: '客栈挚友', color: '#ff9966', rank: 6 }
};

const TITLES = [
  // ---- 初出茅庐（简单）----
  { id:'t_first_step', name:'初入江湖', desc:'完成第一局游戏', tier:'bronze',
    check:()=>stats.totalGames>=1, progress:()=>Math.min(stats.totalGames/1,1) },
  { id:'t_wall_10',    name:'新手上路', desc:'累计撞墙 10 次', tier:'bronze',
    check:()=>stats.deaths.wall>=10, progress:()=>Math.min(stats.deaths.wall/10,1) },
  { id:'t_eat_50',     name:'小吃货',   desc:'累计吃食物 50 个', tier:'bronze',
    check:()=>stats.totalFoodsEaten>=50, progress:()=>Math.min(stats.totalFoodsEaten/50,1) },
  { id:'t_len_8',      name:'小蛇一条', desc:'单局体长达到 8', tier:'bronze',
    check:()=>stats.bestLength>=8, progress:()=>Math.min(stats.bestLength/8,1) },
  { id:'t_time_60',    name:'初窥门径', desc:'单局存活 60 秒', tier:'bronze',
    check:()=>stats.bestSurvivalTime>=60, progress:()=>Math.min(stats.bestSurvivalTime/60,1) },

  // ---- 小有名气（普通）----
  { id:'t_wall_100',   name:'铁头功',   desc:'累计撞墙 100 次', tier:'silver',
    check:()=>stats.deaths.wall>=100, progress:()=>Math.min(stats.deaths.wall/100,1) },
  { id:'t_combo_20',   name:'连击狂魔', desc:'单局最高连击 20', tier:'silver',
    check:()=>stats.bestCombo>=20, progress:()=>Math.min(stats.bestCombo/20,1) },
  { id:'t_score_300',  name:'小试牛刀', desc:'单局得分 300', tier:'silver',
    check:()=>highScore>=300, progress:()=>Math.min(highScore/300,1) },
  { id:'t_eat_500',    name:'大胃王',   desc:'累计吃食物 500 个', tier:'silver',
    check:()=>stats.totalFoodsEaten>=500, progress:()=>Math.min(stats.totalFoodsEaten/500,1) },
  { id:'t_games_20',   name:'老玩家',   desc:'累计游玩 20 局', tier:'silver',
    check:()=>stats.totalGames>=20, progress:()=>Math.min(stats.totalGames/20,1) },
  { id:'t_time_180',   name:'稳如老狗', desc:'单局存活 180 秒', tier:'silver',
    check:()=>stats.bestSurvivalTime>=180, progress:()=>Math.min(stats.bestSurvivalTime/180,1) },

  // ---- 名震一方（困难）----
  { id:'t_cat_bite_50', name:'猫粮',     desc:'累计被猫咬断尾巴 50 次', tier:'gold',
    check:()=>stats.catBitesReceived>=50, progress:()=>Math.min(stats.catBitesReceived/50,1) },
  { id:'t_cat_trap_10', name:'猫见愁',   desc:'累计围死野猫 10 次', tier:'gold',
    check:()=>stats.catTrapped>=10, progress:()=>Math.min(stats.catTrapped/10,1) },
  { id:'t_score_600',   name:'一方高手', desc:'单局得分 600', tier:'gold',
    check:()=>highScore>=600, progress:()=>Math.min(highScore/600,1) },
  { id:'t_combo_40',    name:'连击之神', desc:'单局最高连击 40', tier:'gold',
    check:()=>stats.bestCombo>=40, progress:()=>Math.min(stats.bestCombo/40,1) },
  { id:'t_games_100',   name:'百战老江湖', desc:'累计游玩 100 局', tier:'gold',
    check:()=>stats.totalGames>=100, progress:()=>Math.min(stats.totalGames/100,1) },
  { id:'t_total_10000', name:'富甲一方', desc:'累计历史总分 10000', tier:'gold',
    check:()=>totalScoreAccum>=10000, progress:()=>Math.min(totalScoreAccum/10000,1) },

  // ---- 威震武林（极难）----
  { id:'t_score_1000',  name:'独孤求败', desc:'单局得分 1000', tier:'diamond',
    check:()=>highScore>=1000, progress:()=>Math.min(highScore/1000,1) },
  { id:'t_cat_trap_50', name:'猫王克星', desc:'累计围死野猫 50 次', tier:'diamond',
    check:()=>stats.catTrapped>=50, progress:()=>Math.min(stats.catTrapped/50,1) },
  { id:'t_time_300',    name:'长寿仙',   desc:'单局存活 300 秒', tier:'diamond',
    check:()=>stats.bestSurvivalTime>=300, progress:()=>Math.min(stats.bestSurvivalTime/300,1) },
  { id:'t_combo_60',    name:'连击天尊', desc:'单局最高连击 60', tier:'diamond',
    check:()=>stats.bestCombo>=60, progress:()=>Math.min(stats.bestCombo/60,1) },

  // ---- 武林至尊（传奇）----
  { id:'t_score_2000',  name:'武林至尊', desc:'单局得分 2000', tier:'legend',
    check:()=>highScore>=2000, progress:()=>Math.min(highScore/2000,1) },
  { id:'t_all_skins',   name:'十二生肖之主', desc:'解锁全部生肖皮肤', tier:'legend',
    check:()=>Object.values(SKINS).filter(s=>s.unlockId).every(s=>unlocked.includes(s.unlockId)||cheatSkins.has(s.unlockId)),
    progress:()=>{ const total=Object.values(SKINS).filter(s=>s.unlockId).length; const got=Object.values(SKINS).filter(s=>s.unlockId&&(unlocked.includes(s.unlockId)||cheatSkins.has(s.unlockId))).length; return total?got/total:1; } },
  { id:'t_all_achieve', name:'圆满飞升', desc:'解锁全部成就', tier:'legend',
    check:()=>unlocked.length>=ACHIEVEMENTS.length,
    progress:()=>Math.min(unlocked.length/ACHIEVEMENTS.length,1) },

  // ---- 双人对战专属 ----
  { id:'t_double_first',     name:'初试身手',   desc:'完成第一局双人对战', tier:'bronze',
    check:()=>(stats.doubleGames||0)>=1, progress:()=>Math.min((stats.doubleGames||0)/1,1) },
  { id:'t_double_win_1',     name:'双人首胜',   desc:'双人对战获胜 1 次', tier:'silver',
    check:()=>(stats.doubleWins||0)>=1, progress:()=>Math.min((stats.doubleWins||0)/1,1) },
  { id:'t_double_kill_20',   name:'同室操戈',   desc:'双人模式撞死对方 20 次', tier:'silver',
    check:()=>(stats.doubleKills||0)>=20, progress:()=>Math.min((stats.doubleKills||0)/20,1) },
  { id:'t_double_win_10',    name:'德比之王',   desc:'双人对战获胜 10 次', tier:'gold',
    check:()=>(stats.doubleWins||0)>=10, progress:()=>Math.min((stats.doubleWins||0)/10,1) },
  { id:'t_double_score_300', name:'双人封顶',   desc:'双人模式率先达到 300 分获胜', tier:'gold',
    check:()=>(stats.doubleWins||0)>=1, progress:()=>Math.min((stats.doubleWins||0)/1,1) },
  { id:'t_double_win_50',    name:'宿命对决',   desc:'双人对战获胜 50 次', tier:'diamond',
    check:()=>(stats.doubleWins||0)>=50, progress:()=>Math.min((stats.doubleWins||0)/50,1) },

  // ---- 合作模式专属 ----
  { id:'t_coop_first',    name:'并肩作战',   desc:'完成第一局合作模式', tier:'bronze',
    check:()=>(stats.coopGames||0)>=1, progress:()=>Math.min((stats.coopGames||0)/1,1) },
  { id:'t_coop_clear_1',  name:'合作首通',   desc:'合作模式通关 1 次', tier:'silver',
    check:()=>(stats.coopWins||0)>=1, progress:()=>Math.min((stats.coopWins||0)/1,1) },
  { id:'t_coop_score_600', name:'双剑合璧',  desc:'合作模式双人合计达到 600 分', tier:'gold',
    check:()=>(stats.coopBestScore||0)>=600, progress:()=>Math.min((stats.coopBestScore||0)/600,1) },
  { id:'t_coop_clear_10', name:'生死与共',   desc:'合作模式通关 10 次', tier:'gold',
    check:()=>(stats.coopWins||0)>=10, progress:()=>Math.min((stats.coopWins||0)/10,1) },
  { id:'t_coop_perfect',  name:'完美配合',   desc:'合作模式零阵亡通关（剩余 3 命）', tier:'diamond',
    check:()=>(stats.coopPerfectWins||0)>=1, progress:()=>Math.min((stats.coopPerfectWins||0)/1,1) },
  { id:'t_coop_clear_50', name:'同生共死',   desc:'合作模式通关 50 次', tier:'diamond',
    check:()=>(stats.coopWins||0)>=50, progress:()=>Math.min((stats.coopWins||0)/50,1) },

  // ---- 种子局专属 ----
  { id:'t_seed_first',     name:'寻道者',    desc:'首次进入种子局挑战', tier:'bronze',
    check:()=>(stats.seedGames||0)>=1, progress:()=>Math.min((stats.seedGames||0)/1,1) },
  { id:'t_seed_score_300', name:'破图者',    desc:'单张种子图达到 300 分', tier:'silver',
    check:()=>(stats.seedBestScore||0)>=300, progress:()=>Math.min((stats.seedBestScore||0)/300,1) },
  { id:'t_seed_clear_5',   name:'五图通',    desc:'通关 5 张不同的种子图', tier:'gold',
    check:()=>(stats.seedClears||[]).length>=5, progress:()=>Math.min((stats.seedClears||[]).length/5,1) },
  { id:'t_seed_score_500', name:'种子猎手',  desc:'单张种子图达到 500 分', tier:'diamond',
    check:()=>(stats.seedBestScore||0)>=500, progress:()=>Math.min((stats.seedBestScore||0)/500,1) },
  { id:'t_seed_clear_all', name:'图王', desc:'通关全部 10 张种子图', tier:'legend',
    check:()=>(stats.seedClears||[]).length>=10, progress:()=>Math.min((stats.seedClears||[]).length/10,1) },

  // ---- 客栈徽章（好感度满 300 解锁）----
  { id:'t_inn_shu', name:'鼠来宝·挚友', desc:'鼠来宝好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.shu||0)+(p.shu||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.shu||0)+(p.shu||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_niu', name:'牛气冲天·挚友', desc:'牛气冲天好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.niu||0)+(p.niu||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.niu||0)+(p.niu||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_hu', name:'虎虎生威·挚友', desc:'虎虎生威好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.hu||0)+(p.hu||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.hu||0)+(p.hu||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_tu', name:'玉兔东升·挚友', desc:'玉兔东升好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.tu||0)+(p.tu||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.tu||0)+(p.tu||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_long', name:'龙腾四海·挚友', desc:'龙腾四海好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.long||0)+(p.long||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.long||0)+(p.long||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_she', name:'灵蛇出洞·挚友', desc:'灵蛇出洞好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.she||0)+(p.she||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.she||0)+(p.she||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_ma', name:'一马当先·挚友', desc:'一马当先好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.ma||0)+(p.ma||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.ma||0)+(p.ma||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_yang', name:'三羊开泰·挚友', desc:'三羊开泰好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.yang||0)+(p.yang||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.yang||0)+(p.yang||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_hou', name:'灵猴献瑞·挚友', desc:'灵猴献瑞好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.hou||0)+(p.hou||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.hou||0)+(p.hou||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_ji', name:'金鸡独立·挚友', desc:'金鸡独立好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.ji||0)+(p.ji||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.ji||0)+(p.ji||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_gou', name:'忠犬护主·挚友', desc:'忠犬护主好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.gou||0)+(p.gou||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.gou||0)+(p.gou||0))/INN_MAX_AFFINITY,1); } },
  { id:'t_inn_zhu', name:'猪事顺利·挚友', desc:'猪事顺利好感度达到 300', tier:'inn',
    check:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return ((a.zhu||0)+(p.zhu||0))>=INN_MAX_AFFINITY; },
    progress:()=>{ const a=SM.getJSON(INN_AFFINITY_KEY,{})||{}; const p=SM.getJSON(INN_PENDING_KEY,{})||{}; return Math.min(((a.zhu||0)+(p.zhu||0))/INN_MAX_AFFINITY,1); } }
];

// 称号存档键（与成就、最高分同风格）
const TITLES_KEY = 'snakeTitlesV1';
const EQUIPPED_TITLE_KEY = 'snakeEquippedTitleV1';
// ===== 生肖客栈 =====
const INN_AFFINITY_KEY = 'snakeInnAffinity';          // 已结算好感度
const INN_PENDING_KEY = 'snakeInnPendingAffinity';    // ★ 待结算好感度（下次进客栈播放）
const INN_CHAT_HISTORY_KEY = 'snakeInnChatHistory';  // ★ AI 聊天历史（防雷同）
const INN_MAX_AFFINITY = 300;                        // 好感度上限
const INN_TIERS = [0, 100, 200, 300];                // 解锁节点：初识/熟络/知己/挚友
const INN_CHARACTERS = {
  shu: {
    id: 'shu', skinId: 'shu', name: '鼠来宝', emoji: '🐭',
    title: '客栈账房',
    roomPos: { x: 18, y: 30 },   // 百分比坐标
    personality: '机灵、精明、爱占小便宜但热心肠，算盘打得比谁都响。心思玲珑，擅长盘账算利，嘴上爱斤斤计较，实则背地里常常悄悄接济落魄江湖人。说话带上海腔，喜欢用"阿拉"自称，处处透着市井精明。',
    flaw: '看见铜板眼睛发亮，会下意识抠小碎银，嘴上爱唠叨算账，遇到人情账就容易犯迷糊。',
    quirk: '走到哪都揣一把老算盘，睡觉都搁枕边；喜欢把碎铜钱码得整整齐齐；偷偷记着客栈每一个人的赊账，唯独不愿记老板娘那碗救命热汤。',
    dialect: '上海话',
    dialectNote: '常用"阿拉"（我）、"侬"（你）、"伐"（吗）、"勿"（不）、"灵光"（聪明）、"惬意"（舒服）、"结棍"（厉害）、"勿要"（不要）、"洋钿"（钱财）。',
    story: '鼠来宝本是江湖上跑单帮的小商贩，走南闯北倒卖零碎货物，一把算盘走天下，吃过不少江湖的亏，也攒下一身世故。某年寒冬大雨滂沱，他身无分文躲雨撞进江湖客栈，冻得浑身打颤，是老板娘端来一碗滚烫肉汤，分文未取收留了他。一碗热汤暖透了漂泊半生的心，就此留下来做客栈账房先生。他算得清往来客商万千账目，分毫不差，可唯独算不清这些年，自己在客栈白喝掉的那一碗碗热汤的价钱，这笔人情账，他干脆选择永远不算。',
        dialogs: [
      '侬好呀，阿拉是鼠来宝，客栈账房。侬要点啥，阿拉给侬算算？',
      '侬又来啦？阿拉今朝心情灵光，账都帮侬算好了。',
      '侬晓得了伐，阿拉这半辈子最惬意的，就是在客栈帮侬记账。'
    ],
    extraDialogs: [
      '哎侬当心点！洋钿勿要乱丢，弄丢了阿拉可不赔伐！',
      '生意归生意，若是侬落难没钱，这笔账……阿拉先给侬挂着。',
      '算盘噼啪响，天下账都好算，唯独人情，算不清咯。',
    ],
    dailyTopics: [
      '账本上今日又添了几笔新账，算盘从早响到晚',
      '有客人赊了一顿酒钱，正纠结要不要记进小本子',
      '天凉了，想着给客房添床被褥——当然，得算钱',
      '后厨牛大厨今朝又炖了新汤，香味飘到账房来了',
    ],
    pastTales: [
      '当年挑着货担走南闯北跑单帮，被地痞讹过一回银子',
      '某个大雪夜躲雨撞进客栈，老板娘端来一碗不要钱的热汤',
      '教小猴子算数，结果算盘被拆成了零件',
      '年轻时被人骗走整批货，从此记账必留一式两份',
    ],
    // ★ 觉醒（好感度 300 得到徽章后触发，暂未实装，仅作设计记录）
    awakening: {
      name: '聚财·觉醒',
      desc: '结算铜钱加成从 +20% 提升至 +30%。',
      effect: { coinBonus: 0.30 }
    }
  },
  niu: {
    id: 'niu', skinId: 'niu', name: '牛气冲天', emoji: '🐮',
    title: '客栈大厨',
    roomPos: { x: 82, y: 30 },
    personality: '憨厚、踏实、话不多但句句实在。力气盖世，性子慢热，不擅长花言巧语，全部心意都炖进锅里。说话带东北腔，喜欢用"俺"自称，一开口就是"那旮旯""整啥呢"，骨子里是个热心的大厨。',
    flaw: '性子耿直不会拐弯，别人客套话他会当真；一生气就闷头使劲劈柴，越恼火柴火劈得越碎。',
    quirk: '每天天不亮就生火，锅灶擦得锃亮；做菜舍得下料，看见旁人吃的香就满心欢喜；腰间常年挂一块擦锅的粗麻布。',
    dialect: '东北话',
    dialectNote: '常用"俺"（我）、"那旮旯"（那地方）、"整"（做）、"得瑟"（显摆）、"咋整"（怎么办）、"老铁"（好朋友）、"贼拉"（特别）、"唠嗑"（聊天）。',
    story: '牛气冲天原是长白山下的猎户，自幼进山狩猎，一身蛮力大得能扛起一头成年野牛。常年独居于山林，不谙世事。一夜江湖客栈意外走水，烈火吞噬屋舍，混乱之中他恰巧路过，不顾烈焰灼烧，拼尽全力把老板娘从火场背出。大火过后客栈重建，他不愿再回清冷深山，便留下来当了客栈厨子。最拿手招牌便是"牛气冲天锅"，浓汤厚料，热气腾腾，江湖人都说吃上一大锅，跋山涉水三日都不觉饥饿。锅里面炖的不止食材，还有他不擅言说的情义。',
    dialogs: [
      '俺是牛气冲天，这旮旯的厨子。整点啥吃的？俺给你整俩硬菜。',
      '老铁又来啦？俺给你留了那碗老汤，贼拉香。',
      '俺这辈子就认两样：一是灶台，二是侬。侬来了俺就踏实。'
    ],
    extraDialogs: [
      '别搁那得瑟，菜趁热造！凉了味道就差事儿了。',
      '山里头啥凶险俺都见过，守着灶台过日子，反倒心里安稳。',
      '要是饿了就言语一声，锅里永远给你留一口热乎的。',
    ],
    dailyTopics: [
      '灶上的老汤炖了一整宿，火候刚刚好',
      '今儿个新劈的柴堆在墙根，锅灶擦得能照出人影',
      '客人吃得香不香，要不要再给添一勺肉',
      '天冷了，想着给每碗汤里多搁两片肉',
    ],
    pastTales: [
      '长白山里做猎户那些年，一个人扛起过一头野牛',
      '客栈走水那夜，冲进火场把老板娘背出来',
      '招牌菜"牛气冲天锅"是咋琢磨出来的',
      '在山里独居太久，下山后连客套话都听不明白',
    ],
    // ★ 觉醒（好感度 300 得到徽章后触发，暂未实装，仅作设计记录）
    awakening: {
      name: '铁壁·觉醒',
      desc: '撞碎石头的次数从每局 3 次提升至 5 次，且撞碎石头额外 +5 分。',
      effect: { niuShieldLeft: 5, breakStoneBonus: 5 }
    }
  },
  hu: {
    id: 'hu', skinId: 'hu', name: '虎虎生威', emoji: '🐯',
    title: '客栈护院',
    roomPos: { x: 88, y: 90 },
    personality: '勇猛、直爽、霸气外露，但有一颗护短的心。嫉恶如仇，见不得弱小受欺负，对外凶狠凌厉，对内客栈众人却格外心软。说话带川渝腔，喜欢用"老子""巴适""雄起"，一开口就是江湖气。',
    flaw: '脾气火爆容易上头，遇事习惯先动手后讲道理；不会体察细腻情绪，安慰人越说越凶。',
    quirk: '喜欢靠在客栈大门石柱打盹；腰间挎一柄阔刀；遇到小孩子会刻意收敛一身凶气。',
    dialect: '川渝话',
    dialectNote: '常用"老子"（我）、"巴适"（舒服、好）、"雄起"（加油）、"瓜娃子"（傻小子）、"要得"（行）、"莫得"（没有）、"安逸"（舒服）、"扯把子"（吹牛）。',
    story: '虎虎生威曾是山林当中当之无愧的山中之王，威风凛凛。一次下山觅食，不慎中猎户布下的陷阱，身受重伤，困于荒郊。机缘巧合被路过的江湖客栈老板娘撞见，不顾凶险将他带回客栈，日日熬草药悉心照料。伤势痊愈之后，他不愿再返回孤寂深山，甘愿褪去山林王的身份，留在客栈当一名护院。江湖上流传，只要虎爷往客栈门口一站，方圆十里地的盗匪、地痞，全都不敢前来惹是生非。可这般威震四方的猛兽，唯独对客栈里的一众人，收尽锋芒。',
    dialogs: [
      '要得！老子是虎虎生威，这客栈的护院。哪个瓜娃子敢闹事，老子收拾他。',
      '兄弟又来咯？巴适得很！今天老子给你看个雄起的。',
      '江湖那么大，老子只认一个地方——这客栈。你来了，老子就安逸。'
    ],
    extraDialogs: [
      '莫要扯把子！在咱们客栈，不准欺负普通人哈！',
      '外头刀光剑影算啥子，守到这一方屋檐，才叫踏实。',
      '有事只管喊老子！天大的麻烦，我给你扛到！',
    ],
    dailyTopics: [
      '门口有没有可疑的人在转悠，得盯紧点',
      '堂里哪个客人被欺负了，老子要替他出头',
      '靠在门柱上打盹，被小猴子拿果子砸醒',
      '今天的酒够不够烈，肉够不够大块',
    ],
    pastTales: [
      '当年做山中之王，巡山时方圆百里都得让路',
      '中了猎户的陷阱，重伤困在荒郊那几天',
      '老板娘日日熬草药，把老子从鬼门关拉回来',
      '一嗓子吼退过一群来客栈闹事的地痞',
    ],
    // ★ 觉醒（好感度 300 得到徽章后触发，暂未实装，仅作设计记录）
    awakening: {
      name: '分身·觉醒',
      desc: '幻影蛇存在时间从 5 秒延长至 8 秒，且幻影能替玩家挡一次猫的攻击。',
      effect: { phantomDuration: 8000, phantomGuard: true }
    }
  },
  tu: {
    id: 'tu', skinId: 'tu', name: '玉兔东升', emoji: '🐰',
    title: '客栈花匠',
    roomPos: { x: 10, y: 50 },
    personality: '温柔、安静、喜欢月亮和花，说话慢条斯理，骨子里是个隐居的读书人。外表软糯温婉，内心自有风骨，看透仙凡悲欢，不悲不喜。带苏州吴语口音，软糯却不失风骨。',
    flaw: '过于喜静，喧闹场合会局促不安；不善争执，受委屈习惯自己默默消化。',
    quirk: '月圆之夜必独自在后院望月；衣袖总沾花香；亲手炮制花草香包送给往来过客。',
    dialect: '苏州话',
    dialectNote: '常用"阿是"（是不是）、"侬"（你）、"奴家"（我）、"老好"（很好）、"哉"（语气词）、"好伐"（好吗）、"阿晓得"（知道吗）。',
    story: '玉兔东升本是月宫捣药的小仙，千百年于广寒宫捣炼灵药。一日耐不住寂寞，偷偷俯瞰人间，痴迷于凡世间四时盛放的烂漫花事，频频下界偷看，触犯天条，被贬谪坠落凡尘。但她心中并无怨怼，反倒贪恋人间烟火，辗转来到江湖客栈，安居后院。亲手栽种满园桂树，每到皓月当空的夜晚，便取出药臼捣制安神香药，赠予奔波劳碌的江湖行客。老板娘时常笑谈，整座江湖客栈萦绕不散的淡淡桂香，便是玉兔本身的味道。凡尘虽无月宫清冷华美，却有烟火人情，令她甘愿长留。',
    dialogs: [
      '阿是侬呀？奴家是玉兔，客栈里种花的，侬慢慢走。',
      '今朝月色老好呃，侬要不要去后院看桂花？',
      '奴家这半辈子最喜静，侬来了，花也就开了。'
    ],
    extraDialogs: [
      '夜风微凉，侬且收下这个香包，路上可以安神哉。',
      '天上月宫冷冷清清，反倒人间小院花开花落，更叫人欢喜。',
      '阿晓得？花开有时，人聚有时，一切皆是缘分。',
    ],
    dailyTopics: [
      '后院的桂花开了，香得整座客栈都是',
      '今朝夜色老好，月亮圆得像新捣的药臼',
      '新炮制的安神香包，想送给赶路的客人',
      '前堂太吵了，想回后院躲一会儿',
    ],
    pastTales: [
      '在广寒宫里捣药的那千百年，冷清得听得见回声',
      '偷偷俯瞰人间花事，触犯天条被贬下凡',
      '初到客栈那年，亲手在后院种下满园桂树',
      '曾送一个落魄行客香包，后来那人再没回来',
    ],
    awakening: {
      name: '疾风·觉醒',
      desc: '初始速度 +10% 提升至 +20%，连击窗口额外 +1 秒。',
      effect: { speedMultiplier: 1.20, comboExtra: 1000 }
    }
  },
  long: {
    id: 'long', skinId: 'long', name: '龙腾四海', emoji: '🐲',
    title: '客栈贵客',
    roomPos: { x: 90, y: 50 },
    personality: '高傲、威严，说话带古风，文言白句混搭。已经看遍人间百年浮沉，看透江湖离合纷争，重情义却极少表露，习惯冷眼旁观世事，平日疏离淡漠，可客栈之人若是受难，便会不惜出手。',
    flaw: '高高在上久矣，不懂凡俗细碎人情，偶尔听不懂凡人玩笑；不善表达关怀，关心人的话语听起来十分冷淡。',
    quirk: '常独坐在窗边饮茶，一壶清茶可以坐看一日云卷云舒；不喜喧嚣，极少参与客栈热闹闲谈；目光一眼便能看穿人心真假。',
    dialect: '雅言（文言）',
    dialectNote: '常用"吾"（我）、"汝"（你）、"之"、"亦"、"善"、"焉"、"矣"、"然"、"非"等文言虚词。',
    story: '龙腾四海乃是大江水域的龙族之君，执掌江河浪涛，寿数绵长。定下规矩，每百年便褪去龙形化作凡人，巡游红尘人间，体察俗世百态。这一次游历途经江湖客栈，刚踏入店门，便被老板娘一句无心打趣"你模样长得好似我家旧年供奉的灶王爷"逗得怔在原地。堂堂江河之主，从未听过这般直白有趣的言语，竟就此停下脚步，成了客栈当中身份最为尊贵，也最为沉默的常客。他日日只是静坐饮茶，冷眼旁观堂内上演一出出江湖离合，寻常纷争从不会插手。可一旦有人蓄意加害客栈、为难老板娘与一众伙计，江河君的怒火，便会顷刻降临。',
    dialogs: [
      '吾乃龙腾四海，四海为家，此处且歇。汝有何事？',
      '汝又来矣。今日江湖，比昨日更有趣乎？',
      '吾行遍四海，唯独此间，让吾愿留。'
    ],
    extraDialogs: [
      '山河万里，吾皆踏遍，难得一隅，可安此身。',
      '江湖恩怨厮杀无穷，可这小小客栈，自有烟火温柔。',
      '汝若遇危难，只管直言，吾非全然冷眼旁观者。',
    ],
    dailyTopics: [
      '窗边一壶清茶，看云卷云舒，坐了一整日',
      '堂内又上演了一出江湖离合，比戏文有趣',
      '老板娘今日又打趣了吾一句，吾竟无言以对',
      '人间烟火虽俗，却比江河浪涛更有滋味',
    ],
    pastTales: [
      '执掌江河浪涛、寿数绵长的那些年月',
      '定下每百年褪去龙形、巡游红尘的规矩',
      '被老板娘一句"你像我家灶王爷"留在了客栈',
      '曾有人蓄意加害客栈，那一次吾动了真怒',
    ],
    awakening: {
      name: '炎爆·觉醒',
      desc: '炎爆路径 5 格延长至 7 格，冷却 5 秒缩短至 3 秒。',
      effect: { fireCells: 7, cooldown: 3000 }
    }
  },
  she: {
    id: 'she', skinId: 'she', name: '灵蛇出洞', emoji: '🐍',
    title: '客栈说书人',
    roomPos: { x: 50, y: 10 },
    personality: '神秘、话里有话、喜欢打哑谜。说书之时娓娓道来，一句话往往藏着两三层深意。阅尽世间奇案，心思缜密，善于察言观色，看破人心却不点破。带粤语腔。',
    flaw: '习惯拐弯抹角说话，很少直来直去；心底藏着过往旧案心结，不愿轻易向旁人袒露。',
    quirk: '手中常年把玩一把说书折扇；每说完一段故事便抿一口清茶；讲的故事虚实参半，从不会直白告知听众何为真何为幻。',
    dialect: '粤语',
    dialectNote: '常用"我"、"你"、"嘅"（的）、"咩"（什么）、"唔"（不）、"系"（是）、"呢度"（这里）、"好正"（很棒）、"故仔"（故事）、"嘅话"（的话）。',
    story: '灵蛇出洞从前是官府当中名震大江南北的捕快，思维敏锐，破获无数扑朔迷离的奇案悬案。见过太多人性阴暗，看过冤屈与阴谋交织，看透朝堂江湖的层层纠葛。一桩大案之后，看透世事，不愿再身陷纷争，就此卸去身份隐姓埋名，落脚江湖客栈，做起说书先生。他坐在高台拍响醒木，将过往经历、坊间传闻、江湖秘闻尽数化作口中故事。满堂江湖客听得如痴如醉。旁人分不清哪些故事是亲身亲历，哪些只是杜撰戏言——一半故事是真，另一半的真相，唯有灵蛇自己深埋心底。',
    dialogs: [
      '我系灵蛇，讲古嘅。想听故仔？坐下先。',
      '你又嚟啦？今日想听边段古？呢度好正嘅。',
      '江湖事，讲一世都讲唔完。你嚟，我就慢慢讲。'
    ],
    extraDialogs: [
      '世间真真假假，又有咩分得清清楚楚呢？听个故事，不必刨根问底。',
      '好多人心底，都藏住一段讲唔出口嘅往事。',
      '醒木一拍，风云登场；醒木一落，万事收场。',
    ],
    dailyTopics: [
      '醒木一拍，堂里坐满了等听古的客人',
      '今夜泡的茶够唔够香，够唔够回甘',
      '客人想听边一段古？甜的、苦的、还是悬的',
      '坐在高台上看堂里每个人的神色，几有趣',
    ],
    pastTales: [
      '当年做捕快，查遍大江南北的奇案悬案',
      '那桩大案之后，看透世事、卸任隐姓埋名',
      '见过太多人性阴暗，也见过冤屈与阴谋交织',
      '为什么我的故仔，永远只讲一半',
    ],
    awakening: {
      name: '隐踪·觉醒',
      desc: '幽灵模式 3 秒延长至 5 秒，且可穿透墙壁一次。',
      effect: { ghostDuration: 5000, ghostThroughWall: true }
    }
  },
  ma: {
    id: 'ma', skinId: 'ma', name: '一马当先', emoji: '🐴',
    title: '客栈信使',
    roomPos: { x: 12, y: 90 },
    personality: '爽朗、热情、喜欢奔跑和交朋友，说话洪亮，笑声震得房梁都似晃动。重信守诺，把递送书信视作性命，行走四方，却始终记挂客栈这一处归处。带陕西口音，豪爽不扭捏。',
    flaw: '性子太急，做事风风火火偶尔粗心；心肠太软，容易被旁人几句诉苦打动。',
    quirk: '每次远行归来必先喝一碗客栈热汤；马鞍布袋永远装干粮、急信、老酒；一高兴就放声大笑。',
    dialect: '陕西话',
    dialectNote: '常用"俺"（我）、"咥"（吃）、"嫽"（好）、"咋"（怎么）、"咧"（语气词）、"哈怂"（坏蛋）、"嘹咋咧"（太棒了）。',
    story: '一马当先是关中平原之上脚力最快的信使，一身脚力冠绝四方，五百里加急书信风雨无阻，烈日暴雨都拦不住他赶路的脚步。他的随身马袋常年装着三样物件：充饥的干粮、十万火急的来往信件、一坛醇厚老酒。常年奔波在千山万水之间，见过大漠孤烟，踏过江南烟雨。老板娘常常打趣评价，他是江湖客栈跑得最快的信使，却也是归家最慢的那个人。因为受托的书信太多，路途遥远，总是不停奔赴远方。可无论跑过多少山河，心底的归宿永远是这家小小的客栈。',
    dialogs: [
      '俺是一马当先，客栈的信使。嫽得很，今日给你带了个好消息。',
      '俺又回来咧！跑了五百里，就为咥一碗热汤。',
      '江湖那么大，俺跑得再快，也总想着回这旮旯。'
    ],
    extraDialogs: [
      '路再远，信必送到！这是俺做信使的本分！',
      '外头风景嘹咋咧，可跑累了，最念想的还是客栈这一口热饭。',
      '路上碰到哈怂俺可不会客气，莫要耽误俺送信！',
    ],
    dailyTopics: [
      '刚跑完一趟五百里的急信，浑身是土',
      '马鞍布袋里还剩半块干粮、一坛老酒',
      '进门第一件事，先咥一碗热汤',
      '路上下了雨，信倒是没湿',
    ],
    pastTales: [
      '关中平原上跑得最快的脚力，五百里加急风雨无阻',
      '踏过大漠孤烟，也淋过江南烟雨',
      '老板娘说他跑得最快，却也是归家最慢的那个',
      '有一回为送一封家书，连夜翻过两道山',
    ],
    awakening: {
      name: '回春·觉醒',
      desc: '复活后额外获得 3 秒加速，且分数只扣 25%（原 50%）。',
      effect: { reviveScoreKeep: 0.75, reviveSpeedBoost: 3000 }
    }
  },
  yang: {
    id: 'yang', skinId: 'yang', name: '三羊开泰', emoji: '🐑',
    title: '客栈说书先生',
    roomPos: { x: 50, y: 72 },
    personality: '温和、通透、说话慢条斯理，看着闲散慵懒，张口便满是包袱笑料。仿佛通晓天下江湖轶事，看透世间百态，待人宽厚和善。爱说"唠""贼""得劲儿""咋整"，江湖上的事儿没有他不知道的。',
    flaw: '平日里贪睡，经常睡过头误了晌午说书；分不清现实与自己"魂游"的见闻，偶尔把梦境故事当真事讲。',
    quirk: '白日说书，夜里酣睡；手边永远放一壶小酒；睡醒就开始回味昨夜魂游所见，整理成新故事。',
    dialect: '东北话',
    dialectNote: '常用"唠"（聊）、"贼"（非常）、"得劲儿"（舒服）、"咋整"（怎么办）、"嘎哈"（干什么）、"老铁"（兄弟）、"舒坦"。',
    story: '三羊开泰是江湖客栈的说书先生，全客栈数他睡得最早，起得也最晚，整日一副闲散慵懒模样。他身上有一桩旁人觉得稀奇的怪事：白日在大堂给众人讲完形形色色江湖故事，夜里沉沉入梦之后，魂魄好似会脱离躯体四处游历，他将其唤作"魂游"。那些梦里游历看见的悲欢奇遇，醒来便全部记在心里。所以他讲出来的故事从来不会重复，有江湖流传的传闻，也有只在梦境之中亲眼目睹的奇遇。旁人分不清哪些是坊间传闻，哪些来自于他午夜魂梦，只晓得听他说书，永远有新鲜趣事。',
    dialogs: [
      '俺们这儿是说书的三羊开泰，客官坐，听段江湖咋样？',
      '今儿个给你唠个新鲜的，贼有意思，刚从梦里带回来的。',
      '老铁，你这气色得劲儿！夜里俺又魂游了一趟，给你捎了个故事。'
    ],
    extraDialogs: [
      '人生在世图个舒坦，听听小故事，啥烦恼都能暂时放下。',
      '别问俺梦里面是真是假，听着乐呵，那就够啦。',
      '来来来老铁，坐下唠唠，咱说说江湖那些奇人异事。',
    ],
    dailyTopics: [
      '昨儿夜里又魂游了一趟，带回个新鲜故事',
      '晌午的说书该开场了，人还没睡醒',
      '手边这壶小酒，就剩个底儿了',
      '看客人气色得劲儿，正想拉他唠两句',
    ],
    pastTales: [
      '睡过头误了晌午说书，被满堂客人嘘了一回',
      '头一回发现自个儿魂游，吓得半宿没敢合眼',
      '把梦里的事儿当真事讲，闹过的笑话',
      '全客栈睡得最早、起得最晚的那个人',
    ],
    awakening: {
      name: '魂游·觉醒',
      desc: '魂游持续时间从 3 秒延长至 5 秒，每局可用次数从 3 次增至 4 次。',
      effect: { soulDuration: 5000, soulCount: 4 }
    }
  },
  hou: {
    id: 'hou', skinId: 'hou', name: '灵猴献瑞', emoji: '🐵',
    title: '客栈跑堂',
    roomPos: { x: 18, y: 70 },
    personality: '机灵、跳脱、爱捉弄人但讲义气。手脚麻利，活泼好动，闲不住，爱开玩笑逗乐满堂客人，可若是客栈遇上难处，第一个挺身而出。说话带河南腔，喜欢说"恁""中""得劲""耍"，一开口就逗得满堂笑。',
    flaw: '贪玩爱闹，偶尔会偷懒耍滑；爱恶作剧，时常捉弄其他伙计，惹出一点小乱子。',
    quirk: '身手矫健，上梁爬檐轻轻松松；端托盘是看家绝活；兜里总藏几颗果子零食。',
    dialect: '河南话',
    dialectNote: '常用"恁"（你/那么）、"中"（行）、"得劲"（舒服）、"耍"（玩）、"整"（搞）、"咯"（语气词）、"乖乖嘞"。',
    story: '灵猴献瑞本是花果山下一只顽皮小猴，整日游山嬉闹。一日偷偷偷吃山神供奉仙桃，惹怒山神，被山神一路追打，慌不择路四处逃窜，一路逃到江湖客栈。老板娘见他虽然调皮，本性不坏，心生恻隐，便将他收留，做起客栈跑堂。在客栈历练三年，练就一身绝技，上菜端盘堪称一绝。偌大托盘一次摆上八碗菜碟，穿梭喧闹人来人往的大堂，穿堂过户快步奔走，盘中汤水半滴都不会洒出来。平日里爱耍爱闹，可一旦客栈有难，绝不退缩。',
    dialogs: [
      '恁来啦！俺是灵猴献瑞，客栈跑堂，中不中？',
      '今儿个菜得劲，恁先坐着，俺给恁端去。',
      '江湖上耍刀的多，耍菜的少，俺算一个。'
    ],
    extraDialogs: [
      '乖乖嘞！客官稍等片刻，菜马上就给恁端上来咯！',
      '江湖各路好汉都会耍刀耍剑，俺偏就耍好手里这托盘！',
      '玩笑归玩笑，真要是客栈遇上事，俺绝对不含糊！',
    ],
    dailyTopics: [
      '一托盘八个菜，穿堂过户半滴汤都不洒',
      '兜里那几颗果子，想分给客人尝尝',
      '今儿个又捉弄了哪个伙计，惹出点小乱子',
      '大堂人多得脚不沾地，正忙得欢',
    ],
    pastTales: [
      '花果山下偷吃山神的仙桃，被追打一路',
      '慌不择路逃到客栈，老板娘心软收留了俺',
      '在客栈三年，把上菜练成了一门绝活',
      '偷懒耍滑被抓包，挨了一顿数落',
    ],
    awakening: {
      name: '筋斗·觉醒',
      desc: '闪避距离从 3 格增至 5 格，冷却减少 50%。',
      effect: { dodgeCells: 5, cooldown: 5000 }
    }
  },
  ji: {
    id: 'ji', skinId: 'ji', name: '金鸡独立', emoji: '🐔',
    title: '客栈更夫',
    roomPos: { x: 82, y: 70 },
    personality: '严肃、守时、话不多但一开口就点中要害。恪守规矩，重诺重信，内心藏着过往的愧疚，把守时当作自己一生信条。说话带山西腔，喜欢用"俺""甚""咋地""一准"，骨子里是个有规矩的人。',
    flaw: '太过刻板较真，不懂得变通；很少袒露内心，总独自背负旧日心结。',
    quirk: '打更铜锣擦得光亮；十二年昼夜时辰分毫不差；天快破晓时会静静望向东方。',
    dialect: '山西话',
    dialectNote: '常用"俺"（我）、"甚"（什么）、"咋地"（怎么）、"一准"（一定）、"甭"（别）、"兀的"（那个）、"时辰"。',
    story: '金鸡独立从前是走南闯北镖局的镖头，武艺高强，受人敬重。可一场凶险押镖途中遭遇伏击，整支镖队几乎全军覆没，只有他一人拼死存活归来。身负失去兄弟的愧疚，他再也不愿走镖闯荡江湖，辗转来到江湖客栈，做起更夫。日复一日，三更起身巡夜打更，五更迎来破晓，整整十二个年头，报出的时辰从无半分差错。他常常念叨一句话：守时，便是守命。既是守客栈众人的安宁夜晚，也是守住对逝去弟兄的一份念想。',
    dialogs: [
      '俺是金鸡独立，这客栈打更的。甚时辰了，该歇就歇。',
      '兀的天快亮了，恁一准得睡个好觉。',
      '十二年俺没差过一刻，今夜也不会。'
    ],
    extraDialogs: [
      '时辰到咯，夜深人静，诸位客人早些安寝，甭在外头游荡。',
      '过往恩怨已经过去，现如今俺只守好这一方客栈夜色。',
      '铜锣一响，便是时辰，俺答应过的事，一准办到。',
    ],
    dailyTopics: [
      '三更起身巡夜，五更迎来破晓，时辰不敢差',
      '客栈夜里的门户与动静，都在俺耳朵里',
      '铜锣擦得光亮，一响就是时辰',
      '天快亮了，该让客人早些安寝',
    ],
    pastTales: [
      '当年在镖局做镖头，走南闯北受人敬重',
      '那趟遭伏击的镖，弟兄们几乎全没回来',
      '为什么放下刀，改行做更夫守时辰',
      '十二个年头，报出的时辰从没差过一刻',
    ],
    awakening: {
      name: '破晓·觉醒',
      desc: '照亮持续时间从 5 秒延长到 8 秒，冷却减少 50%。',
      effect: { lightDuration: 8000, cooldown: 2500 }
    }
  },
  gou: {
    id: 'gou', skinId: 'gou', name: '忠犬护主', emoji: '🐶',
    title: '客栈门房',
    roomPos: { x: 38, y: 90 },
    personality: '忠诚、沉默、把规矩看得比命还重。言语不多，行动永远可靠，坚守门户，待人宽厚，认准的人和地方，便会拼尽全力守护。说话带山东腔，喜欢说"俺""咱""好生""莫慌"，开口就是靠得住的感觉。',
    flaw: '过于认死理，认准规矩很难变通；不善言辞，安慰人只会默默站在一旁。',
    quirk: '大半时日都守在客栈大门；坐姿端正；会默默记住每一位熟客样貌。',
    dialect: '山东话',
    dialectNote: '常用"俺"（我）、"咱"（我们）、"好生"（好好地）、"莫慌"（别急）、"中不中"（行不行）、"啥"（什么）、"安稳"。',
    story: '忠犬护主早年是戍守边关的老兵，在沙场历经风霜。年岁已高退伍之后，辞别边关，一路向南漂泊，机缘巧合走到江湖客栈门前。老板娘看见他身姿挺拔稳重，随口一句"你站在门口，再合适不过"，就此把他留下担任门房。自此无论刮风下雨，严寒酷暑，他日日驻守客栈大门，寸步不离。江湖坊间流传，只要忠犬护主守在门前，宵小毛贼，绝不敢踏入客栈半步。他心性认死理，一旦认定这个地方，便打算守护到老。',
    dialogs: [
      '俺是忠犬护主，这客栈门房。进来吧，好生歇着。',
      '莫慌，有俺在门口，恁睡踏实。',
      '咱这人，认死理，认了这客栈，就守到老。'
    ],
    extraDialogs: [
      '只管好生歇息，门外的事，交给俺就中。',
      '咱没多大本事，守住这扇门，守住客栈众人安稳，就够。',
      '不管外头风雨多大，进了这道门，便是安稳地界。',
    ],
    dailyTopics: [
      '守在大门口，把来往的人都记在心里',
      '今夜风雨不小，门闩又紧了一道',
      '这位客人是熟面孔，上次也是这个时辰来的',
      '帮客人把行李搬进门，顺手掸了掸灰',
    ],
    pastTales: [
      '戍守边关那些年，风沙里站惯了岗',
      '退伍后一路向南漂泊，走到了客栈门口',
      '老板娘一句"你站门口最合适"，就把俺留下了',
      '江湖上那句"有他在门口，客栈里就没贼"',
    ],
    awakening: {
      name: '守护·觉醒',
      desc: '开局护盾从 1 个增至 2 个，且撞墙免死次数从 1 次增至 2 次。',
      effect: { shieldCount: 2, wallGuardCount: 2 }
    }
  },
  zhu: {
    id: 'zhu', skinId: 'zhu', name: '猪事顺利', emoji: '🐷',
    title: '客栈厨娘',
    roomPos: { x: 62, y: 90 },
    personality: '憨厚、乐观、乐天派，很少发愁。最大爱好便是品尝美食，乐于分享热腾腾的饭菜。心肠宽厚，待人热忱，烟火气十足。说话带湖南腔，喜欢说"呷""好呷""咯""莫"，一开口就是热乎乎的饭菜香。',
    flaw: '心宽体胖，偶尔犯迷糊记性差；见不得旁人挨饿，哪怕手头食材有限，也总想多分给别人。',
    quirk: '厨房里永远飘香气；擅长腌腊肉；看见客人吃得开心就满心欢喜。',
    dialect: '湖南话',
    dialectNote: '常用"呷"（吃）、"好呷"（好吃）、"咯"（语气词）、"莫"（不要）、"要得"（行）、"哈"（傻）、"香得很"。',
    story: '猪事顺利出身乡下农家，家中世代养猪腌制腊肉，练出一手远近闻名的好厨艺。不甘心困于一方乡土，她挑着满满一担子自家熏制腊肉，孤身一人闯荡江湖，四处游历。一路兜兜转转，最终落脚江湖客栈。她常挂嘴边一句话：世间再大的事情都可以往后放一放，唯独饭点万万不能耽误。她烹制的红烧肉色泽红亮肥而不腻，是江湖客栈响当当的招牌菜。来往江湖侠客走南闯北，很多人专门赶来，就为吃上一口她做的热菜。',
    dialogs: [
      '呷饭了冇？俺是猪事顺利，客栈厨娘，好呷的嘞。',
      '咯个红烧肉刚出锅，莫客气，呷多点。',
      '天下大事都能等，呷饭等不得。'
    ],
    extraDialogs: [
      '莫要饿到肚子咯！人是铁饭是钢，再大烦恼，吃饱再说！',
      '来来来，再加一块肉！客气啥子咯！',
      '江湖漂泊多辛苦，能吃上一口热乎饭菜，便是福气。',
    ],
    dailyTopics: [
      '厨房里香气直往外飘，红烧肉刚出锅',
      '新腌的腊肉挂在檐下，晒得油亮',
      '客人呷饱了冇，要不要再添一碗饭',
      '天大的事都能等，呷饭等不得',
    ],
    pastTales: [
      '乡下农家世代养猪腌腊肉，练出一手好厨艺',
      '挑着一担腊肉孤身闯江湖，一路兜兜转转',
      '落脚客栈，红烧肉成了响当当的招牌',
      '见不得旁人挨饿，宁可自己少吃一口',
    ],
    awakening: {
      name: '福气·觉醒',
      desc: '食物分数加成从 +20% 提升至 +35%，速度惩罚从 -5% 降至 -2%。',
      effect: { foodBonus: 0.35, speedPenalty: 0.02 }
    }
  }
};

// 好感度 → 等级（0=初识 1=熟络 2=知己 3=挚友）
function getInnTier(affinity) {
  if (affinity >= 300) return 3;
  if (affinity >= 200) return 2;
  if (affinity >= 100) return 1;
  return 0;
}
const INN_TIER_NAMES = ['初识', '熟络', '知己', '挚友'];