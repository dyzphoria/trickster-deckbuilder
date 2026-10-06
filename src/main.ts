import Phaser from 'phaser'
import { GameScene } from './game.ts'
import './style.css'

function designSize(): { width: number; height: number } {
  const w = window.innerWidth
  const h = window.innerHeight
  if (w < h) {
    // Portrait: design at ~1:1 CSS-pixel scale so font sizes mean what they say.
    const dw = 360
    const dh = Math.round((dw * h) / w)
    return { width: dw, height: Math.min(Math.max(dh, 600), 1000) }
  }
  return { width: 1280, height: 720 }
}

const size = designSize()
const portrait = size.width < size.height

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: size.width,
  height: size.height,
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
