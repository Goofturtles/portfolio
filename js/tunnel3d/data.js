// The film's tunnel, as numbers. Every table here is read off film/research/P1.md (reference frames f92 to f128 of
// film/ref/loop.mp4, 24 fps); f is a reference frame number and may be fractional. No THREE in this file.

export const F_FIRST = 92
export const F_LAST = 136 // sampled up to here (the flight ends on white long before)
const NF = F_LAST - F_FIRST + 1

// ---- ring tables (u = 1 / screen radius in frame widths; a tip line at u sits at depth 0.5 u metres) -------------
// Section A: rings A1..A6 (A6 is the far rim). Section B: rings B1..B10 (the rim comes from the opening table).
const A_TABLE = {
  92: [null, 3.18, 3.75, 4.30, 4.97, 5.94], 93: [2.39, 2.88, 3.40, 4.02, 4.75, 5.79], 94: [2.12, 2.62, 3.15, 3.80, 4.60, 5.72],
  95: [null, 2.42, 2.98, 3.65, 4.47, 5.70], 96: [null, 2.28, 2.85, 3.55, 4.39, 5.73], 97: [null, 2.18, 2.76, 3.49, 4.39, 5.80],
  98: [null, 2.12, 2.72, 3.48, 4.42, 5.67], 99: [null, 2.06, 2.68, 3.43, 4.42, 5.76], 100: [null, 2.02, 2.65, 3.43, 4.45, 5.80],
  101: [null, null, 2.58, 3.39, 4.39, 5.79], 102: [null, null, 2.51, 3.32, 4.37, 5.80], 103: [null, null, 2.36, 3.18, 4.23, 5.69],
  104: [null, null, 2.21, 3.01, 4.06, 5.49], 105: [null, null, 1.99, 2.76, 3.79, 5.16], 106: [null, null, null, 2.46, 3.46, 4.77],
  107: [null, null, null, 2.14, 3.06, 4.33], 108: [null, null, null, null, 2.66, 3.86], 109: [null, null, null, null, 2.26, 3.38],
  110: [null, null, null, null, null, 2.86], 111: [null, null, null, null, null, 2.35],
}
const B_TABLE = {
  106: [null, null, 5.77], 107: [null, null, 5.13, 6.03], 108: [null, null, 4.69, 5.54, 6.07], 109: [null, 3.83, 4.66, 5.52, 6.16],
  110: [null, 3.76, 4.60, 5.50, 6.26, 7.11], 111: [null, 3.68, 4.55, 5.43, 6.26, 7.20], 112: [2.69, 3.63, 4.49, 5.34, 6.23, 7.24],
  113: [2.65, 3.63, 4.39, 5.24, 6.16, 7.20, 8.38, 9.88], 114: [2.52, 3.46, 4.27, 5.12, 6.04, 7.10, 8.38, 9.71],
  115: [2.39, 3.33, 4.13, 4.95, 5.89, 6.96, 8.25, 9.61], 116: [2.23, 3.16, 3.95, 4.75, 5.69, 6.74, 8.04, 9.51, 11.2, 13.0],
  117: [2.05, 2.95, 3.72, 4.49, 5.40, 6.46, 7.78, 9.11, 11.36, 13.70], 118: [null, 2.71, 3.45, 4.20, 5.07, 6.11, 7.40, 8.85, 10.78, 13.30],
  119: [null, null, 3.15, 3.86, 4.70, 5.69, 6.94, 8.35, 10.21, 12.55], 120: [null, null, 2.79, 3.48, 4.29, 5.23, 6.43, 7.77, 9.60, 12.03],
  121: [null, null, null, 3.09, 3.85, 4.75, 5.89, 7.14, 8.78, 11.3], 122: [null, null, null, 2.69, 3.40, 4.23, 5.32, 6.57, 8.14, 10.38],
  123: [null, null, null, 2.26, 2.93, 3.70, 4.72, 5.92, 7.41, 9.65], 124: [null, null, null, null, 2.43, 3.15, 4.08, 5.20, 6.66, 8.65],
  125: [null, null, null, null, null, 2.52, 3.38, 4.39, 5.74, 7.43], 126: [null, null, null, null, null, null, 2.58, 3.45, 4.69, null],
  127: [null, null, null, null, null, null, null, 2.29, 3.35, null],
}
export const NA = 8 // A_{-1}, A0, A1..A6   (index = k + 1)
export const NB = 17 // B_{-1}, B0, B1..B15  (index = k + 1)

// Fill a row of tip lines: gaps by geometric interpolation, nearer rings by the nearest ratio, deeper rings likewise.
function fillRow(known, n, firstIdx, defRatio) {
  // known: array starting at ring number firstIdx (A1 or B1), with nulls
  const arr = new Array(n).fill(null)
  for (let i = 0; i < known.length; i++) if (known[i] != null) arr[i + firstIdx] = known[i]
  const idx = []
  for (let i = 0; i < n; i++) if (arr[i] != null) idx.push(i)
  const out = new Float32Array(n)
  const clampR = (r, lo, hi) => Math.min(hi, Math.max(lo, r))
  for (const i of idx) out[i] = arr[i]
  for (let q = 0; q + 1 < idx.length; q++) {
    const i0 = idx[q], i1 = idx[q + 1]
    for (let i = i0 + 1; i < i1; i++) out[i] = arr[i0] * Math.pow(arr[i1] / arr[i0], (i - i0) / (i1 - i0))
  }
  const rN = idx.length >= 2 ? clampR(Math.pow(arr[idx[1]] / arr[idx[0]], 1 / (idx[1] - idx[0])), 1.12, 1.45) : defRatio
  for (let i = idx[0] - 1; i >= 0; i--) out[i] = out[i + 1] / rN
  const L = idx.length
  const rF = L >= 2 ? clampR(Math.pow(arr[idx[L - 1]] / arr[idx[L - 2]], 1 / (idx[L - 1] - idx[L - 2])), 1.1, 1.3) : defRatio
  for (let i = idx[L - 1] + 1; i < n; i++) out[i] = out[i - 1] * rF
  return out
}

const A_U = [] // per integer frame, Float32Array(NA)
const B_U = []
{
  const aRow = {}
  for (const f in A_TABLE) aRow[f] = fillRow(A_TABLE[f], NA, 2, 1.3) // A1 is index 2
  const bRow = {}
  for (const f in B_TABLE) bRow[f] = fillRow(B_TABLE[f], NB, 2, 1.14) // B1 -> index 2
  for (let fi = 0; fi < NF; fi++) {
    const f = F_FIRST + fi
    let a
    if (f <= 111) a = aRow[f]
    else { // slides off, about 0.55 u a frame, then gone
      a = Float32Array.from(aRow[111], (v) => Math.max(0.3, v - 0.55 * (f - 111) * (1 + 0.15 * (f - 111))))
    }
    A_U.push(a)
    let b
    if (f < 106) b = bRow[106]
    else if (f <= 127) b = bRow[f]
    else b = Float32Array.from(bRow[127], (v) => v * Math.pow(0.64, f - 127))
    B_U.push(b)
  }
}

// ---- the far opening (sky radius, in W) and section A's rim ----------------------------------------------------------
const SKY_R = {
  92: 0.171, 93: 0.175, 94: 0.177, 95: 0.177, 96: 0.176, 97: 0.174, 98: 0.172, 99: 0.169, 100: 0.168, 101: 0.167, 102: 0.169,
  103: 0.173, 104: 0.181, 105: 0.177, 106: 0.177, 107: 0.169, 108: 0.151, 109: 0.143, 110: 0.127, 111: 0.120, 112: 0.104,
  113: 0.099, 114: 0.086, 115: 0.083, 116: 0.072, 117: 0.070, 118: 0.070, 119: 0.072, 120: 0.076, 121: 0.080, 122: 0.087,
  123: 0.095, 124: 0.108, 125: 0.127, 126: 0.152, 127: 0.20, 128: 0.39, 129: 0.80, 130: 1.6, 131: 3.2, 132: 6.4, 133: 13, 134: 26, 135: 52, 136: 104,
}
const A_RIM_R = { 105: 0.194, 106: 0.210, 107: 0.231, 108: 0.259, 109: 0.296, 110: 0.350, 111: 0.426, 112: 0.52, 113: 0.70, 114: 0.95 }

// ---- rotation (degrees a frame, + = clockwise on screen) -------------------------------------------------------------
function keyed(keys) { // piecewise-linear rate from [[f, rate], ...]; held outside
  return (f) => {
    if (f <= keys[0][0]) return keys[0][1]
    for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) {
      const k0 = keys[i - 1], k1 = keys[i]
      return k0[1] + (k1[1] - k0[1]) * (f - k0[0]) / (k1[0] - k0[0])
    }
    return keys[keys.length - 1][1]
  }
}
const NEAR = keyed([[93, -5], [99, -5]])
const A_RATE = [NEAR, NEAR, NEAR, NEAR,
  keyed([[93.5, -5], [95.5, -2.9], [96.5, -2.0], [98, -1.4], [101, -1.3], [104, -2.4], [106, -3], [111, -3]]),
  keyed([[93.5, -4.5], [95.5, -2.0], [96.5, -0.1], [98, 1.7], [101, 2.9], [104, 1.7], [106, -0.7], [108, -1.2], [111, -2]]),
  keyed([[93.5, -3], [95.5, -0.4], [96.5, 1.6], [98, -1.8], [101, -0.5], [104, -1.25], [105.5, -3.4], [106.5, -5.2], [107.5, -7.2], [109, -2.6], [111, -3]]),
  keyed([[93.5, -2], [95.5, 1.2], [96.5, 4.2], [98, 1.0], [101, -3.3], [104, 2.6], [105.5, 0.3], [106.5, -2.0], [107.5, -4.6], [109, -1.0], [110, -4.5], [111, -9]]),
]
const B_RATE = keyed([[105, 4.0], [118.5, 4.0], [119.5, 4.1], [120.5, 4.4], [121.5, 4.6], [122.5, 5.2], [123.5, 5.6], [124.5, 6.2], [125.5, 6.9], [126.5, 8], [129, 10]])
const RAD = Math.PI / 180
// cumulative angle (radians) at each integer frame, then interpolated
const A_ANG = A_RATE.map(() => new Float32Array(NF))
const B_ANG = new Float32Array(NF)
for (let fi = 1; fi < NF; fi++) {
  const f = F_FIRST + fi - 0.5
  for (let k = 0; k < NA; k++) A_ANG[k][fi] = A_ANG[k][fi - 1] + A_RATE[k](f) * RAD
  B_ANG[fi] = B_ANG[fi - 1] + B_RATE(f) * RAD
}
// where each ring's pattern starts (the film's own are unknown): spread so neighbours never line up
// the film's own starting angles are unknown: line the rings up at f100 so their strands read as one twisted rope across the seams
const A_PHASE = Array.from({ length: NA }, (_, k) => -A_ANG[k][100 - F_FIRST] + 0.3 * k * RAD)
const B_PHASE = 0.6 * RAD

// ---- colour ------------------------------------------------------------------------------------------------------
// Stops go round the tunnel clockwise from 3 o'clock every 45 degrees: right, lower right, bottom, lower left, left,
// upper left, top, upper right. Each stop: shade, middle, lit. These zones stay put on screen while the wall turns.
export const PAL_A = ['#1356BF', '#1D74C4', '#58B4EC', '#1740BD', '#3363C5', '#7C96E3', '#1922AD', '#3A47BE', '#6980DC', '#121BA9', '#2B33B8', '#5C60DD',
  '#1625A6', '#213DB8', '#4E7ADB', '#0E3CB1', '#1D52BC', '#5A7EDD', '#0B53B9', '#1269C2', '#30B0EA', '#1261C1', '#167BC6', '#3AACEB']
// How section A's light changes through its time on screen (read off the film at f93 and f106): pale and pastel on entry, saturated by f100, darker and bluer as it leaves
export const PAL_A_E = ['#4378D0', '#2863BD', '#88B4EF', '#5C68D0', '#3F50CF', '#90A6EF', '#6558CC', '#4B3CC8', '#9C8EF1', '#4850C8', '#172ABD', '#8C84ED',
  '#2A58C8', '#0F44B8', '#6888E5', '#1C6CCC', '#1156BF', '#4A9BE6', '#2279CC', '#1165C2', '#7FACE0', '#2A82D0', '#0E6EC8', '#72B6EF']
export const PAL_A_D = ['#1F70C0', '#174DAD', '#48A6E3', '#1870C0', '#164DAA', '#2EA1E6', '#126BC0', '#134DB2', '#2092DC', '#3558A6', '#1A38AA', '#5C6AD0',
  '#3C4EB4', '#152DB0', '#6A78D8', '#3436BC', '#1425AA', '#5C68D5', '#453BC0', '#251BB4', '#7E5DE2', '#2A57BC', '#1248A8', '#489AD7']
export const PAL_B = ['#10147E', '#14269F', '#1940AF', '#0F1280', '#1B21A4', '#4D52C4', '#0E0E5D', '#15148C', '#726ACC', '#0E0F68', '#17188F', '#5B63C8',
  '#0D0F5A', '#1E35A2', '#697BCC', '#0D0D56', '#162A82', '#39409B', '#0C1153', '#101A64', '#25418B', '#0E0D55', '#10146C', '#303B8D']
export const PAL_B_EXIT = ['#1E16DB', '#5538F3', '#9870F9', '#1A22DB', '#4A45F4', '#8C78F9', '#1F18DD', '#5A3CF4', '#9A72F9', '#1C26E0', '#4C48F5', '#8E80F9',
  '#1441DB', '#2C7BF7', '#6CABFC', '#1345D8', '#2A80F6', '#6AAEFC', '#1650D8', '#3088F7', '#78B6FC', '#1B3ADC', '#3A66F5', '#82A0FB']

const SKY_KEYS = [ // f, upper-left, lower-right
  [92, '#9AA8EA', '#90AEEA'], [105, '#8292E6', '#779CE6'], [115, '#8D98E6', '#84A0E8'], [121, '#8A9BE7', '#8A9BE7'],
  [124, '#B2B9EF', '#BBC8F2'], [127, '#BCCAF3', '#CDDDF4'], [128, '#B9D8F5', '#F0EDFC'], [130, '#F0F0FD', '#F4F1FD'], [133, '#F6F4FE', '#F6F4FE'],
]

// ---- sampling -----------------------------------------------------------------------------------------------------
export function hex3(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255] }
const SKY_RGB = SKY_KEYS.map(([f, a, b]) => [f, hex3(a), hex3(b)])
function lerp(a, b, t) { return a + (b - a) * t }
function smooth(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

function frameIdx(f) {
  const x = Math.min(F_LAST - 1e-6, Math.max(F_FIRST, f)) - F_FIRST
  const i = Math.floor(x)
  return [i, x - i]
}
function lerpLog(arrs, i, t, k) { return Math.exp(lerp(Math.log(arrs[i][k]), Math.log(arrs[i + 1][k]), t)) }
function tableAt(tab, f, defRim) {
  const keys = Object.keys(tab).map(Number).sort((a, b) => a - b)
  if (f <= keys[0]) return defRim
  for (let i = 1; i < keys.length; i++) if (f <= keys[i]) return lerp(tab[keys[i - 1]], tab[keys[i]], (f - keys[i - 1]) / (keys[i] - keys[i - 1]))
  return tab[keys[keys.length - 1]]
}

const state = {
  f: 0, A: new Float32Array(NA), B: new Float32Array(NB), angA: new Float32Array(NA), angB: 0,
  skyU: 6, rimAU: 6, rimBU: 6, blur: 0, lift: 0, white: 0, glowB: 0, glowA: 1, skyUL: [0, 0, 0], skyLR: [0, 0, 0],
}

export function sampleFlight(f) {
  const s = state
  s.f = f
  const [i, t] = frameIdx(f)
  for (let k = 0; k < NA; k++) {
    s.A[k] = lerpLog(A_U, i, t, k)
    s.angA[k] = lerp(A_ANG[k][i], A_ANG[k][i + 1], t) + A_PHASE[k]
  }
  for (let k = 0; k < NB; k++) s.B[k] = lerpLog(B_U, i, t, k)
  s.angB = lerp(B_ANG[i], B_ANG[i + 1], t) + B_PHASE
  // the sky edge: before f105 it is section A's own rim (the film shows no collar before then)
  const sky = tableAt(SKY_R, f, 0.171)
  const a6 = s.A[7]
  const skyU = f >= 105 ? 1 / sky : lerp(a6, 1 / sky, smooth(104, 105, f))
  s.skyU = skyU
  s.rimBU = Math.max(skyU, 0.01)
  s.rimAU = f < 105 ? skyU : Math.max(0.01, 1 / tableAt(A_RIM_R, f, 0.194))
  // radial blur: a short shutter (0.13 of a frame) acting on how fast the wall rushes at the camera (the film's exit smears a little more)
  const u0 = lerpLog(B_U, ...frameIdx(f - 0.5), 9), u1 = lerpLog(B_U, ...frameIdx(f + 0.5), 9)
  s.blur = Math.min(0.5, Math.max(0, 0.15 * (u0 / u1 - 1) * (1 + 1.5 * smooth(126.5, 128, f))))
  s.glowB = smooth(108, 124, f)
  s.lift = smooth(120.5, 127, f)
  s.white = smooth(123.5, 128.6, f)
  // sky colours
  let k = 0
  while (k < SKY_RGB.length - 2 && f > SKY_RGB[k + 1][0]) k++
  const k0 = SKY_RGB[k], k1 = SKY_RGB[k + 1]
  const q = Math.min(1, Math.max(0, (f - k0[0]) / (k1[0] - k0[0])))
  for (let c = 0; c < 3; c++) { s.skyUL[c] = lerp(k0[1][c], k1[1][c], q); s.skyLR[c] = lerp(k0[2][c], k1[2][c], q) }
  return s
}

// ---- small objects (screen boxes per frame come from tracks.js) -----------------------------------------------------
export const CARD = { // f: long side (W), angle of the long side from level (degrees, backslash lean)
  120: [0.013, 73], 121: [0.024, 63], 122: [0.033, 53], 123: [0.040, 43], 124: [0.045, 34], 125: [0.053, 22], 126: [0.061, 11],
  127: [0.068, 8], 128: [0.080, 1], 129: [0.103, 0], 130: [0.135, 0], 131: [0.17, 0], 132: [0.22, 0], 133: [0.3, 0],
}

// The white trail: screen polylines (x of W, y of H; old end first, the cursor's end last) at the frames the study lists,
// with width in px at 1080p and opacity. Two pieces: the long sweep f92-f96 and the line joined to the cursor f98-f124.
const T1 = [
  [92, 4, 1, [[0.73, 0.63], [0.73, 0.45], [0.70, 0.30], [0.63, 0.17], [0.585, 0.15]]],
  [93, 7, 1, [[0.821, 0.668], [0.820, 0.538], [0.812, 0.344], [0.801, 0.214], [0.776, 0.084], [0.74, 0.0], [0.72, -0.06], [0.66, -0.05], [0.61, 0.06], [0.57, 0.17]]],
  [94, 9, 1, [[0.939, 0.654], [0.915, 0.439], [0.892, 0.294], [0.861, 0.150], [0.816, 0.006], [0.79, -0.06]]],
  [95, 9, 1, [[1.02, 0.38], [0.986, 0.306], [0.964, 0.232], [0.939, 0.156], [0.909, 0.081], [0.877, 0.005], [0.85, -0.06]]],
  [96, 9, 1, [[1.06, 0.2], [0.996, 0.123], [0.931, 0.006], [0.9, -0.05]]],
]
const T2 = [
  [97, 9, 0, [[0.43, -0.05], [0.41, 0.06], [0.40, 0.17]]],
  [98, 9, 1, [[0.417, 0.004], [0.405, 0.06], [0.394, 0.110], [0.40, 0.2]]],
  [100, 8, 1, [[0.351, 0.006], [0.335, 0.057], [0.331, 0.109], [0.336, 0.161], [0.354, 0.213], [0.367, 0.236]]],
  [102, 9, 1, [[0.259, 0.007], [0.242, 0.093], [0.248, 0.174], [0.286, 0.254], [0.334, 0.280], [0.358, 0.275]]],
  [104, 10, 1, [[0.103, 0.006], [0.091, 0.144], [0.136, 0.281], [0.214, 0.331], [0.292, 0.278], [0.298, 0.257]]],
  [105, 10, 1, [[0.03, 0.0], [0.01, 0.15], [0.05, 0.30], [0.14, 0.385], [0.21, 0.37], [0.245, 0.345], [0.262, 0.30], [0.25, 0.265], [0.22, 0.27], [0.225, 0.31], [0.26, 0.34], [0.30, 0.37]]],
  [106, 10, 1, [[0.0, 0.31], [0.10, 0.37], [0.17, 0.37], [0.20, 0.33], [0.205, 0.28], [0.18, 0.265], [0.165, 0.30], [0.19, 0.36], [0.18, 0.45], [0.20, 0.52], [0.23, 0.54]]],
  [107, 10, 1, [[0.007, 0.364], [0.083, 0.379], [0.125, 0.345], [0.15, 0.30], [0.17, 0.31], [0.16, 0.36], [0.124, 0.424], [0.145, 0.559], [0.180, 0.620], [0.256, 0.656]]],
  [109, 8, 1, [[0.004, 0.378], [0.073, 0.404], [0.070, 0.508], [0.086, 0.613], [0.134, 0.710], [0.193, 0.752], [0.252, 0.748], [0.310, 0.696], [0.349, 0.597]]],
  [111, 6, 1, [[0.003, 0.496], [0.046, 0.669], [0.087, 0.754], [0.135, 0.803], [0.184, 0.818], [0.233, 0.805], [0.282, 0.761], [0.326, 0.681]]],
  [113, 4.5, 0.9, [[0.006, 0.812], [0.070, 0.890], [0.133, 0.920], [0.197, 0.904], [0.260, 0.834], [0.286, 0.781], [0.33, 0.67], [0.415, 0.71]]],
  [115, 2.5, 0.55, [[0.19, 1.02], [0.27, 0.83], [0.33, 0.78], [0.40, 0.76], [0.47, 0.70]]],
  [118, 1.8, 0.4, [[0.27, 1.02], [0.38, 0.86], [0.46, 0.76], [0.50, 0.66]]],
  [119, 2.5, 0.6, [[0.35, 0.98], [0.42, 0.92], [0.47, 0.86], [0.50, 0.78], [0.515, 0.70], [0.52, 0.65]]],
  [121, 1.2, 0.35, [[0.52, 0.85], [0.535, 0.63]]],
  [122, 2, 0.8, [[0.56, 0.70], [0.542, 0.60]]],
  [123, 2, 0.8, [[0.57, 0.648], [0.55, 0.59]]],
  [124, 1.2, 0.6, [[0.571, 0.599], [0.558, 0.584]]],
  [125, 1, 0, [[0.575, 0.58], [0.568, 0.572]]],
]
export const TRAILS = [T1, T2]
