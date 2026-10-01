import { Component, EventEmitter, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AppSettings, AuthService, SettingsService } from '@core';
import { TranslateModule } from '@ngx-translate/core';
import { PageHeader } from '@shared';
import { Customizer } from '@theme/customizer/customizer';
import { PerfilLoginAd } from '../login-ad/perfil-login-ad';
import { PerfilExpediente } from '../expediente/perfil-expediente';


@Component({
  selector: 'app-profile-layout',
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
  imports: [
    RouterLink,
    RouterOutlet,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatListModule,
    MatIconModule,
    PageHeader,
    TranslateModule,
    Customizer,
    PerfilLoginAd,
    PerfilExpediente
  ],
})
export class ProfileLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);

  user = toSignal(this.auth.user());
  parentEmitter = new EventEmitter<any>();
  options = this.settings.options;

  logout() {
    this.auth.logout().subscribe(() => {
      this.router.navigateByUrl('/auth/login');
    });
  }

  emitEventToChild(event:any) {
    this.parentEmitter.emit(event);
  }

    updateOptions(options: AppSettings) {
      this.options = options;
      this.settings.setOptionsSave(options);
      this.settings.setDirection();
      this.settings.setTheme();
    }
}
