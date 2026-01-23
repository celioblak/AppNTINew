import { Component, EventEmitter, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AppSettings, AuthService, SettingsService, User } from '@core';
import { TranslateModule } from '@ngx-translate/core';
import { PageHeaderComponent } from '@shared';
import { CustomizerSettingsComponent } from '@theme/customizer-settings/customizer-settings.component';
import { ProfileSettingsComponent } from '../settings/settings.component';

@Component({
  selector: 'app-profile-layout',
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatListModule,
    MatIconModule,
    PageHeaderComponent,
    TranslateModule,
    CustomizerSettingsComponent,
    ProfileSettingsComponent
  ],
})
export class ProfileLayoutComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);

  user!: User;
  parentEmitter = new EventEmitter<any>();
  options = this.settings.options;

  ngOnInit(): void {
    this.auth.user().subscribe(user => (this.user = user));
  }

  emitEventToChild(event:any) {
    this.parentEmitter.emit(event);
  }

  updateOptions(options: AppSettings) {
    console.log('UPDATE LAYOUT ');
      this.options = options;
      this.settings.setOptionsSave(this.options);
      this.settings.setDirection();
      this.settings.setTheme();
      }

  logout() {
    this.auth.logout().subscribe(() => {
      this.auth.logout();
    });
  }
}
