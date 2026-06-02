import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = localStorage.getItem('userRole');

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // STOP THE FLICKER: If user is Admin, only allow /admin paths
  if (role === 'Admin' && !state.url.startsWith('/admin')) {
    router.navigate(['/admin']);
    return false;
  }

  return true;
};





