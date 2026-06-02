import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import * as signalR from '@microsoft/signalr';

@Component({
  selector: 'app-root',
  standalone: true, // Assuming your app is standalone based on the imports
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('MuniClear.Angular');
  private hubConnection!: signalR.HubConnection;

  ngOnInit() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5026/paymentHub')
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start()
      .then(() => console.log('SignalR: Global Connection Active'))
      .catch(err => console.error('SignalR Error: ', err));

    // Listen globally
    this.hubConnection.on('ReceivePaymentUpdate', (data: any) => {
      console.log('Global Payment Notification:', data);
      // You can trigger a global notification or toast message here
    });
  }

  ngOnDestroy() {
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }
}

