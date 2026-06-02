import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { PasskeyService } from '../../services/passkey.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  accountId  = 1;
  residentId = 1;
  loading    = true;
  saving     = false;
  error      = '';
  success    = '';

  // Resident form
  fullName = '';
  email    = '';
  phone    = '';
  idMasked = '';

  // Account info (read-only)
  account: any = null;

  // Passkeys
  passkeys:           any[]   = [];
  biometricAvailable  = false;
  registeringPasskey  = false;
  deviceLabel         = '';

  constructor(
    private api:     ApiService,
    private auth:    AuthService,
    private passkey: PasskeyService,
    private router:  Router,
    private cdr:     ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    const id = localStorage.getItem('accountId');
    if (!id) { this.router.navigate(['/login']); return; }
    this.accountId  = Number(id);
    this.residentId = Number(id);

    this.biometricAvailable = await this.passkey.isPlatformAvailable();

    this.api.getAccount(this.accountId).subscribe({ next: (acc) => { this.account = acc; } });

    this.api.get<any>(`Accounts/resident/${this.residentId}`).subscribe({
      next: (r) => {
        this.fullName = r.fullName;
        this.email    = r.email;
        this.phone    = r.phone || '';
        // Mask SA ID — show only last 4 digits
        const id13 = r.sA_IDNumber || r.sa_IDNumber || '';
        this.idMasked = id13 ? '*'.repeat(9) + id13.slice(-4) : '•••••••••••••';
        this.loading  = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; }
    });

    this.loadPasskeys();
  }

  loadPasskeys(): void {
    this.passkey.getCredentials(this.residentId).subscribe({
      next: (p) => { this.passkeys = p; this.cdr.detectChanges(); }
    });
  }

  save(): void {
    if (!this.fullName || !this.email) { this.error = 'Name and email are required.'; return; }
    this.saving = true; this.error = ''; this.success = '';

    this.api.put<any>(`Accounts/resident/${this.residentId}`, {
      fullName: this.fullName,
      email:    this.email,
      phone:    this.phone
    }).subscribe({
      next: (res) => {
        this.saving  = false;
        this.success = 'Profile updated successfully.';
        // Update localStorage so header shows new name
        localStorage.setItem('userName', res.fullName);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.error  = err?.error?.message || 'Could not save. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  async registerPasskey(): Promise<void> {
    this.registeringPasskey = true; this.error = '';
    try {
      await this.passkey.register(this.residentId, this.deviceLabel || undefined);
      this.success = '✅ Biometric passkey registered! You can now log in with your fingerprint or Face ID.';
      this.loadPasskeys();
    } catch (err: any) {
      this.error = err?.message || 'Passkey registration failed.';
    } finally {
      this.registeringPasskey = false;
      this.cdr.detectChanges();
    }
  }

  deletePasskey(credentialId: number): void {
    this.passkey.deleteCredential(credentialId).subscribe({
      next: () => { this.loadPasskeys(); },
      error: () => { this.error = 'Could not remove passkey.'; this.cdr.detectChanges(); }
    });
  }

  formatDate(d: string): string {
    return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
  }

  logout(): void { this.auth.logout(); this.router.navigate(['/login']); }
  goBack(): void { this.router.navigate(['/dashboard']); }
}