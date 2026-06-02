import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import * as signalR from '@microsoft/signalr';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.scss']
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  accountId    = 1;
  unreadCount  = 0;
  notifications: any[] = [];
  open         = false;
  private hub: signalR.HubConnection | null = null;

  readonly TYPE_STYLES: Record<string, { bg: string; color: string }> = {
    Success: { bg: '#f0fdf4', color: '#166534' },
    Warning: { bg: '#fffbeb', color: '#92400e' },
    Danger:  { bg: '#fef2f2', color: '#991b1b' },
    Info:    { bg: '#eff6ff', color: '#1e40af' }
  };

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const id = localStorage.getItem('accountId');
    if (!id) return;
    this.accountId = Number(id);
    this.loadNotifications();
    this.connectSignalR();
  }

  ngOnDestroy(): void { this.hub?.stop(); }

  loadNotifications(): void {
    this.api.getNotifications(this.accountId).subscribe({
      next: (n) => {
        this.notifications = n;
        this.unreadCount   = n.filter(x => !x.isRead).length;
        this.cdr.detectChanges();
      }
    });
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open && this.unreadCount > 0) {
      this.api.markAllRead(this.accountId).subscribe(() => {
        this.unreadCount = 0;
        this.notifications.forEach(n => n.isRead = true);
        this.cdr.detectChanges();
      });
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(e: Event): void {
    const el = (e.target as HTMLElement).closest('.bell-wrap');
    if (!el) this.open = false;
  }

  connectSignalR(): void {
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5026/paymentHub')
      .withAutomaticReconnect()
      .build();
    this.hub.on('ReceiveNotification', () => this.loadNotifications());
    this.hub.on('ReceivePaymentUpdate', () => this.loadNotifications());
    this.hub.on('ReceiveFaultUpdate',   () => this.loadNotifications());
    this.hub.start().catch(e => console.warn('SignalR bell:', e));
  }

  typeStyle(type: string) { return this.TYPE_STYLES[type] || this.TYPE_STYLES['Info']; }

  formatDate(d: string): string {
    return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  }
}