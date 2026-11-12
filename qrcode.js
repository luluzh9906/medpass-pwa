/**
 * Pure JS ISO/IEC 18004 QR Code Generator (Byte mode UTF-8, Versions 1..40, EC Levels L & M)
 * Zero external dependencies, optimized for crisp SVG rendering in PWA.
 */

// [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]
const EC_TABLES = {
  L: [
    null,
    [7, 1, 19, 0, 0],
    [10, 1, 34, 0, 0],
    [15, 1, 55, 0, 0],
    [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0],
    [20, 2, 78, 0, 0],
    [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0],
    [18, 2, 68, 2, 69],
    [20, 4, 81, 0, 0],
    [24, 2, 92, 2, 93],
    [26, 4, 107, 0, 0],
    [30, 3, 115, 1, 116],
    [22, 5, 87, 1, 88],
    [24, 5, 98, 1, 99],
    [28, 1, 107, 5, 108],
    [30, 5, 120, 1, 121],
    [28, 3, 113, 4, 114],
    [28, 3, 107, 5, 108],
    [28, 4, 116, 4, 117],
    [28, 2, 111, 7, 112],
    [30, 4, 121, 5, 122],
    [30, 6, 117, 4, 118],
    [26, 8, 106, 4, 107],
    [28, 10, 114, 2, 115],
    [30, 8, 122, 4, 123],
    [30, 3, 117, 10, 118],
    [30, 7, 116, 7, 117],
    [30, 5, 115, 10, 116],
    [30, 13, 115, 3, 116],
    [30, 17, 115, 0, 0],
    [30, 17, 115, 1, 116],
    [30, 13, 115, 6, 116],
    [30, 12, 121, 7, 122],
    [30, 6, 121, 14, 122],
    [30, 17, 122, 4, 123],
    [30, 4, 122, 18, 123],
    [30, 20, 117, 4, 118],
    [30, 19, 118, 6, 119]
  ],
  M: [
    null,
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44],
    [30, 1, 50, 4, 51],
    [22, 6, 36, 2, 37],
    [22, 8, 37, 1, 38],
    [24, 4, 40, 5, 41],
    [24, 5, 41, 5, 42],
    [28, 7, 45, 3, 46],
    [28, 10, 46, 1, 47],
    [26, 9, 43, 4, 44],
    [26, 3, 44, 11, 45],
    [26, 3, 41, 13, 42],
    [26, 17, 42, 0, 0],
    [28, 17, 46, 0, 0],
    [28, 4, 47, 14, 48],
    [28, 6, 45, 14, 46],
    [28, 8, 47, 13, 48],
    [28, 19, 46, 4, 47],
    [28, 22, 45, 3, 46],
    [28, 3, 45, 23, 46],
    [28, 21, 45, 7, 46],
    [28, 19, 47, 10, 48],
    [28, 2, 46, 29, 47],
    [28, 10, 46, 23, 47],
    [28, 14, 46, 21, 47],
    [28, 14, 46, 23, 47],
    [28, 12, 47, 26, 48],
    [28, 6, 47, 34, 48],
    [28, 29, 46, 14, 47],
    [28, 13, 46, 32, 47],
    [28, 40, 47, 7, 48],
    [28, 18, 47, 31, 48]
  ]
};

const ALIGNMENT_POS = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170]
];

// GF(256) with primitive polynomial 0x11D
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEC(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

function appendBits(bitArr, val, len) {
  for (let i = len - 1; i >= 0; i--) {
    bitArr.push((val >>> i) & 1);
  }
}

function pickVersion(byteLen, ecLevel) {
  const table = EC_TABLES[ecLevel];
  for (let v = 1; v <= 40; v++) {
    const [, g1b, g1d, g2b, g2d] = table[v];
    const dataBytes = g1b * g1d + g2b * g2d;
    const headerBits = 4 + (v <= 9 ? 8 : 16);
    const totalBitsNeeded = headerBits + byteLen * 8;
    if (totalBitsNeeded <= dataBytes * 8) {
      return v;
    }
  }
  throw new Error('数据超出二维码最大容量（> 2953 字节）');
}

function buildCodewords(utf8Bytes, version, ecLevel) {
  const [ecPerBlock, g1b, g1d, g2b, g2d] = EC_TABLES[ecLevel][version];
  const totalDataBytes = g1b * g1d + g2b * g2d;
  const bits = [];
  // Byte mode: 0100
  appendBits(bits, 0b0100, 4);
  appendBits(bits, utf8Bytes.length, version <= 9 ? 8 : 16);
  for (const b of utf8Bytes) appendBits(bits, b, 8);

  const capBits = totalDataBytes * 8;
  const terminatorLen = Math.min(4, capBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
    dataBytes.push(val);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < totalDataBytes) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Split into blocks
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let i = 0; i < g1b; i++) {
    const blk = dataBytes.slice(offset, offset + g1d);
    offset += g1d;
    dataBlocks.push(blk);
    ecBlocks.push(rsComputeEC(blk, ecPerBlock));
  }
  for (let i = 0; i < g2b; i++) {
    const blk = dataBytes.slice(offset, offset + g2d);
    offset += g2d;
    dataBlocks.push(blk);
    ecBlocks.push(rsComputeEC(blk, ecPerBlock));
  }

  // Interleave data then EC codewords
  const out = [];
  const maxDataLen = Math.max(g1d, g2d);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) out.push(blk[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const blk of ecBlocks) {
      out.push(blk[i]);
    }
  }
  return out;
}

function getBchFormat(ecLevel, maskId) {
  const ecBits = ecLevel === 'L' ? 0b01 : 0b00; // L=01, M=00
  const data = (ecBits << 3) | maskId;
  let d = data << 10;
  const poly = 0b10100110111;
  for (let i = 4; i >= 0; i--) {
    if ((d >>> (i + 10)) & 1) {
      d ^= poly << i;
    }
  }
  return ((data << 10) | d) ^ 0b101010000010010;
}

function getBchVersion(version) {
  let d = version << 12;
  const poly = 0b1111100100101;
  for (let i = 5; i >= 0; i--) {
    if ((d >>> (i + 12)) & 1) {
      d ^= poly << i;
    }
  }
  return (version << 12) | d;
}

function createMatrix(version) {
  const size = version * 4 + 17;
  // values: null (unset), 0/1 (dark/light), plus isFunc boolean matrix
  const modules = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const isFunc = Array.from({ length: size }, () => new Uint8Array(size));

  const setFunc = (r, c, val) => {
    modules[r][c] = val ? 1 : 0;
    isFunc[r][c] = 1;
  };

  // Finder patterns + separators
  const drawFinder = (top, left) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setFunc(rr, cc, inOuter && (onBorder || inCore));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    if (!isFunc[6][i]) setFunc(6, i, bit);
    if (!isFunc[i][6]) setFunc(i, 6, bit);
  }

  // Dark module
  setFunc(size - 8, 8, 1);

  // Alignment patterns
  const pos = ALIGNMENT_POS[version];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      const cr = pos[i];
      const cc = pos[j];
      // Skip if overlapping with 3 finder patterns
      if ((cr <= 8 && cc <= 8) || (cr <= 8 && cc >= size - 9) || (cr >= size - 9 && cc <= 8)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunc(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunc[8][i] = 1;
      isFunc[i][8] = 1;
    }
  }
  for (let i = size - 8; i < size; i++) {
    isFunc[8][i] = 1;
    isFunc[i][8] = 1;
  }

  // Version info for V >= 7
  if (version >= 7) {
    const vBits = getBchVersion(version);
    for (let i = 0; i < 18; i++) {
      const bit = (vBits >>> i) & 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  return { size, modules, isFunc };
}

function placeDataAndMask(size, baseModules, isFunc, codewords, ecLevel) {
  const rawBits = [];
  for (const cw of codewords) {
    for (let b = 7; b >= 0; b--) rawBits.push((cw >>> b) & 1);
  }

  // Place raw bits in zig-zag
  const dataCoords = [];
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!isFunc[r][c]) {
          const bit = bitIdx < rawBits.length ? rawBits[bitIdx] : 0;
          bitIdx++;
          baseModules[r][c] = bit;
          dataCoords.push([r, c]);
        }
      }
    }
    upward = !upward;
  }

  const maskFns = [
    (r, c) => (r + c) % 2 === 0,
    (r, _c) => r % 2 === 0,
    (_r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  const writeFormat = (grid, maskId) => {
    const fmt = getBchFormat(ecLevel, maskId);
    for (let i = 0; i <= 5; i++) grid[8][i] = (fmt >>> (14 - i)) & 1;
    grid[8][7] = (fmt >>> 8) & 1;
    grid[8][8] = (fmt >>> 7) & 1;
    grid[7][8] = (fmt >>> 6) & 1;
    for (let i = 9; i <= 14; i++) grid[14 - i][8] = (fmt >>> (14 - i)) & 1;

    for (let i = 0; i <= 6; i++) grid[size - 1 - i][8] = (fmt >>> (14 - i)) & 1;
    for (let i = 7; i <= 14; i++) grid[8][size - 15 + i] = (fmt >>> (14 - i)) & 1;
  };

  let bestMask = 0;
  let bestScore = Infinity;
  let bestGrid = null;

  for (let m = 0; m < 8; m++) {
    const grid = baseModules.map((row) => Int8Array.from(row));
    const fn = maskFns[m];
    for (const [r, c] of dataCoords) {
      if (fn(r, c)) grid[r][c] ^= 1;
    }
    writeFormat(grid, m);
    const score = evaluatePenalty(grid, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
      bestGrid = grid;
    }
  }

  return { grid: bestGrid, mask: bestMask };
}

function evaluatePenalty(grid, size) {
  let penalty = 0;

  // Rule 1: 5+ consecutive same-color modules
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (grid[r][c] === grid[r][c - 1]) {
        run++;
      } else {
        if (run >= 5) penalty += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) penalty += 3 + (run - 5);
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (grid[r][c] === grid[r - 1][c]) {
        run++;
      } else {
        if (run >= 5) penalty += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) penalty += 3 + (run - 5);
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 3: 1011101 + 4 lights either side
  const isPat = (arr, i) =>
    arr[i] === 1 &&
    arr[i + 1] === 0 &&
    arr[i + 2] === 1 &&
    arr[i + 3] === 1 &&
    arr[i + 4] === 1 &&
    arr[i + 5] === 0 &&
    arr[i + 6] === 1;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 11; c++) {
      const row = grid[r];
      const leftLight = row[c] === 0 && row[c + 1] === 0 && row[c + 2] === 0 && row[c + 3] === 0;
      const rightLight = row[c + 7] === 0 && row[c + 8] === 0 && row[c + 9] === 0 && row[c + 10] === 0;
      if ((leftLight && isPat(row, c + 4)) || (rightLight && isPat(row, c))) {
        penalty += 40;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    const col = new Int8Array(size);
    for (let r = 0; r < size; r++) col[r] = grid[r][c];
    for (let r = 0; r <= size - 11; r++) {
      const topLight = col[r] === 0 && col[r + 1] === 0 && col[r + 2] === 0 && col[r + 3] === 0;
      const botLight = col[r + 7] === 0 && col[r + 8] === 0 && col[r + 9] === 0 && col[r + 10] === 0;
      if ((topLight && isPat(col, r + 4)) || (botLight && isPat(col, r))) {
        penalty += 40;
      }
    }
  }

  // Rule 4: dark ratio
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) if (grid[r][c] === 1) dark++;
  }
  const pct = (dark * 100) / (size * size);
  const prev5 = Math.abs(Math.floor(pct / 5) * 5 - 50) / 5;
  const next5 = Math.abs(Math.ceil(pct / 5) * 5 - 50) / 5;
  penalty += Math.min(prev5, next5) * 10;

  return penalty;
}

export function generateQR(text, ecLevel = 'M') {
  const bytes = new TextEncoder().encode(text);
  let chosenEc = ecLevel;
  let version;
  try {
    version = pickVersion(bytes.length, chosenEc);
  } catch {
    chosenEc = 'L';
    version = pickVersion(bytes.length, 'L');
  }
  const codewords = buildCodewords(bytes, version, chosenEc);
  const { size, modules, isFunc } = createMatrix(version);
  const { grid, mask } = placeDataAndMask(size, modules, isFunc, codewords, chosenEc);
  return {
    version,
    ecLevel: chosenEc,
    mask,
    size,
    byteLength: bytes.length,
    grid
  };
}

export function renderQRSvg(qr, pixelSize = 240, quietZone = 3) {
  const total = qr.size + quietZone * 2;
  const paths = [];
  for (let r = 0; r < qr.size; r++) {
    let runStart = -1;
    for (let c = 0; c <= qr.size; c++) {
      const dark = c < qr.size && qr.grid[r][c] === 1;
      if (dark && runStart === -1) {
        runStart = c;
      } else if (!dark && runStart !== -1) {
        const len = c - runStart;
        paths.push(`M${runStart + quietZone},${r + quietZone}h${len}v1h-${len}z`);
        runStart = -1;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges" role="img" aria-label="就诊摘要二维码"><rect width="${total}" height="${total}" fill="#FFFFFF"/><path d="${paths.join('')}" fill="#0F172A"/></svg>`;
}
