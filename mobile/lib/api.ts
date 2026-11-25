// Chức năng: Kết nối HTTP đến backend — địa chỉ API, đăng nhập, đăng ký và các yêu cầu dùng chung.

import Constants from "expo-constants";

type AuthInput = {
  phone: string;
  password: string;
};

type RegisterInput = AuthInput & {
  full_name: string;
};

export type AuthUser = {
  token?: string;
  sessionToken?: string;
  user_id: number;
  full_name: string;
  phone: string | null;
  email?: string | null;
};

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    const metroHost = hostUri.split(":")[0];
    return `http://${metroHost}:3000`;
  }

  throw new Error(
    "Không xác định được địa chỉ backend. Hãy cấu hình EXPO_PUBLIC_API_URL.",
  );
}

async function requestApi<T>(endpoint: string, body: object): Promise<T> {
  const baseUrl = getApiBaseUrl();

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      `Không kết nối được backend tại ${baseUrl}. ` +
        "Hãy kiểm tra backend đang chạy và iPhone cùng Wi-Fi với Mac.",
    );
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message || `Yêu cầu thất bại (HTTP ${response.status}).`);
  }

  if (!result) {
    throw new Error("Backend không trả về dữ liệu JSON hợp lệ.");
  }

  return result as T;
}

export async function registerWithApi(input: RegisterInput) {
  return requestApi<{ success: boolean; data: AuthUser }>("/api/auth/register", input);
}

export async function loginWithApi(input: AuthInput | { identifier: string; password: string }): Promise<AuthUser> {
  const result = await requestApi<{
    success: boolean;
    data: AuthUser;
  }>("/api/auth/login", input);

  if (!result.success || !result.data) {
    throw new Error("Backend không trả về tài khoản người dùng.");
  }

  return result.data;
}

type GoogleAuthUser = AuthUser & { isNewAccount?: boolean };

export async function loginWithGoogleApi(idToken: string): Promise<GoogleAuthUser> {
  const result = await requestApi<{ success: boolean; data: GoogleAuthUser }>(
    "/api/auth/google",
    { idToken },
  );
  if (!result.success || !result.data) {
    throw new Error("Backend không trả về tài khoản Google.");
  }
  return result.data;
}

export async function createGoogleBrowserSession() {
  return requestApi<{
    success: boolean;
    sessionId: string;
    secret: string;
    browserUrl: string;
  }>("/api/auth/google/expo/session", {});
}

export async function completeGoogleBrowserSession(
  sessionId: string,
  secret: string,
) {
  const result = await requestApi<{ success: boolean; idToken: string }>(
    "/api/auth/google/expo/result",
    { sessionId, secret },
  );
  if (!result.success || !result.idToken) {
    throw new Error("Không nhận được kết quả đăng nhập Google.");
  }
  return result.idToken;
}

export type UserPreferences = {
  avatar?: string | null;
  diet: string;
  tastes: string[];
  region: string;
  budget: number;
  people: number;
  cookTime: number;
  allergies: string[];
  dislikes: string[];
};

export async function saveUserPreferences(
  userId: number,
  preferences: UserPreferences,
) {
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/users/${userId}/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferences),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "Không thể lưu khẩu vị vào MySQL");
  }

  return result;
}

export async function uploadUserAvatar(
  userId: number,
  imageUri: string,
): Promise<string> {
  const baseUrl = getApiBaseUrl();

  const formData = new FormData();

  formData.append("avatar", {
    uri: imageUri,
    name: `avatar_${userId}.jpg`,
    type: "image/jpeg",
  } as any);

  const response = await fetch(`${baseUrl}/api/users/${userId}/avatar`, {
    method: "POST",
    body: formData,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !result?.avatar_url) {
    throw new Error(result?.message || "Không thể tải ảnh đại diện lên server");
  }

  const avatarUrl: string = result.avatar_url;

  return avatarUrl.startsWith("/") ? `${baseUrl}${avatarUrl}` : avatarUrl;
}

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  endpoint: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const base = getApiBaseUrl();
  const { getAuthUser } = await import("./auth");
  const user = await getAuthUser();
  const authToken = user?.token || user?.sessionToken;
  let response: Response;
  try {
    response = await fetch(`${base}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "1",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(`Không kết nối được backend tại ${base}`);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new ApiRequestError(
      result?.message || `Yêu cầu thất bại (HTTP ${response.status})`,
      response.status,
    );
  }
  return result.data as T;
}

export function requestPasswordReset(identifier: string) {
  return requestApi<{ success: boolean; challengeId: string; message: string }>(
    "/api/auth/password-reset/request", { channel: "email", identifier },
  );
}

export function verifyPasswordReset(challengeId: string, code: string) {
  return requestApi<{ success: boolean; resetToken: string }>(
    "/api/auth/password-reset/verify", { challengeId, code },
  );
}

export function completePasswordReset(challengeId: string, resetToken: string, password: string) {
  return requestApi<{ success: boolean }>(
    "/api/auth/password-reset/complete", { challengeId, resetToken, password },
  );
}
