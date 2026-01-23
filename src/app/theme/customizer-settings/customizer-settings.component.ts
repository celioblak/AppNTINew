import { CdkDrag, CdkDragStart } from '@angular/cdk/drag-drop';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MtxDrawer, MtxDrawerModule, MtxDrawerRef } from '@ng-matero/extensions/drawer';
import { Subscription } from 'rxjs';

import { AppSettings, SettingsService } from '@core';
import { DisableControlDirective } from '@shared';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-customizer-settings',
  templateUrl: './customizer-settings.component.html',
  styleUrl: './customizer-settings.component.scss',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MtxDrawerModule,
    DisableControlDirective,
    TranslateModule,
  ],
})
export class CustomizerSettingsComponent {
  @Output() optionsChange = new EventEmitter<AppSettings>();
  @Input() snButtonVisible = true;
  @Input() eventEmitter = new EventEmitter<any>();

  @ViewChild('customizerPanel', { static: true, read: TemplateRef })
  statsRef!: TemplateRef<any>;

  private readonly settings = inject(SettingsService);
  private readonly drawer = inject(MtxDrawer);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group<AppSettings>(this.settings.options);

  private formSubscription = Subscription.EMPTY;

  get isHeaderPosAbove() {
    return this.form.get('headerPos')?.value === 'above';
  }

  get isNavPosTop() {
    return this.form.get('navPos')?.value === 'top';
  }

  get isShowHeader() {
    return this.form.get('showHeader')?.value === true;
  }

  private dragging = false;

  private drawerRef?: MtxDrawerRef;

  ngOnInit(): void {
    this.subscribeToParentEmitter();
 }

  subscribeToParentEmitter(): void {
    this.eventEmitter.subscribe((data: string) => {
        this.openPanel(this.statsRef);
    });
  }

  onDragStart(event: CdkDragStart) {
    this.dragging = true;
  }

  openPanel(templateRef: TemplateRef<any>) {
    if (this.dragging) {
      this.dragging = false;
      return;
  }

    this.drawerRef = this.drawer.open(templateRef, {
      position: this.form.get('dir')?.value === 'rtl' ? 'left' : 'right',
      width: '320px',
    });

    this.drawerRef.afterOpened().subscribe(() => {
      this.formSubscription = this.form.valueChanges.subscribe(value => {
        this.sendOptions(this.form.getRawValue());
      });
    });

    this.drawerRef.afterDismissed().subscribe(() => {
      this.formSubscription.unsubscribe();
    });
  }

  closePanel() {
    this.drawerRef?.dismiss();
  }

  sendOptions(options: AppSettings) {
    this.optionsChange.emit(options);
  }
}
