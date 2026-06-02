import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  email = '';
  idNumber = '';

  loading = false;
  demoLoading = false;
  error = '';
  expired = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    if (this.auth.isLoggedIn()) {
      const role = localStorage.getItem('role');

      if (role === 'Admin') {
        this.router.navigateByUrl('/admin');
      } else if (role === 'Resident') {
        this.router.navigateByUrl('/dashboard');
      }
    }

    this.route.queryParams.subscribe(p => {
      this.expired = p['expired'] === 'true';
    });
  }

  login(): void {

    if (!this.email || !this.idNumber) {
      this.error = 'Please enter your email and ID/Password.';
      return;
    }

    this.loading = true;
    this.error = '';

    this.auth.login(this.email, this.idNumber).subscribe({
      next: (res: any) => {
        this.loading = false;

        if (res.role === 'Admin' || res.isAdmin === true) {
          this.router.navigateByUrl('/admin');
        } else {
          this.router.navigateByUrl('/dashboard');
        }
      },
      error: (err) => {
        this.loading = false;

        this.error =
          typeof err.error === 'string'
            ? err.error
            : err.error?.message ?? 'Invalid credentials.';

        this.cdr.detectChanges();
      }
    });
  }

  demoLogin(): void {
    this.demoLoading = true;

    this.auth.demoLogin().subscribe({
      next: () => {
        this.demoLoading = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: () => {
        this.demoLoading = false;
        this.error = 'Demo login failed. Make sure the API is running.';
        this.cdr.detectChanges();
      }
    });
  }
}