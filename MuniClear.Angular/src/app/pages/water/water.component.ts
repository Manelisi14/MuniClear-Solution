import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

// uMhlathuze Rising Block Tariff for water 2025/2026 (incl. 15% VAT)
const WATER_BLOCKS = [
  { label: 'Free basic', range: '0–6 kL',   rateIncl: 0,      maxKl: 6   },
  { label: 'Block 1',    range: '7–15 kL',   rateIncl: 12.65,  maxKl: 15  },
  { label: 'Block 2',    range: '16–30 kL',  rateIncl: 18.97,  maxKl: 30  },
  { label: 'Block 3',    range: '31–60 kL',  rateIncl: 28.46,  maxKl: 60  },
  { label: 'Block 4',    range: '60+ kL',    rateIncl: 42.69,  maxKl: Infinity },
];

@Component({
  selector: 'app-water',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './water.component.html',
  styleUrls: ['./water.component.scss']
})
export class WaterComponent implements OnInit {
  accountId = 1;
  loading = false;
  error = '';
  success = '';

  // Meter reading submission
  currentReading = '';
  previousReading = 150; // from last month's record
  submitting = false;

  // Usage history (mock — replace with real API when water endpoint exists)
  usageHistory = [
    { month: 'March 2026',    kl: 22, amount: 285.34, date: new Date('2026-03-01') },
    { month: 'February 2026', kl: 19, amount: 241.22, date: new Date('2026-02-01') },
    { month: 'January 2026',  kl: 31, amount: 421.80, date: new Date('2026-01-01') },
  ];

  waterBlocks = WATER_BLOCKS;
  monthlyKl = 22;
  currentBlockIndex = 2;
  progressPct = 0;

  // Leak detection
  leakAlert = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = localStorage.getItem('accountId');
    if (!id) { this.router.navigate(['/login']); return; }
    this.accountId = Number(id);
    this.computeBlock();
  }

  computeBlock(): void {
    for (let i = 0; i < WATER_BLOCKS.length; i++) {
      if (this.monthlyKl <= WATER_BLOCKS[i].maxKl) { this.currentBlockIndex = i; break; }
    }
    const totalRange = 60;
    this.progressPct = Math.min((this.monthlyKl / totalRange) * 100, 100);
    // Simple leak detection: flag if reading jump > 50% above average
    const avg = this.usageHistory.reduce((s, h) => s + h.kl, 0) / this.usageHistory.length;
    const newUsage = Number(this.currentReading) - this.previousReading;
    this.leakAlert = newUsage > 0 && newUsage > avg * 1.5;
  }

  submitReading(): void {
    if (!this.currentReading) { this.error = 'Please enter your current meter reading.'; return; }
    const reading = Number(this.currentReading);
    if (reading <= this.previousReading) { this.error = 'Reading must be greater than previous reading.'; return; }
    this.submitting = true;
    this.error = '';
    // Simulate API call — wire to real endpoint when available
    setTimeout(() => {
      const usage = reading - this.previousReading;
      this.success = `Meter reading of ${reading} kL submitted. Usage: ${usage} kL this period.`;
      this.monthlyKl = usage;
      this.computeBlock();
      this.submitting = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  formatCurrency(v: number): string {
    return `R ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  formatDate(d: Date): string {
    return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  goBack(): void { this.router.navigate(['/dashboard']); }
}