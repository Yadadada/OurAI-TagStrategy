#!/usr/bin/env bash
#
# Generate a unified diff that can be applied back to the Ourai monorepo.
#
# Path mapping (matches UPSTREAM.md):
#   src/personaCard.ts             → api/src/domains/dating/personaCard.ts
#   src/personaCardTypes.ts        → api/src/domains/dating/personaCardTypes.ts
#   src/components/PersonaCardView.tsx → client/src/features/dating/components/PersonaCardView.tsx
#   src/components/MbtiRadar.tsx       → client/src/features/dating/components/MbtiRadar.tsx
#   src/components/TraitsRadar.tsx     → client/src/features/dating/components/TraitsRadar.tsx
#   src/components/InterestCloud.tsx   → client/src/features/dating/components/InterestCloud.tsx
#   src/components/QuestionnaireFlow.tsx → client/src/features/dating/components/QuestionnaireFlow.tsx
#
# stubs/, services/datingService.ts, lib/utils.ts, App.tsx, main.tsx, server/
# are coursework-only and intentionally excluded from the patch.
#
# Usage:
#   ./scripts/make-merge-back-patch.sh > improvements.patch
#   # then in the Ourai monorepo:
#   git apply improvements.patch

set -euo pipefail

UPSTREAM=$(cat ../UPSTREAM_COMMIT 2>/dev/null || echo "HEAD")
echo "# Patch generated against Ourai upstream $UPSTREAM"
echo "# Skipped: src/stubs/ src/services/ src/lib/ src/App.tsx src/main.tsx src/server/"

git diff --no-color HEAD \
    -- 'src/personaCard.ts' \
       'src/personaCardTypes.ts' \
       'src/components/PersonaCardView.tsx' \
       'src/components/MbtiRadar.tsx' \
       'src/components/TraitsRadar.tsx' \
       'src/components/InterestCloud.tsx' \
       'src/components/QuestionnaireFlow.tsx' \
  | sed \
      -e 's|^--- a/src/personaCard\.ts|--- a/api/src/domains/dating/personaCard.ts|' \
      -e 's|^+++ b/src/personaCard\.ts|+++ b/api/src/domains/dating/personaCard.ts|' \
      -e 's|^--- a/src/personaCardTypes\.ts|--- a/api/src/domains/dating/personaCardTypes.ts|' \
      -e 's|^+++ b/src/personaCardTypes\.ts|+++ b/api/src/domains/dating/personaCardTypes.ts|' \
      -e 's|^--- a/src/components/|--- a/client/src/features/dating/components/|' \
      -e 's|^+++ b/src/components/|+++ b/client/src/features/dating/components/|'
