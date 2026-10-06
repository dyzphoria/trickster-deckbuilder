import Phaser from 'phaser'
import { CARDS, VILLAGERS } from './cards.ts'
import type { CardDef, VillagerDef } from './cards.ts'

const W = 1280
const H = 720
const CARD_W = 160
const CARD_H = 210
const MAX_HAND = 5
const FONT = 'Georgia, "Times New Roman", "Segoe UI Emoji", "Noto Color Emoji", serif'

type VState = 'devoted' | 'neutral' | 'suspicious'

interface Villager {
  def: VillagerDef
  belief: number
  x: number
  y: number
  container: Phaser.GameObjects.Container
  border: Phaser.GameObjects.Graphics
  bar: Phaser.GameObjects.Graphics
  beliefText: Phaser.GameObjects.Text
  stateText: Phaser.GameObjects.Text
}

interface HandCard {
  def: CardDef
  container: Phaser.GameObjects.Container
  homeX: number
  homeY: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function stateOf(belief: number): VState {
  if (belief >= 70) return 'devoted'
  if (belief <= 25) return 'suspicious'
  return 'neutral'
}

function stateLabel(s: VState): string {
  if (s === 'devoted') return 'Devoted 💚'
  if (s === 'suspicious') return 'Suspicious ⚠️'
  return 'Neutral 😐'
}

function stateColor(s: VState): number {
  if (s === 'devoted') return 0x4ade80
  if (s === 'suspicious') return 0xef4444
  return 0xe8d9a0
}

export class GameScene extends Phaser.Scene {
  private villagers: Villager[] = []
  private hand: HandCard[] = []
  private paradox = 20
  private gameOver = false
  private paradoxBar!: Phaser.GameObjects.Graphics
  private paradoxText!: Phaser.GameObjects.Text
  private logText!: Phaser.GameObjects.Text

  constructor() {
    super('game')
  }

  create(): void {
    this.villagers = []
    this.hand = []
    this.paradox = 20
    this.gameOver = false

    this.add
      .text(24, 20, 'TRICKSTER 🎭', { fontFamily: FONT, fontSize: '22px', color: '#d4af37' })
      .setOrigin(0, 0)
    this.logText = this.add
      .text(24, 52, 'Drag lies onto villagers. SPACE draws a card.', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#7fb8a8',
      })
      .setOrigin(0, 0)

    this.add
      .text(640, 26, 'PARADOX', { fontFamily: FONT, fontSize: '13px', color: '#e8d9a0' })
      .setOrigin(0.5)
    this.paradoxBar = this.add.graphics()
    this.paradoxText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#e8d9a0' })
    this.redrawParadox()

    VILLAGERS.forEach((def, i) => this.makeVillager(def, 310 + i * 330, 250))

    this.makeDeck(1160, 600)

    this.input.on(
      'dragstart',
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
        if (this.gameOver) return
        const hc = obj.getData('hc') as HandCard | undefined
        if (!hc) return
        obj.setData('dragging', true)
        this.children.bringToTop(obj)
        this.tweens.add({ targets: obj, scale: 1.08, duration: 100 })
      }
    )

    this.input.on(
      'drag',
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, dx: number, dy: number) => {
        if (this.gameOver) return
        const hc = obj.getData('hc') as HandCard | undefined
        if (!hc) return
        obj.x = dx
        obj.y = dy
        const over = this.villagerAt(obj.x, obj.y)
        this.villagers.forEach(v => {
          v.container.setScale(over === v ? 1.05 : 1)
        })
      }
    )

    this.input.on(
      'dragend',
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
        const hc = obj.getData('hc') as HandCard | undefined
        if (!hc) return
        obj.setData('dragging', false)
        obj.setScale(1)
        this.villagers.forEach(v => v.container.setScale(1))
        const over = this.villagerAt(obj.x, obj.y)
        if (over && !this.gameOver) {
          this.playCardOn(over, hc)
        } else {
          this.tweens.add({ targets: obj, x: hc.homeX, y: hc.homeY, duration: 200, ease: 'Cubic.out' })
        }
      }
    )

    this.input.keyboard!.on('keydown-SPACE', () => this.drawCard())

    this.time.delayedCall(150, () => this.drawCard())
    this.time.delayedCall(300, () => this.drawCard())
    this.time.delayedCall(450, () => this.drawCard())
  }

  private villagerAt(x: number, y: number): Villager | undefined {
    return this.villagers.find(v => Math.abs(x - v.x) <= 130 && Math.abs(y - v.y) <= 150)
  }

  private makeVillager(def: VillagerDef, x: number, y: number): void {
    const border = this.add.graphics()
    const bar = this.add.graphics()
    const emoji = this.add
      .text(0, -70, def.emoji, { fontFamily: FONT, fontSize: '52px' })
      .setOrigin(0.5)
    const name = this.add
      .text(0, -18, def.name, { fontFamily: FONT, fontSize: '17px', color: '#e8d9a0', fontStyle: 'bold' })
      .setOrigin(0.5)
    const beliefText = this.add
      .text(0, 30, '', { fontFamily: FONT, fontSize: '14px', color: '#e8d9a0' })
      .setOrigin(0.5)
    const stateText = this.add
      .text(0, 60, '', { fontFamily: FONT, fontSize: '15px' })
      .setOrigin(0.5)
    const container = this.add.container(x, y, [border, emoji, name, bar, beliefText, stateText])
    const v: Villager = { def, belief: def.belief, x, y, container, border, bar, beliefText, stateText }
    this.villagers.push(v)
    this.updateVillagerVisual(v)
  }

  private updateVillagerVisual(v: Villager): void {
    const s = stateOf(v.belief)
    v.border.clear()
    v.border.fillStyle(0x0e2a24, 0.9)
    v.border.fillRoundedRect(-120, -130, 240, 260, 16)
    v.border.lineStyle(3, stateColor(s), 1)
    v.border.strokeRoundedRect(-120, -130, 240, 260, 16)
    v.bar.clear()
    v.bar.fillStyle(0x06110e, 1)
    v.bar.fillRoundedRect(-70, 14, 140, 12, 6)
    v.bar.fillStyle(stateColor(s), 1)
    v.bar.fillRoundedRect(-70, 14, Math.max(1.4 * v.belief, 6), 12, 6)
    v.beliefText.setText(`${Math.round(v.belief)}/100`)
    v.stateText.setText(stateLabel(s))
    v.stateText.setColor(s === 'devoted' ? '#4ade80' : s === 'suspicious' ? '#ef4444' : '#e8d9a0')
  }

  private makeDeck(x: number, y: number): void {
    const stack = this.add.graphics()
    for (let i = 2; i >= 0; i--) {
      stack.fillStyle(0x0e2a24, 1)
      stack.fillRoundedRect(-55 + i * 3, -75 + i * 3, 110, 150, 10)
      stack.lineStyle(2, 0xd4af37, 0.8)
      stack.strokeRoundedRect(-55 + i * 3, -75 + i * 3, 110, 150, 10)
    }
    const label = this.add
      .text(0, 0, '🎴\nDRAW\nSPACE', { fontFamily: FONT, fontSize: '15px', color: '#e8d9a0', align: 'center' })
      .setOrigin(0.5)
    const c = this.add.container(x, y, [stack, label])
    c.setSize(110, 150)
    c.setInteractive(new Phaser.Geom.Rectangle(-55, -75, 110, 150), Phaser.Geom.Rectangle.Contains)
    c.on('pointerdown', () => this.drawCard())
  }

  private makeCard(def: CardDef, x: number, y: number): HandCard {
    const bg = this.add.graphics()
    bg.fillStyle(0x0e2a24, 0.95)
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12)
    bg.lineStyle(2, 0xd4af37, 0.9)
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12)
    const glyph = this.add
      .text(0, -68, def.glyph, { fontFamily: FONT, fontSize: '40px' })
      .setOrigin(0.5)
    const name = this.add
      .text(0, -28, def.name, {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#d4af37',
        fontStyle: 'bold',
        wordWrap: { width: CARD_W - 20 },
      })
      .setOrigin(0.5)
    const desc = this.add
      .text(0, 14, def.desc, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#9fc7b8',
        align: 'center',
        wordWrap: { width: CARD_W - 24 },
      })
      .setOrigin(0.5)
    const beliefStr = def.belief >= 0 ? `💭 +${def.belief}` : `💭 ${def.belief}`
    const paradoxStr = def.paradox >= 0 ? `🌀 +${def.paradox}` : `🌀 ${def.paradox}`
    const stats = this.add
      .text(0, 82, `${beliefStr}   ${paradoxStr}`, { fontFamily: FONT, fontSize: '13px', color: '#e8d9a0' })
      .setOrigin(0.5)
    const container = this.add.container(x, y, [bg, glyph, name, desc, stats])
    container.setSize(CARD_W, CARD_H)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains
    )
    this.input.setDraggable(container)
    const hc: HandCard = { def, container, homeX: x, homeY: y }
    container.setData('hc', hc)
    return hc
  }

  private drawCard(): void {
    if (this.gameOver) return
    if (this.hand.length >= MAX_HAND) {
      this.setLog('Hand is full — play something first.')
      return
    }
    const pool = CARDS.filter(c => !this.hand.some(h => h.def.id === c.id))
    const source = pool.length > 0 ? pool : CARDS
    const total = source.reduce((a, c) => a + c.weight, 0)
    let r = Math.random() * total
    let def = source[source.length - 1]
    for (const c of source) {
      r -= c.weight
      if (r <= 0) {
        def = c
        break
      }
    }
    const hc = this.makeCard(def, 1160, 600)
    this.hand.push(hc)
    this.layoutHand()
    this.children.bringToTop(hc.container)
  }

  private layoutHand(): void {
    const n = this.hand.length
    this.hand.forEach((hc, i) => {
      hc.homeX = 640 + (i - (n - 1) / 2) * 185
      hc.homeY = 600
      if (hc.container.getData('dragging')) return
      this.tweens.add({ targets: hc.container, x: hc.homeX, y: hc.homeY, duration: 220, ease: 'Cubic.out' })
    })
  }

  private playCardOn(v: Villager, hc: HandCard): void {
    const def = hc.def
    this.hand = this.hand.filter(h => h !== hc)
    let belief = def.belief
    if (def.flatter && stateOf(v.belief) === 'suspicious') belief += 14
    v.belief = clamp(v.belief + belief, 0, 100)
    this.paradox = clamp(this.paradox + def.paradox, 0, 100)
    this.setLog(`${def.glyph} ${def.name} → ${v.def.name}`)
    this.updateVillagerVisual(v)
    this.redrawParadox()
    this.tweens.add({
      targets: hc.container,
      x: v.x,
      y: v.y,
      scale: 0.3,
      alpha: 0,
      duration: 240,
      ease: 'Cubic.in',
      onComplete: () => hc.container.destroy(),
    })
    if (this.paradox >= 100) {
      this.time.delayedCall(280, () => {
        this.glitch()
        this.checkEnd()
      })
    } else {
      this.checkEnd()
      if (!this.gameOver) this.time.delayedCall(280, () => this.drawCard())
    }
  }

  private glitch(): void {
    this.cameras.main.shake(280, 0.012)
    const v = this.villagers[Math.floor(Math.random() * this.villagers.length)]
    v.belief = Math.floor(Math.random() * 71) + 20
    this.paradox = 45
    this.setLog(`⚡ REALITY GLITCHES — ${v.def.name} remembers a different life.`)
    this.updateVillagerVisual(v)
    this.redrawParadox()
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0x35f0a8, 0.25).setDepth(90)
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() })
  }

  private checkEnd(): boolean {
    if (this.gameOver) return true
    if (this.villagers.every(v => stateOf(v.belief) === 'devoted')) {
      this.endGame(true)
      return true
    }
    if (this.villagers.every(v => stateOf(v.belief) === 'suspicious')) {
      this.endGame(false)
      return true
    }
    return false
  }

  private endGame(win: boolean): void {
    this.gameOver = true
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x030a08, 0).setDepth(100)
    this.tweens.add({ targets: shade, alpha: 0.88, duration: 500 })
    this.add
      .text(W / 2, H / 2 - 60, win ? 'THE VILLAGE BELIEVES 🏆' : 'BANISHED 🌑', {
        fontFamily: FONT,
        fontSize: '44px',
        color: win ? '#4ade80' : '#ef4444',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(101)
    this.add
      .text(
        W / 2,
        H / 2 + 10,
        win ? 'They would follow you into Ragnarök itself.' : 'The elders saw through every lie.',
        { fontFamily: FONT, fontSize: '18px', color: '#e8d9a0' }
      )
      .setOrigin(0.5)
      .setDepth(101)
    const again = this.add
      .text(W / 2, H / 2 + 70, '[ R ] play again', { fontFamily: FONT, fontSize: '16px', color: '#d4af37' })
      .setOrigin(0.5)
      .setDepth(101)
    again.setInteractive({ useHandCursor: true })
    again.on('pointerdown', () => this.scene.restart())
    this.input.keyboard!.once('keydown-R', () => this.scene.restart())
    this.setLog(win ? 'Victory.' : 'Defeat.')
  }

  private redrawParadox(): void {
    const g = this.paradoxBar
    g.clear()
    const w = 400
    g.fillStyle(0x06110e, 1)
    g.fillRoundedRect(640 - w / 2, 36, w, 18, 8)
    const p = this.paradox / 100
    const col = this.paradox < 40 ? 0x4ade80 : this.paradox < 75 ? 0xd4af37 : 0xef4444
    if (p > 0.01) {
      g.fillStyle(col, 1)
      g.fillRoundedRect(640 - w / 2, 36, Math.max(w * p, 16), 18, 8)
    }
    g.lineStyle(1, 0xd4af37, 0.5)
    g.strokeRoundedRect(640 - w / 2, 36, w, 18, 8)
    this.paradoxText.setPosition(640 + w / 2 + 14, 45).setOrigin(0, 0.5).setText(`${Math.round(this.paradox)}%`)
  }

  private setLog(msg: string): void {
    this.logText.setText(msg)
    this.logText.setAlpha(1)
    this.tweens.killTweensOf(this.logText)
    this.tweens.add({ targets: this.logText, alpha: 0.35, delay: 3500, duration: 900 })
  }
}
