export const themeEffects = {
    arrakis: {
        tick: { frequency: 145, end: 62 },
        chime: { notes: [82.41, 123.47, 164.81], release: 0.9, spacing: 0.16 },
        particles: { colors: ['#ffcc96', '#eea465', '#bb6d3d', '#fff0d8', '#9cdafa'], size: 2, spread: 4, count: 90 }
    },
    spooky: {
        hub: ['#151321', '#cbc4dd', '#423750', '#171321'],
        tick: { frequency: 270, end: 92, wave: 'sawtooth', volume: 0.027 },
        chime: { notes: [146.83, 155.56, 220], release: 0.85, spacing: 0.15 },
        particles: { colors: ['#fcead1', '#c5b4ee', '#a575de', '#ff9f5f'], size: 2, spread: 4, count: 44 },
        scene: { winner: 'Tonight at the haunted drive-in' }
    },
    forest: {
        hub: ['#ffda91', '#a16d3d', '#795333', '#35271f'],
        tick: { frequency: 460, end: 215, volume: 0.048 },
        chime: { notes: [261.63, 392, 523.25], release: 0.72, spacing: 0.11 },
        particles: { colors: ['#ffe2a5', '#f9ad54', '#ef7747'], size: 2, spread: 4, count: 54 },
        scene: { winner: 'Tonight around the campfire' }
    },
    thanksgiving: {
        hub: ['#dba357', '#8e4d29', '#efb66b', '#572a1e'],
        tick: { frequency: 315, end: 170, volume: 0.05 },
        chime: { notes: [196, 246.94, 293.66, 392], release: 0.65, spacing: 0.11 },
        particles: { colors: ['#e66d40', '#df9b45', '#b44235', '#f2c875'], size: 6, spread: 9, count: 64 },
        scene: { winner: 'The main course' }
    },
    holiday: {
        hub: ['#e7ba63', '#a13047', '#e2b65f', '#214d3c'],
        tick: { frequency: 870, wave: 'sine', volume: 0.045 },
        chime: { notes: [523.25, 659.25, 783.99, 1046.5], release: 0.62, spacing: 0.1 },
        particles: { colors: ['#f9f5ea', '#deeaee', '#f3d393'], size: 3, spread: 5, count: 68 },
        scene: { winner: 'Under the marquee tonight' }
    },
    hanukkah: {
        hub: ['#ffdf91', '#3765a1', '#c89f54', '#182e54'],
        tick: { frequency: 690, end: 460, volume: 0.042 },
        chime: { notes: [293.66, 349.23, 440, 587.33], release: 0.8, spacing: 0.14 },
        particles: { colors: ['#ffe4a3', '#f2bc64', '#8ebaf7', '#f4f7ff'], size: 2, spread: 6, count: 55 },
        scene: { winner: 'Tonight by candlelight' }
    },
    friendslop: {
        hub: ['#d6fa75', '#283821', '#829343', '#191724'],
        tick: { frequency: 380, end: 770, wave: 'square', volume: 0.021 },
        chime: { notes: [196, 293.66, 392, 587.33], release: 0.36, spacing: 0.09, wave: 'triangle' },
        particles: { colors: ['#d6fa75', '#ffae61', '#a89aff', '#efffc9'], size: 4, spread: 9, count: 72 },
        scene: { winner: 'Extraction complete' }
    }
};
