import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { InvestigationStore } from '../../store/investigation-store';

export const keepImportsReadOnly: CanActivateFn = async (route) => {
  const store = inject(InvestigationStore);
  const router = inject(Router);
  const id = route.paramMap.get('id');
  if (!id) return router.parseUrl('/investigations');
  try {
    const record = await store.getInvestigation(id);
    if (!record.readOnly) return true;
    return router.createUrlTree(['investigations', id, record.verdict ? 'verdict' : 'evidence']);
  } catch {
    return router.parseUrl('/investigations');
  }
};
