import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { HttpParams } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PageEvent } from '@angular/material/paginator';
import { MtxGridColumn, MtxGridModule, MtxGridRowClassFormatter } from '@ng-matero/extensions/grid';

import { finalize } from 'rxjs';
import { SessionService } from './sessao.service';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { MatRadioModule } from '@angular/material/radio';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { HotToastService } from '@ngxpert/hot-toast';
import { AlturaAteRodape } from '@shared';
import { SessaoQueriFormComponent } from './sessao-query-form';
import { SessoesLockComponent } from './sessoes-lock/sessoes-lock';


@Component({
  selector: 'app-sessoes',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MtxGridModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    TranslateModule,
    MatRadioModule,
    MtxSelectModule,
    CommonModule,
    ClipboardModule,
    MatMenuModule,
    MatTabsModule,
    SessoesLockComponent,
    AlturaAteRodape
  ],
  templateUrl: './sessoes.html',
  styleUrl: './sessoes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessoesComponent implements OnInit, AfterViewInit {
  private readonly sessaoService = inject(SessionService);
  private readonly toast = inject(HotToastService);
  private readonly clipboard = inject(Clipboard);
  private readonly cdr = inject(ChangeDetectorRef);
  dialog = inject(MatDialog);

  win_width = 0;
  win_height = 300;
  _selectedStatus = 'lock';
  _selectedFiltro = 'username';
  _valorPesquisa = undefined;

  columns: MtxGridColumn[] = [
    { header: 'Sid', field: 'sid', width: '10px', resizable: false, class: data => {return data?.status == 'ACTIVE' ? 'success' : '';} ,formatter: (data: any) => `<span class="label">${data?.sid?data?.sid:''}</span>`},
    { header: 'Serial', field: 'serial', width: '15px', resizable: false, formatter: (data: any) => `<span class="label">${data?.serial?data?.serial:''}</span>`},
    { header: 'Username', field: 'username', width: '200px', pinned: 'left', resizable: false},
   // { header: 'B.Sid', field: 'lc_session', width: '15px', resizable: false, formatter: (data: any) => `<span class="label">${data?.lc_session?data?.lc_session:''}</span>`},
    { header: 'Blocker', field: 'lc_user', width: '200px', resizable: false},
   // { header: 'B.Final Sid', field: 'lc_final_session', width: '15px', resizable: false, formatter: (data: any) => `<span class="label">${data?.lc_final_session?data?.lc_final_session:''}</span>`},
    { header: 'Blocker Final', field: 'lc_final_user', width: '200px', resizable: false},
   /* {
      header: '',
      field: 'kilL',
      minWidth: 10,
      width: '10px',
      right: '0px',
      type: 'button',
      resizable: true,
      buttons: [
        {
          type: 'icon',
          text: 'SQL',
          icon: 'receipt',
          color: 'primary',
          tooltip: 'SQL',
         // disabled: data => data.sql_id==null,
          iif: data => data.sql_id!=null,
          click: (data) => alert(data.username),
        }
      ],
    },*/
    { header: 'Program', field: 'program', width: '200px', resizable: false},
    { header: 'Action', field: 'action', width: '200px', resizable: false},
    { header: 'Terminal', field: 'terminal', width: '200px', resizable: false},
    { header: 'SO User', field: 'usuario_terminal', width: '200px', resizable: false},
    { header: 'Dt.Logon', field: 'logon_time', width: '200px', resizable: false},
    { header: 'Dt.Status', field: 'last_status_time', width: '200px', resizable: false},
    {
      header: 'Operação',
      field: 'operacao',
      pinned: 'right',
      minWidth: 115,
      width: '115px',
      right: '0px',
      type: 'button',
      resizable: false,
      buttons: [
        {
          type: 'icon',
          text: 'SQL',
          icon: 'code',
          color: 'primary',
          tooltip: 'SQL',
         // disabled: data => data.sql_id==null,
          iif: data => data.sql_id!=null,
          click: (data) => this.carregarSql(data),
        },
        {
          type: 'icon',
          text: 'Derrubar',
          icon: 'offline_bolt',
          color: 'warn',
          class: 'btn-vermelho',
          tooltip: 'Derrubar',
          click: (data) => this.killSessao(data),
        },
      ],
    },
  ];


  list: any[] = [];
  total = 0;
  isLoading = true;
  noResult='Nenhum registro encontrado';

  query = {
    q: 'user:nzbin',
    sort: 'stars',
    order: 'desc',
    page: 0,
    per_page: 10,
  };

  get params() {
    const p = Object.assign({}, this.query);
    p.page += 1;
    return p;
  }

  ngOnInit() {
    setTimeout(() => {
       this.pesquisarSessao();
    });

    this.win_width = window.innerWidth;
    this.win_height = window.innerHeight;

  }
  ngAfterViewInit(){
  }

 /* radioStatusChange(event:any){
    this._selectedStatus = event.value;
    console.log(this._selectedStatus);
  }*/

 /* radioPesquisaChange(event:any){
    this._selectedFiltro = event.value;
    console.log(this._selectedFiltro);
  }*/

  pesquisarSessao() {
    let params = new HttpParams();
    if (this._selectedStatus == 'lock'){
      params = params.append('lc_status','VALID');
    }else if (this._selectedStatus == 'exclusiva'){
      params = params.append('sn_lc_exclusive','S');
    }else if (this._selectedStatus == 'ativa'){
      params = params.append('status','ACTIVE');
    }else if (this._selectedStatus == 'inativa'){
      params = params.append('status','INACTIVE');
    }else if (this._selectedStatus == 'todas'){
      //nao atribui nenhum paramentro
    }else{
      params = params.append('lc_status','VALID');
    }
    if (this._valorPesquisa != undefined){
        params = params.append(this._selectedFiltro,this._valorPesquisa);
    }

    this.isLoading = true;
    this.sessaoService
      //.getList(this.params)
      .pesquisarSessoes(params)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe(res => {
        this.list = res;
        this.total = res.length;
        this.isLoading = false;
      });

  }

  killSessao(row:any) {
    this.sessaoService.matarSessoes(row).subscribe(dados => {
          this.toast.info('Sessão do usuario '+row.username+' derrubada com sucesso!');
          this.pesquisarSessao();
        },erro => {
          console.log(erro);
          this.pesquisarSessao();
          this.toast.error('Erro ao derrubar sessão do usuario:  '+row.username+'\n'+erro.error);
        }
    );
    this.pesquisarSessao();
  }


  killSessaoLock(row:any) {
    this.sessaoService.matarSessoesLock(row).subscribe(dados => {
            this.toast.info('Sessão do usuario '+row.lc_final_user+' derrubada com sucesso!');
            this.pesquisarSessao();
          },erro => {
            this.toast.error('Erro ao derrubar sessão do usuario:  '+row.lc_final_user+'\n'+erro.error);
            this.pesquisarSessao();
          }
          );
  }

  copy(value:string) {
    this.clipboard.copy(value);
    this.toast.info('Valor copiado para area de transferência');
  }

  getList() {
    this.isLoading = true;
    this.sessaoService
      //.getList(this.params)
      .carregarSessoes()
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(res => {
        this.list  = res;

        this.total = res.length;
        console.log(this.total);
        this.isLoading = false;
      });
  }

  getNextPage(e: PageEvent) {
    this.query.page = e.pageIndex;
    this.query.per_page = e.pageSize;
    this.getList();
  }

  search() {
    this.query.page = 0;
    //this.getList();
    this.pesquisarSessao();
  }

  reset() {
    this.query.page = 0;
    this.query.per_page = 10;
    this.getList();
  }

async carregarSql(row:any){

  let params = new HttpParams();

  params = params.append('sqlId',row.sql_id);
  params = params.append('sqlAddress',row.sql_address);
  params = params.append('hashValue',row.sql_hash_value.toString());
  params = params.append('parsingSchemaName',row.username);

  await this.sessaoService.pesquisarSql(params).subscribe(dados => {
     if (dados.length > 0){
       if (dados != null){
        this.dialog.open(SessaoQueriFormComponent,{
                                        maxWidth: '70vw',
                                        maxHeight: '100vh',
                                        height: '70%',
                                        width: '90%',
                                        panelClass: 'full-screen-modal',
                                        data: dados[0]
                                      });
       }
     }
    }
   );

 }
}
