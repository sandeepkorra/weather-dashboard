import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Forecast, WeatherData } from '../models/weather.model';

export interface WeatherLocation {
  city?: string;
  lat?: number;
  lon?: number;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/weather`;

  getCurrent(location: WeatherLocation): Observable<WeatherData> {
    return this.http.get<WeatherData>(`${this.baseUrl}/current`, {
      params: this.toParams(location)
    });
  }

  getForecast(location: WeatherLocation): Observable<Forecast> {
    return this.http.get<Forecast>(`${this.baseUrl}/forecast`, {
      params: this.toParams(location)
    });
  }

  private toParams(location: WeatherLocation): HttpParams {
    let params = new HttpParams();
    if (location.city) params = params.set('city', location.city);
    if (location.lat !== undefined) params = params.set('lat', location.lat);
    if (location.lon !== undefined) params = params.set('lon', location.lon);
    return params;
  }
}
