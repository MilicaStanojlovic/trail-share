import { RouteActivity, RouteDifficulty } from '../route.entity';

export interface RouteAuthorDto {
  id: string;
  displayName: string;
}

export interface RouteDto {
  id: string;
  name: string;
  description: string;
  difficulty: RouteDifficulty;
  activity: RouteActivity;
  author: RouteAuthorDto;
  waypoints: [number, number][];
  waypointCount: number;
  tourCount: number;
  distanceKm: number;
  distanceLabel: string;
  elevationM: number;
  elevationLabel: string;
  durationLabel: string;
  createdAt: string;
}
