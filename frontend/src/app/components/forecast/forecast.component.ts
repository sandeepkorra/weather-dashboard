import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, inject } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ForecastItem } from '../../models/weather.model';
import { WeatherLocation, WeatherService } from '../../services/weather.service';

@Component({
  selector: 'app-forecast',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './forecast.component.html',
  styleUrls: ['./forecast.component.scss']
})
export class ForecastComponent implements OnChanges {
  @Input() location: WeatherLocation | null = null;

  days: ForecastItem[] = [];
  hourly: ForecastItem[] = [];
  loading = false;
  error = '';
  private timezoneOffset = 0;
  chartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: '#91a8bf' },
        grid: { color: 'rgba(157, 190, 225, 0.08)' }
      },
      y: {
        beginAtZero: false,
        ticks: { color: '#91a8bf' },
        grid: { color: 'rgba(157, 190, 225, 0.08)' }
      }
    }
  };
  private readonly weatherService = inject(WeatherService);

  ngOnChanges(): void {
    if (!this.location) return;

    this.loading = true;
    this.error = '';
    this.weatherService.getForecast(this.location).subscribe({
      next: forecast => {
        this.timezoneOffset = forecast.timezoneOffset ?? 0;
        this.hourly = forecast.list.slice(0, 8);
        this.days = this.groupByDay(forecast.list, this.timezoneOffset).slice(0, 5);
        this.chartData = {
          labels: this.days.map(day => day.dt),
          datasets: [{
            data: this.days.map(day => day.temp),
            label: 'Temperature (°C)',
            borderColor: '#55e8f2',
            backgroundColor: 'rgba(85, 232, 242, 0.12)',
            fill: true,
            tension: 0.35
          }]
        };
        this.loading = false;
      },
      error: response => {
        this.days = [];
        this.hourly = [];
        this.chartData = { labels: [], datasets: [] };
        this.error = response.error?.message ?? 'Unable to load the forecast.';
        this.loading = false;
      }
    });
  }

  formatDayDate(date: string | undefined): string {
    if (!date) return '—';
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  }

  formatHour(item: ForecastItem): string {
    const timestamp = item.timestamp ?? Date.parse(`${item.dt} UTC`) / 1000;
    const localDate = new Date((timestamp + this.timezoneOffset) * 1000);
    if (Number.isNaN(localDate.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC'
    }).format(localDate);
  }

  private groupByDay(items: ForecastItem[], timezoneOffset: number): ForecastItem[] {
    const grouped = new Map<string, { items: ForecastItem[]; representative: ForecastItem }>();
    for (const item of items) {
      const timestamp = item.timestamp ?? Date.parse(`${item.dt} UTC`) / 1000;
      const localTime = new Date((timestamp + timezoneOffset) * 1000);
      const day = Number.isNaN(localTime.getTime()) ? item.dt.slice(0, 10) : localTime.toISOString().slice(0, 10);
      const group = grouped.get(day);
      if (group) {
        group.items.push(item);
        const currentHour = this.getLocalHour(group.representative, timezoneOffset);
        const candidateHour = this.getLocalHour(item, timezoneOffset);
        if (Math.abs(candidateHour - 12) < Math.abs(currentHour - 12)) group.representative = item;
      } else {
        grouped.set(day, { items: [item], representative: item });
      }
    }

    return [...grouped.entries()].map(([localDate, group]) => ({
      ...group.representative,
      localDate,
      tempMin: Math.min(...group.items.map(item => item.tempMin ?? item.temp)),
      tempMax: Math.max(...group.items.map(item => item.tempMax ?? item.temp))
    }));
  }

  private getLocalHour(item: ForecastItem, timezoneOffset: number): number {
    const timestamp = item.timestamp ?? Date.parse(`${item.dt} UTC`) / 1000;
    return new Date((timestamp + timezoneOffset) * 1000).getUTCHours();
  }
}
