import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BehaviorSubject, of } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';

// Enforce Type-Safety across billing histories
export interface SewerHistoryItem {
  month: string;
  waterCharge: number;
  sewerCharge: number;
}

@Component({
  selector: 'app-sewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sewer.component.html',
  styleUrls: ['./sewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush // Drastically cuts mobile CPU cycles
})
export class SewerComponent implements OnInit {
  accountId = 0;

  // 🏛️ Dynamic Sanitation Math Models (65% Effluent Formula Framework)
  monthlyWaterCharge = 285.34;
  readonly sewerRate = 0.65; 
  sewerCharge = 0.00;
  readonly fixedSewerLevy = 95.45; // Fixed sanitation levy incl. VAT
  totalSewer = 0.00;

  // Static Historical Data Fallback Map Array Registers
  history: SewerHistoryItem[] = [
    { month: 'March 2026', waterCharge: 285.34, sewerCharge: 280.77 },
    { month: 'February 2026', waterCharge: 241.22, sewerCharge: 252.18 },
    { month: 'January 2026', waterCharge: 421.80, sewerCharge: 369.62 }
  ];

  // Enterprise State Tracking Subjects Engines
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
    this.calculateSewerCharges();
    this.syncLiveSewerTelemetry();
  }

  // Calculate local runtime parameters safely
  private calculateSewerCharges(): void {
    this.sewerCharge = this.monthlyWaterCharge * this.sewerRate;
    this.totalSewer = this.sewerCharge + this.fixedSewerLevy;
  }

  // 📡 Async Backend API Telemetry Stream Integrations
  private syncLiveSewerTelemetry(): void {
    this.uiState.loading$.next(true);
    this.uiState.error$.next('');

    this.api.getUtilityUsage(this.accountId).pipe(
      take(1),
      catchError((err) => {
        console.warn('Wastewater billing connection error upstream. Using default local calculations schema.', err);
        // Clean production exception container fallback stream loops
        return of(null);
      }),
      finalize(() => {
        this.uiState.loading$.next(false);
        this.cdr.markForCheck(); // Forces screen repaint inside asynchronous operations threads
      })
    ).subscribe((liveData: any) => {
      if (!liveData) return;

      // Extract fresh values and dynamically recalculate math rows
      this.monthlyWaterCharge = liveData.totalSpentWater ?? 285.34;
      this.calculateSewerCharges();
    });
  }

  // 🛠️ Utility Helper View Formatters
  formatCurrency(v: number): string {
    if (v === undefined || v === null || isNaN(v)) return 'R 0.00';
    return `R ${v.toFixed(2)}`;
  }

    // 👇 ADD THIS METHOD TO FIX THE COMPILER ERROR
  trackByMonth(index: number, item: SewerHistoryItem): string {
    return item.month;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}

