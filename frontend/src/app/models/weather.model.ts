export interface WeatherData {
  city: string;
  district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countryName?: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  pressure?: number;
  visibility?: number;
  condition?: string;
  description: string;
  icon: string;
  sunrise?: number;
  sunset?: number;
  updatedAt?: number;
  timezoneOffset?: number;
  coord?: {
    lat: number;
    lon: number;
  };
}

export interface ForecastItem {
  dt: string;
  timestamp?: number;
  temp: number;
  tempMin?: number;
  tempMax?: number;
  feelsLike?: number;
  humidity?: number;
  rainProbability?: number;
  condition?: string;
  description: string;
  icon: string;
  localDate?: string;
}

export interface Forecast {
  city: string;
  district?: string;
  state?: string;
  country?: string;
  timezoneOffset?: number;
  list: ForecastItem[];
}

export interface Favorite {
  _id: string;
  user: string;
  city: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchHistoryEntry {
  _id: string;
  city: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}
