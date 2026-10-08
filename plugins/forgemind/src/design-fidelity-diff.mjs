import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { decodePng } from './xray-image-diff.mjs';

export async function compareDesignImages({ baseline, candidate, output }) {
  const [left, right] = await Promise.all([decodePng(baseline), decodePng(candidate)]);
  const width = Math.max(left.width, right.width); const height = Math.max(left.height, right.height); const pixels = Buffer.alloc(width * height * 4);
  let changed = 0; let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const target = (y * width + x) * 4; const a = pixel(left, x, y); const b = pixel(right, x, y);
    if (!a.equals(b)) { changed += 1; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); pixels.set([255, 0, 0, 255], target); }
  }
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, encodeRgbaPng({ width, height, pixels }));
  return { differencePercent: width * height ? changed / (width * height) * 100 : 0, dimensions: { baseline: [left.width, left.height], candidate: [right.width, right.height] }, changedBounds: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, output };
}
function pixel(image, x, y) { if (x >= image.width || y >= image.height) return Buffer.from([0, 0, 0, 0]); return image.pixels.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4); }
export function encodeRgbaPng({ width, height, pixels }) { const raw = Buffer.alloc((width * 4 + 1) * height); for (let y = 0; y < height; y += 1) { raw[y * (width * 4 + 1)] = 0; pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); } const chunk = (type, body) => Buffer.concat([u32(body.length), Buffer.from(type), body, Buffer.alloc(4)]); return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', Buffer.concat([u32(width), u32(height), Buffer.from([8,6,0,0,0])])), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
function u32(value) { const output = Buffer.alloc(4); output.writeUInt32BE(value); return output; }
