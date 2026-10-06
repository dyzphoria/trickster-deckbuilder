import Phaser from 'phaser'
import { starterDeck, VILLAGERS } from './cards.ts'
import type { CardDef, VillagerDef } from './cards.ts'

const CARD_W = 160
const CARD_H = 210
const MAX_HAND = 5
const FONT = '[ADDRESS], "Times New Roman", "Segoe UI Emoji", "Noto Color Emoji", serif'

type VState = 'devoted' | 'wary' | 'skeptical' | 'curious'
type Stance = 'fox' | 'serpent' | 'crone' | null

interface Mul {
  belief: number
  paradox: number
  doubt: number
}

interface Villager {
  def: VillagerDef
  belief: number
  suspicion: number
  claims: Map<string, string>
  devoted: boolean
  x: number
  y: number
  container: Phaser.GameObjects.Container
  border: Phaser.GameObjects.Graphics
  bar: Phaser.GameObjects.Graphics
  statsText: Phaser.GameObjects.Text
  stateText: Phaser.GameObjects.Text
  claimsText: Phaser.GameObjects.Text
}

interface HandCard {
  def: CardDef
  container: Phaser.GameObjects.Container
  homeX: number
  homeY: number
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, n))
}

function stateOf(v: { belief: number; suspicion: number; devoted: boolean }): VState {
  if (v.devoted) return 'devoted'
  if (v.suspicion >= 70) return 'wary'
  if (v.belief <= 25) return 'skeptical'
  return 'curious'
}

function stateLabel(s: VState): string {
  if (s === 'devoted') return 'Devoted 💚'
  if (s === 'wary') return 'Wary ⚠️'
  if (s === 'skeptical') return 'Skeptical 🤨'
  return 'Curious 🙂'
}

function stateColor(s: VState): number {
  if (s === 'devoted') return 0xd4af37
  if (s === 'wary') return 0xef4444
  if (s === 'skeptical') return 0xb249f8
  return 0x4ade80
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class GameScene extends Phaser.Scene {
  private villagers: Villager[] = []
  private hand: HandCard[] = []
  private deck: CardDef[] = []
  private discard: CardDef[] = []
  private paradox = 20
  private day = 1
  private bluff = 3
  private stance: Stance = null
  private gameOver = false
  private gw = 1280
  private gh = 720
  private portrait = false
  private deckX = 1160
  private deckY = 600
  private paradoxBar!: Phaser.GameObjects.Graphics
  private paradoxText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private stanceText!: Phaser.GameObjects.Text
  private logText!: Phaser.GameObjects.Text
  private deckInfo!: Phaser.GameObjects.Text

  constructor() {
    super('game')
  }

  create(): void {
    this.villagers = []
    this.hand = []
    this.discard = []
    this.deck = shuffle(starterDeck())
    this.paradox = 20
    this.day = 1
    this.bluff = 3
    this.stance = null
    this.gameOver = false
    this.gw = this.scale.width
    this.gh = this.scale.height
    this.portrait = this.gw < this.gh
    this.deckX = this.portrait ? this.gw - 90 : 1160
    this.deckY = this.portrait ? 170 : 600

    this.add
      .text(24, 16, 'TRICKSTER 🎭', { fontFamily: FONT, fontSize: '20px', color: '#d4af37' })
      .setOrigin(0, 0)
    this.statusText = this.add
      .text(24, 44, '', { fontFamily: FONT, fontSize: '15px', color: '#e8d9a0' })
      .setOrigin(0, 0)
    this.stanceText = this.portrait
      ? this.add.text(24, 62, '', { fontFamily: FONT, fontSize: '14px', color: '#7fb8a8' }).setOrigin(0, 0)
      : this.add.text(this.gw - 24, 44, '', { fontFamily: FONT, fontSize: '14px', color: '#7fb8a8' }).setOrigin(1, 0)
    this.logText = this.add
      .text(24, this.portrait ? 88 : 72, 'Draw lies. Spend Bluff. Contradict nothing — or everything.', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#7fb8a8',
        wordWrap: { width: this.gw - 160 },
      })
      .setOrigin(0, 0)

    this.add
      .text(this.gw / 2, 26, 'PARADOX', { fontFamily: FONT, fontSize: '13px', color: '#e8d9a0' })
      .setOrigin(0.5)
    this.paradoxBar = this.add.graphics()
    this.paradoxText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#e8d9a0' })
    this.redrawParadox()

    VILLAGERS.forEach((def, i) => {
      if (this.portrait) this.makeVillager(def, this.gw / 2, 300 + i * 310)
      else this.makeVillager(def, 310 + i * 330, 250)
    })

    this.makeDeck(this.deckX, this.deckY)
    this.makeEndTurn()

    this.input.on('dragstart', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (this.gameOver) return
      const hc = obj.getData('hc') as HandCard | undefined
      if (!hc) return
      obj.setData('dragging', true)
      this.children.bringToTop(obj)
      this.tweens.add({ targets: obj, scale: 1.08, duration: 100 })
    })

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

    this.input.on('dragend', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      const hc = obj.getData('hc') as HandCard | undefined
      if (!hc) return
      obj.setData('dragging', false)
      obj.setScale(1)
      this.villagers.forEach(v => v.container.setScale(1))
      const over = this.villagerAt(obj.x, obj.y)
      if (over && !this.gameOver) {
        if (this.tryPlay(over, hc)) {
          this.tweens.add({
            targets: obj,
            x: over.x,
            y: over.y,
            scale: 0.3,
            alpha: 0,
            duration: 240,
            ease: 'Cubic.in',
            onComplete: () => obj.destroy(),
          })
          return
        }
      }
      this.tweens.add({ targets: obj, x: hc.homeX, y: hc.homeY, duration: 200, ease: 'Cubic.out' })
    })

    this.input.keyboard!.on('keydown-SPACE', () => this.drawCard())
    this.input.keyboard!.on('keydown-E', () => this.endTurn())

    for (let i = 0; i < MAX_HAND; i++) this.time.delayedCall(120 * i, () => this.drawCard())
    this.updateStatus()
  }

  private villagerAt(x: number, y: number): Villager | undefined {
    return this.villagers.find(v => Math.abs(x - v.x) <= 130 && Math.abs(y - v.y) <= 150)
  }

  private makeVillager(def: VillagerDef, x: number, y: number): void {
    const border = this.add.graphics()
    const bar = this.add.graphics()
    const emoji = this.add.text(0, -80, def.emoji, { fontFamily: FONT, fontSize: '46px' }).setOrigin(0.5)
    const name = this.add
      .text(0, -34, def.name, { fontFamily: FONT, fontSize: '18px', color: '#e8d9a0', fontStyle: 'bold' })
      .setOrigin(0.5)
    const statsText = this.add
      .text(0, 44, '', { fontFamily: FONT, fontSize: '14px', color: '#9fc7b8' })
      .setOrigin(0.5)
    const stateText = this.add.text(0, 66, '', { fontFamily: FONT, fontSize: '16px' }).setOrigin(0.5)
    const claimsText = this.add
      .text(0, 92, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#7d8f87',
        align: 'center',
        wordWrap: { width: 210 },
      })
      .setOrigin(0.5, 0)
    const container = this.add.container(x, y, [border, emoji, name, bar, statsText, stateText, claimsText])
    const v: Villager = {
      def,
      belief: def.belief,
      suspicion: def.suspicion,
      claims: new Map(),
      devoted: false,
      x,
      y,
      container,
      border,
      bar,
      statsText,
      stateText,
      claimsText,
    }
    this.villagers.push(v)
    this.updateVillagerVisual(v)
  }

  private updateVillagerVisual(v: Villager): void {
    const s = stateOf(v)
    v.border.clear()
    v.border.fillStyle(0x0e2a24, 0.9)
    v.border.fillRoundedRect(-120, -130, 240, 260, 16)
    v.border.lineStyle(3, stateColor(s), 1)
    v.border.strokeRoundedRect(-120, -130, 240, 260, 16)
    v.bar.clear()
    v.bar.fillStyle(0x06110e, 1)
    v.bar.fillRoundedRect(-80, 2, 160, 10, 5)
    v.bar.fillRoundedRect(-80, 22, 160, 10, 5)
    v.bar.fillStyle(v.devoted ? 0xd4af37 : 0x4ade80, 1)
    v.bar.fillRoundedRect(-80, 2, Math.max(4, 1.6 * v.belief), 10, 5)
    v.bar.fillStyle(v.suspicion >= 70 ? 0xef4444 : 0xb249f8, 1)
    v.bar.fillRoundedRect(-80, 22, Math.max(4, 1.6 * v.suspicion), 10, 5)
    v.statsText.setText(`💭 ${Math.round(v.belief)}  ·  ⚠️ ${Math.round(v.suspicion)}`)
    v.stateText.setText(stateLabel(s))
    v.stateText.setColor(
      '#' + stateColor(s).toString(16).padStart(6, '0')
    )
    const claims = [...v.claims.values()]
    v.claimsText.setText(claims.length > 0 ? `swears by: ${claims.join(', ')}` : '')
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
      .text(0, -10, '🎴\nDRAW\nSPACE', { fontFamily: FONT, fontSize: '15px', color: '#e8d9a0', align: 'center' })
      .setOrigin(0.5)
    this.deckInfo = this.add
      .text(0, 92, '', { fontFamily: FONT, fontSize: '13px', color: '#7d8f87' })
      .setOrigin(0.5)
    const c = this.add.container(x, y, [stack, label, this.deckInfo])
    c.setSize(110, 150)
    c.setInteractive(new Phaser.Geom.Rectangle(-55, -75, 110, 150), Phaser.Geom.Rectangle.Contains)
    c.on('pointerdown', () => this.drawCard())
    this.updateDeckInfo()
  }

  private updateDeckInfo(): void {
    this.deckInfo.setText(`deck ${this.deck.length} · used ${this.discard.length}`)
  }

  private makeEndTurn(): void {
    const x = this.portrait ? this.gw - 90 : 1150
    const y = this.portrait ? 1010 : 440
    const g = this.add.graphics()
    g.fillStyle(0x0e2a24, 1)
    g.fillRoundedRect(-60, -25, 120, 50, 12)
    g.lineStyle(2, 0xd4af37, 0.9)
    g.strokeRoundedRect(-60, -25, 120, 50, 12)
    const label = this.add
      .text(0, 0, 'End Turn\n+3 ⚡', { fontFamily: FONT, fontSize: '15px', color: '#e8d9a0', align: 'center' })
      .setOrigin(0.5)
    const c = this.add.container(x, y, [g, label])
    c.setSize(120, 50)
    c.setInteractive(new Phaser.Geom.Rectangle(-60, -25, 120, 50), Phaser.Geom.Rectangle.Contains)
    c.on('pointerdown', () => this.endTurn())
  }

  private makeCard(def: CardDef, x: number, y: number): HandCard {
    const bg = this.add.graphics()
    bg.fillStyle(0x0e2a24, 0.95)
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12)
    bg.lineStyle(2, 0xd4af37, 0.9)
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12)
    const glyph = this.add.text(0, -70, def.glyph, { fontFamily: FONT, fontSize: '36px' }).setOrigin(0.5)
    const cost = this.add
      .text(CARD_W / 2 - 16, -CARD_H / 2 + 14, `⚡${def.cost}`, { fontFamily: FONT, fontSize: '14px', color: '#e8d9a0' })
      .setOrigin(0.5)
    const name = this.add
      .text(0, -30, def.name, {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#d4af37',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: CARD_W - 16 },
      })
      .setOrigin(0.5)
    const desc = this.add
      .text(0, 14, def.desc, {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#9fc7b8',
        align: 'center',
        wordWrap: { width: CARD_W - 22 },
      })
      .setOrigin(0.5)
    const bStr = def.belief >= 0 ? `+${def.belief}` : `${def.belief}`
    const sStr = def.suspicion >= 0 ? `+${def.suspicion}` : `${def.suspicion}`
    const pStr = def.paradox >= 0 ? `+${def.paradox}` : `${def.paradox}`
    const stats = this.add
      .text(0, 82, `💭 ${bStr}  ⚠️ ${sStr}  🌀 ${pStr}`, { fontFamily: FONT, fontSize: '13px', color: '#e8d9a0' })
      .setOrigin(0.5)
    const container = this.add.container(x, y, [bg, glyph, cost, name, desc, stats])
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
    if (this.deck.length === 0) {
      if (this.discard.length === 0) {
        this.setLog('Out of cards. The village has heard it all.')
        return
      }
      this.deck = shuffle(this.discard)
      this.discard = []
      this.setLog('Old lies resurface from the discard.')
    }
    const def = this.deck.splice(Math.floor(Math.random() * this.deck.length), 1)[0]
    const hc = this.makeCard(def, this.deckX, this.deckY)
    this.hand.push(hc)
    this.layoutHand()
    this.children.bringToTop(hc.container)
    this.updateDeckInfo()
  }

  private layoutHand(): void {
    const n = this.hand.length
    this.hand.forEach((hc, i) => {
      hc.homeX = this.gw / 2 + (i - (n - 1) / 2) * (this.portrait ? 130 : 185)
      hc.homeY = this.gh - 120
      if (hc.container.getData('dragging')) return
      this.tweens.add({ targets: hc.container, x: hc.homeX, y: hc.homeY, duration: 220, ease: 'Cubic.out' })
    })
  }

  private stanceMul(): Mul {
    if (this.stance === 'fox') return { belief: 0.75, paradox: 0.5, doubt: 0.75 }
    if (this.stance === 'serpent') return { belief: 1.5, paradox: 1.25, doubt: 1.5 }
    if (this.stance === 'crone') return { belief: 0.6, paradox: 1, doubt: 0.5 }
    return { belief: 1, paradox: 1, doubt: 1 }
  }

  private tryPlay(v: Villager, hc: HandCard): boolean {
    const def = hc.def
    if (this.gameOver) return false
    if (this.bluff < def.cost) {
      this.floatText(v, 'Not enough Bluff ⚡', '#ef4444', -40)
      this.setLog('Not enough Bluff. End the turn to recover.')
      return false
    }
    if (def.stance) {
      this.bluff -= def.cost
      const replaced = this.stance !== null
      this.stance = def.stance
      this.setLog(
        replaced
          ? `You slip into a new shape: ${def.glyph} ${def.name}.`
          : `${def.glyph} You take the shape of the ${def.name.replace(' Shape', '')}.`
      )
      this.updateStatus()
      this.consume(hc)
      return true
    }
    if (v.devoted) {
      this.setLog('They already worship you. Aim elsewhere.')
      return false
    }

    this.bluff -= def.cost
    const mul = this.stanceMul()
    const targets = def.target === 'all' ? this.villagers.filter(t => !t.devoted) : [v]
    this.paradox = clamp(this.paradox + Math.round(def.paradox * mul.paradox))

    for (const t of targets) {
      const prior = def.axis ? t.claims.get(def.axis) : undefined
      const contradiction = prior !== undefined && prior !== def.claim
      let belief = def.belief
      if (def.flatter && stateOf(t) === 'skeptical') belief += 14
      belief = Math.round(belief * mul.belief)
      const doubt =
        def.belief > 0 && def.claim ? Math.round((4 + Math.floor(this.paradox / 25)) * mul.doubt) : 0
      const susp = def.suspicion + doubt + (contradiction ? 15 : 0)
      const bDelta = belief - (contradiction ? 10 : 0)
      t.belief = clamp(t.belief + bDelta)
      t.suspicion = clamp(t.suspicion + susp)
      if (def.axis && def.claim) t.claims.set(def.axis, def.claim)
      if (def.clears) t.claims.clear()
      if (bDelta !== 0) {
        this.floatText(t, `${bDelta > 0 ? '+' : ''}${bDelta} 💭`, bDelta > 0 ? '#4ade80' : '#ef4444', -40)
      }
      if (susp !== 0) {
        this.floatText(t, `${susp > 0 ? '+' : ''}${susp} ⚠️`, '#b249f8', 10)
      }
      if (contradiction) {
        this.floatText(t, 'Contradiction!', '#ef4444', -70)
        this.cameras.main.shake(90, 0.002)
      }
      if (!t.devoted && t.belief >= 70) {
        t.devoted = true
        t.belief = 70
        t.suspicion = Math.min(t.suspicion, 69)
        this.floatText(t, 'DEVOTED 💚', '#d4af37', -95)
      }
      this.updateVillagerVisual(t)
    }

    this.setLog(`${def.glyph} ${def.name} → ${def.target === 'all' ? 'the village' : v.def.name}`)
    this.consume(hc)
    this.redrawParadox()
    this.updateStatus()

    if (this.paradox >= 100) {
      this.time.delayedCall(300, () => {
        this.glitch()
        this.checkEnd()
      })
    } else {
      this.checkEnd()
      if (!this.gameOver) this.time.delayedCall(300, () => this.drawCard())
    }
    return true
  }

  private consume(hc: HandCard): void {
    this.hand = this.hand.filter(h => h !== hc)
    this.discard.push(hc.def)
    this.layoutHand()
    this.updateDeckInfo()
  }

  private endTurn(): void {
    if (this.gameOver) return
    for (const hc of [...this.hand]) {
      hc.container.setData('dragging', false)
      this.discard.push(hc.def)
      this.tweens.add({
        targets: hc.container,
        x: this.deckX,
        y: this.deckY,
        scale: 0.3,
        alpha: 0,
        duration: 180,
        ease: 'Cubic.in',
        onComplete: () => hc.container.destroy(),
      })
    }
    this.hand = []

    for (const v of this.villagers) {
      if (v.devoted) continue
      if (this.stance === 'crone') {
        const d = Math.min(5, v.suspicion)
        v.suspicion -= d
        if (d > 0) this.floatText(v, `−${d} ⚠️`, '#b249f8', -20)
      } else {
        const d = Math.min(3, v.belief)
        v.belief -= d
        if (d > 0) this.floatText(v, `−${d} 💭`, '#9fc7b8', -20)
      }
      this.updateVillagerVisual(v)
    }
    this.paradox = clamp(this.paradox - 4)

    this.day++
    this.bluff = Math.min(5, this.bluff + 3)
    this.redrawParadox()
    this.updateStatus()
    this.updateDeckInfo()
    this.setLog(`Dusk falls. Day ${this.day} begins.`)
    const need = MAX_HAND - this.hand.length
    for (let i = 0; i < need; i++) this.time.delayedCall(150 + 120 * i, () => this.drawCard())
  }

  private glitch(): void {
    const candidates = this.villagers.filter(v => !v.devoted)
    if (candidates.length === 0) return
    this.cameras.main.shake(280, 0.012)
    const v = candidates[Math.floor(Math.random() * candidates.length)]
    v.belief = Math.floor(Math.random() * 71) + 20
    this.paradox = 45
    this.setLog(`⚡ REALITY GLITCHES — ${v.def.name} remembers a different life.`)
    if (v.belief >= 70) {
      v.devoted = true
      v.belief = 70
      v.suspicion = Math.min(v.suspicion, 69)
      this.floatText(v, 'DEVOTED 💚', '#d4af37', -95)
    }
    this.floatText(v, '⚡', '#35f0a8', -60)
    this.updateVillagerVisual(v)
    this.redrawParadox()
    const flash = this.add.rectangle(this.gw / 2, this.gh / 2, this.gw, this.gh, 0x35f0a8, 0.25).setDepth(90)
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() })
  }

  private checkEnd(): boolean {
    if (this.gameOver) return true
    const lost = this.villagers.filter(v => !v.devoted && v.suspicion >= 100)
    if (lost.length > 0) {
      this.endGame(false, lost[0])
      return true
    }
    if (this.villagers.every(v => v.devoted)) {
      this.endGame(true)
      return true
    }
    return false
  }

  private endGame(win: boolean, torchbearer?: Villager): void {
    this.gameOver = true
    const shade = this.add
      .rectangle(this.gw / 2, this.gh / 2, this.gw, this.gh, 0x030a08, 0)
      .setDepth(100)
    this.tweens.add({ targets: shade, alpha: 0.88, duration: 500 })
    this.add
      .text(this.gw / 2, this.gh / 2 - 60, win ? 'THE VILLAGE BELIEVES 🏆' : 'THE TORCHES COME OUT 🌑', {
        fontFamily: FONT,
        fontSize: this.portrait ? '34px' : '44px',
        color: win ? '#4ade80' : '#ef4444',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: this.gw - 60 },
      })
      .setOrigin(0.5)
      .setDepth(101)
    this.add
      .text(
        this.gw / 2,
        this.gh / 2 + 10,
        win
          ? `Three devoted hearts after ${this.day} days of beautiful lies.`
          : `${torchbearer ? torchbearer.def.name : 'The village'} saw through you.`,
        { fontFamily: FONT, fontSize: '18px', color: '#e8d9a0', align: 'center', wordWrap: { width: this.gw - 80 } }
      )
      .setOrigin(0.5)
      .setDepth(101)
    const again = this.add
      .text(this.gw / 2, this.gh / 2 + 70, '↻ tap to play again', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#d4af37',
      })
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
    const w = this.portrait ? 300 : 400
    const cx = this.gw / 2
    g.fillStyle(0x06110e, 1)
    g.fillRoundedRect(cx - w / 2, 36, w, 18, 8)
    const p = this.paradox / 100
    const col = this.paradox < 40 ? 0x4ade80 : this.paradox < 75 ? 0xd4af37 : 0xef4444
    if (p > 0.01) {
      g.fillStyle(col, 1)
      g.fillRoundedRect(cx - w / 2, 36, Math.max(w * p, 16), 18, 8)
    }
    g.lineStyle(1, 0xd4af37, 0.5)
    g.strokeRoundedRect(cx - w / 2, 36, w, 18, 8)
    this.paradoxText.setPosition(cx + w / 2 + 12, 45).setOrigin(0, 0.5).setText(`${Math.round(this.paradox)}%`)
  }

  private updateStatus(): void {
    this.statusText.setText(`Day ${this.day}  ·  ⚡ ${this.bluff} Bluff`)
    const names: Record<'fox' | 'serpent' | 'crone', string> = {
      fox: '🦊 Fox — cheap lies, modest gains',
      serpent: '🐲 Serpent — big lies, big risk',
      crone: '👁️ Crone — slow lies, dusk cleanses suspicion',
    }
    this.stanceText.setText(this.stance ? names[this.stance] : '')
  }

  private floatText(v: Villager, msg: string, color: string, dy: number): void {
    const t = this.add
      .text(v.x, v.y + dy, msg, { fontFamily: FONT, fontSize: '16px', color })
      .setOrigin(0.5)
      .setDepth(60)
    this.tweens.add({
      targets: t,
      y: t.y - 42,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.out',
      onComplete: () => t.destroy(),
    })
  }

  private setLog(msg: string): void {
    this.logText.setText(msg)
    this.logText.setAlpha(1)
    this.tweens.killTweensOf(this.logText)
    this.tweens.add({ targets: this.logText, alpha: 0.35, delay: 3500, duration: 900 })
  }
}
