/**
 * Pi Digit Engine, Turkish Alphabet & Symbol Mapping Utilities
 */

const TURKISH_ALPHABET = [
  "A", "B", "C", "Ç", "D", "E", "F", "G", "Ğ", "H", 
  "I", "İ", "J", "K", "L", "M", "N", "O", "Ö", "P", 
  "R", "S", "Ş", "T", "U", "Ü", "V", "Y", "Z", " "
];

const TURKISH_FREQUENT_LETTERS = [
  "A", // 0
  "E", // 1
  "İ", // 2
  "N", // 3
  "R", // 4
  "L", // 5
  "I", // 6
  "D", // 7
  "K", // 8
  "M"  // 9
];

const EMOJI_PALETTE = ["🪐", "🌌", "⭐", "🎨", "🧠", "⚡", "🔮", "💎", "🧬", "👁️"];
const ASCII_RAMP = [" ", "·", ":", "-", "=", "+", "*", "#", "%", "@"];

const COLOR_PALETTES = {
  cyberpunk: {
    name: "Cyberpunk Neon",
    colors: [
      "#ff0055", // 0: Neon Pink
      "#00f0ff", // 1: Cyber Cyan
      "#7928ca", // 2: Purple Glow
      "#ffbe0b", // 3: Bright Amber
      "#00ff66", // 4: Matrix Lime
      "#ff007f", // 5: Deep Rose
      "#3a86ff", // 6: Electric Blue
      "#8338ec", // 7: Violet
      "#fb5607", // 8: Neon Orange
      "#ff00a0"  // 9: Magenta
    ],
    rgb: [
      [255, 0, 85],
      [0, 240, 255],
      [121, 40, 202],
      [255, 190, 11],
      [0, 255, 102],
      [255, 0, 127],
      [58, 134, 255],
      [131, 56, 236],
      [251, 86, 7],
      [255, 0, 160]
    ]
  },
  monalisa: {
    name: "Mona Lisa Pigments (Da Vinci)",
    colors: [
      "#241d15", // 0: Raw Umber
      "#4a3b2c", // 1: Burnt Umber
      "#7d5a3c", // 2: Warm Ochre
      "#a67c52", // 3: Sfumato Brown
      "#c49a6c", // 4: Renaissance Flesh
      "#e0be8b", // 5: Highlight Beige
      "#3a4f41", // 6: Tuscan Olive Green
      "#5b6e58", // 7: Distant Landscape Green
      "#4b5d67", // 8: Sky Glaze Blue-Grey
      "#1a1612"  // 9: Deep Velvet Black
    ],
    rgb: [
      [36, 29, 21],
      [74, 59, 44],
      [125, 90, 60],
      [166, 124, 82],
      [196, 154, 108],
      [224, 190, 139],
      [58, 79, 65],
      [91, 110, 88],
      [75, 93, 103],
      [26, 22, 18]
    ]
  },
  spectral: {
    name: "Spectral Rainbow",
    colors: [
      "#ff0000", "#ff7700", "#ffdd00", "#77ff00", "#00ff55",
      "#00ffdd", "#0077ff", "#2200ff", "#9900ff", "#ff0099"
    ],
    rgb: [
      [255, 0, 0], [255, 119, 0], [255, 221, 0], [119, 255, 0], [0, 255, 85],
      [0, 255, 221], [0, 119, 255], [34, 0, 255], [153, 0, 255], [255, 0, 153]
    ]
  },
  thermal: {
    name: "Thermal Heatmap",
    colors: [
      "#000004", "#1b0c41", "#4f0b6e", "#781c6d", "#a52c60",
      "#cf4446", "#ed6925", "#fb9b06", "#f7d13d", "#fcffa4"
    ],
    rgb: [
      [0, 0, 4], [27, 12, 65], [79, 11, 110], [120, 28, 109], [165, 44, 96],
      [207, 68, 70], [237, 105, 37], [251, 155, 6], [247, 209, 61], [252, 255, 164]
    ]
  },
  pastel: {
    name: "Pastel Dream",
    colors: [
      "#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff",
      "#a0c4ff", "#bdb2ff", "#ffc6ff", "#fffffc", "#f1c0e8"
    ],
    rgb: [
      [255, 173, 173], [255, 214, 165], [253, 255, 182], [202, 255, 191], [155, 246, 255],
      [160, 196, 255], [189, 178, 255], [255, 198, 255], [255, 255, 252], [241, 192, 232]
    ]
  },
  monochrome: {
    name: "OLED Monochrome",
    colors: [
      "#000000", "#1c1c1c", "#383838", "#555555", "#717171",
      "#8e8e8e", "#aaaaaa", "#c6c6c6", "#e3e3e3", "#ffffff"
    ],
    rgb: [
      [0, 0, 0], [28, 28, 28], [56, 56, 56], [85, 85, 85], [113, 113, 113],
      [142, 142, 142], [170, 170, 170], [198, 198, 198], [227, 227, 227], [255, 255, 255]
    ]
  }
};

class PiEngine {
  constructor() {
    this.digits = [];
    this.digitsString = "";
    this.decodedTurkishText = "";
    this.currentPalette = "cyberpunk";
    this.mappingMode = "single"; // 'single', 'dual', 'rgb', 'hex'
    this.symbolMode = "none"; // 'none', 'turkish-letters', 'turkish-dual', 'morse', 'binary', 'emoji', 'ascii'
    this.onDigitsAddedCallbacks = [];
  }

  reset() {
    this.digits = [];
    this.digitsString = "";
    this.decodedTurkishText = "";
  }

  addDigits(newDigits) {
    if (newDigits instanceof Uint8Array || Array.isArray(newDigits)) {
      const prevLength = this.digits.length;
      for (let i = 0; i < newDigits.length; i++) {
        this.digits.push(newDigits[i]);
      }

      // Update digit string
      if (this.digitsString.length < 500000) {
        let chunkStr = "";
        for (let i = 0; i < newDigits.length; i++) {
          chunkStr += newDigits[i];
        }
        this.digitsString += chunkStr;
      }

      // Update decoded Turkish text stream (mod 30 dual-digit decoding)
      if (this.decodedTurkishText.length < 200000) {
        let textChunk = "";
        const startI = prevLength % 2 === 1 ? prevLength - 1 : prevLength;
        for (let i = startI; i < this.digits.length - 1; i += 2) {
          const val = (this.digits[i] * 10 + this.digits[i + 1]) % 30;
          textChunk += TURKISH_ALPHABET[val];
        }
        this.decodedTurkishText += textChunk;
      }
    }

    for (const cb of this.onDigitsAddedCallbacks) {
      cb(newDigits, this.digits.length);
    }
  }

  onDigitsAdded(cb) {
    this.onDigitsAddedCallbacks.push(cb);
  }

  get totalDigits() {
    return this.digits.length;
  }

  getDigit(index) {
    return this.digits[index];
  }

  getSlice(start, end) {
    return this.digits.slice(start, end);
  }

  // Get Glyph / Character symbol for a given pixel index
  getPixelSymbol(index) {
    if (this.symbolMode === 'none') return null;

    if (this.symbolMode === 'turkish-letters') {
      const d = this.digits[index];
      return d !== undefined ? TURKISH_FREQUENT_LETTERS[d] : "";
    }
    else if (this.symbolMode === 'turkish-dual') {
      const i = index * 2;
      if (i + 1 >= this.digits.length) return "";
      const val = (this.digits[i] * 10 + this.digits[i + 1]) % 30;
      return TURKISH_ALPHABET[val];
    }
    else if (this.symbolMode === 'morse') {
      const d = this.digits[index];
      return d < 5 ? "•" : "—";
    }
    else if (this.symbolMode === 'binary') {
      const d = this.digits[index];
      return (d % 2 === 0) ? "0" : "1";
    }
    else if (this.symbolMode === 'emoji') {
      const d = this.digits[index];
      return d !== undefined ? EMOJI_PALETTE[d] : "";
    }
    else if (this.symbolMode === 'ascii') {
      const d = this.digits[index];
      return d !== undefined ? ASCII_RAMP[d] : "";
    }
    return null;
  }

  // Color mapping methods
  getPixelColor(index) {
    const pal = COLOR_PALETTES[this.currentPalette] || COLOR_PALETTES.cyberpunk;

    if (this.mappingMode === "single") {
      const d = this.digits[index];
      if (d === undefined) return [0, 0, 0, 0];
      const rgb = pal.rgb[d];
      return [rgb[0], rgb[1], rgb[2], 255];
    } 
    else if (this.mappingMode === "dual") {
      const i = index * 2;
      if (i + 1 >= this.digits.length) return [0, 0, 0, 0];
      const d1 = this.digits[i];
      const d2 = this.digits[i + 1];
      const val = d1 * 10 + d2;
      const hue = (val / 100) * 360;
      return this.hslToRgb(hue, 0.85, 0.55);
    } 
    else if (this.mappingMode === "rgb") {
      const i = index * 3;
      if (i + 2 >= this.digits.length) return [0, 0, 0, 0];
      const r = Math.round((this.digits[i] / 9) * 255);
      const g = Math.round((this.digits[i + 1] / 9) * 255);
      const b = Math.round((this.digits[i + 2] / 9) * 255);
      return [r, g, b, 255];
    }
    else if (this.mappingMode === "hex") {
      const i = index * 6;
      if (i + 5 >= this.digits.length) return [0, 0, 0, 0];
      const r = (this.digits[i] * 10 + this.digits[i + 1]) % 256;
      const g = (this.digits[i + 2] * 10 + this.digits[i + 3]) % 256;
      const b = (this.digits[i + 4] * 10 + this.digits[i + 5]) % 256;
      return [r, g, b, 255];
    }

    return [255, 255, 255, 255];
  }

  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hNorm = h / 360;
      r = hue2rgb(p, q, hNorm + 1/3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255];
  }

  searchSubstring(pattern) {
    const cleanPattern = pattern.replace(/[^0-9]/g, "");
    if (!cleanPattern) return -1;
    return this.digitsString.indexOf(cleanPattern);
  }

  searchTurkishWord(word) {
    const cleanWord = word.toUpperCase();
    if (!cleanWord) return -1;
    return this.decodedTurkishText.indexOf(cleanWord);
  }

  getDigitFrequency() {
    const freq = new Array(10).fill(0);
    for (let i = 0; i < this.digits.length; i++) {
      freq[this.digits[i]]++;
    }
    return freq;
  }
}

window.PiEngine = PiEngine;
window.COLOR_PALETTES = COLOR_PALETTES;
window.TURKISH_ALPHABET = TURKISH_ALPHABET;
window.TURKISH_FREQUENT_LETTERS = TURKISH_FREQUENT_LETTERS;
