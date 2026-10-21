import Constants from "expo-constants";

function getApiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  // With Expo LAN mode, hostUri is the Windows PC's LAN address.
  const metroHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (metroHost) return `http://${metroHost}:3000`;

  throw new Error("Không tìm thấy địa chỉ backend. Hãy chạy Expo bằng --lan.");
}

export async function registerWithApi(input: {
  full_name: string;
  phone: string;
  password: string;
}) {
  const baseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(
      `iPhone không kết nối được ${baseUrl}. Mở ${baseUrl}/api/health trên Safari; nếu không mở được, kiểm tra cùng Wi-Fi và Windows Firewall.`,
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || "Đăng ký thất bại. Vui lòng thử lại.");
  }
  return result;
}

export async function loginWithApi(input: { phone: string; password: string }) {
  const baseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(
      `Không kết nối được ${baseUrl}. Kiểm tra backend và kết nối Wi-Fi.`,
    );
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.message ||
      (response.status === 404
        ? "Không tìm thấy API đăng nhập. Hãy khởi động lại backend đúng thư mục."
        : `Đăng nhập thất bại (HTTP ${response.status}).`);
    throw new Error(message);
  }
  return result.data as { user_id: number; full_name: string; phone: string };
}
