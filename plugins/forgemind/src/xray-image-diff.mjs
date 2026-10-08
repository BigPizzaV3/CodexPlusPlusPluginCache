import { inflateSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export async function pngDifferencePercent(baselinePath, candidatePath) {
  const [baseline, candidate] = await Promise.all([decodePng(baselinePath), decodePng(candidatePath)]);
  if (baseline.width !== candidate.width || baseline.height !== candidate.height) return 100;
  let changed = 0;
  for (let pixel = 0; pixel < baseline.width * baseline.height; pixel += 1) {
    const offset = pixel * 4;
    if (baseline.pixels[offset] !== candidate.pixels[offset]
      || baseline.pixels[offset + 1] !== candidate.pixels[offset + 1]
      || baseline.pixels[offset + 2] !== candidate.pixels[offset + 2]
      || baseline.pixels[offset + 3] !== candidate.pixels[offset + 3]) changed += 1;
  }
  return (changed / (baseline.width * baseline.height)) * 100;
}

export async function decodePng(file) {
  const bytes = await readFile(file);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG image');
  let offset = 8; let header; const data = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset); const type = bytes.toString('ascii', offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = body;
    if (type === 'IDAT') data.push(body);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  if (!header || header.length !== 13 || !data.length) throw new Error('incomplete PNG image');
  const width = header.readUInt32BE(0); const height = header.readUInt32BE(4);
  const bitDepth = header[8]; const colorType = header[9]; const interlace = header[12];
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!width || !height || bitDepth !== 8 || !channels || interlace !== 0) throw new Error('PNG must be non-interlaced 8-bit RGB or RGBA');
  const rowBytes = width * channels; const raw = inflateSync(Buffer.concat(data));
  if (raw.length !== (rowBytes + 1) * height) throw new Error('invalid PNG scanline data');
  const rows = Buffer.alloc(rowBytes * height); let position = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[position++]; const rowOffset = row * rowBytes; const previousOffset = rowOffset - rowBytes;
    for (let index = 0; index < rowBytes; index += 1) {
      const value = raw[position++]; const left = index >= channels ? rows[rowOffset + index - channels] : 0;
      const up = row ? rows[previousOffset + index] : 0; const upperLeft = row && index >= channels ? rows[previousOffset + index - channels] : 0;
      rows[rowOffset + index] = (value + filtered(filter, left, up, upperLeft)) & 255;
    }
  }
  const pixels = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels; const target = pixel * 4;
    pixels[target] = rows[source]; pixels[target + 1] = rows[source + 1]; pixels[target + 2] = rows[source + 2]; pixels[target + 3] = channels === 4 ? rows[source + 3] : 255;
  }
  return { width, height, pixels };
}

function filtered(filter, left, up, upperLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter === 4) { const estimate = left + up - upperLeft; const a = Math.abs(estimate - left); const b = Math.abs(estimate - up); const c = Math.abs(estimate - upperLeft); return a <= b && a <= c ? left : b <= c ? up : upperLeft; }
  throw new Error('unsupported PNG filter');
}
