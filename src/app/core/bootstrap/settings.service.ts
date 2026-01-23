import { Direction } from '@angular/cdk/bidi';
import { MediaMatcher } from '@angular/cdk/layout';
import { DOCUMENT } from '@angular/common';
import { ApplicationRef, Inject, Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AppDirectionality, LocalStorageService } from '@shared';
import { enUS, Locale, ptBR, zhCN, zhTW } from 'date-fns/locale';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AppSettings, AppTheme, defaults } from '../settings';
import { LoginService } from '@core/authentication';


@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly key = 'app-nti-settings';

  private readonly document = inject(DOCUMENT);
  private readonly translate = inject(TranslateService);
  private readonly store = inject(LocalStorageService);
  private readonly mediaMatcher = inject(MediaMatcher);
  private readonly dir = inject(AppDirectionality);
  private readonly loginService = inject(LoginService);
  private readonly notify$ = new BehaviorSubject<Partial<AppSettings>>({});


  isDarkMode = signal(false);

  get notify() {
    return this.notify$.asObservable();
  }

  private htmlElement = this.document.querySelector('html')!;
  private storedOptions: AppSettings = this.store.get(this.key);
  options: AppSettings = Object.assign(defaults, this.storedOptions);
  languages = ['en-US', 'zh-CN', 'zh-TW','pt-BR'];
  localeMap: Record<string, Locale> = { 'en-US': enUS, 'zh-CN': zhCN, 'zh-TW': zhTW, 'pt-BR': ptBR  };

  constructor(private ref: ApplicationRef) {
    this.translate.addLangs(this.languages);
  }

  reset() {
    this.store.remove(this.key);
  }

  getkey(){
    return this.key;
  }

  setDirection(dir?: Direction) {
    if (dir) {
      this.setOptions({ dir });
    }
    this.dir.value = this.options.dir;
    this.htmlElement.dir = this.options.dir;
  }

  getThemeColor() {
    // Check whether the browser support `prefers-color-scheme`

    if (
      this.options.theme === 'auto' &&
      this.mediaMatcher.matchMedia('(prefers-color-scheme)').media !== 'not all'
    ) {
      const isSystemDark = this.mediaMatcher.matchMedia('(prefers-color-scheme: dark)').matches;
      // Set theme to dark if `prefers-color-scheme` is dark. Otherwise, set it to light.
      return isSystemDark ? 'dark' : 'light';
    } else {
      return this.options.theme as Exclude<AppTheme, 'auto'>;
    }
  }

  setTheme(theme?: AppTheme) {
    if (theme) {
      this.setOptions({ theme });
    }
    if (this.getThemeColor() === 'dark')
      {
      this.htmlElement.classList.remove('light-theme');
      this.htmlElement.classList.add('theme-dark');
      this.htmlElement.classList.add('my-app-dark');// tema PrimeNG

    } else {
      this.htmlElement.classList.remove('theme-dark');
      this.htmlElement.classList.remove('light-theme');
      this.htmlElement.classList.remove('my-app-dark');// tema PrimeNG
    }
  }

  getTranslateLang() {
    if (this.options.language === 'auto') {
      const browserLang = navigator.language;
      return this.languages.includes(browserLang) ? browserLang : 'en-US';
    }
    return this.options.language;
  }

  setLanguage(language?: string) {
    if (language) {
      this.setOptions({ language });
    }
    this.translate.use(this.getTranslateLang());
  }

  getLocale() {
    return this.localeMap[this.getTranslateLang()];
  }

  setOptions(options?: Partial<AppSettings>) {
    this.options = Object.assign(defaults, this.options, options);
    this.store.set(this.key, this.options);
    this.notify$.next(this.options);
    this.setTheme();
  }

  setOptionsSave(options: AppSettings) {
    this.setOptions(options);
    this.saveOptions();
  }

  saveOptions() {
    this.loginService.setConfiguracaoUsuario(this.key.toLocaleUpperCase(),JSON.stringify(this.options)).subscribe();
  }
}
