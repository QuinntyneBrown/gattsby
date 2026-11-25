import { Injectable, signal } from '@angular/core';

const SESSION_KEY = 'gattsby.readiness';

@Injectable({ providedIn: 'root' })
export class ReadinessSession {
  private readonly preference = signal(this.restore());
  readonly choice = this.preference.asReadonly();

  continueAs(preference: 'agent' | 'checklist'): void {
    this.preference.set(preference);
    try {
      sessionStorage.setItem(SESSION_KEY, preference);
    } catch {
      // The choice remains available to this tab while the app is open.
    }
  }

  private restore(): 'agent' | 'checklist' | null {
    try {
      const value = sessionStorage.getItem(SESSION_KEY);
      return value === 'agent' || value === 'checklist' ? value : null;
    } catch {
      return null;
    }
  }
}
