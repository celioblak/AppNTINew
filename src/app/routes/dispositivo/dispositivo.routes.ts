import { Routes } from '@angular/router';
import { ServidorComponent } from './servidor/servidor.component';
import { VncViewComponent } from './vnc-view/vnc-view.component';

export const routes: Routes = [
  { path: 'servidor', component: ServidorComponent },
  { path: 'viewvnc', component: VncViewComponent },
  ];
