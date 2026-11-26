import { apiClient } from '@/services/apiClient';
import type { ConstraintConfiguration, ConstraintConfigurationPayload } from '@/types/constraints';

export async function fetchConstraints(): Promise<ConstraintConfiguration> {
  const { data } = await apiClient.get<ConstraintConfiguration>('/constraints');
  return data;
}

export async function saveConstraints(payload: ConstraintConfigurationPayload): Promise<ConstraintConfiguration> {
  const { data } = await apiClient.put<ConstraintConfiguration>('/constraints', payload);
  return data;
}
