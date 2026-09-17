/* ============================================================================
   启动
   ============================================================================ */
SoundSys.installUnlockOnFirstGesture();

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  width: CONFIG.width,
  height: CONFIG.height,
  parent: 'game-root',
  backgroundColor: '#060b12',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },
  // 场景顺序：菜单 → 商城 → 装备 → 双人整备 → 游戏。
  // TwoPlayer 必须显式注册，否则主菜单的「双人模式」按钮会直接抛
  // "Scene not found: TwoPlayer"
  scene: [MenuScene, ShopScene, LoadoutScene, TwoPlayerScene, GameScene],
});

// 供自动化测试 / 调试使用
window.__game = window.game;

/* 引擎创建完成后再量一次视口。
   原因：ScaleManager 是在构造时按父容器尺寸算缩放的，而 index.html 里那段
   视口脚本跑在 Phaser 之前 —— 它改完尺寸时引擎还不存在，没法 refresh。
   这里补一次，保证画布严格贴合"真正可见"的区域，iPhone 横屏下
   上下不再被浏览器工具栏切掉。 */
if (typeof window.__fitViewport === 'function') {
  window.__fitViewport();
  // 首帧渲染完再补一次：iOS 上工具栏收起/展开会让可视高度再变一次
  window.addEventListener('load', function () { window.__fitViewport(); });
}
