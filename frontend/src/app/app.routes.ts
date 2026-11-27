import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthPageComponent } from './components/auth-page/auth-page.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { HomePageComponent } from './components/home-page/home-page.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', component: HomePageComponent },
  { path: 'login', component: AuthPageComponent, canActivate: [guestGuard], data: { mode: 'login' } },
  { path: 'register', component: AuthPageComponent, canActivate: [guestGuard], data: { mode: 'register' } },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
