import Phaser from 'phaser'
import { GameScene } from './game.ts'
import './style.css'

const portrait = window.innerWidth < window.innerHeight

new Phaser.Game({
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
