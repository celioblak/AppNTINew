import { Component, ElementRef, HostListener, inject, OnInit, ViewChild } from '@angular/core';
import { HbserviceService } from '@core/hbservice/hb.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import RFB from '@novnc/novnc/lib/rfb';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MtxGridModule } from '@ng-matero/extensions/grid';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';

@Component({
  selector: 'app-vnc-view',
  standalone: true,
  imports: [TranslateModule,
            MatIconModule,
            MatButtonModule,
            FormsModule,
            MatFormFieldModule,
            MtxGridModule,
            MatInputModule,
            MatOptionModule,
            ReactiveFormsModule,
            MatCardModule,
            MatDatepickerModule,
            MatSelectModule,
            ],
  templateUrl: './vnc-view.component.html',
  styleUrl: './vnc-view.component.scss'
})
export class VncViewComponent implements OnInit {
  readonly hbService:HbserviceService = inject(HbserviceService);
  private readonly translate = inject(TranslateService);

  title = 'vnc-client';
  public rfb: RFB = {} as RFB;
  desktopName = '';
  status = 'DESCONECTADO';
  statusExecutaveis = '';
  url = 'ws';
  password = 'monitor';
  host = '';
  vncAtivo = false;

  @ViewChild('btnStart') btnStart!: ElementRef;

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    console.log(event);
    //keyCode = 20
    //code:"CapsLock"
  }

// Since most operating systems will catch Ctrl+Alt+Del
// before they get a chance to be intercepted by the browser,
// we provide a way to emulate this key sequence.
sendCtrlAltDel() {

    this.rfb.sendCtrlAltDel();
    return false;
}
stopClient() {
  this.rfb.disconnect();
}

getHostValue(e:any){

  this.host = e.target.value;
  if(this.host == ''){
    //const btnStart: HTMLElement = document.getElementById('btnStart') as HTMLElement;
        //btnStart.setAttribute('disabled','');
    this.btnStart.nativeElement.setAttribute('disabled', '');
  }else{
    //const btnStart: HTMLElement = document.getElementById('btnStart') as HTMLElement;
       // btnStart.removeAttribute('disabled');
    this.btnStart.nativeElement.removeAttribute('disabled');
  }
}

makeFullScreen(){
  const divVncView = document.getElementById('vncView') as HTMLElement;
  console.log(divVncView);
  divVncView.className = 'fullScreen';
  const requestMethod = divVncView.requestFullscreen;
  if (requestMethod) { // Native full screen.
    requestMethod.call(divVncView);
  }
}
_interopRequireDefault(e:any) { return e && e.__esModule ? e : { default: e }; }

sendCapsLock(){
  const _keysym = this._interopRequireDefault(('./input/keysym.js'));
  console.log('sendKey');
  // Meta
  // MetaLeft
  // 91
  /*for (let i:number = 0; i < 1000; i++) {
    console.log(i);
    this.rfb.sendKey(0xffe5,'CapsLock',false);
    console.log('___________________________');
    this.delay(10000);
 }*/
   // this.rfb.sendCtrlAltDel();
   this.rfb.sendKey(_keysym['default'].XK_Caps_Lock, 'CapsLock', true);

}

async startClient() {
   if(!await this.verificaRequisitos()){
      console.log('Pré requisitos nao atendido');
      this.vncAtivo = false;
      return;
   }

    console.log('Starting !!!');
    if(this.host == ''){
      return;
    }

    this.status = 'CONECTANDO';
    this.vncAtivo = true;
    /*let btnStart: HTMLElement = document.getElementById('btnStart') as HTMLElement;
        btnStart.setAttribute('disabled','');
    let hostElement: HTMLElement = document.getElementById('hostInput') as HTMLElement;
        hostElement.setAttribute('disabled','');*/

    // Read parameters specified in the URL query string
    // By default, use the host and port of server that served this file
   // const host = "localhost";
   //this.host= "localhost";

    const port = '5901';
    //const password = "monitor"; // password of your vnc server
    const path = 'websockify';
    // Build the websocket URL used to connect

    if (window.location.protocol === 'https:') {
      this.url = 'wss';
    } else {
      this.url = 'ws';
    }

    this.url += '://' + this.host;
    if (port) {
      this.url += ':' + port;
    }
    this.url += '/' + path;
    //console.log("URL: ", this.url);

    try{
      const container = document.getElementById('screen') as HTMLElement;
      // Creating a new RFB object will start a new connection
      this.rfb = new RFB(container, this.url, {
        credentials: { username: '',password: this.password, target:''},
      });
    }catch(e){
        console.log(e);
    }

     // Add listeners to important events from the RFB module
     this.rfb.addEventListener('connect', (detail:any) =>{
      this.status = 'CONECTADO';
      this.vncAtivo = true;
      this.statusExecutaveis = '';

    });

     this.rfb.addEventListener('disconnect', (detail:any) =>{
        this.status = 'DESCONECTADO';
        this.desktopName = '';
        this.statusExecutaveis = '';
        this.vncAtivo = false;
        this.statusExecutaveis = '';
     });

     this.rfb.addEventListener('credentialsrequired', (detail:any) =>{
      this.status = 'CREDENCIAL REQUERIDO';
      this.vncAtivo = false;
     });

     this.rfb.addEventListener('desktopname', (detail:any) =>{
      this.desktopName = detail.detail.name.replace(' - application mode','').toUpperCase();
     });

     this.rfb.addEventListener('serververification', async(detail:any) =>{
      const type = detail.detail.type;
      console.log(detail);
     });

     this.rfb.addEventListener('bell', (detail:any) =>{
      const player = document.getElementById('noVNC_bell') as HTMLAudioElement;
      player.play();
        player.addEventListener('error',(e) =>{
          console.log('Playback error: ' + e);
        });
     });
  }

  ngOnInit(): void {
  }

  private delay(ms: number): Promise<boolean> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }

  async verificaRequisitos(){
        const hbserviceStatus = (await this.hbService.health(this.host)).status;
        if(hbserviceStatus == 'OK'){
          this.statusExecutaveis = 'HBSERVICE INICIADO NO DESTINO';
            const vncStatus = (await this.hbService.statusVNC(this.host)).status;
            if (vncStatus == 'NAO INICIADO'){
              /*Reinicia o VNC*/
              this.statusExecutaveis = 'VNC NAO INICIADONO DESTINO, TENTATIVA DE INICIALIZADO SERÁ REALIZADA';
              const vncStatusTentativa = (await this.hbService.restartVNC(this.host,'')).status;
                await this.delay(2000);
                  if (vncStatusTentativa == 'NAO INICIADO'){
                    this.statusExecutaveis = 'VNC NAO INICIADO NO DESTINO, APOS TENTATIVA';
                    return false;
                  }else{
                    this.statusExecutaveis = 'VNC INICIADO NO DESTINO COM TENTATIVA';
                    return true;
                  }
            }else{
              this.statusExecutaveis = 'VNC EM EXECUÇAO NO DESTINO';
              return true;
            }
        }else{
          this.statusExecutaveis = 'HBSERVICE NAO INICIADO NO DESTINO';
          return false;
        }
   }
}
