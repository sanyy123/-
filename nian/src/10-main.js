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
  scene: [MenuScene, ShopScene, LoadoutScene, GameScene],
});

// 供自动化测试 / 调试使用
window.__game = window.game;
