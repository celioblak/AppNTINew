import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreferenciaFolgaComponent } from './preferencia-folga.component';

describe('PreferenciaFolgaComponent', () => {
  let component: PreferenciaFolgaComponent;
  let fixture: ComponentFixture<PreferenciaFolgaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreferenciaFolgaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreferenciaFolgaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
