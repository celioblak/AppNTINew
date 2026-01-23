import { Routes } from '@angular/router';
import { UtilitiesCssGridComponent } from './css-grid/css-grid.component';
import { UtilitiesCssHelpersComponent } from './css-helpers/css-helpers.component';
import { InformativoMvComponent } from './informativo/informativo-mv/informativo-mv.component';
import { JobManagerComponent } from './job-manager/job-manager.component';

export const routes: Routes = [
  { path: 'css-grid', component: UtilitiesCssGridComponent },
  { path: 'css-helpers', component: UtilitiesCssHelpersComponent },
  { path: 'informativomv', component: InformativoMvComponent },
  { path: 'job-manager', component: JobManagerComponent },
];
