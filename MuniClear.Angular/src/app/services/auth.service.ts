import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthResponse {
  token: string;
  expiresAt: string;
  userName: string;
  role: string;
  isAdmin?: boolean;
  accountId?: number;
  accountNumber?: string;
  isBlocked?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private base = environment.apiUrl;
  
  private currentUserSource = new BehaviorSubject<AuthResponse | null>(null);
  currentUser$ = this.currentUserSource.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, idNumber: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/Auth/login`, { email, idNumber })
      .pipe(
        tap(res => {
          this.storeSession(res);
          this.currentUserSource.next(res);
        })
      );
  }

  demoLogin(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/Auth/demo`, {})
      .pipe(
        tap(res => {
          this.storeSession(res);
          this.currentUserSource.next(res);
        })
      );
  }

  private storeSession(res: AuthResponse): void {
    try {
      // 1. Save core properties (Strings)
      localStorage.setItem('token', res.token || '');
      localStorage.setItem('tokenExpiry', res.expiresAt || '');
      localStorage.setItem('userName', res.userName || 'User');
      localStorage.setItem('role', res.role || 'Resident');

      // 2. Save optional Resident properties SAFELY
      // We check if they exist before calling .toString() to prevent the "stuck" crash
      if (res.accountId !== undefined && res.accountId !== null) {
        localStorage.setItem('accountId', res.accountId.toString());
      }

      if (res.accountNumber) {
        localStorage.setItem('accountNumber', res.accountNumber);
      }

      if (res.isBlocked !== undefined && res.isBlocked !== null) {
        localStorage.setItem('isBlocked', res.isBlocked.toString());
      }

      console.log('Session stored successfully for:', res.role);
    } catch (e) {
      console.error('Error saving session to localStorage', e);
    }
  }

  logout(): void {
    localStorage.clear();
    this.currentUserSource.next(null);
  }

  // ── HELPERS ────────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRole(): string | null {
    return localStorage.getItem('role');
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    const expiry = localStorage.getItem('tokenExpiry');
    if (!token || !expiry) return false;

    // Check if token is still valid
    return new Date(expiry) > new Date();
  }

  isAdmin(): boolean {
    return this.getRole() === 'Admin';
  }
}
