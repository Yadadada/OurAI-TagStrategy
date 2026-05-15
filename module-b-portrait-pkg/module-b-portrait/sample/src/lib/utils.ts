// Stub for the production `@/shared/lib/utils` `cn()` helper.
// Same contract: classnames-style string concatenation.

import clsx from 'clsx';

export function cn(...inputs: Array<string | false | null | undefined>): string {
  return clsx(inputs);
}
