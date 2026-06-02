import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { forkJoin } from 'rxjs';

// 1. Correct Chart.js imports for Angular
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit, AfterViewInit {
  accountId = 0;
  loading = true;
  error = '';

  elecData: { label: string; amount: number }[] = [];
  waterData: { label: string; usage: number }[] = [];
  
  private elecChart: any;
  private waterChart: any;

  // Summary stats
  totalSpentElec = 0;
  avgMonthlyElec = 0;
  totalWaterKl = 0;
  avgMonthlyWater = 0;

  constructor(
    private api: ApiService, 
    private router: Router, 
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const rawId = localStorage.getItem('accountId');
    if (!rawId) {
      this.router.navigate(['/login']);
      return;
    }

    // Parse as Base 10 integer to prevent string concatenation
    this.accountId = parseInt(rawId, 10);
    this.loadAnalyticsData();
  }

  ngAfterViewInit(): void {}

  loadAnalyticsData(): void {
    this.loading = true;
    
    forkJoin({
      elec: this.api.getElectricityTokens(this.accountId),
      water: this.api.getMonthlyWaterUsage(this.accountId)
    }).subscribe({
      next: ({ elec, water }) => {
        // 1. Process Electricity Data
        const elecMap: Record<string, number> = {};
        (elec || []).forEach((t: any) => {
          const key = new Date(t.createdAt).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
          elecMap[key] = (elecMap[key] || 0) + Number(t.amount);
        });
        
        this.elecData = Object.entries(elecMap)
          .map(([label, amount]) => ({ label, amount }))
          .slice(-6); 

        // 2. Process Water Data
        this.waterData = (water || []).map((w: any) => ({
          label: w.label,
          usage: Number(w.usage)
        }));

        // 3. Calculate Stats
        this.totalSpentElec = this.elecData.reduce((s, d) => s + d.amount, 0);
        this.avgMonthlyElec = this.elecData.length ? this.totalSpentElec / this.elecData.length : 0;
        
        this.totalWaterKl = this.waterData.reduce((s, d) => s + d.usage, 0);
        this.avgMonthlyWater = this.waterData.length ? this.totalWaterKl / this.waterData.length : 0;

        this.loading = false;
        this.cdr.detectChanges();

        // 4. Draw Charts after a small timeout
        setTimeout(() => {
          this.drawElecChart();
          this.drawWaterChart();
        }, 200);
      },
      error: (err) => {
        console.error('Analytics load error:', err);
        this.loading = false;
        this.error = 'Could not load usage data.';
        this.cdr.detectChanges();
      }
    });
  }

  drawElecChart(): void {
    const canvas = document.getElementById('elecChart') as HTMLCanvasElement;
    if (!canvas || !this.elecData.length) return;

    if (this.elecChart) this.elecChart.destroy();

    this.elecChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.elecData.map(d => d.label),
        datasets: [{
          label: 'Electricity spend (R)',
          data: this.elecData.map(d => d.amount),
          backgroundColor: 'rgba(251, 191, 36, 0.8)',
          borderColor: '#d97706',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: { callback: (v: any) => `R${v}` }
          }
        }
      }
    });
  }

  drawWaterChart(): void {
    const canvas = document.getElementById('waterChart') as HTMLCanvasElement;
    if (!canvas || !this.waterData.length) return;

    if (this.waterChart) this.waterChart.destroy();

    this.waterChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this.waterData.map(d => d.label),
        datasets: [{
          label: 'Water usage (kL)',
          data: this.waterData.map(d => d.usage),
          backgroundColor: 'rgba(14, 165, 233, 0.2)',
          borderColor: '#0ea5e9',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: { callback: (v: any) => `${v} kL` }
          }
        }
      }
    });
  }

  formatCurrency(v: number): string {
    return `R ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}

