// Stub to satisfy the vendored PersonaCardView import:
//   import type { PersonaCardPayload, PersonaLmh } from '../services/datingService';
//
// In Ourai, datingService is the frontend's typed API client. Here we re-
// export the relevant types from the vendored backend personaCard module so
// the component compiles without modification.

export type { PersonaCardPayload } from '../personaCard.js';
export type { LMH as PersonaLmh } from '../personaCardTypes.js';
