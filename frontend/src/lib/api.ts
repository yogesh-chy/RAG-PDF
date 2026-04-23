/**
 * Base URL for the backend API.
 * Uses the environment variable NEXT_PUBLIC_API_URL, or defaults to localhost.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Helper to construct API endpoints.
 * @param path The endpoint path (e.g., '/auth/login')
 */
export const getApiUrl = (path: string) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
};
