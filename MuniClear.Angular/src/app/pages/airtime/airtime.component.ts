import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import * as signalR from '@microsoft/signalr';

@Component({
  selector: 'app-airtime',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './airtime.component.html',
  styleUrl: './airtime.component.scss'
})
export class AirtimeComponent implements OnInit, OnDestroy {
  // Purchase State
  phoneNumber: string = '';
  selectedNetwork: string = '';
  selectedAmount: number = 20;
  customAmount: string = '';
  useCustom: boolean = false;
  isProcessing: boolean = false;
  showSuccessPopup: boolean = false; 
  errorMessage: string = '';
  
  // Data State
  accountId: number = 1;
  voucherHistory: any[] = [];
  private hubConnection!: signalR.HubConnection;

  networks = [
    { name: 'MTN', color: '#ffcc00' },
    { name: 'Vodacom', color: '#e60000' },
    { name: 'Cell C', color: '#000000' },
    { name: 'Telkom', color: '#0099ff' }
  ];
  presetAmounts = [10, 20, 50, 100, 200, 500];

  constructor(
    private api: ApiService, 
    private router: Router, 
    private route: ActivatedRoute, 
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const id = localStorage.getItem('accountId');
    if (!id) { this.router.navigate(['/login']); return; }
    this.accountId = parseInt(id);

    this.loadHistory();
    this.setupSignalR();

    this.route.queryParams.subscribe(params => {
      if (params['success'] === 'true') {
        this.showSuccessPopup = true;
      }
    });
  }

  private setupSignalR() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5026/paymentHub')
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start().catch(err => console.error(err));

    this.hubConnection.on('ReceivePaymentUpdate', (data: any) => {
      if (Number(data.accountId) === this.accountId) {
        this.loadHistory();
        this.showSuccessPopup = false;
        this.router.navigate([], { queryParams: { success: null } });
      }
    });
  }

  loadHistory() {
    this.api.getMobilePurchases(this.accountId).subscribe({
      next: (res) => {
        this.voucherHistory = res || [];
        this.cdr.detectChanges();
      }
    });
  }

  getFinalAmount(): number {
    return this.useCustom ? (parseFloat(this.customAmount) || 0) : this.selectedAmount;
  }

  purchase() {
    if (!this.selectedNetwork) { this.errorMessage = 'Select a network'; return; }
    const amount = this.getFinalAmount();
    this.isProcessing = true;
    
    this.api.createCheckout(this.accountId, { 
      amount, paymentMethod: 'Airtime', phoneNumber: this.phoneNumber, network: this.selectedNetwork 
    }).subscribe({
      next: (res: any) => window.location.href = res.url,
      error: () => { this.isProcessing = false; this.errorMessage = 'Error starting payment'; }
    });
  }

  shareVoucher(item: any) {
    const msg = `MuniClear Voucher\nCode: ${item.voucherCode}\nNetwork: ${item.network}\nAmount: R${item.amount}`;
    if (navigator.share) {
      navigator.share({ title: 'Airtime Voucher', text: msg });
    } else {
      navigator.clipboard.writeText(msg);
      alert('Voucher copied to clipboard!');
    }
  }

  ngOnDestroy() { if (this.hubConnection) this.hubConnection.stop(); }
  goBack() { this.router.navigate(['/dashboard']); }
}



