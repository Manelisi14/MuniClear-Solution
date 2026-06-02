import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { catchError, finalize, take } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-electricity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './electricity.component.html',
  styleUrls: ['./electricity.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ElectricityComponent implements OnInit {

  accountId = 1;
  step: 'home' | 'buy' | 'success' = 'home';
  loading = false;
  submitting = false;
  error = '';

  purchaseAmount = 0;
  buyForSomeoneElse = false;
  targetMeterNumber = '';
  readonly presetAmounts = [50, 100, 200, 500];

  tokens: any[] = [];
  latestToken: any = null;
  monthlyKwh = 0;

  readonly ibtBlocks = [
    { label: 'Block 1', range: '0–50 kWh',    rateIncl: 0.98,  maxKwh: 50   },
    { label: 'Block 2', range: '51–350 kWh',   rateIncl: 1.52,  maxKwh: 350  },
    { label: 'Block 3', range: '351–600 kWh',  rateIncl: 2.17,  maxKwh: 600  },
    { label: 'Block 4', range: '600+ kWh',     rateIncl: 2.82,  maxKwh: 9999 },
  ];

  get currentBlock() {
    return this.ibtBlocks.find(b => this.monthlyKwh <= b.maxKwh) ?? this.ibtBlocks[3];
  }

  get currentBlockIndex() {
    const idx = this.ibtBlocks.findIndex(b => this.monthlyKwh <= b.maxKwh);
    return idx === -1 ? 3 : idx;
  }

  get ibtProgressPct() { return Math.min((this.monthlyKwh / 600) * 100, 100); }

  get estimatedKwh() {
    if (this.purchaseAmount < 10) return 0;
    return this.purchaseAmount / this.currentBlock.rateIncl;
  }

  get defaultMeter(): string {
    return localStorage.getItem('meterNumber') || 'MTR100';
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.accountId = Number(localStorage.getItem('accountId') || 1);
    this.loadTokens();

    // Detect Stripe redirect back with ?success=true
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (params['success'] === 'true') {
        this.step = 'success';
        this.pollForNewToken();
        // Clean the URL
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
  }

  loadTokens(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.api.getElectricityTokens(this.accountId).pipe(
      take(1),
      catchError(() => of([])),
      finalize(() => { this.loading = false; this.cdr.markForCheck(); })
    ).subscribe((tokens: any[]) => {
      this.tokens = tokens;
      this.latestToken = tokens[0] ?? null;

      // Estimate monthly kWh from token purchase amounts
      const now = new Date();
      const monthlyTokens = tokens.filter(t => {
        const d = new Date(t.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      // Approximate: assume Block 2 rate for estimate
      this.monthlyKwh = monthlyTokens.reduce((sum, t) => sum + (t.amount / 1.52), 0);
      this.cdr.markForCheck();
    });
  }

  // Poll after Stripe redirect — webhook may have a few seconds delay
  private pollForNewToken(attempts = 0): void {
    if (attempts > 8) return;
    setTimeout(() => {
      this.api.getElectricityTokens(this.accountId).pipe(
        take(1), catchError(() => of([]))
      ).subscribe((tokens: any[]) => {
        if (tokens.length > this.tokens.length || (tokens[0]?.purchaseID !== this.tokens[0]?.purchaseID)) {
          this.tokens = tokens;
          this.latestToken = tokens[0] ?? null;
          this.cdr.markForCheck();
        } else {
          this.pollForNewToken(attempts + 1);
        }
      });
    }, 2500);
  }

  buy(): void {
    this.error = '';
    if (this.purchaseAmount < 10) { this.error = 'Minimum purchase is R10.00'; return; }
    if (this.buyForSomeoneElse && this.targetMeterNumber.trim().length < 6) {
      this.error = 'Please enter a valid meter number'; return;
    }

    this.submitting = true;
    this.cdr.markForCheck();

    const meter = this.buyForSomeoneElse ? this.targetMeterNumber.trim() : this.defaultMeter;

    this.api.createCheckout(this.accountId, {
      amount: this.purchaseAmount,
      paymentMethod: 'Electricity',
      meterNumber: meter,
    }).pipe(
      take(1),
      catchError(() => {
        this.error = 'Payment failed to start. Please try again.';
        this.submitting = false;
        this.cdr.markForCheck();
        return of(null);
      })
    ).subscribe(res => {
      if (res?.url) window.location.href = res.url;
      else { this.submitting = false; this.cdr.markForCheck(); }
    });
  }

  goToBuy(): void  { this.step = 'buy'; this.purchaseAmount = 0; this.error = ''; }
  goHome(): void   { this.step = 'home'; this.loadTokens(); }
  goBack(): void   { this.router.navigate(['/dashboard']); }
  addPreset(v: number): void { this.purchaseAmount += v; this.error = ''; }

  copyToken(token: string): void {
    navigator.clipboard.writeText(token).catch(() => {});
  }

  formatToken(t: string): string { return t || ''; }

  formatCurrency(v: number): string {
    return `R ${(v ?? 0).toFixed(2)}`;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(d));
  }
}