import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard'; // Ensure this file exists at src/app/guards/admin.guard.ts

import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ElectricityComponent } from './pages/electricity/electricity.component';
import { AirtimeComponent } from './pages/airtime/airtime.component';
import { WaterComponent } from './pages/water/water.component';
import { RefuseComponent } from './pages/refuse/refuse.component';
import { SewerComponent } from './pages/sewer/sewer.component';
import { RatesComponent } from './pages/rates/rates.component';
import { StatementComponent } from './pages/statement/statement.component';
import { PaymentComponent } from './pages/payment/payment.component';
import { FaultsComponent } from './pages/faults/faults.component';
import { AnalyticsComponent } from './pages/analytics/analytics.component';
import { PaymentPlanComponent } from './pages/payment-plan/payment-plan.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  
  // --- Resident Routes ---
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'electricity', component: ElectricityComponent, canActivate: [authGuard] },
  { path: 'airtime', component: AirtimeComponent, canActivate: [authGuard] },
  { path: 'water', component: WaterComponent, canActivate: [authGuard] },
  { path: 'refuse', component: RefuseComponent, canActivate: [authGuard] },
  { path: 'sewer', component: SewerComponent, canActivate: [authGuard] },
  { path: 'rates', component: RatesComponent, canActivate: [authGuard] },
  { path: 'statement', component: StatementComponent, canActivate: [authGuard] },
  { path: 'payment', component: PaymentComponent, canActivate: [authGuard] },
  { path: 'faults', component: FaultsComponent, canActivate: [authGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [authGuard] },
  { path: 'payment-plan', component: PaymentPlanComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },

  // --- Admin / Staff Portal Routes ---
  { 
    path: 'admin', 
    component: AdminComponent, 
    canActivate: [authGuard, adminGuard] 
  },

  { path: '**', redirectTo: 'login' }
];



