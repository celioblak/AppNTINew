import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VncViewComponent } from './vnc-view.component';

describe('VncViewComponent', () => {
  let component: VncViewComponent;
  let fixture: ComponentFixture<VncViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VncViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VncViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
