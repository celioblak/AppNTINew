import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { SettingsService } from '@core';

export function settingsInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const settings = inject(SettingsService);

  return next(
    req.clone({
      //headers: req.headers.append('Accept-Language', settings.getTranslateLang()),
      headers: req.headers
            .append('Accept-Language', settings.getTranslateLang())
            .append( 'Content-Type','application/json',)
            .append('Access-Control-Allow-Origin','*',)
            .append('Access-Control-Allow-Methods','GET,HEAD,OPTIONS,POST,PUT',)
            .append('Access-Control-Allow-Headers', '*',),
    })
  );
}
