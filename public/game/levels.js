// Level catalogue: every level's text, rules, map marker and world layout in one place.
//
// World layout entries are compact arrays (copied verbatim from the original game):
//   platforms   [x, y, width, type?, moveX?, moveY?, speed?, baseY?]
//               type: 's' solid (default) · 'c' crumbles when stood on · 'm' moving · 'g' storm board (Sky Kingdom)
//               y >= 380 is thick ground; anything higher is a thin 16-px board.
//   spikes      [x, y, width]
//   wolves      [x, y, patrolMin, patrolMax, speed]
//   checkpoints [x, y]
//   jets        [x, y, phaseOffset]            fire jets (2.6 s cycle: off → warning → flame)
//   bats        [x, y]                         Haunted Harvest
//   turrets     [x, y, direction, phase]       Frostbite Pass snowball machines
//   archers     [x, y, phase]                  Siege of Ashkar
//   gunWolves   [x, y, patrolMin, patrolMax, hp, phase]   Neon Wolfpack
//   ammo        [x, y]                         Neon Wolfpack
//   capes       [x, y]                         Sky Kingdom
//
// Platformer rules (defaults in modes/platformer.js):
//   fallCostsHeart  falling into a gap costs a heart (otherwise you just respawn)
//   wolvesChase     wolves speed up and turn towards a nearby sheep
//   checkpointHeal  'full' refills hearts, a number adds that many, 0 does nothing
//   cloverSpacing   distance between clovers placed along each platform

const MOVE = 'Joystick or ←/→ to run';

export const LEVELS = [
  {
    slug: 'level-1', name: 'Sunrise Meadow', difficulty: 'EASY', mode: 'platformer', theme: 'meadow',
    hearts: 5, length: 3000, goal: 2900,
    rules: { fallCostsHeart: false, wolvesChase: false, checkpointHeal: 'full', cloverSpacing: 90 },
    intro: 'Wide meadow ground, slow wolves and a few spikes. Checkpoints refill your hearts.',
    controls: `${MOVE} · JUMP or Space (tap twice to double-jump) · stomp wolves from above.`,
    loseText: 'Not this time!',
    map: { x: 170, y: 1110, color: '#2f9e44', land: '#8fd36f', props: ['🌼', '🌳', '🌾'] },
    world: {
      platforms: [
        [0, 380, 520], [610, 380, 380], [690, 290, 120], [1080, 380, 300], [1170, 300, 100], [1480, 380, 420],
        [2000, 380, 300], [2400, 380, 640],
      ],
      spikes: [
        [820, 380, 40], [1780, 380, 40], [2560, 380, 40],
      ],
      wolves: [
        [700, 380, 620, 770, 35], [1580, 380, 1520, 1700, 35], [2150, 380, 2060, 2240, 35],
      ],
      checkpoints: [
        [1100, 380], [2020, 380],
      ],
    },
  },
  {
    slug: 'level-2', name: 'Night of Fire', difficulty: 'VERY HARD', mode: 'platformer', theme: 'fire',
    hearts: 3, length: 3700, goal: 3640,
    intro: 'Crumbling ground, moving platforms, fire jets and fast chasing wolves. Only 3 hearts.',
    controls: `${MOVE} · JUMP or Space (double-jump) · stomp wolves.`,
    teaser: 'The difficulty jumps. Good luck.', warnOnUnlock: true,
    map: { x: 440, y: 1030, color: '#c92a2a', land: '#6b3446', props: ['🔥', '🌋', '🐺'] },
    world: {
      platforms: [
        [0, 380, 280], [350, 360, 80, 'c'], [490, 330, 80, 'c'], [640, 300, 90, 'm', 120, 0, 1.1, 300], [920, 340, 110], [1100, 380, 170],
        [1330, 350, 70, 'c'], [1450, 320, 70, 'c'], [1570, 290, 70, 'c'], [1710, 260, 130], [1920, 260, 80, 'm', 0, 90, 1.3, 260], [2090, 380, 220],
        [2390, 330, 90, 'm', 130, 0, 1.2, 330], [2640, 330, 70, 'c'], [2760, 300, 70, 'c'], [2890, 340, 150], [3110, 290, 80, 'm', 0, 70, 1.4, 290], [3300, 380, 380],
      ],
      spikes: [
        [2130, 380, 40], [3600, 380, 40],
      ],
      wolves: [
        [1180, 380, 1110, 1250, 110], [2220, 380, 2200, 2290, 120], [3340, 380, 3320, 3450, 125], [3470, 380, 3460, 3560, 125],
      ],
      checkpoints: [
        [1110, 380], [2900, 340],
      ],
      jets: [
        [975, 340, 0], [1775, 260, 0.8], [2960, 340, 1.2], [3540, 380, 0.4],
      ],
    },
  },
  {
    slug: 'level-3', name: 'Sunset Highway', difficulty: 'MEDIUM', mode: 'highway',
    length: 7000, goal: 6800,
    intro: "Ride the bike, grab red fuel bags on the road, hop over rocks and ramps. Don't run dry!",
    controls: 'Joystick right = ride, left = brake · JUMP = hop.',
    teaser: 'Fuel up and ride the highway!',
    loseText: 'Out of fuel! Grab the red fuel bags on the road and hop to reach the high ones.',
    map: { x: 620, y: 930, color: '#e8a008', land: '#e0a45a', props: ['🏍️', '🌵', '🛣️'] },
  },
  {
    slug: 'level-4', name: 'Starfall Run', difficulty: 'HARD', mode: 'space',
    hearts: 3, length: 9000,
    intro: 'Fly through space: meteors, UFOs, wolf rockets, spikes and giant black holes. NITRO (5 s, costs 60% fuel) escapes a black hole.',
    controls: 'Joystick to fly (screen scrolls by itself) · NITRO button or Space.',
    teaser: 'Space: meteors, UFOs, black holes!',
    loseText: 'Your rocket-sheep was destroyed! Dodge carefully and save 60% fuel for black holes.',
    map: { x: 520, y: 810, color: '#e8590c', land: '#34306b', props: ['🚀', '☄️', '🛸'] },
  },
  {
    slug: 'level-5', name: 'Haunted Harvest', difficulty: 'VERY HARD', mode: 'platformer', theme: 'haunted', features: ['haunted'],
    hearts: 3, length: 4500, goal: 4380,
    intro: 'Bats dive at you, pumpkins fall from the sky, crumbling ground, fire and wolves.',
    controls: `${MOVE} · JUMP or Space · watch the orange ▼ for pumpkins.`,
    tip: 'Bats dive at you · pumpkins fall from the sky (watch the orange ▼) · stomp bats & wolves',
    teaser: 'Haunted night: bats and falling pumpkins!',
    map: { x: 250, y: 750, color: '#c92a2a', land: '#7a4a8a', props: ['🎃', '🦇', '👻'] },
    world: {
      platforms: [
        [0, 380, 240], [310, 350, 60, 'c'], [430, 320, 60, 'c'], [550, 290, 60, 'c'], [680, 330, 80], [830, 300, 70, 'm', 110, 0, 1.3, 300],
        [1080, 360, 100], [1250, 380, 120], [1450, 340, 60, 'c'], [1560, 310, 60, 'c'], [1670, 280, 60, 'c'], [1790, 240, 90],
        [1970, 260, 70, 'm', 0, 100, 1.5, 260], [2150, 380, 130], [2360, 350, 60, 'c'], [2470, 320, 70, 'm', 100, 0, 1.4, 320], [2700, 340, 80], [2860, 300, 60, 'c'],
        [2960, 270, 60, 'c'], [3100, 260, 70, 'm', 0, 90, 1.6, 260], [3280, 380, 150], [3520, 340, 60, 'c'], [3620, 310, 60, 'c'], [3730, 280, 70, 'm', 120, 0, 1.5, 280],
        [3980, 340, 100], [4150, 380, 300],
      ],
      spikes: [
        [1115, 360, 36], [2200, 380, 40], [3395, 380, 30], [4320, 380, 40],
      ],
      wolves: [
        [1280, 380, 1260, 1350, 125], [2170, 380, 2160, 2270, 130], [3340, 380, 3310, 3380, 130], [4200, 380, 4180, 4300, 135],
      ],
      checkpoints: [
        [1260, 380], [2170, 380], [3300, 380], [3990, 340],
      ],
      jets: [
        [720, 330, 0.3], [1840, 240, 0.5], [2230, 380, 1.3], [4030, 340, 0.9], [4260, 380, 0],
      ],
      bats: [
        [500, 230], [900, 200], [1150, 230], [1300, 260], [1700, 170], [2050, 200],
        [2400, 230], [2600, 180], [2800, 210], [3150, 160], [3450, 250], [3800, 190],
        [4100, 240],
      ],
    },
  },
  {
    slug: 'level-6', name: 'Frostbite Pass', difficulty: 'MEDIUM-HARD', mode: 'platformer', theme: 'frost', features: ['frost'],
    hearts: 4, length: 3800, goal: 3600,
    rules: { wolvesChase: false, checkpointHeal: 1 },
    intro: 'Snowmen patrol and snowball machines fire. Jump the snowballs, stomp the snowmen.',
    controls: `${MOVE} · JUMP or Space · each checkpoint restores a heart.`,
    tip: 'Snowmen patrol · snowball machines fire · jump the snowballs, stomp snowmen',
    teaser: 'Snow world: snowmen and snowball machines!',
    map: { x: 130, y: 630, color: '#1c7ed6', land: '#e6f4ff', props: ['❄️', '⛄', '🌲'] },
    world: {
      platforms: [
        [0, 380, 300], [390, 380, 200], [680, 340, 100], [870, 300, 70, 'c'], [1000, 300, 70, 'm', 100, 0, 1.1, 300], [1260, 360, 180],
        [1530, 380, 200], [1820, 350, 80, 'c'], [1950, 320, 70, 'c'], [2070, 290, 90], [2260, 310, 70, 'm', 0, 70, 1.2, 310], [2420, 380, 250],
        [2770, 380, 150], [3010, 350, 80, 'c'], [3140, 330, 80, 'm', 90, 0, 1.1, 330], [3390, 380, 410],
      ],
      spikes: [
        [1330, 360, 36], [2620, 380, 40], [3520, 380, 36],
      ],
      wolves: [
        [440, 380, 410, 520, 45], [1560, 380, 1550, 1690, 45], [2460, 380, 2440, 2580, 45], [2790, 380, 2780, 2890, 45], [3430, 380, 3410, 3490, 50],
      ],
      checkpoints: [
        [1270, 360], [2430, 380], [3400, 380],
      ],
      turrets: [
        [560, 380, -1, 0], [770, 340, -1, 0.8], [1420, 360, -1, 0.3], [1700, 380, -1, 1.1], [2150, 290, -1, 0.5], [2900, 380, -1, 0],
        [3700, 380, -1, 0.6],
      ],
    },
  },
  {
    slug: 'level-7', name: 'Siege of Ashkar', difficulty: 'EXTREME', mode: 'platformer', theme: 'siege', features: ['siege'],
    hearts: 3, length: 4800, goal: 4680,
    intro: 'An ancient battlefield: archers fire aimed arrows, volleys rain from the sky, spear soldiers charge, siege fire burns. 3 hearts, no healing.',
    controls: `${MOVE} · JUMP or Space · watch the red ▼ for arrow volleys · stomp soldiers.`,
    tip: 'Archers aim at you · watch the red ▼ for arrow volleys · stomp soldiers',
    teaser: 'Ancient battlefield: arrows rain down!',
    map: { x: 330, y: 545, color: '#862e9c', land: '#b5654a', props: ['🏰', '⚔️', '🏹'] },
    world: {
      platforms: [
        [0, 380, 240], [320, 350, 70, 'c'], [440, 320, 70, 'c'], [560, 290, 70, 'm', 90, 0, 1.5, 290], [800, 330, 100], [1010, 380, 130],
        [1230, 350, 60, 'c'], [1330, 320, 60, 'c'], [1430, 290, 60, 'c'], [1560, 260, 110], [1790, 300, 70, 'm', 0, 100, 1.6, 280], [1970, 380, 200],
        [2270, 350, 60, 'c'], [2390, 320, 70, 'm', 100, 0, 1.7, 320], [2630, 350, 90], [2830, 300, 60, 'c'], [2930, 270, 60, 'c'], [3040, 270, 70, 'm', 0, 90, 1.7, 270],
        [3230, 380, 160], [3500, 340, 60, 'c'], [3600, 310, 60, 'c'], [3700, 280, 70, 'm', 130, 0, 1.6, 280], [3990, 320, 90], [4170, 380, 80],
        [4350, 380, 450],
      ],
      spikes: [
        [1050, 380, 40], [3350, 380, 36], [4500, 380, 40],
      ],
      wolves: [
        [1090, 380, 1020, 1130, 115], [2040, 380, 2000, 2150, 120], [3320, 380, 3260, 3380, 125], [4400, 380, 4370, 4480, 125], [4600, 380, 4560, 4660, 130],
      ],
      checkpoints: [
        [1020, 380], [2000, 380], [3240, 380], [4000, 320],
      ],
      jets: [
        [2110, 380, 0.2], [4020, 320, 0.9], [1600, 260, 0.6],
      ],
      archers: [
        [880, 330, 0], [1640, 260, 0.8], [2700, 350, 1.4], [3400, 380, 1], [4060, 320, 0.4], [4700, 380, 1.2],
      ],
    },
  },
  {
    slug: 'level-8', name: 'Neon Wolfpack', difficulty: 'EXTREME', mode: 'platformer', theme: 'neon', features: ['neon'],
    hearts: 3, length: 7785, goal: 7485,
    intro: 'A long neon-city run. Fire your gun, grab ammo boxes, and use your shield — wolves shoot back! Killing a wolf repairs the shield.',
    controls: `${MOVE} · JUMP or Space · FIRE button or J/F (hold) · stomp works too.`,
    tip: 'FIRE shoots (hold it) · grab ammo boxes · kills repair your shield · wolves shoot back!',
    teaser: 'Neon city: guns, shields and a wolf pack!',
    map: { x: 580, y: 480, color: '#e03131', land: '#30285e', props: ['🏙️', '🔫', '🤖'] },
    world: {
      platforms: [
        [0, 380, 260], [320, 340, 80, 'm', 120, 0, 1.3, 340], [600, 380, 297], [980, 380, 368], [1438, 380, 374], [1895, 350, 60, 'c'],
        [2010, 320, 60, 'c'], [2125, 290, 60, 'c'], [2240, 290, 150], [2450, 320, 60, 'c'], [2565, 350, 60, 'c'], [2680, 380, 319],
        [3078, 380, 349], [3503, 380, 368], [3961, 380, 329], [4371, 380, 360], [4791, 340, 80, 'm', 120, 0, 1.3, 340], [5071, 380, 268],
        [5399, 340, 80, 'm', 120, 0, 1.3, 340], [5679, 380, 282], [6044, 350, 60, 'c'], [6159, 320, 60, 'c'], [6274, 290, 60, 'c'], [6389, 290, 150],
        [6599, 320, 60, 'c'], [6714, 350, 60, 'c'], [6829, 380, 316], [7225, 380, 520],
      ],
      spikes: [
        [1605, 380, 40], [3667, 380, 40], [4531, 380, 40],
      ],
      wolves: [
        [1050, 380, 1020, 1124, 110], [1498, 380, 1468, 1580, 105], [2800, 380, 2760, 2939, 115], [3168, 380, 3108, 3307, 120], [3563, 380, 3533, 3642, 105], [4031, 380, 4001, 4085, 110],
        [4431, 380, 4401, 4506, 105], [6949, 380, 6909, 7085, 115],
      ],
      checkpoints: [
        [1438, 380], [3503, 380], [5071, 380],
      ],
      jets: [
        [1164, 380, 1.4], [4125, 380, 1.1],
      ],
      gunWolves: [
        [852, 380, 812, 872, 3, 0.3], [1303, 380, 1268, 1323, 3, 0.27], [2350, 290, 2310, 2370, 3, 0.53], [3377, 380, 3337, 3397, 3, 0.07], [4245, 380, 4210, 4265, 3, 0.87], [5294, 380, 5254, 5314, 3, 0.76],
        [5916, 380, 5876, 5936, 3, 0.79], [6499, 290, 6459, 6519, 3, 0.41],
      ],
      ammo: [
        [180, 366], [640, 366], [1010, 366], [1478, 366], [2270, 276], [2720, 366],
        [3118, 366], [3543, 366], [3991, 366], [4411, 366], [5111, 366], [5719, 366],
        [6419, 276], [6869, 366],
      ],
    },
  },
  {
    slug: 'level-9', name: 'Sky Kingdom', difficulty: 'MEDIUM-HARD', mode: 'platformer', theme: 'sky', features: ['sky'],
    hearts: 3, length: 9866, goal: 9566,
    rules: { checkpointHeal: 1 },
    intro: 'Float across golden clouds at sunrise. Grab red capes to become SUPER SHEEP: fly, smash wolves, and nothing can hurt you for 8 seconds!',
    controls: `${MOVE} · JUMP or Space · in SUPER mode hold JUMP to fly up, joystick down to descend.`,
    tip: 'Red capes = SUPER mode · grey storm boards: reach another board or ground within 3 s or lightning strikes!',
    teaser: 'Sky kingdom: grab a cape and go SUPER!',
    map: { x: 630, y: 350, color: '#f59f00', land: '#cfe9ff', props: ['☁️', '🌈', '🎈'] },
    world: {
      platforms: [
        [0, 380, 300], [372, 352, 66, 'c'], [490, 324, 66, 'c'], [608, 296, 66, 'c'], [726, 296, 140, 'g'], [926, 326, 66, 'c'],
        [1044, 354, 66, 'c'], [1162, 380, 340], [1557, 340, 84, 'm', 115, 0, 1.3, 340], [1828, 380, 262], [2159, 380, 373], [2608, 380, 323],
        [3018, 380, 362], [3472, 380, 300], [3839, 360, 140, 'g'], [4037, 330, 90, 'm', 110, 0, 1.2, 330], [4303, 350, 130, 'g'], [4493, 320, 66, 'c'],
        [4611, 350, 66, 'c'], [4729, 380, 314], [5098, 340, 84, 'm', 115, 0, 1.3, 340], [5369, 380, 319], [5743, 340, 84, 'm', 115, 0, 1.3, 340], [6014, 380, 264],
        [6333, 340, 84, 'm', 115, 0, 1.3, 340], [6604, 380, 286, 'g'], [6971, 360, 140, 'g'], [7169, 330, 90, 'm', 110, 0, 1.2, 330], [7435, 350, 130, 'g'], [7625, 320, 66, 'c'],
        [7743, 350, 66, 'c'], [7861, 380, 336], [8267, 380, 110], [8442, 330, 80, 'm', 0, 70, 1.2, 330], [8582, 250, 120, 'g'], [8762, 300, 80, 'm', 0, 80, 1.5, 300],
        [8910, 380, 326], [9306, 380, 520],
      ],
      spikes: [
        [2811, 380, 36], [3260, 380, 36],
      ],
      wolves: [
        [1272, 380, 1222, 1452, 105], [1928, 380, 1878, 2030, 100], [2219, 380, 2199, 2295, 100], [2708, 380, 2648, 2841, 100], [3118, 380, 3058, 3290, 110], [3532, 380, 3502, 3592, 100],
        [3662, 380, 3642, 3732, 100], [5469, 380, 5419, 5628, 100], [6114, 380, 6064, 6218, 100], [6704, 380, 6654, 6830, 100], [9030, 380, 8980, 9176, 105],
      ],
      checkpoints: [
        [2159, 380], [3472, 380], [6014, 380], [8910, 380],
      ],
      jets: [
        [2345, 380, 0.6], [2455, 380, 1.7],
      ],
      capes: [
        [1352, 300], [3230, 300], [4893, 300], [6740, 300], [9086, 300],
      ],
    },
  },
  {
    slug: 'level-10', name: 'Crystal Depths', difficulty: 'EXTREME', mode: 'platformer', theme: 'crystal', features: ['crystal'],
    hearts: 3, length: 12389, goal: 12089,
    intro: 'The longest, hardest run: a glowing crystal cavern with falling crystals (watch the cyan ▼), crumbling and moving boards, spikes, fire vents and packs of chasing wolves.',
    controls: `${MOVE} · JUMP or Space (double-jump) · 3 hearts, falling in a gap costs one.`,
    tip: 'Falling crystals: watch the cyan ▼ · wolves chase · the longest, hardest run!',
    teaser: 'Crystal depths: the longest, hardest run!',
    map: { x: 370, y: 265, color: '#0b7285', land: '#1f5566', props: ['💎', '🔮', '🦇'] },
    world: {
      platforms: [
        [0, 380, 300], [379, 380, 431], [882, 330, 64], [1027, 290, 64], [1185, 330, 64], [1343, 300, 64],
        [1484, 380, 344], [1906, 350, 62, 'c'], [2027, 318, 62, 'c'], [2150, 286, 62, 'c'], [2269, 318, 62, 'c'], [2391, 286, 130],
        [2577, 320, 62, 'c'], [2691, 352, 62, 'c'], [2813, 380, 333], [3216, 350, 62, 'c'], [3338, 318, 62, 'c'], [3454, 286, 62, 'c'],
        [3568, 318, 62, 'c'], [3685, 286, 130], [3876, 320, 62, 'c'], [3991, 352, 62, 'c'], [4105, 380, 354], [4542, 380, 406],
        [5003, 340, 78, 'm', 110, 0, 1.4, 340], [5253, 305, 78, 'm', 110, 0, 1.7, 305], [5509, 380, 314], [5878, 340, 78, 'm', 110, 0, 1.4, 340], [6128, 305, 78, 'm', 110, 0, 1.7, 305], [6384, 380, 349],
        [6820, 380, 461], [7354, 380, 456], [7879, 350, 62, 'c'], [7998, 318, 62, 'c'], [8115, 286, 62, 'c'], [8232, 318, 62, 'c'],
        [8346, 286, 130], [8532, 320, 62, 'c'], [8653, 352, 62, 'c'], [8774, 380, 356], [9205, 380, 413], [9685, 380, 457],
        [10233, 380, 110], [10405, 330, 78, 'm', 0, 72, 1.4, 330], [10543, 250, 110], [10713, 300, 78, 'm', 0, 84, 1.7, 300], [10857, 380, 370], [11327, 380, 427],
        [11829, 380, 560],
      ],
      spikes: [
        [489, 380, 40], [670, 380, 40], [4652, 380, 40], [4808, 380, 40], [6930, 380, 40], [7141, 380, 40],
        [7464, 380, 40], [7670, 380, 40], [9391, 380, 40], [9795, 380, 40], [10002, 380, 40], [11042, 380, 36],
        [11437, 380, 40], [11614, 380, 40],
      ],
      wolves: [
        [439, 380, 419, 479, 108], [594, 380, 529, 650, 130], [2923, 380, 2873, 3096, 124], [4215, 380, 4165, 4409, 108], [4602, 380, 4582, 4642, 108], [4745, 380, 4692, 4788, 124],
        [5619, 380, 5559, 5763, 124], [6494, 380, 6434, 6673, 116], [6880, 380, 6860, 6920, 130], [7050, 380, 6970, 7121, 130], [7414, 380, 7394, 7454, 124], [7582, 380, 7504, 7650, 108],
        [8884, 380, 8834, 9080, 124], [9285, 380, 9245, 9381, 108], [9451, 380, 9431, 9568, 108], [9745, 380, 9725, 9785, 116], [9913, 380, 9835, 9982, 108], [10977, 380, 10927, 11167, 124],
        [11387, 380, 11367, 11427, 124], [11540, 380, 11477, 11594, 124],
      ],
      checkpoints: [
        [2813, 380], [5509, 380], [7354, 380], [9685, 380],
      ],
      jets: [
        [594, 380, 0.4], [1059, 290, 2.1], [1375, 300, 0.9], [6558, 380, 0.8], [7050, 380, 0.4], [7582, 380, 1],
        [9913, 380, 2], [11540, 380, 0],
      ],
    },
  },
];

/** Infinite Mode: not a numbered level, an endless generated run in Night of Fire's style. */
export const INFINITE = {
  slug: 'infinite', name: 'Infinite Mode', difficulty: 'ENDLESS', mode: 'platformer', theme: 'fire', features: ['infinite'],
  infinite: true, title: '∞ Infinite Mode',
  hearts: 3, length: 1e9, goal: 1e9,
  intro: "Not a level: an endless run in Level 2's night of fire. The screen scrolls by itself and speeds up as your score grows. Stay ahead of the red edge! Top-10 scoreboard.",
  controls: `${MOVE} · JUMP or Space (double-jump) · score = metres + 10 per clover.`,
  tip: 'INFINITE MODE: the screen scrolls by itself and speeds up as your score grows · keep up!',
  map: { x: 170, y: 120 },
  world: {
    platforms: [
      [0, 380, 320],
    ],
  },
};

LEVELS.forEach((level, i) => {
  level.index = i;
  level.number = i + 1;
  level.title = `Level ${i + 1} · ${level.name}`;
  level.loseText ??= 'Brutal! Study the timing, then try again.';
});
INFINITE.index = LEVELS.length;
INFINITE.loseText = '';

export const ALL_LEVELS = [...LEVELS, INFINITE];

/** Accepts 1..10 (as number or string) or 'infinite'; returns the level or undefined. */
export function findLevel(key) {
  if (key === 'infinite' || key === 'inf') return INFINITE;
  return LEVELS[Number(key) - 1];
}
