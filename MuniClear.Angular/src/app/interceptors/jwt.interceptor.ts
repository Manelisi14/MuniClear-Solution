import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const token  = auth.getToken();

  // Attach Bearer token to every outgoing request that goes to our API
  // Skip for login and demo endpoints (they don't need a token)
  const isAuthEndpoint = req.url.includes('/Auth/login') || req.url.includes('/Auth/demo');

  if (token && !isAuthEndpoint) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // If 401 — token expired or invalid — redirect to login
      if (err.status === 401) {
        auth.logout();
        router.navigate(['/login'], { queryParams: { expired: true } });
      }
      return throwError(() => err);
    })
  );
};