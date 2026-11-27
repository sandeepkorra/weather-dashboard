import { CommonModule } from '@angular/common';
import { Component, HostBinding, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FavoriteService } from '../../services/favorite.service';
import { AuthService } from '../../services/auth.service';
import { WeatherData } from '../../models/weather.model';
import { WeatherLocation } from '../../services/weather.service';
import { CurrentWeatherComponent } from '../current-weather/current-weather.component';
import { ForecastComponent } from '../forecast/forecast.component';
import { FavoritesComponent } from '../favorites/favorites.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SearchBarComponent, CurrentWeatherComponent, ForecastComponent, FavoritesComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  @HostBinding('class') weatherSceneClass = 'weather-default';
  @ViewChild(FavoritesComponent) private favoritesComponent?: FavoritesComponent;
  selectedLocation: WeatherLocation | null = null;
  selectedCity = '';
  selectedWeather: WeatherData | null = null;
  savingFavorite = false;
  favoriteMessage = '';
  favoriteError = '';
  historyError = '';

  private readonly favoriteService = inject(FavoriteService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  onLocationSearch(location: WeatherLocation): void {
    this.selectedLocation = location;
    this.weatherSceneClass = 'weather-default';
    this.selectedCity = location.city ?? '';
    this.selectedWeather = null;
    this.favoriteMessage = '';
    this.favoriteError = '';
    this.historyError = '';
  }

  onWeatherLoaded(weather: WeatherData): void {
    this.selectedCity = weather.city;
    this.selectedWeather = weather;
    this.weatherSceneClass = this.getWeatherScene(weather.condition, weather.description);
    if (!this.authService.isLoggedIn()) return;

    this.favoriteService.addToHistory({
      city: weather.city,
      country: weather.country,
      latitude: weather.coord?.lat,
      longitude: weather.coord?.lon
    }).subscribe({
      next: () => this.favoritesComponent?.refreshHistory(),
      error: response => {
        this.historyError = response.error?.message ?? 'Unable to save this search.';
      }
    });
  }

  saveFavorite(): void {
    if (!this.selectedCity || this.savingFavorite) return;

    this.savingFavorite = true;
    this.favoriteMessage = '';
    this.favoriteError = '';
    this.favoriteService.add(
      this.selectedCity,
      this.selectedWeather?.country,
      this.selectedWeather?.coord?.lat,
      this.selectedWeather?.coord?.lon
    ).subscribe({
      next: () => {
        this.favoriteMessage = `${this.selectedCity} was added to favorites.`;
        this.favoritesComponent?.refresh();
        this.savingFavorite = false;
      },
      error: response => {
        this.favoriteError = response.error?.message ?? 'Unable to save favorite. Please log in.';
        this.savingFavorite = false;
      }
    });
  }

  private getWeatherScene(condition?: string, description?: string): string {
    const mainCondition = condition?.toLowerCase() ?? '';
    const details = description?.toLowerCase() ?? '';
    const text = `${mainCondition} ${details}`;

    if (text.includes('thunder')) return 'weather-storm';
    if (mainCondition.includes('snow') || /\b(snow|sleet|blizzard)\b/.test(details)) return 'weather-snow';
    if (mainCondition.includes('rain') || mainCondition.includes('drizzle') || /\b(rain|drizzle|shower)\b/.test(details)) return 'weather-rain';
    if (/\b(fog|mist|haze|smoke|dust|sand|ash)\b/.test(text)) return 'weather-fog';
    if (mainCondition.includes('cloud') || /\b(cloud|overcast)\b/.test(details)) return 'weather-cloudy';
    if (mainCondition.includes('clear') || /\b(clear|sunny)\b/.test(details)) return 'weather-sunny';
    return 'weather-default';
  }
}
