import type { CanDeactivateFn } from '@angular/router';
import type { InvestigationPage } from './investigation.page';

export const leaveInvestigation: CanDeactivateFn<InvestigationPage> = (page) => page.canLeave();
