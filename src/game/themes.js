import { TRACK } from './path'

// Look of each Grand Prix venue: ground colours, how hilly it is, scenery mix.
export const THEMES = {
  meadow: {
    label: 'Green meadow',
    ground: { hue: 0.28, sat: 0.55, light: 0.24 }, dryHue: -0.06,
    hills: 14, farHills: 26, lake: false,
    trees: 1, pines: 0.45, leafHue: 0.24, rocks: 1, flowers: 1,
    verge: ['#5d9b3f', '#4a8532'],
  },
  lake: {
    label: 'Lakeside',
    ground: { hue: 0.3, sat: 0.5, light: 0.25 }, dryHue: -0.04,
    hills: 10, farHills: 30, lake: true,
    trees: 1.1, pines: 0.7, leafHue: 0.3, rocks: 0.8, flowers: 1.3,
    verge: ['#5fa046', '#4b8838'],
  },
  hills: {
    label: 'Autumn hills',
    ground: { hue: 0.2, sat: 0.5, light: 0.25 }, dryHue: -0.1,
    hills: 24, farHills: 38, lake: false,
    trees: 1.2, pines: 0.3, leafHue: 0.08, rocks: 1.2, flowers: 0.6,
    verge: ['#7a9a3c', '#668632'],
  },
  canyon: {
    label: 'Red canyon',
    ground: { hue: 0.07, sat: 0.5, light: 0.42 }, dryHue: 0.03,
    hills: 30, farHills: 55, lake: false,
    trees: 0.25, pines: 0.2, leafHue: 0.18, rocks: 3, flowers: 0.2,
    verge: ['#c9a36a', '#b88f58'],
  },
}

/** Theme of the track currently loaded (see setTrack in path.js). */
export const currentTheme = () => THEMES[TRACK?.theme] || THEMES.meadow
