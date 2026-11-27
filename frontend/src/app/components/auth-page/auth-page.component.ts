import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';

type AuthMode = 'login' | 'register';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmation = control.get('confirmPassword')?.value;
  return password === confirmation ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.component.html',
  styleUrls: ['./auth-page.component.scss']
})
export class AuthPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly mode: AuthMode = this.route.snapshot.data['mode'] === 'register' ? 'register' : 'login';
  submitting = false;
  serverError = '';

  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  readonly registrationForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  }, { validators: passwordsMatch });

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.serverError = '';
    this.submitting = true;
    const { email, password } = this.loginForm.getRawValue();
    this.authService.login(email.trim(), password).pipe(
      finalize(() => this.submitting = false)
    ).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: response => {
        this.serverError = response.error?.message ?? 'Unable to sign in. Please try again.';
      }
    });
  }

  register(): void {
    if (this.registrationForm.invalid) {
      this.registrationForm.markAllAsTouched();
      return;
    }

    this.serverError = '';
    this.submitting = true;
    const { name, email, password } = this.registrationForm.getRawValue();
    this.authService.register(name.trim(), email.trim(), password).pipe(
      finalize(() => this.submitting = false)
    ).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: response => {
        this.serverError = response.error?.message ?? 'Unable to create your account. Please try again.';
      }
    });
  }
}
