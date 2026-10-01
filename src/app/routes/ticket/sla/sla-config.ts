// src/app/routes/config/sla/sla-config.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';

// NgMatero Grid
import { MtxGridModule, MtxGridColumn } from '@ng-matero/extensions/grid';

// Services
import { SlaContrato } from '@core';
import { SlaConfigService } from './sla-config.service';

@Component({
  selector: 'app-sla-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatDividerModule,
    MatExpansionModule,
    MtxGridModule
  ],
  templateUrl: './sla-config.html',
  styleUrls: ['./sla-config.scss']
})
export class SlaConfigComponent implements OnInit {
  private fb = inject(FormBuilder);
  private slaConfigService = inject(SlaConfigService);
  private snackBar = inject(MatSnackBar);

  form!: FormGroup;
  slas: SlaContrato[] = [];
  loading = false;
  isEditing = false;
  editingId?: number;

  // Configuração da Grid
  slaColumns: MtxGridColumn[] = [
    {
      header: 'Nível',
      field: 'nivel',
      width: '100px',
      type: 'tag',
      tag: {
        1: { text: 'Nível 1', color: 'red-500' },
        2: { text: 'Nível 2', color: 'orange-500' },
        3: { text: 'Nível 3', color: 'yellow-500' },
        4: { text: 'Nível 4', color: 'green-500' }
      }
    },
    {
      header: 'Nome',
      field: 'nomeContrato',
      sortable: true,
      minWidth: 200
    },
    {
      header: 'Horas Paliativo',
      field: 'horasPaliativo',
      width: '140px'
    },
    {
      header: 'Horas Definitivo',
      field: 'horasDefinitivo',
      width: '140px'
    },
    {
      header: 'Horas Úteis',
      field: 'horasUteis',
      width: '100px',
      type: 'boolean'
    },
    {
      header: 'Expediente',
      field: 'expediente',
      width: '150px',
      formatter: (data: any) =>
        `${data.inicioExpediente || '08:00'} - ${data.fimExpediente || '18:00'}`
    },
    {
      header: 'Vigência',
      field: 'vigencia',
      width: '200px',
      formatter: (data: any) =>
        `${this.formatDate(data.vigenciaInicio) || 'Indefinido'} a ${this.formatDate(data.vigenciaFim) || 'Indefinido'}`
    },
    {
      header: 'Ações',
      field: 'actions',
      width: '120px',
      type: 'button',
      buttons: [
        {
          type: 'icon',
          icon: 'edit',
          tooltip: 'Editar',
          color: 'primary',
          click: (record: any) => this.editarSla(record)
        },
        {
          type: 'icon',
          icon: 'delete',
          tooltip: 'Excluir',
          color: 'warn',
          click: (record: any) => this.excluirSla(record)
        }
      ]
    }
  ];

  ngOnInit(): void {
    this.criarForm();
    this.carregarSlas();
  }

  criarForm(): void {
    this.form = this.fb.group({
      nivel: [null, [Validators.required, Validators.min(1), Validators.max(4)]],
      nomeContrato: ['', [Validators.required, Validators.maxLength(100)]],
      horasPaliativo: [null, [Validators.required, Validators.min(1)]],
      horasDefinitivo: [null, [Validators.required, Validators.min(1)]],
      horasUteis: [true],
      inicioExpediente: ['08:00', Validators.required],
      fimExpediente: ['18:00', Validators.required],
      vigenciaInicio: [null],
      vigenciaFim: [null],
      descricao: ['', Validators.maxLength(500)]
    });
  }

  carregarSlas(): void {
    this.loading = true;
    this.slaConfigService.listarTodos().subscribe({
      next: (slas) => {
        this.slas = slas;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erro ao carregar SLAs', err);
        this.snackBar.open('Erro ao carregar SLAs', 'Fechar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  salvar(): void {
    if (this.form.invalid) {
      this.marcarCamposComoTocados();
      return;
    }

    const sla: SlaContrato = this.form.value;

    if (this.isEditing && this.editingId) {
      sla.id = this.editingId;
      this.slaConfigService.atualizar(this.editingId, sla).subscribe({
        next: () => {
          this.snackBar.open('SLA atualizado com sucesso!', 'Fechar', { duration: 3000 });
          this.carregarSlas();
          this.limparForm();
        },
        error: (err) => {
          console.error('Erro ao atualizar SLA', err);
          this.snackBar.open('Erro ao atualizar SLA: ' + err.message, 'Fechar', { duration: 5000 });
        }
      });
    } else {
      this.slaConfigService.criar(sla).subscribe({
        next: () => {
          this.snackBar.open('SLA criado com sucesso!', 'Fechar', { duration: 3000 });
          this.carregarSlas();
          this.limparForm();
        },
        error: (err) => {
          console.error('Erro ao criar SLA', err);
          this.snackBar.open('Erro ao criar SLA: ' + err.message, 'Fechar', { duration: 5000 });
        }
      });
    }
  }

  editarSla(sla: SlaContrato): void {
    this.isEditing = true;
    this.editingId = sla.id;

    this.form.patchValue({
      nivel: sla.nivel,
      nomeContrato: sla.nomeContrato,
      horasPaliativo: sla.horasPaliativo,
      horasDefinitivo: sla.horasDefinitivo,
      horasUteis: sla.horasUteis || true,
      inicioExpediente: sla.inicioExpediente || '08:00',
      fimExpediente: sla.fimExpediente || '18:00',
      vigenciaInicio: sla.vigenciaInicio,
      vigenciaFim: sla.vigenciaFim,
      descricao: sla.descricao || ''
    });

    // Scroll para o formulário
    document.getElementById('form-sla')?.scrollIntoView({ behavior: 'smooth' });
  }

  excluirSla(sla: SlaContrato): void {
    if (confirm(`Deseja realmente excluir o SLA "${sla.nomeContrato}" (Nível ${sla.nivel})?`)) {
      this.slaConfigService.excluir(sla.id!).subscribe({
        next: () => {
          this.snackBar.open('SLA excluído com sucesso!', 'Fechar', { duration: 3000 });
          this.carregarSlas();
        },
        error: (err) => {
          console.error('Erro ao excluir SLA', err);
          this.snackBar.open('Erro ao excluir SLA: ' + err.message, 'Fechar', { duration: 5000 });
        }
      });
    }
  }

  limparForm(): void {
    this.form.reset({
      horasUteis: true,
      inicioExpediente: '08:00',
      fimExpediente: '18:00'
    });
    this.isEditing = false;
    this.editingId = undefined;
  }

  cancelar(): void {
    this.limparForm();
  }

  marcarCamposComoTocados(): void {
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.markAsTouched();
    });
  }

  formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR');
  }

  // Métodos para pré-configurações
  aplicarConfiguracaoPadrao(): void {
    if (confirm('Aplicar configurações padrão de SLA? Isso substituirá as configurações atuais.')) {
      this.slaConfigService.aplicarConfiguracaoPadrao().subscribe({
        next: () => {
          this.snackBar.open('Configurações padrão aplicadas com sucesso!', 'Fechar', { duration: 3000 });
          this.carregarSlas();
        },
        error: (err) => {
          console.error('Erro ao aplicar configurações padrão', err);
          this.snackBar.open('Erro ao aplicar configurações: ' + err.message, 'Fechar', { duration: 5000 });
        }
      });
    }
  }
}
