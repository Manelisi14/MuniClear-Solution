import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BehaviorSubject, forkJoin, of } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';

// ═══════════════════════════════════════════════════════════════
// DEFENSIVE DATA TYPES SYSTEM INTERFACES
// ═══════════════════════════════════════════════════════════════
export interface DebtPlanTerm {
  months: number;
  label: string;
  rate: string;
}

export interface DebtPlanPreview {
  monthlyInstalment: number;
  totalWithInterest: number;
  interestCharged: number;
}

export interface ActivePaymentArrangement {
  id?: number;
  status: 'Active' | 'Completed' | 'Defaulted';
  totalArrears: number;
  paidToDate: number;
  monthlyInstalment: number;
  nextPaymentDate: string;
}

@Component({
  selector: 'app-payment-plan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-plan.component.html',
  styleUrls: ['./payment-plan.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush // Drastically cuts mobile CPU cycles
})
export class PaymentPlanComponent implements OnInit {
  accountId = 1;
  account: any = null;
  
  // Interactive UI State Controllers 
  termMonths = 6;
  preview: DebtPlanPreview | null = null;
  activePlan: ActivePaymentArrangement | null = null;

  // South African Municipal Arrears Regulation Pricing Standard Setup
  readonly terms: DebtPlanTerm[] = [
    { months: 3, label: '3 months', rate: '0% interest' },
    { months: 6, label: '6 months', rate: '5% interest' },
    { months: 12, label: '12 months', rate: '10% interest' }
  ];

  // Enterprise Subscription State Machine Flags
  readonly uiState = {
    loading$: new BehaviorSubject<boolean>(true),
    submitting$: new BehaviorSubject<boolean>(false),
    error$: new BehaviorSubject<string>(''),
    success$: new BehaviorSubject<string>('')
  };

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE INITIALIZATION
  // ═══════════════════════════════════════════════════════════════
  ngOnInit(): void {
    const cachedId = localStorage.getItem('accountId');
    if (!cachedId) {
      this.router.navigate(['/login']);
      return;
    }

    this.accountId = Number(cachedId);
    this.loadCoreArrangementDataPipeline();
  }

  // 📡 CONCURRENT METRICS AGGREGATION MOTOR
  private loadCoreArrangementDataPipeline(): void {
    this.uiState.loading$.next(true);
    this.uiState.error$.next('');
    this.uiState.success$.next('');

    forkJoin({
      account: this.api.getAccount(this.accountId),
      plans: this.api.getPaymentPlans(this.accountId).pipe(catchError(() => of([] as any[])))
    }).pipe(
      take(1),
      finalize(() => {
        this.uiState.loading$.next(false);
        this.cdr.markForCheck(); // repaints async updates frame layout safely
      })
    ).subscribe({
      next: (res: any) => {
        this.account = res.account;
        
        // Isolate dynamic status flags across registered agreements arrays
        if (res.plans && Array.isArray(res.plans)) {
          this.activePlan = res.plans.find((p: any) => p.status === 'Active') || null;
        }

        this.calculatePreview();
      },
      error: (err) => {
        console.error('Upstream system breakdown fetching utility records:', err);
        this.uiState.error$.next('Could not download active debt account matrix portfolios.');
      }
    });
  }

  loadActivePlan(): void {
    this.api.getPaymentPlans(this.accountId).pipe(
      take(1),
      catchError(() => of([]))
    ).subscribe((plans: any[]) => {
      this.activePlan = plans.find(p => p.status === 'Active') || null;
      this.cdr.markForCheck();
    });
  }

  // 📊 REACTIVE CALCULATION CORE DRIVERS
  calculatePreview(): void {
    if (!this.account?.arrearsBalance || this.account.arrearsBalance <= 0) {
      this.preview = null;
      return;
    }

    this.api.calculatePlan({
      accountId: this.accountId,
      totalArrears: this.account.arrearsBalance,
      termMonths: this.termMonths
    }).pipe(
      take(1),
      catchError((err) => {
        console.warn('Asynchronous breakdown resolving plan estimation calculations. Running fallback calculator matrix.', err);
        return of(this.executeLocalCalculationFallback());
      })
    ).subscribe((res: DebtPlanPreview) => {
      this.preview = res;
      this.cdr.markForCheck();
    });
  }

  private executeLocalCalculationFallback(): DebtPlanPreview {
    const balance = this.account?.arrearsBalance || 0;
    const rateFactor = this.termMonths === 3 ? 0 : this.termMonths === 6 ? 0.05 : 0.10;
    const interest = balance * rateFactor;
    const aggregate = balance + interest;
    
    return {
      monthlyInstalment: aggregate / this.termMonths,
      totalWithInterest: aggregate,
      interestCharged: interest
    };
  }

  // 🎚️ GAMIFIED INTERACTION INPUT HANDLERS
  onSliderChange(event: any): void {
    const value = Number(event.target.value);
    
    // Snaps the continuous slider inputs directly onto your 3, 6, or 12 municipal intervals 
    if (value <= 4) {
      this.termMonths = 3;
    } else if (value > 4 && value <= 8) {
      this.termMonths = 6;
    } else {
      this.termMonths = 12;
    }

    this.calculatePreview();
  }

  getActiveInterestLabel(): string {
    const matchingTerm = this.terms.find(t => t.months === this.termMonths);
    return matchingTerm ? matchingTerm.rate : '0% interest';
  }

  getInterestClass(): string {
    if (this.termMonths === 3) return 'tier-favourable';
    if (this.termMonths === 6) return 'tier-moderate';
    return 'tier-extended';
  }

  // 🚀 ACTION DISPATCH TRANSACTION CONTROLLERS
  applyPlan(): void {
    this.uiState.error$.next('');
    this.uiState.success$.next('');

    if (!this.account?.isBlocked) {
      this.uiState.error$.next('Account is currently Active. Arrears payment arrangements are reserved for restricted profiles.');
      return;
    }

    this.uiState.submitting$.next(true);
    this.cdr.markForCheck();

    this.api.applyPlan({
      accountId: this.accountId,
      totalArrears: this.account.arrearsBalance,
      termMonths: this.termMonths
    }).pipe(
      take(1),
      catchError((err) => {
        console.error('Payment arrangement pipeline submission delivery error:', err);
        const serverErrorMessage = err?.error || 'Unable to deploy payment terms contract framework.';
        this.uiState.error$.next(serverErrorMessage);
        return of(null);
      }),
      finalize(() => {
        this.uiState.submitting$.next(false);
        this.cdr.markForCheck();
      })
    ).subscribe(res => {
      if (!res) return;

      this.uiState.success$.next(`Payment plan terms approved! Monthly instalment: ${this.formatCurrency(res.monthlyInstalment)}`);
      this.loadActivePlan();
    });
  }

  // 🛠️ SHARED VIEW TEMPLATE OPTIMIZATIONS TRACKERS HELPERS
  get progress(): number {
    if (!this.activePlan || this.activePlan.totalArrears <= 0) return 0;
    return Math.min((this.activePlan.paidToDate / this.activePlan.totalArrears) * 100, 100);
  }

  formatCurrency(v: number): string {
    if (v === undefined || v === null || isNaN(v)) return 'R 0.00';
    return `R ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  formatDate(d: string): string {
    if (!d) return 'Recent';
    return new Intl.DateTimeFormat('en-ZA', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).format(new Date(d));
  }

  trackByTermMonths(index: number, item: DebtPlanTerm): number {
    return item.months;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
