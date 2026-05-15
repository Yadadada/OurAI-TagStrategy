// Seedable PRNG (mulberry32) so fixture generation is fully reproducible.
// All randomness in fixtures MUST go through this — never Math.random().
export function makeRng(seed) {
    let state = seed >>> 0;
    return function rng() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}
export function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}
export function pickWeighted(rng, items) {
    const total = items.reduce((s, it) => s + it.weight, 0);
    let r = rng() * total;
    for (const it of items) {
        r -= it.weight;
        if (r <= 0)
            return it.value;
    }
    return items[items.length - 1].value;
}
export function pickN(rng, arr, n) {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = Math.floor(rng() * copy.length);
        out.push(copy.splice(idx, 1)[0]);
    }
    return out;
}
export function gauss(rng, mean, sd) {
    // Box-Muller
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * sd;
}
export function clipInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value)));
}
export function chance(rng, p) {
    return rng() < p;
}
// Stable HMAC-like pseudo-id derived from index. Hex 32 chars (uuid-like length).
export function pseudoId(prefix, index) {
    // Deterministic 32-char hex from a string. No crypto dependency, good enough for fixtures.
    let h1 = 0x811c9dc5, h2 = 0xdeadbeef;
    const s = `${prefix}::${index}`;
    for (let i = 0; i < s.length; i++) {
        h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ s.charCodeAt(i), 0x85ebca6b) >>> 0;
    }
    // Format as a faux-uuid for compatibility with Postgres uuid columns
    const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2).slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
