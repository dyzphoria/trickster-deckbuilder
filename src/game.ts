import Phaser from 'phaser'
import { starterDeck, VILLAGERS } from './cards.ts'
import type { CardDef, VillagerDef } from './cards.ts'

const CARD_W = 160
const CARD_H = 210
const MAX_HAND = 5
const FONT = 'Georgia, "Times New Roman", "Segoe UI Emoji", "Noto Color Emoji", serif'

type VState = 'devoted' | 'wary' | 'skeptical' | 'curious'
type Stance = 'fox' | 'serpent' | 'crone' | null

interface Mul {
  belief: number
  paradox: number
  doubt: number
}

interface Layout {
  vw: number
  vh: number
  vFirstY: number
  vSpacing: number
  emojiSize: number
  emojiY: number
  nameSize: number
  nameY: number
  statsSize: number
  statsY: number
  stateSize: number
  stateY: number
  claimsSize: number
  claimsY: number
  barW: number
  barH: number
  barY1: number
  barY2: number
  handScale: number
  handY: number
  deckW: number
  deckH: number
  deckInfoDy: number
  paradoxW: number
  hitX: number
  hitY: number
  floatSize: number
  endW: number
  endH: number
  endX: number
  endY: number
  endLabelSize: number
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
  private L!: Layout
  private villagers: Villager[] = []
  private hand: HandCard[] = []
  private deck: CardDef[] = []
  private discard: CardDef[] = []
  private paradox = 20
  private day = 1
  private bluff = 3
  private stance: Stance = null
  private gameOver = false
  private peeked: HandCard | null = null
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
    this.peeked = null
    this.gw = this.scale.width
    this.gh = this.scale.height
    this.portrait = this.gw < this.gh
    this.L = this.portrait ? this.portraitLayout() : this.landscapeLayout()
    this.deckX = this.portrait ? this.gw - 48 : 1160
    this.deckY = this.portrait ? 68 : 600

    this.add
      .text(this.portrait ? 8 : 24, this.portrait ? 6 : 16, 'TRICKSTER 🎭', {
        fontFamily: FONT,
        fontSize: this.portrait ? '14px' : '20px',
        color: '#d4af37',
      })
      .setOrigin(0, 0)
    this.statusText = this.add
      .text(this.portrait ? 8 : 24, this.portrait ? 24 : 44, '', {
        fontFamily: FONT,
        fontSize: this.portrait ? '11px' : '15px',
        color: '#e8d9a0',
      })
      .setOrigin(0, 0)
    this.stanceText = this.add
      .text(this.portrait ? 8 : this.gw - 24, this.portrait ? 38 : 44, '', {
        fontFamily: FONT,
        fontSize: this.portrait ? '10px' : '14px',
        color: '#7fb8a8',
      })
      .setOrigin(this.portrait ? 0 : 1, 0)
    this.logText = this.add
      .text(
        this.portrait ? 8 : 24,
        this.portrait ? 52 : 72,
        'Draw lies. Spend Bluff. Contradict nothing — or everything.',
        {
          fontFamily: FONT,
          fontSize: this.portrait ? '10px' : '15px',
          color: '#7fb8a8',
          wordWrap: { width: this.portrait ? this.gw - 100 : this.gw - 160 },
        }
      )
      .setOrigin(0, 0)

    if (!this.portrait) {
      this.add
        .text(this.gw / 2, 26, 'PARADOX', { fontFamily: FONT, fontSize: '13px', color: '#e8d9a0' })
        .setOrigin(0.5)
    }
    this.paradoxBar = this.add.graphics()
    this.paradoxText = this.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: this.portrait ? '9px' : '14px',
      color: '#e8d9a0',
    })
    this.redrawParadox()

    VILLAGERS.forEach((def, i) => {
      const x = this.portrait ? this.gw / 2 : 310 + i * 330
      this.makeVillager(def, x, this.L.vFirstY + i * this.L.vSpacing)
    })

    this.makeDeck(this.deckX, this.deckY)
    this.makeEndTurn()

    this.input.on('dragstart', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (this.gameOver) return
      const hc = obj.getData('hc') as HandCard | undefined
      if (!hc) return
      obj.setData('dragging', true)
      if (this.peeked === hc) this.peeked = null
      this.children.bringToTop(obj)
      this.tweens.add({ targets: obj, scale: this.portrait ? 1 : 1.08, duration: 100 })
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
      obj.setScale(this.L.handScale)
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
      this.snapHome(hc)
    })

    this.input.keyboard!.on('keydown-SPACE', () => this.drawCard())
    this.input.keyboard!.on('keydown-E', () => this.endTurn())

    for (let i = 0; i < MAX_HAND; i++) this.time.delayedCall(120 * i, () => this.drawCard())
    this.updateStatus()
  }

  private portraitLayout(): Layout {
    const handY = this.gh - CARD_H / 2 - 6
    const handTop = handY - CARD_H / 2
    const endH = 36
    const endY = handTop - 4 - endH / 2
    const zoneTop = 116
    const zoneBottom = endY - endH / 2 - 6
    const vh = clamp(Math.floor((zoneBottom - zoneTop - 12) / 3), 86, 128)
    const firstC = zoneTop + vh / 2
    const lastC = zoneBottom - vh / 2
    return {
      vw: 240,
      vh,
      vFirstY: firstC,
      vSpacing: (lastC - firstC) / 2,
      emojiSize: 24,
      emojiY: -vh * 0.32,
      nameSize: 12,
      nameY: -vh * 0.15,
      statsSize: 10,
      statsY: vh * 0.12,
      stateSize: 10,
      stateY: vh * 0.3,
      claimsSize: 10,
      claimsY: vh * 0.3,
      barW: 150,
      barH: 6,
      barY1: -vh * 0.06,
      barY2: -vh * 0.03,
      handScale: 1,
      handY,
      deckW: 64,
      deckH: 88,
      deckInfoDy: 26,
      paradoxW: 150,
      hitX: 120,
      hitY: vh / 2 + 10,
      floatSize: 12,
      endW: 140,
      endH,
      endX: 180,
      endY,
      endLabelSize: 11,
    }
  }

  private landscapeLayout(): Layout {
    return {
      vw: 240,
      vh: 260,
      vFirstY: 250,
      vSpacing: 330,
      emojiSize: 46,
      emojiY: -80,
      nameSize: 18,
      nameY: -34,
      statsSize: 14,
      statsY: 44,
      stateSize: 16,
      stateY: 66,
      claimsSize: 12,
      claimsY: 92,
      barW: 160,
      barH: 10,
      barY1: 2,
      barY2: 22,
      handScale: 1,
      handY: this.gh - 120,
      deckW: 110,
      deckH: 150,
      deckInfoDy: 92,
      paradoxW: 400,
      hitX: 130,
      hitY: 150,
      floatSize: 16,
      endW: 120,
      endH: 50,
      endX: 1150,
      endY: 440,
      endLabelSize: 15,
    }
  }

  private villagerAt(x: number, y: number): Villager | undefined {
    return this.villagers.find(
      v => Math.abs(x - v.x) <= this.L.hitX && Math.abs(y - v.y) <= this.L.hitY
    )
  }

  private makeVillager(def: VillagerDef, x: number, y: number): void {
    const L = this.L
    const border = this.add.graphics()
    const bar = this.add.graphics()
    const emoji = this.add
      .text(0, L.emojiY, def.emoji, { fontFamily: FONT, fontSize: `${L.emojiSize}px` })
      .setOrigin(0.5)
    const name = this.add
      .text(0, L.nameY, def.name, {
        fontFamily: FONT,
        fontSize: `${L.nameSize}px`,
        color: '#e8d9a0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    const statsText = this.add
      .text(0, L.statsY, '', { fontFamily: FONT, fontSize: `${L.statsSize}px`, color: '#9fc7b8' })
      .setOrigin(0.5)
    const stateText = this.add
      .text(0, L.stateY, '', { fontFamily: FONT, fontSize: `${L.stateSize}px` })
      .setOrigin(0.5)
    const claimsText = this.add
      .text(0, L.claimsY, '', {
        fontFamily: FONT,
        fontSize: `${L.claimsSize}px`,
        color: '#7d8f87',
        align: 'center',
        wordWrap: { width: L.vw - 40 },
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
    const L = this.L
    const s = stateOf(v)
    const r = this.portrait ? 10 : 16
    v.border.clear()
    v.border.fillStyle(0x0e2a24, 0.9)
    v.border.fillRoundedRect(-L.vw / 2, -L.vh / 2, L.vw, L.vh, r)
    v.border.lineStyle(3, stateColor(s), 1)
    v.border.strokeRoundedRect(-L.vw / 2, -L.vh / 2, L.vw, L.vh, r)
    v.bar.clear()
    v.bar.fillStyle(0x06110e, 1)
    v.bar.fillRoundedRect(-L.barW / 2, L.barY1, L.barW, L.barH, 3)
    v.bar.fillRoundedRect(-L.barW / 2, L.barY2, L.barW, L.barH, 3)
    v.bar.fillStyle(v.devoted ? 0xd4af37 : 0x4ade80, 1)
    v.bar.fillRoundedRect(-L.barW / 2, L.barY1, Math.max(L.barW * (v.belief / 100), 5), L.barH, 3)
    v.bar.fillStyle(v.suspicion >= 70 ? 0xef4444 : 0xb249f8, 1)
    v.bar.fillRoundedRect(-L.barW / 2, L.barY2, Math.max(L.barW * (v.suspicion / 100), 5), L.barH, 3)
    const claims = [...v.claims.values()]
    if (this.portrait) {
      v.statsText.setText(`💭${Math.round(v.belief)}  ⚠${Math.round(v.suspicion)}`)
      const c = claims.length > 0 ? `  · by: ${claims.join(', ')}` : ''
      v.stateText.setText(`${stateLabel(s)}${c}`)
      v.claimsText.setText('')
    } else {
      v.statsText.setText(`💭${Math.round(v.belief)}  ⚠${Math.round(v.suspicion)}`)
      v.stateText.setText(stateLabel(s))
      v.claimsText.setText(claims.length > 0 ? `swears by: ${claims.join(', ')}` : '')
    }
    v.stateText.setColor('#' + stateColor(s).toString(16).padStart(6, '0'))
  }

  private makeDeck(x: number, y: number): void {
    const L = this.L
    const stack = this.add.graphics()
    const off = this.portrait ? 2 : 3
    for (let i = 2; i >= 0; i--) {
      stack.fillStyle(0x0e2a24, 1)
      stack.fillRoundedRect(-L.deckW / 2 + i * off, -L.deckH / 2 + i * off, L.deckW, L.deckH, 8)
      stack.lineStyle(2, 0xd4af37, 0.8)
      stack.strokeRoundedRect(-L.deckW / 2 + i * off, -L.deckH / 2 + i * off, L.deckW, L.deckH, 8)
    }
    const label = this.add
      .text(0, this.portrait ? -14 : -10, this.portrait ? '🎴\nDRAW' : '🎴\nDRAW\nSPACE', {
        fontFamily: FONT,
        fontSize: this.portrait ? '10px' : '15px',
        color: '#e8d9a0',
        align: 'center',
      })
      .setOrigin(0.5)
    this.deckInfo = this.add
      .text(0, L.deckInfoDy, '', {
        fontFamily: FONT,
        fontSize: this.portrait ? '9px' : '13px',
        color: '#7d8f87',
      })
      .setOrigin(0.5)
    const c = this.add.container(x, y, [stack, label, this.deckInfo])
    c.setSize(L.deckW, L.deckH)
    c.setInteractive(
      new Phaser.Geom.Rectangle(-L.deckW / 2, -L.deckH / 2, L.deckW, L.deckH),
      Phaser.Geom.Rectangle.Contains
    )
    c.on('pointerdown', () => this.drawCard())
    this.updateDeckInfo()
  }

  private updateDeckInfo(): void {
    this.deckInfo.setText(`deck ${this.deck.length} · used ${this.discard.length}`)
  }

  private makeEndTurn(): void {
    const L = this.L
    const g = this.add.graphics()
    g.fillStyle(0x0e2a24, 1)
    g.fillRoundedRect(-L.endW / 2, -L.endH / 2, L.endW, L.endH, 12)
    g.lineStyle(2, 0xd4af37, 0.9)
    g.strokeRoundedRect(-L.endW / 2, -L.endH / 2, L.endW, L.endH, 12)
    const label = this.add
      .text(0, 0, this.portrait ? 'End Turn · +3⚡' : 'End Turn\n+3 ⚡', {
        fontFamily: FONT,
        fontSize: `${L.endLabelSize}px`,
        color: '#e8d9a0',
        align: 'center',
      })
      .setOrigin(0.5)
    const c = this.add.container(L.endX, L.endY, [g, label])
    c.setSize(L.endW, L.endH)
    c.setInteractive(
      new Phaser.Geom.Rectangle(-L.endW / 2, -L.endH / 2, L.endW, L.endH),
      Phaser.Geom.Rectangle.Contains
    )
    c.on('pointerdown', () => this.endTurn())
  }

  private makeCard(def: CardDef, x: number, y: number): HandCard {
    const bg = this.add.graphics()
    bg.fillStyle(0x0e2a24, 0.95)
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12)
    bg.lineStyle(2, 0xd4af37, 0.9)
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12)
    const parts: Phaser.GameObjects.GameObject[] = [bg]
    const bStr = def.belief >= 0 ? `+${def.belief}` : `${def.belief}`
    const sStr = def.suspicion >= 0 ? `+${def.suspicion}` : `${def.suspicion}`
    const pStr = def.paradox >= 0 ? `+${def.paradox}` : `${def.paradox}`
    if (this.portrait) {
      // Fanned hand: only the left ~50px strip of each card stays visible,
      // so all key info is anchored to the left edge. Tap a card to lift it
      // and read everything.
      const glyph = this.add
        .text(-50, -62, def.glyph, { fontFamily: FONT, fontSize: '22px' })
        .setOrigin(0.5)
      const name = this.add
        .text(-72, -42, def.name, {
          fontFamily: FONT,
          fontSize: '10px',
          color: '#d4af37',
          fontStyle: 'bold',
          wordWrap: { width: 46, useAdvancedWrap: true },
        })
        .setOrigin(0, 0)
      const cost = this.add
        .text(-72, -12, `⚡ costs ${def.cost}`, { fontFamily: FONT, fontSize: '9px', color: '#e8d9a0' })
        .setOrigin(0, 0)
      const sb = this.add
        .text(-72, 4, `💭 ${bStr}`, { fontFamily: FONT, fontSize: '10px', color: '#4ade88' })
        .setOrigin(0, 0)
      const ss = this.add
        .text(-72, 19, `⚠ ${sStr}`, { fontFamily: FONT, fontSize: '10px', color: '#b49af8' })
        .setOrigin(0, 0)
      const sp = this.add
        .text(-72, 34, `🌀 ${pStr}`, { fontFamily: FONT, fontSize: '10px', color: '#e8d9a0' })
        .setOrigin(0, 0)
      parts.push(glyph, name, cost, sb, ss, sp)
    } else {
      const glyph = this.add.text(0, -70, def.glyph, { fontFamily: FONT, fontSize: '36px' }).setOrigin(0.5)
      const cost = this.add
        .text(CARD_W / 2 - 16, -CARD_H / 2 + 14, `⚡${def.cost}`, {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#e8d9a0',
        })
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
      const stats = this.add
        .text(0, 82, `💭${bStr} ⚠${sStr} 🌀${pStr}`, {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#e8d9a0',
        })
        .setOrigin(0.5)
      parts.push(glyph, cost, name, desc, stats)
    }
    const container = this.add.container(x, y, parts)
    container.setSize(CARD_W, CARD_H)
    container.setScale(this.L.handScale)
    container.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains
    )
    this.input.setDraggable(container)
    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
      container.setData('down', { x: p.x, y: p.y })
    })
    container.on('pointerup', (p: Phaser.Input.Pointer) => {
      const down = container.getData('down') as { x: number; y: number } | undefined
      container.setData('down', undefined)
      if (!down) return
      const moved = Math.abs(p.x - down.x) + Math.abs(p.y - down.y)
      if (moved < 14) {
        const hc = container.getData('hc') as HandCard | undefined
        if (hc && !this.gameOver) this.togglePeek(hc)
      }
    })
    const hc: HandCard = { def, container, homeX: x, homeY: y }
    container.setData('hc', hc)
    return hc
  }

  private togglePeek(hc: HandCard): void {
    if (this.peeked === hc) {
      this.peeked = null
      this.snapHome(hc)
      return
    }
    if (this.peeked) {
      const old = this.peeked
      this.peeked = null
      this.snapHome(old)
    }
    this.peeked = hc
    this.tweens.killTweensOf(hc.container)
    this.children.bringToTop(hc.container)
    this.tweens.add({
      targets: hc.container,
      y: hc.homeY - (this.portrait ? 215 : 95),
      duration: 150,
      ease: 'Cubic.out',
    })
  }

  private snapHome(hc: HandCard): void {
    this.tweens.killTweensOf(hc.container)
    this.tweens.add({
      targets: hc.container,
      x: hc.homeX,
      y: hc.homeY,
      scale: this.L.handScale,
      duration: 170,
      ease: 'Cubic.out',
    })
  }

  private drawCard(): void {
    if (this.gameOver) return
    if (this.hand.length >= MAX_HAND) {
      this.setLog('Hand is full — play or end the turn.')
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
    this.peeked = null
    const n = this.hand.length
    const spacing =
      this.portrait && n > 1 ? Math.min(100, (this.gw - CARD_W) / (n - 1)) : this.portrait ? 0 : 185
    this.hand.forEach((hc, i) => {
      hc.homeX = this.gw / 2 + (i - (n - 1) / 2) * spacing
      hc.homeY = this.L.handY
      if (hc.container.getData('dragging')) return
      this.tweens.killTweensOf(hc.container)
      this.tweens.add({
        targets: hc.container,
        x: hc.homeX,
        y: hc.homeY,
        scale: this.L.handScale,
        duration: 220,
        ease: 'Cubic.out',
      })
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
      this.setLog('Not enough Bluff ⚡. End the turn to recover.')
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
    if (this.peeked === hc) this.peeked = null
    this.discard.push(hc.def)
    this.layoutHand()
    this.updateDeckInfo()
  }

  private endTurn(): void {
    if (this.gameOver) return
    this.peeked = null
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
    this.bluff = Math.min(6, this.bluff + 3)
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
    const flash = this.add
      .rectangle(this.gw / 2, this.gh / 2, this.gw, this.gh, 0x35f0a8, 0.25)
      .setDepth(90)
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
        fontSize: this.portrait ? '22px' : '44px',
        color: win ? '#4ade80' : '#ef4444',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: this.gw - 40 },
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
        {
          fontFamily: FONT,
          fontSize: this.portrait ? '13px' : '18px',
          color: '#e8d9a0',
          align: 'center',
          wordWrap: { width: this.gw - 60 },
        }
      )
      .setOrigin(0.5)
      .setDepth(101)
    const again = this.add
      .text(this.gw / 2, this.gh / 2 + 70, '↻ tap to play again', {
        fontFamily: FONT,
        fontSize: this.portrait ? '14px' : '18px',
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
    const w = this.L.paradoxW
    const h = this.portrait ? 12 : 18
    const cx = this.portrait ? this.gw - 12 - w / 2 : this.gw / 2
    const y = this.portrait ? 6 : 36
    g.fillStyle(0x06110e, 1)
    g.fillRoundedRect(cx - w / 2, y, w, h, 6)
    const p = this.paradox / 100
    const col = this.paradox < 40 ? 0x4ade80 : this.paradox < 75 ? 0xd4af37 : 0xef4444
    if (p > 0.01) {
      g.fillStyle(col, 1)
      g.fillRoundedRect(cx - w / 2, y, Math.max(w * p, 12), h, 6)
    }
    g.lineStyle(1, 0xd4af37, 0.5)
    g.strokeRoundedRect(cx - w / 2, y, w, h, 6)
    if (this.portrait) {
      this.paradoxText.setOrigin(0.5, 0.5).setPosition(cx, y + h / 2).setText(`PARADOX ${Math.round(this.paradox)}%`)
    } else {
      this.paradoxText.setOrigin(0, 0.5).setPosition(cx + w / 2 + 12, y + 9).setText(`${Math.round(this.paradox)}%`)
    }
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
      .text(v.x, v.y - this.L.vh / 2 - 10 + dy, msg, {
        fontFamily: FONT,
        fontSize: `${this.L.floatSize}px`,
        color,
      })
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
