import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherLocation } from '../../services/weather.service';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss']
})
export class SearchBarComponent {
  @Output() readonly citySearch = new EventEmitter<WeatherLocation>();
  city = '';
  locationError = '';
  locating = false;

  onSubmit(): void {
    const city = this.city.trim();
    if (city) {
      this.locationError = '';
      this.citySearch.emit({ city });
    }
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.locationError = 'Your browser does not support location access.';
      return;
    }

    this.locating = true;
    this.locationError = '';
    navigator.geolocation.getCurrentPosition(
      position => {
        this.locating = false;
        this.citySearch.emit({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      error => {
        this.locating = false;
        this.locationError = error.code === 1
          ? 'Location permission was denied. Allow access or search by city or PIN code.'
          : 'Unable to determine your location. Please try again or search by city or PIN code.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
}
