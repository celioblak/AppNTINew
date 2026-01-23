import { DOCUMENT, DatePipe } from '@angular/common';
import { Component, ElementRef, Inject, OnInit, Renderer2 } from '@angular/core';
import { SharedService } from '../shared.service';
import { ChamadoService } from '@core/chamado.service'

import { Subscription } from 'rxjs';


export interface Totais {
  total: number;
  totalAprovacaoGestor: number;
  totalValidacao: number;
  totalAnaliseRequisitos: number;
  totalEmAnalise: number;
  totalPausado: number;
  totalAguardandoExecucao: number;
  totalEmExecucao: number;
  totalSolicitado: number;
  totalReprovado:  number;
  totalValidacaoPendente: number;
}

@Component({
  selector: 'app-painel-requisicao',
  templateUrl: './painel-requisicao.component.html',
  styleUrls: ['./painel-requisicao.component.scss']
})
export class PainelRequisicaoComponent implements OnInit {

  totais:Totais = {} as Totais;
  eventUpdatesubscription:Subscription;
  constructor(
    public chamadoService:ChamadoService,
    private sharedService:SharedService,
    @Inject(DOCUMENT) private document:Document) {
      this.eventUpdatesubscription = this.sharedService.receiverUpdatePainel().subscribe(()=>{
        this.atualizar();
        })
    }

  ngOnInit(): void {
    this.obterChamados();
  }

  atualizar(){
    this.obterChamados();
  }

  obterChamados(){
    this.chamadoService.getTicketPainelRequisicao().then(response =>{
      this.addItensAnalise(response);
      this.addItensExecucao(response);

     if (response.type !='error'){

      this.totais.total                   = response?.total;
      this.totais.totalAprovacaoGestor    = response?.totalAprovacaoGestor;
      this.totais.totalValidacao          = response?.totalValidacao;
      this.totais.totalAnaliseRequisitos  = response?.totalAnaliseRequisitos;
      this.totais.totalEmAnalise          = response?.totalEmAnalise;
      this.totais.totalPausado            = response?.totalPausado;
      this.totais.totalAguardandoExecucao = response?.totalAguardandoExecucao;
      this.totais.totalEmExecucao         = response?.totalEmExecucao;
      this.totais.totalReprovado          = response?.totalReprovado;
      this.totais.totalSolicitado         = response?.totalSolicitado;
      this.totais.totalValidacaoPendente  = response?.totalValidacaoPendente;
     }

        }).catch((error:Error) => {
          console.log('Deu Ruim '+error.message);
        }
      )
  }

  addItensAnalise(valores:any){

       const lista = (document.getElementById('listaAnalise') as HTMLElement);

        while (lista.firstChild) {
          lista.removeChild( lista.firstChild );
        }

      if (valores.item != null){

        if (Number(valores.total) > 0){
          lista.removeChild;
          var divAnalise             = this.document.createElement('div');
          var divPausado             = this.document.createElement('div');
          var indice = 0;

          while(indice < Number(valores.total)){
                  if (valores.item[indice].status == 'AGUARDANDO_ANALISE'){

                    if (valores.item[indice].snPendente == 'N' && valores.item[indice].snTecnico == 'N'){

                      var divItem = this.document.createElement('div');
                      divItem.style.fontSize  = '1.6rem';
                      divItem.style.marginTop = '5'
                      divItem.style.width     = '100%'

                      divItem.className = 'card-body mb-1 p-1';
                      divItem.style.backgroundColor = '#3b5998';

                      divItem.innerHTML = '<b>'+valores.item[indice].idChamado + ' ' +valores.item[indice].titulo.toUpperCase()+'</b>';
                      divAnalise.appendChild(divItem);

                    }else if (valores.item[indice].snPendente == 'S' && valores.item[indice].snTecnico == 'N'){
                      var divItemPendente = this.document.createElement('div');
                      divItemPendente.style.fontSize = '1.6rem';
                      divItemPendente.style.marginTop= '5'

                      divItemPendente.className = 'card-body mb-1 p-1';
                      divItemPendente.style.backgroundColor = '#feda90';

                      divItemPendente.innerHTML = '<b style="color:blue;">'+valores.item[indice].idChamado + ' ' +valores.item[indice].titulo.toUpperCase()+'</b>';
                      divAnalise.appendChild(divItemPendente);
                    }
                  }

                  if (valores.item[indice].status == 'PAUSADO'){
                      var divItemPausado = this.document.createElement('div');
                      divItemPausado.style.fontSize = '1.6rem';
                      divItemPausado.style.marginTop= '5'

                      divItemPausado.className = 'card-body mb-1 p-1';
                      divItemPausado.style.backgroundColor = '#8B4513';

                      divItemPausado.innerHTML = '<b>'+valores.item[indice].idChamado + ' ' +valores.item[indice].titulo.toUpperCase()+'</b>';
                      divPausado.appendChild(divItemPausado);

                  }
                    indice ++;
              }
              lista.appendChild(divAnalise);
              lista.appendChild(divPausado);
              }
          }
    }

 addItensExecucao(valores:any){
      const lista = (document.getElementById('listaExecucao') as HTMLElement);
       while (lista.firstChild) {
         lista.removeChild( lista.firstChild );
       }

     if (valores.item != null){
       if (Number(valores.total) > 0){
         lista.removeChild;
         var divExecucao = this.document.createElement('div');
         var indice = 0;

           while(indice < Number(valores.total)){

                   if (valores.item[indice].status == 'AGUARDANDO_EXECUCAO' || valores.item[indice].status == 'REPROVADO'){

                     if(valores.item[indice].status == 'REPROVADO') {
                      var divItemExecucaoPendente = this.document.createElement('div');
                      divItemExecucaoPendente.style.fontSize = '1.6rem';
                      divItemExecucaoPendente.style.marginTop= '5'

                      divItemExecucaoPendente.className = 'card-body mb-1 p-1';
                      divItemExecucaoPendente.style.backgroundColor = '#ff0000';

                      divItemExecucaoPendente.innerHTML = '<b>'+valores.item[indice].idChamado + ' ' +valores.item[indice].titulo.toUpperCase()+'</b>';
                      divExecucao.appendChild(divItemExecucaoPendente);

                     }else if (valores.item[indice].snPendente == 'N'){

                       var divItemExecucao = this.document.createElement('div');
                       divItemExecucao.style.fontSize  = '1.6rem';
                       divItemExecucao.style.marginTop = '5'
                       divItemExecucao.style.width = '100%'

                       divItemExecucao.className = 'card-body mb-1 p-1';
                       divItemExecucao.style.backgroundColor = '#3b5998';

                       divItemExecucao.innerHTML = '<b>'+valores.item[indice].idChamado + ' ' +valores.item[indice].titulo.toUpperCase()+'</b>';
                       divExecucao.appendChild(divItemExecucao);

                     }else if (valores.item[indice].snPendente == 'S'){
                       var divItemExecucaoPendente = this.document.createElement('div');
                       divItemExecucaoPendente.style.fontSize = '1.6rem';
                       divItemExecucaoPendente.style.marginTop= '5'

                       divItemExecucaoPendente.className = 'card-body mb-1 p-1';
                       divItemExecucaoPendente.style.backgroundColor = '#feda90';

                       divItemExecucaoPendente.innerHTML = '<b style="color:blue;">'+valores.item[indice].idChamado + ' ' +valores.item[indice].titulo.toUpperCase()+'</b>';
                       divExecucao.appendChild(divItemExecucaoPendente);
                     }
                   }
                     indice ++;
               }
               lista.appendChild(divExecucao);
              }
         }
   }

}
