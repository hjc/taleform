/**
 * SHA-1 hex digest of a UTF-8 string. Synchronous and dependency-free, so map ids are the
 * same in the plugin (desktop and mobile) and the CLI. Not for security; for stable ids.
 */
export function sha1(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] ?? 0) | (bytes[i]! << (24 - (i % 4) * 8));
  const bitLen = bytes.length * 8;
  words[bitLen >> 5] = (words[bitLen >> 5] ?? 0) | (0x80 << (24 - (bitLen % 32)));
  const total = (((bitLen + 64) >> 9) << 4) + 16;
  for (let i = 0; i < total; i++) words[i] = words[i] ?? 0;
  words[total - 1] = bitLen;

  let [a, b, c, d, e] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80);
  for (let i = 0; i < total; i += 16) {
    for (let t = 0; t < 80; t++) {
      w[t] = t < 16 ? words[i + t]! : rotl(w[t - 3]! ^ w[t - 8]! ^ w[t - 14]! ^ w[t - 16]!, 1);
    }
    let [aa, bb, cc, dd, ee] = [a, b, c, d, e];
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? (bb & cc) | (~bb & dd) : t < 40 ? bb ^ cc ^ dd : t < 60 ? (bb & cc) | (bb & dd) | (cc & dd) : bb ^ cc ^ dd;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const tmp = (rotl(aa, 5) + f + ee + k + w[t]!) | 0;
      [ee, dd, cc, bb, aa] = [dd, cc, rotl(bb, 30), aa, tmp];
    }
    [a, b, c, d, e] = [(a + aa) | 0, (b + bb) | 0, (c + cc) | 0, (d + dd) | 0, (e + ee) | 0];
  }
  return [a, b, c, d, e].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
