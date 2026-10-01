import { Component } from '@angular/core';
import { ErrorCode } from '@shared/components/error-code/error-code';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-error-403',
  template: `
    <error-code
      code="403"
      title="{{ 'sessions.denided' | translate }}"
      message="{{ 'sessions.denided-menssage' | translate }}"
    />
  `,
  imports: [ErrorCode,TranslateModule],
})
export class Error403 {}
