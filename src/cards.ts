export interface CardDef {
  id: string
  name: string
  glyph: string
  desc: string
  cost: number
  belief: number
  suspicion: number
  paradox: number
  target: 'one' | 'all'
  weight: number
  axis?: string
  claim?: string
  clears?: boolean
  stance?: 'fox' | 'serpent' | 'crone'
  flatter?: boolean
}

export interface VillagerDef {
  name: string
  emoji: string
  belief: number
  suspicion: number
}

export const CARDS: CardDef[] = [
  {
    id: 'petty-lie',
    name: 'Petty Lie',
    glyph: '🤥',
    desc: '"The well whispers my name at night."',
    cost: 1,
    belief: 10,
    suspicion: 2,
    paradox: 6,
    target: 'one',
    weight: 3,
    axis: 'rumor',
    claim: 'whispers',
  },
  {
    id: 'oldest-friend',
    name: 'Oldest Friend',
    glyph: '🫂',
    desc: '"I have known you since you were born."',
    cost: 1,
    belief: 12,
    suspicion: 2,
    paradox: 4,
    target: 'one',
    weight: 2,
    axis: 'identity',
    claim: 'friend',
  },
  {
    id: 'faceless-stranger',
    name: 'Faceless Stranger',
    glyph: '🫥',
    desc: '"Who are you, again? We have never met."',
    cost: 1,
    belief: 10,
    suspicion: 2,
    paradox: 3,
    target: 'one',
    weight: 1,
    axis: 'identity',
    claim: 'stranger',
  },
  {
    id: 'grand-promise',
    name: 'Grand Promise',
    glyph: '🌟',
    desc: '"Golden apples, come springtime. Sworn."',
    cost: 2,
    belief: 20,
    suspicion: 3,
    paradox: 12,
    target: 'one',
    weight: 2,
    axis: 'wealth',
    claim: 'gold',
  },
  {
    id: 'humble-beggar',
    name: 'Humble Beggar',
    glyph: '🥺',
    desc: '"I am penniless. Spare a coin for a wretch."',
    cost: 1,
    belief: 10,
    suspicion: 2,
    paradox: 3,
    target: 'one',
    weight: 1,
    axis: 'wealth',
    claim: 'poor',
  },
  {
    id: 'doom-prophecy',
    name: 'Doom Prophecy',
    glyph: '🔮',
    desc: '"Frost comes early. Only I can stop it."',
    cost: 2,
    belief: 15,
    suspicion: 4,
    paradox: 10,
    target: 'one',
    weight: 2,
    axis: 'prophecy',
    claim: 'doom',
  },
  {
    id: 'soothing-word',
    name: 'Soothing Word',
    glyph: '🕊️',
    desc: '"Nothing will happen. Trust me entirely."',
    cost: 1,
    belief: 10,
    suspicion: -5,
    paradox: 2,
    target: 'one',
    weight: 1,
    axis: 'prophecy',
    claim: 'safe',
  },
  {
    id: 'flattery',
    name: 'Flattery',
    glyph: '💐',
    desc: '"Your cheese rivals Asgard\'s own table."',
    cost: 1,
    belief: 8,
    suspicion: -4,
    paradox: 2,
    target: 'one',
    weight: 2,
    flatter: true,
    axis: 'flatter',
    claim: 'compliment',
  },
  {
    id: 'well-of-secrets',
    name: 'Well of Secrets',
    glyph: '🕳️',
    desc: 'A rumor for every ear in the village.',
    cost: 2,
    belief: 10,
    suspicion: 2,
    paradox: 12,
    target: 'all',
    weight: 2,
    axis: 'rumor',
    claim: 'whispers',
  },
  {
    id: 'serpent-coil',
    name: 'Serpent Coil',
    glyph: '🐍',
    desc: 'A honeyed coil of pure nonsense.',
    cost: 2,
    belief: 25,
    suspicion: 4,
    paradox: 16,
    target: 'one',
    weight: 2,
    axis: 'serpent',
    claim: 'coil',
  },
  {
    id: 'borrowed-face',
    name: 'Borrowed Face',
    glyph: '🎭',
    desc: 'Erase what they remember you claiming.',
    cost: 1,
    belief: 5,
    suspicion: -6,
    paradox: 4,
    target: 'one',
    weight: 2,
    clears: true,
  },
  {
    id: 'false-confession',
    name: 'False Confession',
    glyph: '😇',
    desc: 'Admit a small lie to bury the big ones.',
    cost: 0,
    belief: -8,
    suspicion: -20,
    paradox: -15,
    target: 'one',
    weight: 2,
  },
  {
    id: 'fox-shape',
    name: 'Fox Shape',
    glyph: '🦊',
    desc: 'Lies cost less ⚡ · belief ×0.75 · risk ×0.75',
    cost: 1,
    belief: 0,
    suspicion: 0,
    paradox: 0,
    target: 'one',
    weight: 1,
    stance: 'fox',
  },
  {
    id: 'serpent-shape',
    name: 'Serpent Shape',
    glyph: '🐲',
    desc: 'Belief ×1.5 · paradox ×1.25 · risk ×1.5',
    cost: 1,
    belief: 0,
    suspicion: 0,
    paradox: 0,
    target: 'one',
    weight: 1,
    stance: 'serpent',
  },
  {
    id: 'crone-shape',
    name: 'Crone Shape',
    glyph: '👁️',
    desc: 'Belief ×0.6 · risk ×0.5 · each dusk: all Suspicion −5',
    cost: 1,
    belief: 0,
    suspicion: 0,
    paradox: 0,
    target: 'one',
    weight: 1,
    stance: 'crone',
  },
]

export function starterDeck(): CardDef[] {
  const deck: CardDef[] = []
  for (const c of CARDS) {
    for (let i = 0; i < c.weight; i++) deck.push(c)
  }
  return deck
}

export const VILLAGERS: VillagerDef[] = [
  { name: 'Astrid the Baker', emoji: '👩‍🍳', belief: 35, suspicion: 10 },
  { name: 'Old Torvald', emoji: '👴', belief: 40, suspicion: 20 },
  { name: 'Sif the Shepherd', emoji: '🧑‍🌾', belief: 45, suspicion: 15 },
]
