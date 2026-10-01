import { Routes } from '@angular/router';
import { UtilitiesCssGrid } from './css-grid/css-grid';
import { UtilitiesCssHelpers } from './css-helpers/css-helpers';
import { InformativoMvComponent } from './informativo/informativo-mv/informativo-mv.component';
import { JobManagerComponent } from './job-manager/job-manager.component';

export const routes: Routes = [
  { path: 'css-grid', component: UtilitiesCssGrid },
  { path: 'css-helpers', component: UtilitiesCssHelpers },
  { path: 'informativomv', component: InformativoMvComponent },
  { path: 'job-manager', component: JobManagerComponent},
];
