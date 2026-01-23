import { DOCUMENT } from '@angular/common';
import { Component, inject, Inject, OnInit} from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { ServidorDto, Sessao } from '@core/interface';
import { SharedService } from '../shared.service';
import { ChamadoService } from '@core/chamado.service';

@Component({
  selector: 'app-painel-incidente',
  templateUrl: './painel-incidente.component.html',
  styleUrls: ['./painel-incidente.component.scss']
})
export class PainelIncidenteComponent implements OnInit {

  eventUpdatesubscription:Subscription;

  public servidores:ServidorDto[] = [];
  public sessoesLocks:Sessao[] = [];
  public totalLocks:number = 0;
  public locksTempoMaior:number = 0;
  public qtdChamandos:number = 0;
  public snApresentaChamados:boolean = true;

  numbers = timer(1000, ((1000*2)));
  private updateSubscription: Subscription = {} as Subscription;
  private chamadoService = inject(ChamadoService);
  private readonly sharedService = inject(SharedService);

  constructor(
    @Inject(DOCUMENT) private document:Document) {
      this.eventUpdatesubscription = this.sharedService.receiverUpdatePainel().subscribe(()=>{
          console.log('EVENTO ATUALIZAR RECEBIDO');
          this.atualizar();
        })
    }

  ngOnInit(): void {
     this.updateSubscription = this.numbers.subscribe(x => {
      this.obterServidor();
     // this.obterLocks();
    });

    this.atualizar();
    //this.obterServidor();
    //this.obterLocks();
  }
  ngAfterInit(){
    this.snApresentaChamados = false;
  }

  atualizar(){
    this.obterChamados();
  }

  obterChamados(){
     this.chamadoService.getTicketPainel().then(response =>{
          if (response.type !='error'){
              this.addItensLista(response);
          }
        }).catch((error:Error) => {
          console.log('Deu Ruim '+error.message);
        }
      )
  }

usoDiscoToNumero(usoTexto:string):number{
  usoTexto = usoTexto.replace('%','');
  return parseInt(usoTexto);
}

usoDiscoCor(usoTexto:string):string{
  let percentual = this.usoDiscoToNumero(usoTexto);
  let cor:string;
  if (percentual >= 0 && percentual <=79){
    cor ='success';
  }else if (percentual >= 80  && percentual <=90){
    cor ='warning';
  }else if (percentual >= 90 ){
    cor ='danger';
   }else{
    cor='';
   }
  return cor;
}

usoCpuToNumero(usoTexto:string):number{
  return parseInt(usoTexto);
}

usoCpuCor(usoTexto:string):string{
  let valor = this.usoCpuToNumero(usoTexto);
  let cor:string;
  if (valor >= 0 && valor <=1.5){
    cor ='success';
  }else if (valor >= 1.5  && valor <=2.9){
    cor ='warning';
  }else if (valor >= 3 ){
    cor ='danger';
   }else{
    cor='';
   }
  return cor;
}

snProgressAnimado(elementoId:string):boolean{
  const pb = (document.getElementById(elementoId) as HTMLElement);
    return true;
}

/*obterServidor(){
  this.servicedeskService.getPainelServidor().then(response =>{
    if(response.type == 'error'){
      console.log('.........  '+response);
      return;
    }

      this.servidores = response;
    }).catch((error:Error) => {
      console.log('Deu Ruim ao obter servidor'+error.message);
    }
    )
}*/

obterServidor(){
  this.chamadoService.getPainelServidor().subscribe(
      data => {
        this.servidores = data;
      }
    );
}

retornaCorLock(sessao:any):string{
  var tempo:number = this.retornaTempoLock(sessao);
    if (tempo >= 0 && tempo <=5){
      return 'warning';
    }else if (tempo >= 6  ){
      return 'danger';
    }
    return '';
}

retornaCorTabelaLock(qtd:number):string{
  let cor:string = '';
  if (this.locksTempoMaior >= 10){
    cor= 'danger';
  }else{
        if (qtd >= 5 && qtd <=10){
          cor= 'warning';
        }else if (qtd >= 10 ){
          cor= 'danger';
        }
}
  return cor;
}

retornaCorTextoTabelaLock(qtd:number):string{
  let cor:string = '';
  if (this.locksTempoMaior >= 10){
    cor= 'white';
  }else{
        if (qtd >= 5 && qtd <=10){
          cor= 'white';
        }else if (qtd >= 10  ){
          cor= 'dark';
        }
}
  return cor;
}

retornaTempoLock(sessao:any):number{
  return sessao.tempoLock;
}

  obterLocks(){
    this.chamadoService.getPainelLocks().then(response =>{
      this.sessoesLocks = [];
      this.locksTempoMaior = 0;
      this.totalLocks = response.total;
      for (let sessao of response.item){
        sessao.tempoLock = this.difTime(new Date,new Date (sessao.last_status_date),sessao);
        this.sessoesLocks.push(sessao);
        if(sessao.tempoLock > this.locksTempoMaior){
          this.locksTempoMaior = sessao.tempoLock;
        }
       }

      }).catch((error:Error) => {
        console.log('Deu Ruim ao obter Locks'+error.message);
      }
      );
  }

  difTime(dataMaior:Date, dataMenor:Date,sessao:Sessao):number{
    let time = dataMaior.getTime() - dataMenor.getTime()
    time = Math.trunc((time/1000)/60);
    return time;
  }

  addItensLista(valores:any){
     this.qtdChamandos = 0;
   if (valores.item != null){

     if (Number(valores.total) > 0){

       var divIncidente = this.document.createElement('div');
       var indice = 0;

       while(indice < Number(valores.total)){
            if (valores.item[indice].status == 'SOLICITADO' || valores.item[indice].status == 'AGUARDANDO_EXECUCAO'){

                   this.qtdChamandos = this.qtdChamandos +1;

                   var divItem = this.document.createElement('div');
                   divItem.style.fontSize  = '1.6rem';
                   divItem.style.marginTop = '5';
                   divItem.style.width     = '100%';
                   divItem.className = 'card-body mb-1 p-1';
                   divItem.id = valores.item[indice].idChamado;
                   if (valores.item[indice].snPendente == 'S'){
                    divItem.style.backgroundColor = '#feda90';
                    divItem.innerHTML = '<b style="color:blue;">'+valores.item[indice].idChamado + ' ' +valores.item[indice].titulo.toUpperCase()+'</b>';
                   }else{
                    divItem.style.backgroundColor = '#3b5998';
                    divItem.innerHTML = '<b>'+valores.item[indice].idChamado + ' ' +valores.item[indice].titulo.toUpperCase()+'</b>';
                   }

                   if(valores.item[indice].snStatusNovo == 'S'){
                      var imgGreen = this.document.createElement('img');
                      imgGreen.width = 23;
                      imgGreen.height = 23;
                      imgGreen.style.marginLeft = "15px";
                      imgGreen.style.padding = '100';
                      imgGreen.src = 'assets/images/circle_green.png';
                      divItem.appendChild(imgGreen);
                   }
                   divIncidente.appendChild(divItem);
               }
               indice ++;
             }

             if (divIncidente.childElementCount > 0){
              const lista = (document.getElementById('listaIncidente') as HTMLElement);
              if (lista!=null){
                while (lista.firstChild) {
                  lista.removeChild( lista.firstChild );
                }
               }
              lista.appendChild(divIncidente);
              this.snApresentaChamados = true;
             }else{
              const lista = (document.getElementById('listaIncidente') as HTMLElement);
               if (lista!=null){
                while (lista.firstChild) {
                  lista.removeChild( lista.firstChild );
                }
               }
              this.snApresentaChamados = false;
             }
           }
       }

       const menus = (document.getElementById('menus') as HTMLElement);
       if (this.qtdChamandos > 15){
          menus.className = "div-cotent";
       }else{
          menus.className = "";
       }
 }
}
