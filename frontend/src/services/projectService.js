/**
 * Projects API client - same cookie-based pattern as authService.js.
 */

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

export class ApiError extends Error {
    constructor(message, status = 0) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

async function request(path, { method = "GET", body } = {}) {
    let response;

    try {
        response = await fetch(`${API_URL}${path}`, {
            method,
            credentials: "include",
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new ApiError("Unable to connect to the server. Please make sure the backend is running.", 0);
    }

    let data = {};
    try {
        data = await response.json();
    } catch {
        // non-JSON body - handled through response.ok below
    }

    if (!response.ok) {
        throw new ApiError(
            data?.message || data?.error || "Something went wrong. Please try again.",
            response.status
        );
    }

    return data;
}

export function getProjects() {
    return request("/projects");
}

export function createProject(details) {
    return request("/projects", { method: "POST", body: details });
}

export function deleteProject(id) {
    return request(`/projects/${id}`, { method: "DELETE" });
}
