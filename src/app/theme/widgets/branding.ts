import { Component, input, OnInit } from '@angular/core';

@Component({
  selector: 'app-branding',
  template: `
    <a class="branding" [href]="getHome()">
      <img [src]="getLogoPath()" class="branding-logo" alt="logo" />
      @if (showName()) {
        <span class="branding-name">NTI</span>
      }
    </a>
  `,
  styles: `
    .branding {
      display: flex;
      align-items: center;
      margin: 0 0.5rem;
      text-decoration: none;
      white-space: nowrap;
      color: inherit;
      border-radius: 50rem;
    }

    .branding-logo {
      width: 2rem;
      height: 2rem;
      border-radius: 50rem;
    }

    .branding-name {
      margin: 0 0.5rem;
      font-size: 1rem;
      font-weight: 500;
    }
  `,
})
export class Branding implements OnInit {
  readonly showName = input(true);

  ngOnInit(): void {
    // Forçar atualização quando o tema mudar
    window.addEventListener('storage', (event) => {
      if (event.key === 'app-nti-settings') {
        // Força a detecção de mudanças
        setTimeout(() => {
          // Este método não é reativo, então recarregamos a página?
          // Ou usamos um approach diferente...
        }, 100);
      }
    });
  }

  getHome():string{
      //return window.location.pathname.substring(0, window.location.pathname.indexOf('/',2)+1);
      //return window.location+"/";
      return "/dashboard";
  }

  getLogoPath(): string {
    try {
      const settingsJson = localStorage.getItem('app-nti-settings');

      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        const theme = settings.theme || 'light';

        if (theme === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          return prefersDark ? 'images/logo_white.png' : 'images/logo_blue.png';
        }

        return theme === 'dark' ? 'images/logo_white.png' : 'images/logo_blue.png';
      }

      return 'images/logo_blue.png';
    } catch {
      return 'images/logo_blue.png';
    }
  }
}
