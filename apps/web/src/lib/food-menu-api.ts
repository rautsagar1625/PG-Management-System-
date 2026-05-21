import { apiClient } from './api';

export interface FoodMenuEntry {
  id: string;
  propertyId: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  mealType: 'BREAKFAST' | 'LUNCH' | 'EVENING_SNACK' | 'DINNER';
  items: string[];
  timing?: string;
  isActive: boolean;
}

export const getFoodMenu = (propertyId: string) =>
  apiClient
    .get('/food-menu', { params: { propertyId } })
    .then((r) => r.data.data as FoodMenuEntry[]);

export const upsertFoodMenu = (dto: Omit<FoodMenuEntry, 'id' | 'isActive'>) =>
  apiClient.post('/food-menu', dto).then((r) => r.data.data as FoodMenuEntry);

export const updateFoodMenu = (
  id: string,
  dto: Partial<Pick<FoodMenuEntry, 'items' | 'timing' | 'isActive'>>,
) => apiClient.put(`/food-menu/${id}`, dto).then((r) => r.data.data as FoodMenuEntry);

export const deleteFoodMenu = (id: string) =>
  apiClient.delete(`/food-menu/${id}`).then((r) => r.data.data);
