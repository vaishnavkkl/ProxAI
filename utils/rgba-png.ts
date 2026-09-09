/* eslint-disable no-bitwise */

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array) {
  let a = 1;
  let b = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    a = (a + bytes[index]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(value: number) {
  return Uint8Array.of((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array) {
  const name = Uint8Array.from(type, (char) => char.charCodeAt(0));
  const body = concat([name, data]);
  return concat([u32(data.length), body, u32(crc32(body))]);
}

function zlibStore(data: Uint8Array) {
  const blocks: Uint8Array[] = [Uint8Array.of(0x78, 0x01)];
  const max = 65535;
  for (let offset = 0; offset < data.length; offset += max) {
    const slice = data.subarray(offset, Math.min(offset + max, data.length));
    const last = offset + slice.length >= data.length ? 1 : 0;
    const len = slice.length;
    const nlen = ~len & 0xffff;
    blocks.push(Uint8Array.of(last, len & 255, (len >>> 8) & 255, nlen & 255, (nlen >>> 8) & 255));
    blocks.push(slice);
  }
  const checksum = adler32(data);
  blocks.push(u32(checksum));
  return concat(blocks);
}

export function encodeRgbaPng(width: number, height: number, rgba: Uint8Array) {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const dest = row * (stride + 1);
    raw[dest] = 0;
    raw.set(rgba.subarray(row * stride, (row + 1) * stride), dest + 1);
  }
  const ihdr = concat([u32(width), u32(height), Uint8Array.of(8, 6, 0, 0, 0)]);
  return concat([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibStore(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}
