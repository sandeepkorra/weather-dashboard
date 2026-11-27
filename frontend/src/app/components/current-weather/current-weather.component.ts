import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { WeatherData } from '../../models/weather.model';
import { WeatherLocation, WeatherService } from '../../services/weather.service';

@Component({
  selector: 'app-current-weather',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './current-weather.component.html',
  styleUrls: ['./current-weather.component.scss']
})
export class CurrentWeatherComponent implements OnChanges {
  @Input() location: WeatherLocation | null = null;
  @Output() readonly weatherLoaded = new EventEmitter<WeatherData>();

  weather: WeatherData | null = null;
  loading = false;
  error = '';
  private readonly weatherService = inject(WeatherService);

  ngOnChanges(): void {
    if (!this.location) return;

    this.loading = true;
    this.error = '';
    this.weatherService.getCurrent(this.location).subscribe({
      next: weather => {
        this.weather = weather;
        this.loading = false;
        this.weatherLoaded.emit(weather);
      },
      error: response => {
        this.weather = null;
        this.error = response.error?.message ?? 'Unable to load current weather.';
        this.loading = false;
      }
    });
  }

  formatWeatherTime(timestamp: number | undefined): string {
    const date = this.toWeatherLocalDate(timestamp);
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC'
    }).format(date);
  }

  formatWeatherDateTime(timestamp: number | undefined): string {
    const date = this.toWeatherLocalDate(timestamp);
    if (!date) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    }).format(date);
  }

  private toWeatherLocalDate(timestamp: number | undefined): Date | null {
    if (timestamp === undefined || !this.weather) return null;
    return new Date((timestamp + (this.weather.timezoneOffset ?? 0)) * 1000);
  }
}
