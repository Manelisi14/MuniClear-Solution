import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { BehaviorSubject, of } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';

export interface RefuseSchedule {
  zone: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
}

@Component({
  selector: 'app-refuse',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './refuse.component.html',
  styleUrls: ['./refuse.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RefuseComponent implements OnInit {
  accountId = 0;
  
  // uMhlathuze Municipal Refuse Rate Metrics DTO Defaults
  refuseLevy = 238.40; // Fixed tariff charge per 240L domestic bin bin incl. VAT
  registeredBinsCount = 1;
  isCollectionDayToday = false;
  nextCollectionText = 'Next collection: Tuesday morning';

  // Zone map defaults centered on regional grids
  schedule: RefuseSchedule = {
    zone: 'Richards Bay Area / Zone 4',
    day: 'Tuesday'
  };

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
    this.evaluateCurrentScheduleDay();
    this.fetchLiveAccountWasteTelemetry();
  }

  private evaluateCurrentScheduleDay(): void {
    const todayName = new Intl.DateTimeFormat('en-ZA', { weekday: 'long' }).format(new Date());
    
    if (todayName === this.schedule.day) {
      this.isCollectionDayToday = true;
      this.nextCollectionText = 'Collection Active Today';
    } else {
      this.isCollectionDayToday = false;
      this.nextCollectionText = `Next Collection: ${this.schedule.day} morning`;
    }
  }

  private fetchLiveAccountWasteTelemetry(): void {
    this.uiState.loading$.next(true);

    this.api.getAccount(this.accountId).pipe(
      take(1),
      catchError((err) => {
        console.warn('Waste parameters unreachable upstream. Rendering static infrastructure defaults.', err);
        return of(null);
      }),
      finalize(() => {
        this.uiState.loading$.next(false);
        this.cdr.markForCheck();
      })
    ).subscribe((accountDetails: any) => {
      if (!accountDetails) return;
      
      // Pull variables if exposed dynamically within DTO properties
      this.registeredBinsCount = accountDetails.refuseBinsCount ?? 1;
    });
  }

  // 🚨 ROUTING HOT-LINKED INTEGRATIONS BINDINGS
  reportSkippedBin(): void {
    // Navigate straight to your visual fault reporter, locking category configuration states
    this.router.navigate(['/faults'], { queryParams: { preselect: 'Refuse', autoTag: 'Missed Wheelie Bin' } });
  }

  reportIllegalDumping(): void {
    this.router.navigate(['/faults'], { queryParams: { preselect: 'Other', autoTag: 'Illegal Dumping Site' } });
  }

  formatCurrency(v: number): string {
    return `R ${v.toFixed(2)}`;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}

