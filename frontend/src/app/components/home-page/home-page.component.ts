import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WeatherData } from '../../models/weather.model';
import { WeatherService } from '../../services/weather.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent implements OnInit {
  weather: WeatherData | null = null;
  loading = true;
  weatherError = '';
  readonly signedIn: boolean;

  private readonly authService = inject(AuthService);
  private readonly weatherService = inject(WeatherService);
  private readonly router = inject(Router);

  constructor() {
    this.signedIn = this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    this.weatherService.getCurrent({ city: 'Visakhapatnam' }).subscribe({
      next: weather => {
        this.weather = weather;
        this.loading = false;
      },
      error: response => {
        this.weatherError = response.error?.message ?? 'Live weather is currently unavailable.';
        this.loading = false;
      }
    });
  }

  formatWeatherTime(timestamp: number | undefined): string {
    if (timestamp === undefined || !this.weather) return '—';
    const localDate = new Date((timestamp + (this.weather.timezoneOffset ?? 0)) * 1000);
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC'
    }).format(localDate);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
