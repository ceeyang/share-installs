import axios from 'axios';

// In development, Vite proxies /dashboard → localhost:6066/dashboard (same-origin, no CORS).
// In production, VITE_API_BASE_URL must point to the deployed backend.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/dashboard`
    : '/dashboard',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Redirect to login if session expires, BUT only if we aren't already there
    // to avoid an infinite reload loop.
    if (error.response && error.response.status === 401) {
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
