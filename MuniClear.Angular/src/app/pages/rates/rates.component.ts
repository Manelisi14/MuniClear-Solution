import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BehaviorSubject, of } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';

@Component({
  selector: 'app-rates',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rates.component.html',
  styleUrls: ['./rates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatesComponent implements OnInit {
  accountId = 0;

  // 🏛️ Municipal Property Rates Evaluation Models
  marketValue = 850000.00; // Default residential valuation baseline property example
  readonly statutoryRebate = 15000.00; // Local MPRA tax-free floor threshold exclusion limit
  rateableValue = 0.00;
  
  // Real-world City of uMhlathuze standard residential rate-in-the-rand ratio example 
  readonly centsInRandFactor = 0.00842; // ~0.842c per rand of value on calculated property
  monthlyRatesCharge = 0.00;

  readonly uiState = {
    loading$: new BehaviorSubject<boolean>(false),
    error$: new BehaviorSubject<string>('')
  };

  constructor(
    private readonly router: Router,
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const cachedId = localStorage.getItem('accountId');
    if (!cachedId) {
      this.router.navigate(['/login']);
      return;
    }

    this.accountId = Number(cachedId);
    this.calculateRatesMathMatrix();
    this.syncLivePropertyRegistryTelemetry();
  }

  private calculateRatesMathMatrix(): void {
    // Deduct standard tax floor exclusion basis cleanly
    this.rateableValue = Math.max(this.marketValue - this.statutoryRebate, 0);
    
    // Annual property tax value split evenly across 12 monthly payments
    const annualCharge = this.rateableValue * this.centsInRandFactor;
    this.monthlyRatesCharge = annualCharge / 12;
  }

  private syncLivePropertyRegistryTelemetry(): void {
    this.uiState.loading$.next(true);

    this.api.getAccount(this.accountId).pipe(
      take(1),
      catchError((err) => {
        console.warn('Property Registry metrics out of bounds. Maintaining baseline calculation frameworks.', err);
        return of(null);
      }),
      finalize(() => {
        this.uiState.loading$.next(false);
        this.cdr.markForCheck();
      })
    ).subscribe((accountDetails: any) => {
      if (!accountDetails || !accountDetails.propertyMarketValue) return;

      this.marketValue = accountDetails.propertyMarketValue;
      this.calculateRatesMathMatrix();
    });
  }

  applyForPensionerRebate(): void {
    console.log('Routing to pensioner relief wizard forms framework...');
    this.router.navigate(['/rebate-application']);
  }

  disputeValuation(): void {
    console.log('Spinning up Section 50 local municipal appeal objection module...');
    this.router.navigate(['/valuation-dispute']);
  }

  formatCurrency(v: number): string {
    return `R ${v.toFixed(2)}`;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
