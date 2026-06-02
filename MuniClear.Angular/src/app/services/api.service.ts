import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly base = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  // ── Generic HTTP Helpers ────────────────────────────────────
  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.base}/${endpoint}`);
  }

  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.base}/${endpoint}`, body);
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.base}/${endpoint}`, body);
  }

  // ── Admin & Staff Management ────────────────────────────────
  getAdminStats(): Observable<any> {
    // Matches: [HttpGet("dashboard-stats")] in AdminController
    return this.http.get<any>(`${this.base}/Admin/dashboard-stats`);
  }

  getAllGlobalFaults(): Observable<any[]> {
    // Alias to getAllFaults for consistent naming in Admin panel
    return this.getAllFaults();
  }

  assignFaultTeam(faultId: number, teamData: any): Observable<any> {
    // Matches: [HttpPatch("faults/{id}/assign")]
    return this.http.patch<any>(`${this.base}/Admin/faults/${faultId}/assign`, teamData);
  }

  // ── Authentication ──────────────────────────────────────────
  login(credentials: { email: string; idNumber: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/Payments/login`, credentials);
  }

  // ── Account & Property ──────────────────────────────────────
  getAccount(accountId: number): Observable<any> {
    return this.http.get<any>(`${this.base}/Accounts/${accountId}`);
  }

  getProperty(propertyId: number): Observable<any> {
    return this.http.get<any>(`${this.base}/Properties/${propertyId}`);
  }

  // ── Bills & Payments ────────────────────────────────────────
  getBills(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/Bills`);
  }

  getPaymentHistory(accountId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/Payments/history/${accountId}`);
  }

  createCheckout(accountId: number, payload: any): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.base}/Payments/create-checkout/${accountId}`, payload);
  }

  downloadInvoice(paymentId: number): Observable<Blob> {
    return this.http.get(`${this.base}/Payments/download-invoice/${paymentId}`, { responseType: 'blob' });
  }

  // ── Electricity ─────────────────────────────────────────────
  getElectricityTokens(accountId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/ElectricityPurchases/account/${accountId}`);
  }

  getMobilePurchases(accountId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/MobilePurchases`).pipe(
      map((p: any[]) => p.filter(x => x.accountID === accountId))
    );
  }

  getMonthlyElectricityUsage(accountId: number): Observable<any[]> {
    return this.getElectricityTokens(accountId);
  }

  // 👇 FIXED: This single block resolves your active TS2339 bundle compilation failure cleanly
  purchaseToken(payload: { accountId: number; amount: number }): Observable<any> {
    return this.http.post<any>(`${this.base}/ElectricityPurchases/purchase`, payload);
  }

  // ── Water Readings & Usage ──────────────────────────────────
  getWaterReadings(accountId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/WaterReadings/${accountId}`);
  }

  submitWaterReading(body: { accountId: number; reading: number; meterNumber: string; phone?: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/WaterReadings`, body);
  }

  getMonthlyWaterUsage(accountId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/WaterReadings/monthly-usage/${accountId}`);
  }

  // ── Aggregated Utility Engine ────────────────────────────────
  /**
   * Fetches unified consumption telemetry metrics for dashboard visualization cards.
   * Matches structural fields needed for live tariff blocks calculation.
   */
  getUtilityUsage(accountId: number): Observable<any> {
    return this.http.get<any>(`${this.base}/Accounts/${accountId}/utility-usage`);
  }

  // ── Faults ──────────────────────────────────────────────────
  getAllFaults(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/Faults`);
  }

  getFaultsByAccount(accountId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/Faults/account/${accountId}`);
  }

  // 👇 ADDED ALIAS FOR COMPATIBILITY WITH HISTORIC ROUTING LOOPS
  getReportedFaults(): Observable<any[]> {
    return this.getAllFaults();
  }

  logFault(body: any): Observable<any> {
    return this.http.post<any>(`${this.base}/Faults`, body);
  }

  // ── Notifications ───────────────────────────────────────────
  getNotifications(accountId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/Notifications/${accountId}`);
  }

  getUnreadCount(accountId: number): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/Notifications/${accountId}/unread-count`);
  }

  markAllRead(accountId: number): Observable<any> {
    return this.http.put<any>(`${this.base}/Notifications/${accountId}/mark-all-read`, {});
  }

  // ── Payment Plans ───────────────────────────────────────────
  getPaymentPlans(accountId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/PaymentPlans/${accountId}`);
  }

  calculatePlan(body: { accountId: number; totalArrears: number; termMonths: number }): Observable<any> {
    return this.http.post<any>(`${this.base}/PaymentPlans/calculate`, body);
  }

  applyPlan(body: { accountId: number; totalArrears: number; termMonths: number }): Observable<any> {
    return this.http.post<any>(`${this.base}/PaymentPlans/apply`, body);
  }

  // ── Statements ──────────────────────────────────────────────
  downloadMonthlyStatement(accountId: number): Observable<Blob> {
    return this.http.get(`${this.base}/Statements/monthly/${accountId}`, { responseType: 'blob' });
  }
}

