import { inject } from '@angular/core';
import { RedirectCommand, Router, type CanActivateFn } from '@angular/router';
import { ReadinessSession } from '../../environment/readiness-session';

export const readinessOnLaunch: CanActivateFn = () => {
  const router = inject(Router);
  if (router.navigated || inject(ReadinessSession).choice()) return true;
  return new RedirectCommand(router.parseUrl('/start'), { replaceUrl: true });
};
