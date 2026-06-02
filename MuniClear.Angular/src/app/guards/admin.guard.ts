import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Change 'userRole' to 'role' to match your AuthService.storeSession logic
  const role = localStorage.getItem('role'); 

  if (role === 'Admin') {
    return true;
  }

  console.warn('AdminGuard: Access denied. Role found:', role);
  router.navigate(['/login']);
  return false;
};


