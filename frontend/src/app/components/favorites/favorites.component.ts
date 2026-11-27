import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { Favorite, SearchHistoryEntry } from '../../models/weather.model';
import { FavoriteService } from '../../services/favorite.service';
import { WeatherLocation } from '../../services/weather.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.scss']
})
export class FavoritesComponent implements OnInit {
  @Output() readonly citySelected = new EventEmitter<WeatherLocation>();
  favorites: Favorite[] = [];
  history: SearchHistoryEntry[] = [];
  loading = false;
  historyLoading = false;
  historyClearing = false;
  error = '';
  historyError = '';
  historyMessage = '';
  removingId = '';
  private readonly favoriteService = inject(FavoriteService);

  ngOnInit(): void {
    this.loadFavorites();
    this.loadHistory();
  }

  refresh(): void {
    this.loadFavorites();
  }

  refreshHistory(): void {
    this.loadHistory();
  }

  removeFavorite(favorite: Favorite): void {
    this.removingId = favorite._id;
    this.error = '';
    this.favoriteService.remove(favorite._id).subscribe({
      next: () => {
        this.favorites = this.favorites.filter(item => item._id !== favorite._id);
        this.removingId = '';
      },
      error: response => {
        this.error = response.error?.message ?? 'Unable to remove favorite.';
        this.removingId = '';
      }
    });
  }

  selectLocation(location: Favorite | SearchHistoryEntry): void {
    if (location.latitude !== undefined && location.longitude !== undefined) {
      this.citySelected.emit({ lat: location.latitude, lon: location.longitude });
      return;
    }
    this.citySelected.emit({ city: location.city });
  }

  clearHistory(): void {
    if (!this.history.length || this.historyClearing) return;

    this.historyClearing = true;
    this.historyError = '';
    this.historyMessage = '';
    this.favoriteService.clearHistory().subscribe({
      next: () => {
        this.history = [];
        this.historyClearing = false;
        this.historyMessage = 'Search history cleared.';
      },
      error: response => {
        this.historyError = response.error?.message ?? 'Unable to clear search history.';
        this.historyClearing = false;
      }
    });
  }

  private loadFavorites(): void {
    this.loading = true;
    this.favoriteService.list().subscribe({
      next: favorites => {
        this.favorites = favorites;
        this.loading = false;
      },
      error: response => {
        this.error = response.error?.message ?? 'Log in to view your favorite cities.';
        this.loading = false;
      }
    });
  }

  private loadHistory(): void {
    this.historyLoading = true;
    this.historyMessage = '';
    this.favoriteService.listHistory().subscribe({
      next: history => {
        this.history = history;
        this.historyLoading = false;
        this.historyError = '';
        this.historyMessage = '';
      },
      error: response => {
        this.history = [];
        this.historyError = response.error?.message ?? 'Unable to load recent searches.';
        this.historyLoading = false;
      }
    });
  }
}
