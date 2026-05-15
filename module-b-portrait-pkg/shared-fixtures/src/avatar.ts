// Open-source avatar URL helper.
//
// Uses DiceBear (https://www.dicebear.com/), a free SVG avatar generator with
// deterministic output keyed on the user id. MIT-licensed and CDN-hosted, so
// any UI that knows a user id can render a unique illustrated avatar without
// shipping image assets or worrying about user-photo consent.
//
// We default to the "notionists" style — soft illustrated portraits that fit
// the warm-cream campus theme. Other usable styles for variety:
//   - "lorelei" : anime-leaning faces
//   - "avataaars": flat portraits
//   - "personas" : playful illustrated heads

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x';

export type AvatarStyle =
  | 'notionists'
  | 'lorelei'
  | 'avataaars'
  | 'personas'
  | 'thumbs'
  | 'open-peeps';

export interface AvatarOptions {
  style?: AvatarStyle;
  /** background hex without # prefix; multiple values comma-separated for randomization */
  background?: string;
  /** SVG output size in px (DiceBear default 512) */
  size?: number;
  /** request format: 'svg' (default) or 'png' */
  format?: 'svg' | 'png';
}

const DEFAULT_BACKGROUND = 'fef3ed,fff8f4,fff0eb,f7dde3'; // matches campus halo palette

/**
 * Return a deterministic avatar URL for the given user id.
 * Same id → same avatar across modules (so a user keeps the same face whether
 * they show up in match cards, chat header, or persona view).
 */
export function getAvatarUrl(userId: string, opts: AvatarOptions = {}): string {
  const style = opts.style ?? 'notionists';
  const format = opts.format ?? 'svg';
  const params = new URLSearchParams();
  params.set('seed', userId);
  params.set('backgroundColor', opts.background ?? DEFAULT_BACKGROUND);
  if (opts.size) params.set('size', String(opts.size));
  return `${DICEBEAR_BASE}/${style}/${format}?${params.toString()}`;
}

/**
 * Return a portrait-photo URL via Unsplash random source. NOT deterministic
 * (every render fetches a different photo) — use sparingly, e.g. for the
 * decorative card-back image on a swipe card. For an avatar, use getAvatarUrl.
 *
 * Unsplash Source returns a 302 to a real image; we pass a category hint so
 * the photos look people-friendly.
 */
export function getPhotoUrl(seed: string, opts: { width?: number; height?: number } = {}): string {
  const w = opts.width ?? 600;
  const h = opts.height ?? 800;
  // picsum.photos gives deterministic seeded random photos; the seed makes it
  // stable per user id. Photos are CC0 / public domain.
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}
