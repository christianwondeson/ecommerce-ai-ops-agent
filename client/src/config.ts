// Centralized API configuration
// In production, connects directly to the live Render backend
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://ecommerce-ai-ops-server.onrender.com' : '');
