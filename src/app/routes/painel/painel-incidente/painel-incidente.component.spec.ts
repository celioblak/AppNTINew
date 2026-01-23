import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PainelIncidenteComponent } from './painel-incidente.component';

describe('PainelIncidenteComponent', () => {
  let component: PainelIncidenteComponent;
  let fixture: ComponentFixture<PainelIncidenteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PainelIncidenteComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PainelIncidenteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
