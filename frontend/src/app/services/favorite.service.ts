import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Favorite, SearchHistoryEntry } from '../models/weather.model';

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/favorites`;

  list(): Observable<Favorite[]> {
    return this.http.get<Favorite[]>(this.baseUrl);
  }

  add(city: string, country?: string, latitude?: number, longitude?: number): Observable<Favorite> {
    return this.http.post<Favorite>(this.baseUrl, { city, country, latitude, longitude });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  listHistory(): Observable<SearchHistoryEntry[]> {
    return this.http.get<SearchHistoryEntry[]>(`${this.baseUrl}/history`);
  }

  addToHistory(entry: Pick<SearchHistoryEntry, 'city' | 'country' | 'latitude' | 'longitude'>): Observable<SearchHistoryEntry> {
    return this.http.post<SearchHistoryEntry>(`${this.baseUrl}/history`, entry);
  }

  clearHistory(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/history`);
  }
}
