import Phaser from 'phaser'
import { GameScene } from './game.ts'
import './style.css'

const portrait = window.innerWidth < window.innerHeight

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: portrait ? 720 : 1280,
  height: portrait ? 1280 : 720,
  backgroundColor: '#0b1f1c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
})

// Mobile browsers resize the visible viewport when the URL bar hides/shows —
// re-fit the canvas whenever that happens so nothing drifts off-screen.
window.visualViewport?.addEventListener('resize', () => game.scale.refresh())

// Rotate the phone = different layout. Clean reload beats half-updated scenes.
window.addEventListener('orientationchange', () => {
  const nowPortrait = window.innerWidth < window.innerHeight
  if (nowPortrait !== portrait) location.reload()
})
