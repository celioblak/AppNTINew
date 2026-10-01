import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AssinaturaUsuario } from '@core';
import { AssinaturaService } from './assinatura.service';



@Component({
  selector: 'app-assinatura',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assinatura.component.html',
  styleUrls: ['./assinatura.component.scss']
})
export class AssinaturaComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();
  private snackBar = inject(MatSnackBar);
  private cdRef = inject(ChangeDetectorRef);

  // TODO: substituir pelo idUsuario do AuthService
  idUsuario = 1;

  assinatura: Partial<AssinaturaUsuario> = {
    nomeExibicao: '',
    cargo: '',
    setor: ''
  };

  imagemSelecionada: File | null = null;
  previewUrl: string | null = null;
  carregando = false;
  salvando = false;

  constructor(private assinaturaService: AssinaturaService) {}

  ngOnInit(): void {
    this.carregarAssinatura();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.previewUrl && this.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }

  /** Busca a imagem com o token e mostra como blob (a API exige login). */
  private carregarImagem(): void {
    this.assinaturaService.imagem(this.idUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          if (this.previewUrl && this.previewUrl.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
          this.previewUrl = URL.createObjectURL(blob);
          this.cdRef.markForCheck();
        },
        error: () => {
          this.previewUrl = null;
          this.cdRef.markForCheck();
        },
      });
  }

  private toast(msg: string, tipo: 'success' | 'error' = 'success'): void {
    this.snackBar.open(msg, 'Fechar', {
      duration: 4000,
      panelClass: tipo === 'success' ? 'snackbar-success' : 'snackbar-error',
      horizontalPosition: 'right', verticalPosition: 'top'
    });
  }

  carregarAssinatura(): void {
    this.carregando = true;
    this.assinaturaService.obterMinha(this.idUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (a) => {
          this.assinatura = { ...a };
          if (a.possuiImagem) {
            this.carregarImagem();
          }
          this.carregando = false;
          this.cdRef.markForCheck();
        },
        error: () => {
          // 404 = ainda não tem assinatura cadastrada
          this.carregando = false;
          this.cdRef.markForCheck();
        }
      });
  }

  onImagemSelecionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    if (file.size > 500 * 1024) {
      this.toast('Imagem deve ter no máximo 500KB', 'error');
      return;
    }
    if (!file.type.includes('png') && !file.type.includes('jpeg')) {
      this.toast('Apenas PNG ou JPEG são aceitos', 'error');
      return;
    }

    this.imagemSelecionada = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl = e.target?.result as string;
      this.cdRef.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  salvar(): void {
    if (!this.assinatura.nomeExibicao?.trim()) {
      this.toast('Nome de exibição é obrigatório', 'error');
      return;
    }

    this.salvando = true;

    this.assinaturaService.salvar({
      idUsuario: this.idUsuario,
      nomeExibicao: this.assinatura.nomeExibicao!,
      cargo: this.assinatura.cargo,
      setor: this.assinatura.setor,
      imagem: this.imagemSelecionada
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (a) => {
        this.assinatura = { ...a };
        this.imagemSelecionada = null;
        this.salvando = false;
        if (a.possuiImagem) {
          this.carregarImagem();
        }
        this.toast('Assinatura salva com sucesso!');
        this.cdRef.markForCheck();
      },
      error: (err) => {
        this.toast(err.message, 'error');
        this.salvando = false;
        this.cdRef.markForCheck();
      }
    });
  }

  removerImagem(): void {
    if (!confirm('Remover a imagem da assinatura?')) return;

    this.assinaturaService.removerImagem(this.idUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.previewUrl = null;
          this.imagemSelecionada = null;
          if (this.assinatura) this.assinatura.possuiImagem = false;
          this.toast('Imagem removida');
          this.cdRef.markForCheck();
        },
        error: (err) => this.toast(err.message, 'error')
      });
  }
}
