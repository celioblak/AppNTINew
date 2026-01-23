import { Injectable } from "@angular/core";
import { environment } from "@env/environment";
import { StompService, StompConfig, StompState } from "@stomp/ng2-stompjs";
import { Message } from "@stomp/stompjs";
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})


export class MessagingSocketService {
  private messages: Observable<Message>;
  private stompService: StompService;
  private WsUrl = environment.webSockerBaseUrl;//"ws:/127.0.0.1:8080/app-nti/socket";
  private topico = "/topic/server-broadcaster";

    constructor() {
    // Create Stomp Configuration
    let stompConfig: StompConfig = {
      url: this.WsUrl,
      headers: {
        login: "",
        passcode: ""
      },
      heartbeat_in: 0,
      heartbeat_out: 20000,
      reconnect_delay: 5000,
      debug: false
    };
    // Create Stomp Service
    this.stompService = new StompService(stompConfig);
    // Connect to a Stream
    this.messages = this.stompService.subscribe(this.topico);
  }

  stream(): Observable<Message> {
    return this.messages;
  }

  send(url: string, message: any) {
    return this.stompService.publish(url, JSON.stringify(message));
  }

  sendUser(url: string, message: any, usuario:string) {
    let headers = {
      user: usuario,
    }

    return this.stompService.publish(url, JSON.stringify(message),headers);
  }

  state(): BehaviorSubject<StompState> {
    return this.stompService.state;
  }
}
