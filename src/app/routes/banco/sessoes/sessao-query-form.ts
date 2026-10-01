import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { HttpParams } from '@angular/common/http';
import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { HotToastService } from '@ngxpert/hot-toast';
import { CodeEditorComponent } from '@shared/components/code-editor/code-editor';
import { finalize } from 'rxjs';
import { SessionService } from './sessao.service';

@Component({
  selector: 'sessao-query-form',
  templateUrl: 'sessao-query-form.html',
  standalone: true,
  imports: [MatDialogModule,
            FormsModule,
            MatFormFieldModule,
            MatInputModule,
            MatButtonModule,
            MtxGridModule,
            MatCardModule,
            MatListModule,
            MatDividerModule,
            ClipboardModule,
            CodeEditorComponent
          ],
})
export class SessaoQueriFormComponent implements OnInit {
  constructor( @Inject(MAT_DIALOG_DATA) public data: any ) {
    //this.languages = languages;
  }
  private readonly sessaoService = inject(SessionService);
  private readonly toast = inject(HotToastService);
  private readonly clipboard = inject(Clipboard);
  public readonly linguagem:string = 'PLSQL';
  //languages = languages;
  listBind: any[] = [];
  isLoading = true;

  columnsBind: MtxGridColumn[] = [
    { header: 'Name', field: 'name', width: '10px', resizable: false, formatter: (data: any) => `<span class="label">${data?.name?data?.name:''}</span>`},
    { header: 'Position', field: 'position', width: '15px', resizable: false, formatter: (data: any) => `<span class="label">${data?.position?data?.position:''}</span>`},
    { header: 'DataType', field: 'dataTypeString', width: '200px', pinned: 'left', resizable: false},
    { header: 'Value', field: 'valueString', width: '200px', resizable: false},
  ];

    ngOnInit() {
      let paramsb = new HttpParams();
      paramsb = paramsb.append('sqlId',this.data.sqlId);
      paramsb = paramsb.append('sqlAddress',this.data.address);
      paramsb = paramsb.append('hashValue',this.data.hashValue.toString());
      paramsb = paramsb.append('childAddress',this.data.childAddress);
      this.isLoading = true;
      this.sessaoService.pesquisarBind(paramsb).pipe(
        finalize(() => {
          this.isLoading = false;
        })
      ).subscribe(dadosBind => {
        this.listBind = dadosBind;
      }
     );
    }
    copysql() {
      //this.clipboard.copy(this.query);
      //this.addToast('Area de Transferência','Valor copiado para area de transferência',Colors.info,ToasterPlacement.BottomEnd, 3000);
      this.copy(this.data.sqlFullText);
    }

    copy(value:string) {
      this.clipboard.copy(value);
      this.toast.info('Valor copiado para area de transferência');
    }
}
