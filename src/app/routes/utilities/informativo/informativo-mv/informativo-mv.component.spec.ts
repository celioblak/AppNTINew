import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InformativoMvComponent } from './informativo-mv.component';

describe('InformativoMvComponent', () => {
  let component: InformativoMvComponent;
  let fixture: ComponentFixture<InformativoMvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InformativoMvComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InformativoMvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
