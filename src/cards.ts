export interface CardDef {
  id: string
  name: string
  glyph: string
  desc: string
  belief: number
  paradox: number
  weight: number
  flatter?: boolean
}

export interface VillagerDef {
  name: string
  emoji: string
  belief: number
}

export const CARDS: CardDef[] = [
  {
    id: 'petty-lie',
    name: 'Petty Lie',
    glyph: '🤥',
    desc: '"The well whispers secrets at night."',
    belief: 12,
    paradox: 8,
    weight: 3,
  },
  {
    id: 'grand-promise',
    name: 'Grand Promise',
    glyph: '🌟',
    desc: '"Golden apples, come springtime. Swear on it."',
    belief: 25,
    paradox: 15,
    weight: 2,
  },
  {
    id: 'prophecy',
    name: 'Doom Prophecy',
    glyph: '🔮',
    desc: '"The frost comes early this year. Only I can stop it."',
    belief: 18,
    paradox: 12,
    weight: 2,
  },
  {
    id: 'flattery',
    name: 'Flattery',
    glyph: '💐',
    desc: '"Your cheese rivals Asgard\'s own table."',
    belief: 8,
    paradox: 2,
    weight: 3,
    flatter: true,
  },
  {
    id: 'confess',
    name: 'False Confession',
    glyph: '😇',
    desc: 'Admit a small lie to bury the big one.',
    belief: -8,
    paradox: -20,
    weight: 3,
  },
  {
    id: 'fox-shape',
    name: 'Fox Shape',
    glyph: '🦊',
    desc: 'Slip out of trouble, grinning.',
    belief: 10,
    paradox: -5,
    weight: 2,
  },
  {
    id: 'serpent-tongue',
    name: 'Serpent Tongue',
    glyph: '🐍',
    desc: 'A honeyed coil of pure nonsense.',
    belief: 20,
    paradox: 18,
    weight: 2,
  },
  {
    id: 'reality-bend',
    name: 'Reality Bend',
    glyph: '🌀',
    desc: '"The sky? Always been green, friend."',
    belief: 30,
    paradox: 25,
    weight: 1,
  },
]

export const VILLAGERS: VillagerDef[] = [
  { name: 'Astrid the Baker', emoji: '👩‍🍳', belief: 35 },
  { name: 'Old Torvald', emoji: '👴', belief: 45 },
  { name: 'Sif the Shepherd', emoji: '🧑‍🌾', belief: 40 },
]
