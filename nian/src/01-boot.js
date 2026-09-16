/* ============================================================================
   棋盘枪手 · 斜俯视四方向自动射击
   ----------------------------------------------------------------------------
   文件结构（从上到下）：
     CONFIG / 敌人表 / 道具表 / 武器表 / 角色表 / 技能表 —— 所有可调数值集中在这里
     Storage                    —— localStorage 读写（最高分 / 静音 / 战绩 / 金币 / 整备）
     BOARD / DIRS / Utils       —— 场地派生常量与坐标换算
     SoundSys                   —— 程序化音效（WebAudio 合成，无音频文件）
     Textures                   —— 程序化纹理生成
     UI                         —— 通用按钮工厂
     GUIDE_DATA                 —— 指南文案数据
     MenuScene / ShopScene / LoadoutScene / GameScene —— 四个场景
   ============================================================================ */

if (typeof Phaser === 'undefined') {
  // 不再整页替换 innerHTML —— 手机上那样会把竖屏提示一起冲掉，
  // 而且玩家看到的是一屏纯文字、没有任何重试入口
  var bootTxt = document.getElementById('boot-text');
  var bootRing = document.querySelector('#boot-splash .ring');
  if (bootRing) bootRing.style.display = 'none';
  if (bootTxt) {
    bootTxt.className = 'err';
    bootTxt.innerHTML = 'Phaser 引擎没能从 CDN 加载成功<br>请检查网络后刷新页面';
  }
  throw new Error('Phaser engine failed to load');
}
// 引擎到位了，撤掉启动页（后面由场景自己的加载进度条接管）
document.body.classList.add('booted');

/* ============================================================================
   画质档位
   ----------------------------------------------------------------------------
   手机（尤其是千元机）扛不住"满配粒子 + 每帧重绘的天气特效"。
   判据刻意用"逻辑核少 **且** 屏幕小或触摸设备"，两个都满足才降档 ——
   只按核数会把高分屏平板误判成低端机，只按屏幕大小又会把桌面小窗口误判。
   降档只影响**视觉密度**，不改任何数值 / 判定 / 玩法。
   ============================================================================ */
const PERF = (() => {
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const scr = (typeof window !== 'undefined' && window.screen) || null;
  const shortSide = scr ? Math.min(scr.width || 9999, scr.height || 9999) : 9999;
  let coarse = false;
  try {
    coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch (e) { coarse = false; }
  const low = cores <= 4 && (shortSide <= 480 || coarse);
  return {
    low,
    particles: low ? 0.5 : 1,   // 火花粒子数量倍率（explode 的 count 统一乘它）
    // 雨 / 雪是 TileSprite，没有"粒子个数"可调，只能改贴图缩放：
    // tileScale 越大 = 同一块屏上重复的次数越少 = 雨丝越稀。
    // 这里直接存最终要喂给 setTileScale 的值，避免再套一层倒数算错
    rainScale: low ? 1.5 : 1,
    snowScale: low ? 1.7 : 1,
    // 背景的草叶 / 斑块条数倍率。buildBackground 是几百次 draw call
    // 一次性烘进 Graphics，低配机上省的是创建耗时和显存
    deco: low ? 0.55 : 1,
    ambient: !low,              // 环境浮尘只有高配才开（纯装饰）
  };
})();

