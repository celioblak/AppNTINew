import { Routes } from '@angular/router';
import { AssinaturaComponent } from './assinatura/assinatura.component';
import { GerenciarAcessoComponent } from './administracao/gerenciar-acesso.component';
import { UsuarioCadastroComponent } from './cadastro/usuario-cadastro.component';
import { adminGuard } from './administracao/telas-menu/admin.guard';
import { TelasMenuComponent } from './administracao/telas-menu/telas-menu';
import { ConfigAdComponent } from './administracao/config-ad/config-ad';



export const routes: Routes = [
  { path: 'assinatura', component: AssinaturaComponent },
  { path: 'acesso', component: GerenciarAcessoComponent },
  { path: 'cadastro', component: UsuarioCadastroComponent },
  { path: 'telas-menu', component: TelasMenuComponent, canActivate: [adminGuard] },
  { path: 'config-ad', component: ConfigAdComponent, canActivate: [adminGuard] },
];

