import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; 
import { CommonModule } from '@angular/common'; 
import { Router } from '@angular/router'; 
import { forkJoin, interval, Subscription, catchError, of } from 'rxjs'; 
import * as signalR from '@microsoft/signalr'; 
import { ApiService } from '../../services/api.service'; 
import { AuthService } from '../../services/auth.service'; 
import { NotificationBellComponent } from '../../shared/notification-bell/notification-bell.component'; 

// ═══════════════════════════════════════════════════════════════ 
// DATA MODEL INTERFACES 
// ═══════════════════════════════════════════════════════════════ 
export interface MunicipalAccount { 
  accountNumber: string; 
  amountOwing: number;     // FIXED: Tracks amount citizen owes to municipality
  overdueAmount: number;   // FIXED: Tracks urgent overdue arrears balances
  isBlocked: boolean; 
} 

export interface IbtBlock { 
  label: string; 
  rateIncl: number; 
} 

export interface ServiceTile { 
  id: string; 
  label: string; 
  bg: string; 
  stroke: string; 
  path?: string; 
  rect?: boolean; 
} 

export interface DashboardTransaction { 
  description: string; 
  date: string; 
  amount: number; 
  credit: boolean; 
} 

@Component({ 
  selector: 'app-dashboard', 
  standalone: true, 
  imports: [CommonModule, NotificationBellComponent], 
  templateUrl: './dashboard.component.html', 
  styleUrls: ['./dashboard.component.scss'] 
}) 
export class DashboardComponent implements OnInit, OnDestroy { 
  // ═══════════════════════════════════════════════════════════════ 
  // GLOBAL STATE 
  // ═══════════════════════════════════════════════════════════════ 
  loading = true; 
  error = ''; 

  // Resident Profile Metadata 
  userName = 'Resident'; 
  userInitials = 'MR'; 
  accountId = 1; 

  // SignalR & Polling Subscriptions
  private hub: signalR.HubConnection | null = null; 
  private refreshSub?: Subscription; 

  // Dashboard Data Models
  account!: MunicipalAccount; 
  transactions: DashboardTransaction[] = []; 
  
  // Interface Configuration Objects
  alerts: any[] = []; 
  outages: any = { ward: 'Ward 12', loadSheddingStage: 2, nextOutage: '18:00 - 20:30', waterMaintenance: 'Sunday 09:00' }; 
  profile: any = { linkedProperties: 2, residencyVerified: true }; 
  liveFaults: any[] = []; 

  quickActions = [ 
    { title: 'Pay Bills', subtitle: 'Secure payments', route: '/payment', accent: 'blue' }, 
    { title: 'Report Fault', subtitle: 'Water, roads, lights', route: '/faults', accent: 'red' }, 
    { title: 'Buy Tokens', subtitle: 'Electricity & water', route: '/electricity', accent: 'yellow' }, 
    { title: 'Statements', subtitle: 'View invoices', route: '/statement', accent: 'green' } 
  ]; 

  // Utility Usage Framework Values
  totalSpentElec = 1250.00; 
  totalWaterUsage = 14.2; 
  monthlyKwh = 342.8; 
  ibtProgressPct = 57.1; 
  currentBlockIndex = 0; 

  // Inclined Block Tariff Boundaries
  ibtBlocks: IbtBlock[] = [ 
    { label: 'Block 1', rateIncl: 1.84 }, 
    { label: 'Block 2', rateIncl: 2.15 }, 
    { label: 'Block 3', rateIncl: 2.68 } 
  ]; 

  // Municipal Infrastructure Management Grid 
  municipalServices: ServiceTile[] = [ 
    { id: 'electricity', label: 'Electricity', bg: '#fffbeb', stroke: '#f59e0b', path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' }, 
    { id: 'water', label: 'Water Services', bg: '#eff6ff', stroke: '#3b82f6', path: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z' }, 
    { id: 'rates', label: 'Property Rates', bg: '#f3e8ff', stroke: '#7c3aed', rect: true }, 
    { id: 'refuse', label: 'Refuse Removal', bg: '#dcfce7', stroke: '#16a34a', path: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' }, 
    { id: 'sewer', label: 'Sewer & Sanitation', bg: '#ffe4e6', stroke: '#e11d48', path: 'M12 14l9-5-9-5-9 5 9 5zm0 0l9-5-9-5-9 5 9 5zm0 0v6' }, 
    { id: 'faults', label: 'Report Faults', bg: '#fef2f2', stroke: '#ef4444', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' } 
  ]; 

  // Account Management & Convenience Portal (VAS) 
  convenienceServices: ServiceTile[] = [ 
    { id: 'payment', label: 'Make Payment', bg: '#e0f2fe', stroke: '#0284c7', path: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' }, 
    { id: 'payment-plan', label: 'Payment Plan', bg: '#ffedd5', stroke: '#ea580c', path: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' }, 
    { id: 'statement', label: 'Statements', bg: '#f1f5f9', stroke: '#475569', rect: true }, 
    { id: 'airtime', label: 'Buy Airtime', bg: '#fae8ff', stroke: '#c026d3', path: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' }, 
    { id: 'load-shedding', label: 'Load Shedding', bg: '#fffbeb', stroke: '#d97706', path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' } 
  ]; 

  constructor( 
    private api: ApiService, 
    private auth: AuthService, 
    private router: Router, 
    private cdr: ChangeDetectorRef 
  ) {} 

  // ═══════════════════════════════════════════════════════════════ 
  // LIFECYCLE 
  // ═══════════════════════════════════════════════════════════════ 
  ngOnInit(): void { 
    this.userName = localStorage.getItem('userName') || 'Resident'; 
    this.userInitials = this.getInitials(this.userName); 
    
    const storedAccountId = localStorage.getItem('accountId'); 
    if (storedAccountId) { 
      this.accountId = Number(storedAccountId); 
    } 

    this.connectSignalR(); 
    this.startRealtimeRefresh(); 
    this.loadDashboard(); 
  } 

  ngOnDestroy(): void { 
    this.hub?.stop(); 
    this.refreshSub?.unsubscribe(); 
  } 

  // ═══════════════════════════════════════════════════════════════ 
  // DASHBOARD DATA LOADING 
  // ═══════════════════════════════════════════════════════════════ 
  loadDashboard(): void { 
    this.loading = true; 
    this.error = ''; 

    forkJoin({ 
      account: this.api.getAccount(this.accountId), 
      payments: this.api.getPaymentHistory(this.accountId), 
      usage: this.api.getUtilityUsage(this.accountId).pipe( 
        catchError(() => { 
          return of({ monthlyKwh: 342.8, totalSpentElec: 1250.00, totalWaterUsage: 14.2 }); 
        }) 
      ) 
    }).subscribe({ 
      next: (res: any) => { 
        this.loading = false; 

        // Account Mapping (FIXED: Bound explicitly to amountOwing and overdueAmount)
        this.account = { 
          accountNumber: res.account?.accountNumber || 'UMH-4839201', 
          amountOwing: res.account?.amountOwing ?? 0, 
          overdueAmount: res.account?.overdueAmount ?? 0, 
          isBlocked: res.account?.isBlocked ?? false 
        }; 

        // Transactions History Data Parser
        if (res.payments && Array.isArray(res.payments)) { 
          this.transactions = res.payments.map((p: any) => ({ 
            description: p.title || p.description || 'Municipal Payment', 
            date: p.date || 'Today', 
            amount: typeof p.amount === 'string' ? parseFloat(p.amount.replace(/[^0-9.]/g, '')) : (p.amount || 0), 
            credit: p.credit ?? false 
          })); 
        } 

        // Usage Metrics 
        if (res.usage) { 
          this.monthlyKwh = res.usage.monthlyKwh || 342.8; 
          this.totalSpentElec = res.usage.totalSpentElec || 1250.00; 
          this.totalWaterUsage = res.usage.totalWaterUsage || 14.2; 
          this.ibtProgressPct = Math.min((this.monthlyKwh / 600) * 100, 100); 
          this.currentBlockIndex = this.monthlyKwh > 300 ? (this.monthlyKwh > 500 ? 2 : 1) : 0; 
        } 

        // Demo Data Injections
        this.alerts = [ 
          { type: 'warning', title: 'Water Maintenance', detail: 'Scheduled interruption tomorrow at 09:00.' } 
        ]; 

        this.liveFaults = [ 
          { title: 'Street Light Fault', location: 'Ngwelezane Section H', status: 'In Progress', severity: 'medium', progress: 65 } 
        ]; 

        this.cdr.detectChanges(); 
      }, 
      error: (err) => { 
        console.error('Dashboard pipeline failure:', err); 
        this.loading = false; 
        this.error = 'Unable to fetch real-time utility profiles.'; 
        this.cdr.detectChanges(); 
      } 
    }); 
  } 

  // ═══════════════════════════════════════════════════════════════ 
  // REALTIME BACKGROUND POLLING 
  // ═══════════════════════════════════════════════════════════════ 
  startRealtimeRefresh(): void { 
    this.refreshSub = interval(30000).subscribe(() => { 
      this.refreshAccount(); 
    }); 
  } 

  refreshAccount(): void { 
    this.api.getAccount(this.accountId).subscribe({ 
      next: (res: any) => { 
        if (this.account && res) { 
          // FIXED: Updates correct variables dynamically via background cycle
          this.account.amountOwing = res.amountOwing; 
          this.account.overdueAmount = res.overdueAmount; 
          this.account.isBlocked = res.isBlocked; 
          this.cdr.detectChanges(); 
        } 
      } 
    }); 
  } 

  // ═══════════════════════════════════════════════════════════════ 
  // WEB SOCKET HUB (SIGNALR) 
  // ═══════════════════════════════════════════════════════════════ 
  connectSignalR(): void { 
    if (this.hub && this.hub.state !== signalR.HubConnectionState.Disconnected) { 
      return; 
    } 

    this.hub = new signalR.HubConnectionBuilder() 
      .withUrl('http://localhost:5026/paymentHub') 
      .withAutomaticReconnect() 
      .build(); 

    this.hub.on('ReceiveNotification', () => { 
      this.loadDashboard(); 
    }); 

    this.hub.start().catch(err => { 
      console.warn('SignalR connection failed:', err); 
    }); 
  } 

  // ═══════════════════════════════════════════════════════════════ 
  // INTERACTIVE NAV ROUTING HELPERS 
  // ═══════════════════════════════════════════════════════════════ 
  navigate(routeId: string): void { 
    const cleanRoute = routeId.startsWith('/') ? routeId : `/${routeId}`; 
    this.router.navigate([cleanRoute]); 
  } 

  goToProfile(): void { 
    this.router.navigate(['/profile']); 
  } 

  logout(): void { 
    this.auth.logout(); 
    this.router.navigate(['/login']); 
  } 

  getInitials(name: string): string { 
    if (!name || !name.trim()) { 
      return 'RE'; 
    } 
    const parts = name.trim().split(/\s+/); 
    return parts 
      .map(x => x[0]) 
      .join('') 
      .toUpperCase() 
      .slice(0, 2); 
  } 

  formatCurrency(value: number): string { 
    return `R ${value.toFixed(2)}`; 
  } 

  formatDate(dateString: string): string { 
    if (!dateString) { 
      return ''; 
    } 
    return dateString; 
  } 
}
