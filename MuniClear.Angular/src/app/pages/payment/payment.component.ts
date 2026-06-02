import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss']
})
export class PaymentComponent implements OnInit {
  accountId = 0;
  account: any = null;
  loading = true;
  submitting = false;
  error = '';
  success = '';

  // UI State
  activeTab: 'current' | 'arrears' | 'general' = 'general';
  
  // Form fields
  amount = '';
  phoneNumber = '';
  paymentType: 'General' | 'Arrears-Unblock' = 'General';

  // History
  paymentHistory: any[] = [];
  historyLoading = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = localStorage.getItem('accountId');
    if (!id) {
      this.router.navigate(['/login']);
      return;
    }
    this.accountId = Number(id);

    this.route.queryParams.subscribe(params => {
      if (params['success'] === 'true') this.success = '✅ Payment successful!';
      if (params['canceled'] === 'true') this.error = 'Payment was cancelled.';
    });

    this.api.getAccount(this.accountId).subscribe({
      next: (acc) => {
        this.account = acc;
        this.loading = false;
        this.phoneNumber = localStorage.getItem('userPhone') || '';
        
        // Auto-select Arrears tab if account is blocked
        if (acc.isBlocked) {
          this.setTab('arrears');
        } else {
          this.setTab('general');
        }
        this.cdr.detectChanges();
      },
      error: () => this.loading = false
    });

    this.loadHistory();
  }

  setTab(tab: 'current' | 'arrears' | 'general'): void {
    this.activeTab = tab;
    this.error = '';
    
    if (tab === 'arrears') {
      this.paymentType = 'Arrears-Unblock';
      this.amount = this.account?.arrearsBalance > 0 ? this.account.arrearsBalance.toString() : '';
    } else if (tab === 'current') {
      this.paymentType = 'General';
      this.amount = '1474.44'; // Fixed example total from your UI breakdown
    } else {
      this.paymentType = 'General';
      this.amount = '';
    }
  }

  get arrearsShare(): number {
    const amt = Number(this.amount);
    return this.account?.isBlocked && amt > 0 ? amt * 0.30 : 0;
  }

  get accountShare(): number {
    return Number(this.amount) - this.arrearsShare;
  }

  pay(): void {
    const amt = Number(this.amount);
    if (!amt || amt < 10) { this.error = 'Minimum payment is R10.'; return; }
    if (!this.phoneNumber) { this.error = 'Phone number required for SMS receipt.'; return; }

    this.submitting = true;
    const payload = { 
      amount: amt, 
      paymentMethod: this.paymentType, 
      phoneNumber: this.phoneNumber 
    };

    this.api.createCheckout(this.accountId, payload).subscribe({
      next: (res) => { if (res?.url) window.location.href = res.url; },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.message || 'Payment failed to initiate.';
        this.cdr.detectChanges();
      }
    });
  }

  loadHistory(): void {
    this.historyLoading = true;
    this.api.getPaymentHistory(this.accountId).subscribe({
      next: (h) => { this.paymentHistory = h.slice(0, 5); this.historyLoading = false; },
      error: () => this.historyLoading = false
    });
  }

  downloadInvoice(id: number): void {
    this.api.downloadInvoice(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice_${id}.pdf`;
        a.click();
      },
      error: () => this.error = 'Download failed.'
    });
  }

  formatCurrency(v: number): string {
    return `R ${Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  formatDate(d: string): string {
    return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short' }).format(new Date(d));
  }

  goBack(): void { this.router.navigate(['/dashboard']); }
}
