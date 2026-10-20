/**
 * Centralized API client for projects and other SEO features.
 * Uses cookies for authentication, just like authService.js.
 */

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest(path, { method = "GET", body } = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Unable to connect to the server. Please make sure the backend is running.",
      0,
    );
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    // Handles empty or non-JSON responses.
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message || data?.error || "Something went wrong. Please try again.",
      response.status,
    );
  }

  return data;
}
