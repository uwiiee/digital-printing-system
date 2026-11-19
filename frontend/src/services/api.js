const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const FILE_URL = API_URL.replace(/\/api\/?$/, ""); // where uploaded images are served

// If the server says our login is no longer valid (expired, or the password was changed on another
// device), tell the rest of the app so it can log out.
function handleRejected(res, token) {
  if (res.status === 401 && token) window.dispatchEvent(new Event("auth:expired"));
}

export async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    handleRejected(res, token);
    throw new Error(data.message || "Request failed");
  }
  return data;
}

// Sends an image file; returns the saved path, e.g. "/uploads/xxxx.png"
export async function uploadDesign(file, token) {
  const form = new FormData(); // the browser sets the multipart header itself
  form.append("design", file);

  const res = await fetch(`${API_URL}/uploads/design`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    handleRejected(res, token);
    throw new Error(data.message || "Upload failed");
  }
  return data.path;
}
