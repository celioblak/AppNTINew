import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PainelRequisicaoComponent } from './painel-requisicao.component';

describe('PainelRequisicaoComponent', () => {
  let component: PainelRequisicaoComponent;
  let fixture: ComponentFixture<PainelRequisicaoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PainelRequisicaoComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PainelRequisicaoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
