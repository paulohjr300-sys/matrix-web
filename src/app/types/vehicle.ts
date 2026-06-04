export interface Brand {
  id: number;
  name: string;
}

export interface VehicleModel {
  id: number;
  name: string;
  brandId: number;
}

export interface Engine {
  id: number;
  name: string;
}

export interface Fuel {
  id: number;
  name: string;
}

export interface Transmission {
  id: number;
  name: string;
}

export interface Color {
  id: number;
  name: string;
}
