import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { InvestigationStore } from '../../store/investigation-store';

// Matches the investigation routes only for an investigation stored on this device, so any other
// address falls through to the Not found page (docs/mocks/pages/not-found/default.html).
export const investigationExists: CanMatchFn = async (_route, segments) => {
  const id = segments[1]?.path;
  if (!id) return false;
  return inject(InvestigationStore)
    .get(id)
    .then(
      () => true,
      () => false,
    );
};
