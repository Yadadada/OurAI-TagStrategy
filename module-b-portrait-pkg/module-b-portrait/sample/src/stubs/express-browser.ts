// Browser-only stub for express. The vendored personaCard.ts imports `express` at
// the top of the module (and calls `express.Router()` at module load) so that the
// HTTP routes register on the production server. In the browser bundle we never
// actually serve HTTP from this file — the algorithmic exports (buildUserVector
// etc.) are what matters. So we return a no-op Router object and the rest of the
// chain (router.get / router.post) never runs.

const noopRouter = {
  get: () => noopRouter,
  post: () => noopRouter,
  put: () => noopRouter,
  delete: () => noopRouter,
  use: () => noopRouter,
  all: () => noopRouter,
};

const expressStub = {
  Router: () => noopRouter,
  json: () => () => undefined,
  urlencoded: () => () => undefined,
  static: () => () => undefined,
};

export default expressStub;
export const Router = expressStub.Router;
