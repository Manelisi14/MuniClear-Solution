import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { NotificationBellComponent } from '../../shared/notification-bell/notification-bell.component';
import { take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import Chart from 'chart.js/auto';

declare const L: any;

// ── Breadcrumb pipe ───────────────────────────────────────────
@Pipe({ name: 'activeLabel', standalone: true })
export class ActiveLabelPipe implements PipeTransform {
  transform(nav: any[], activeId: string): string {
    return nav.find(n => n.id === activeId)?.label ?? activeId;
  }
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ActiveLabelPipe, NotificationBellComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, AfterViewInit {

  // ── CORE STATE ───────────────────────────────────
  activeModule = 'dashboard';
  sidebarCollapsed = false;
  loading = false;
  error = '';
  success = '';

  // ── NAV ──────────────────────────────────────────
  readonly NAV = [
    { id: 'dashboard',  label: 'Dashboard',      icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    { id: 'residents',  label: 'Residents',       icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
    { id: 'billing',    label: 'Billing',         icon: 'M14 2H6a2 2 0 0 0-2 2v16h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
    { id: 'payments',   label: 'Payments',        icon: 'M1 4h22v16H1z M1 10h22' },
    { id: 'faults',     label: 'Fault map',       icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0' },
    { id: 'analytics',  label: 'Analytics',       icon: 'M18 20V10 M12 20V4 M6 20v-6' },
    { id: 'notify',     label: 'Notifications',   icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0' },
    { id: 'plans',      label: 'Pay plans',       icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    { id: 'properties', label: 'Properties',      icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
  ];

  // ── DATA STATE ───────────────────────────────────
  stats: any = null;
  private revenueChart: any;
  private faultChart: any;
  residents: any[]     = [];
  allBills: any[]      = [];
  payments: any[]      = [];
  allFaults: any[]     = [];
  paymentPlans: any[]  = [];
  properties: any[]    = [];

  // ── FORMS & FILTERS ──────────────────────────────
  residentSearch    = '';
  blockReason       = '';
  paymentsFrom      = '';
  paymentsTo        = '';
  faultStatusFilter   = '';
  faultCategoryFilter = '';
  newBill = { accountId: 1, waterCharge: 0, electricityCharge: 0, refuseCharge: 185.50, sewerCharge: 0 };
  bulkTitle   = '';
  bulkMessage = '';
  bulkType    = 'Info';
  bulkSms     = false;

  // ── MAP ──────────────────────────────────────────
  private faultMap: any;
  private markerLayer: any;
  readonly STATUS_COLOR: Record<string, string> = {
    Pending:    '#ef4444',
    InProgress: '#f59e0b',
    Resolved:   '#22c55e'
  };

  // ── INIT ─────────────────────────────────────────
  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  ngAfterViewInit(): void {}

  // ── MODULE SWITCHING ─────────────────────────────
  setModule(id: string): void {
    this.activeModule = id;
    this.error   = '';
    this.success = '';

    setTimeout(() => {
      if (id === 'faults')    this.initFaultMap();
      if (id === 'analytics') this.drawRevenueChart();
      if (id === 'dashboard') this.drawDashboardCharts();
    }, 150);

    if (id === 'residents')  this.loadResidents();
    if (id === 'billing')    this.loadBills();
    if (id === 'payments')   this.loadPayments();
    if (id === 'faults')     this.loadFaults();
    if (id === 'plans')      this.loadPlans();
    if (id === 'properties') this.loadProperties();
  }

  // ── STATS ────────────────────────────────────────
  loadStats(): void {
    this.loading = true;
    this.api.get<any>('Admin/stats').pipe(take(1)).subscribe({
      next: (s) => {
        this.stats   = s;
        this.loading = false;
        setTimeout(() => this.drawDashboardCharts(), 200);
      },
      error: () => { this.error = 'Failed to load stats.'; this.loading = false; }
    });
  }

  private drawDashboardCharts(): void {
    this.drawRevenueChart();
    this.drawFaultChart();
  }

  // ── RESIDENTS ────────────────────────────────────
  loadResidents(): void {
    const url = `Admin/residents${this.residentSearch ? '?search=' + this.residentSearch : ''}`;
    this.api.get<any[]>(url).pipe(take(1)).subscribe({
      next:  r => this.residents = r,
      error: () => this.error = 'Failed to load residents.'
    });
  }

  toggleBlock(r: any): void {
    this.api.put(`Admin/residents/${r.residentID}/block`, {
      block: !r.account?.isBlocked,
      reason: this.blockReason || 'Admin action'
    }).pipe(take(1)).subscribe({
      next:  () => { this.success = 'Account status updated.'; this.loadResidents(); },
      error: () => this.error = 'Failed to update status.'
    });
  }

  // ── BILLING ──────────────────────────────────────
  loadBills(): void {
    this.api.get<any[]>('Admin/bills').pipe(take(1)).subscribe({
      next:  b => this.allBills = b,
      error: () => this.error = 'Failed to load bills.'
    });
  }

  generateBill(): void {
    this.api.post<any>('Admin/bills/generate', this.newBill).pipe(take(1)).subscribe({
      next:  res => { this.success = `Bill generated: R${res.totalAmount?.toFixed(2)}`; this.loadBills(); },
      error: ()  => this.error = 'Failed to generate bill.'
    });
  }

  get newBillTotal(): number {
    return (this.newBill.waterCharge + this.newBill.electricityCharge +
            this.newBill.refuseCharge + this.newBill.sewerCharge) * 1.15;
  }

  // ── PAYMENTS ─────────────────────────────────────
  loadPayments(): void {
    const url = `Admin/payments?from=${this.paymentsFrom}&to=${this.paymentsTo}`;
    this.api.get<any>(url).pipe(take(1)).subscribe({
      next:  res => this.payments = res.payments ?? [],
      error: ()  => this.error = 'Failed to load payments.'
    });
  }

  verifyPayment(id: number): void {
    this.api.put(`Admin/payments/${id}/verify`, {}).pipe(take(1)).subscribe({
      next:  () => { this.success = 'Payment verified.'; this.loadPayments(); },
      error: () => this.error = 'Failed to verify payment.'
    });
  }

  exportCsv(): void {
    window.open(`${environment.apiUrl}/Admin/payments/export`, '_blank');
  }

  // ── FAULTS ───────────────────────────────────────
  loadFaults(): void {
    let url = 'Admin/faults';
    const params = [];
    if (this.faultStatusFilter)   params.push(`status=${this.faultStatusFilter}`);
    if (this.faultCategoryFilter) params.push(`category=${this.faultCategoryFilter}`);
    if (params.length) url += '?' + params.join('&');

    this.api.get<any[]>(url).pipe(take(1)).subscribe({
      next: f => {
        this.allFaults = f;
        if (this.faultMap) this.renderFaultMarkers();
      },
      error: () => this.error = 'Failed to load faults.'
    });
  }

  initFaultMap(): void {
    if (this.faultMap) { this.faultMap.invalidateSize(); return; }
    this.faultMap   = L.map('admin-fault-map').setView([-28.7548, 32.0377], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.faultMap);
    this.markerLayer = L.layerGroup().addTo(this.faultMap);
    this.renderFaultMarkers();
  }

  renderFaultMarkers(): void {
    if (!this.markerLayer) return;
    this.markerLayer.clearLayers();
    this.allFaults.forEach(f => {
      if (!f.latitude || !f.longitude) return;
      L.marker([f.latitude, f.longitude], {
        icon: L.divIcon({
          html: `<div style="background:${this.STATUS_COLOR[f.status]};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
          className: ''
        })
      }).addTo(this.markerLayer)
        .bindPopup(`<b>${f.category}</b><br>${f.description ?? ''}<br><small>${f.status}</small>`);
    });
  }

  // ── NOTIFICATIONS ────────────────────────────────
  sendBulkNotify(): void {
    if (!this.bulkTitle || !this.bulkMessage) return;
    this.api.post<any>('Admin/notify/bulk', {
      title: this.bulkTitle, message: this.bulkMessage, sendSms: this.bulkSms
    }).pipe(take(1)).subscribe({
      next:  res => { this.success = `Sent to ${res.sent} residents.`; this.bulkTitle = ''; this.bulkMessage = ''; },
      error: ()  => this.error = 'Broadcast failed.'
    });
  }

  // ── PAYMENT PLANS ────────────────────────────────
  loadPlans(): void {
    this.api.get<any[]>('Admin/payment-plans').pipe(take(1)).subscribe({
      next:  p => this.paymentPlans = p,
      error: () => this.error = 'Failed to load payment plans.'
    });
  }

  markDefault(id: number): void {
    if (!confirm('Mark this plan as defaulted and block the account?')) return;
    this.api.put(`Admin/payment-plans/${id}/default`, {}).pipe(take(1)).subscribe({
      next:  () => { this.success = 'Plan defaulted. Account blocked.'; this.loadPlans(); },
      error: () => this.error = 'Failed to mark default.'
    });
  }

  // ── PROPERTIES ───────────────────────────────────
  loadProperties(): void {
    this.api.get<any[]>('Admin/properties').pipe(take(1)).subscribe({
      next:  p => this.properties = p,
      error: () => this.error = 'Failed to load properties.'
    });
  }

  // ── CHARTS ───────────────────────────────────────
  drawRevenueChart(): void {
    const ctx = document.getElementById('revenueChart') as HTMLCanvasElement;
    if (!ctx || !this.stats?.revenueByMonth?.length) return;
    if (this.revenueChart) this.revenueChart.destroy();

    this.revenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.stats.revenueByMonth.map((x: any) => x.label),
        datasets: [{
          label: 'Revenue (R)',
          data: this.stats.revenueByMonth.map((x: any) => x.revenue),
          borderColor: '#0e7ab5',
          backgroundColor: 'rgba(14,122,181,0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#0e7ab5',
          pointRadius: 4,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              callback: (v: any) => `R${Number(v).toLocaleString('en-ZA')}`,
              font: { family: 'DM Sans', size: 11 }
            }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'DM Sans', size: 11 } }
          }
        }
      }
    });
  }

  drawFaultChart(): void {
    const ctx = document.getElementById('faultChart') as HTMLCanvasElement;
    if (!ctx || !this.stats?.faultsByCategory?.length) return;
    if (this.faultChart) this.faultChart.destroy();

    const data = this.stats.faultsByCategory as { category: string; count: number }[];
    this.faultChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.category),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: ['#ef4444','#f59e0b','#3b82f6','#10b981','#8b5cf6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'DM Sans', size: 11 }, padding: 12 }
          }
        }
      }
    });
  }

  // ── UTILITIES ────────────────────────────────────
  formatCurrency(v: number): string {
    return `R ${Math.abs(v ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  get userName(): string {
    return localStorage.getItem('userName') ?? 'Admin';
  }
}