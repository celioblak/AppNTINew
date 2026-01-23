import { Injectable, inject } from '@angular/core';
import { AuthService, AUser, LoginService } from '@core/authentication';
import { NgxPermissionsService, NgxRolesService } from 'ngx-permissions';
import { switchMap, tap } from 'rxjs';
import { Menu, MenuService } from './menu.service';
import { SettingsService } from './settings.service';
import { AppSettings } from '@core/settings';

@Injectable({
  providedIn: 'root',
})
export class StartupService {
  private readonly authService = inject(AuthService);
  private readonly settings = inject(SettingsService);
  private readonly loginService = inject(LoginService);
  private readonly menuService = inject(MenuService);
  private readonly permissonsService = inject(NgxPermissionsService);
  private readonly rolesService = inject(NgxRolesService);

  options = this.settings.options;

  /**
   * Load the application only after get the menu or other essential informations
   * such as permissions and roles.
   */
  load() {
    return new Promise<void>((resolve, reject) => {
      this.authService
        .change()
        .pipe(
          tap(user => this.setPermissions(user)),
          switchMap(() => this.authService.menu()),
          tap(menu => this.setMenu(menu)),
          //tap(() => this.setSettings()),
        )
        .subscribe({
          next: () => resolve(),
          error: (error) => {
            resolve();
          },
        });
    });
  }

  private setMenu(menu: Menu[]) {
    this.menuService.addNamespace(menu, 'menu');
    this.menuService.set(menu);
  }

  private setPermissions(user: AUser) {
    // In a real app, you should get permissions and roles from the user information.
    const permissions = ['canAdd', 'canDelete', 'canEdit', 'canRead'];
    this.permissonsService.loadPermissions(permissions);
    this.rolesService.flushRoles();
    this.rolesService.addRoles({ ADMIN: permissions });

    // Tips: Alternatively you can add permissions with role at the same time.
    // this.rolesService.addRolesWithPermissions({ ADMIN: permissions });
  }

  private setSettings() {
    this.loginService.getConfiguracaoUsuario(this.settings.getkey().toLocaleUpperCase()).subscribe(data =>{
      console.log("startup.service");
        this.updateOptions(Object.assign(JSON.parse(data.valor)));
        this.settings.setOptions(Object.assign(this.options));
        this.load();
    });
  }

  getSettings() {
    this.setSettings();
    return this.options;
  }

  updateOptions(options: AppSettings) {
    this.options = options;
    this.settings.setOptions(this.options);
    this.settings.setDirection();
    this.settings.setTheme();
  }
}
