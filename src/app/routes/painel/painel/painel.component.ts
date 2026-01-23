import { CommonModule, DOCUMENT, DatePipe } from '@angular/common';
import { Component, ElementRef, inject, Inject, OnInit, Output, Renderer2, ViewChildren } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription, interval, timer } from 'rxjs';

import { Message } from '@stomp/stompjs';
import { StompState } from '@stomp/ng2-stompjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MtxProgressModule } from '@ng-matero/extensions/progress';
import { MtxAlertModule } from '@ng-matero/extensions/alert';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { MessagingSocketService } from '@core/webSocket/messagingsocket.service';
import { Alerta } from '@core/interface';
import { SharedService } from '../shared.service';
import { ConfiguracaoService } from '@core/configuracao.service';

const songUrl = '/chamadaServlet.do?ativaNuance=true&frase=';
const songParameters = '&qualidade=PREMIUM HIGH&nomeOuSenha=&dsSenha=&dsPostoMilitar=&dsPostoMilitarAbreviado=&nmPaciente=&vozNuance=FELIPE';

@Component({
  selector: 'app-painel',
  templateUrl: './painel.component.html',
  styleUrls: ['./painel.component.scss'],
   imports: [
    DatePipe,
    Component,
    ElementRef,
    Inject,
    Output,
    ViewChildren,
    MatChipsModule,
    MatListModule,
    MatGridListModule,
    MatTableModule,
    MatTabsModule,
    MtxProgressModule,
    MtxAlertModule,
    ButtonModule,
    TableModule,
    CommonModule,
    CardModule,
    ProgressBarModule,
    ToastModule,
    MessagingSocketService,
    SharedService,
    //MatProgressBarModule,
    MessageModule],
  providers: [DatePipe]
})

export class PainelComponent implements OnInit {

  @Output() state: string = "NÃO CONECTADO";
  text:any;
  @Output() statusExecucao: string = '';
  @Output() updatePainel: string = '';
  private updateSubscription: Subscription = {} as Subscription;

  ttsPainelUrl:string   = '';
  public alerta:Alerta         = {} as Alerta;
  song:string           = '';
  songExecution:boolean = false;
  playList:string[]     = [];

  @ViewChildren('player') audioPlayer: ElementRef = {} as ElementRef;

  messageHistory        = [];
  elem:HTMLElement      = {} as HTMLElement;

  screenHeight:any;
  screenWidth:any;
  numbers = timer(1000, ((1000*60)));
  inscricao:Subscription = {} as Subscription;
  tipoPainel:string = {} as string;
  showRequisicao:boolean = false;
  showIncidente:boolean  = false;

  private readonly messagingService = inject(MessagingSocketService);
  private readonly toast = inject(ToastrService);
  private readonly clipboard = inject(Clipboard);
  private readonly hostElement = inject(ElementRef);
  private readonly sharedService = inject(SharedService);
  private readonly router = inject(ActivatedRoute);
  private readonly datePipe = inject(DatePipe);
  private readonly configuracaoService = inject(ConfiguracaoService);



  constructor(
    @Inject(DOCUMENT) private document:Document) {

      // Instantiate a messagingService
      this.messagingService = new MessagingSocketService();
      // Subscribe to its stream (to listen on messages)
      this.messagingService.stream().subscribe((message: Message) => {
        //this.messageHistory.unshift(message.body);
        this.alerta = JSON.parse(message.body);
        if (this.alerta?.tipo == 'INFO'){
          this.showSuccess(this.alerta.titulo,this.alerta.msg);
        }else if (this.alerta.tipo == 'ERRO'){
          this.showError(this.alerta.titulo,this.alerta.msg);
        }else if (this.alerta?.tipo == 'ALERTA'){
          this.showWarning(this.alerta.titulo,this.alerta.msg);
        }else if (this.alerta?.tipo == 'LOG'){
            this.statusExecucao = this.alerta.msg;
            this.hostElement.nativeElement.querySelector('estado');
        }else if (this.alerta?.tipo == 'PNUPD'){/*Atualização Do Painel*/
              this.updatePainel = this.alerta.msg;
              this.atualizarPainel();
              ///implementar metodo para recaregar chamados//this.obterChamados();
        }

        /*Chamada para execução do alerta sonoro TTS*/
        if (this.alerta?.tts != ''){
          this.soundExecutionTTS();
        }
      });

      this.messagingService.state().subscribe((state: StompState) => {
      if (StompState[state] == 'CONNECTED'){
        this.state = 'state_blue';
      }else if (StompState[state] == 'CLOSED'){
        this.state = 'state_red';
      }else if (StompState[state] == 'TRYING'){
        this.state = 'state_yellow';
      }
    });
    }

  atualizarPainel(){
    this.sharedService.emiterUpdatePainel();
  }

  ngOnInit(): void {

    this.inscricao = this.router.queryParams.subscribe(
      (queryParams:any) => {
        this.tipoPainel = queryParams['tipo'];

        if (this.tipoPainel == undefined){
          console.log('tipo painel não informado');
        }else if (this.tipoPainel == 'requisicao'){
            this.showRequisicao = true;
        }else if(this.tipoPainel =='incidente'){
            this.showIncidente = true;
        }
      }
    );

    console.log(this.tipoPainel);

    this.updateSubscription = this.numbers.subscribe(x => {
      this.updatePainel = 'Painel Atualizado Local '+this.datePipe.transform(new Date, 'dd/MM/yyyy HH:mm:ss');
    });

    var context = new AudioContext();
    this.elem = document.documentElement;
    this.updateSubscription = interval(1000*60).subscribe( /*Atualiza a cada 1min*/
      (val) => { /*this.atualizaFrameGlpi()*/
    }
   );
  }
  ngAfterViewInit(){
    this.carregarTTSUrl();
  }


  soundExecutionTTS(){
    this.song = this.ttsPainelUrl + songUrl + this.alerta.tts + songParameters;
    this.playList.push(this.song);
    this.playAudio();
  }
  showSuccess(titulo:string,msg:string) {
    this.toast.success(msg, titulo,{timeOut: 19000,positionClass:'toast-bottom-full-width',enableHtml:true,progressBar:true});
  }

  showWarning(titulo:string,msg:string) {
    msg    = '<b><font color=\"black\">'+msg+'</font></b>';
    this.toast.warning(msg, titulo,{timeOut: 19000,positionClass:'toast-bottom-full-width',enableHtml:true,progressBar:true});
  }

  showError(titulo:string,msg:string) {
    this.toast.error(msg, titulo,{timeOut: 19000,positionClass:'toast-top-full-width',enableHtml:true,progressBar:true});
  }

  carregarTTSUrl(){
    this.configuracaoService.getConfig("TTS_PAINEL").subscribe((dados:any) => {
    this.ttsPainelUrl = dados.valor;
   },(erro:any) => {
               console.log(erro);
             }
   );
 }

  playAudio(){
    if (this.songExecution == true){
      return;
    }

    if (this.playList.length > 0){
     let audio = this.hostElement.nativeElement.querySelector('audio');
     audio.src = encodeURI(this.playList[0]);

    var  _this = this;
    _this.songExecution = true;
    audio.load();
    setTimeout(function() {
      var context = new AudioContext();
      var promise = audio.play();
                if (promise !== undefined) {
                      promise.then((_:any) => {
                      _this.songExecution = true;
                      console.log('Execucao do Audio iniciada');
                      console.log('Audio(s) na Fila antes da execução: '+_this.playList.length);
                    }).catch((error:Error) => {
                      _this.audioError(error);
                    });
                }
        context.close;
     }, 2);
   }
  }

  audioEnded(): void {
    console.log('Execucao do Audio finalizada');
    this.playList.splice(0,1);
    console.log('Audio(s) na Fila final da execução: '+this.playList.length);
    this.songExecution = false;
    this.playAudio();
    console.log('-------------------------------------');
  }

  audioError(error:Error): void {
    console.log('Erro ao Executar Audio');
    console.log(error.message);
    console.log('Fila: '+this.playList.length);
    if (error.name == 'NotAllowedError'){
      this.showWarning('Erro ao executar audio','Sem permisssão do navegador para execução de audio, verificar permissao do navegador');
    }
    this.playList.splice(0,1);
    console.log('Erro Audio(s) na Fila final da execução: '+this.playList.length);
    this.songExecution = false;
    this.playAudio();
    console.log('-------------------------------------');
  }

}
