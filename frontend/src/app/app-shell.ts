import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// The app shell: everything every page sits in. Pages are lazy routes (app.routes.ts).
@Component({
  selector: 'g-app-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class AppShell {}
