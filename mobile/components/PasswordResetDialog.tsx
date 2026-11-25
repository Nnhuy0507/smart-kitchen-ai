import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { completePasswordReset, requestPasswordReset, verifyPasswordReset } from "../lib/api";

type Props = { identifier: string; onClose: () => void; onSuccess: () => void };

export default function PasswordResetDialog({ identifier, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState(identifier.includes("@") ? identifier : "");
  const [challengeId, setChallengeId] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const nextSendAt = useRef(0);
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);
  const resendCoolingDown = secondsUntilResend > 0;

  useEffect(() => {
    if (!resendCoolingDown) return;
    const interval = setInterval(() => {
      setSecondsUntilResend(Math.max(0, Math.ceil((nextSendAt.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(interval);
  }, [resendCoolingDown]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vui lòng thử lại.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function sendCode() {
    const wait = Math.ceil((nextSendAt.current - Date.now()) / 1000);
    if (wait > 0) throw new Error(`Bạn có thể gửi mã mới sau ${wait} giây.`);
    const result = await requestPasswordReset(email.trim());
    nextSendAt.current = Date.now() + 60_000;
    setSecondsUntilResend(60);
    setChallengeId(result.challengeId);
    setCode("");
    setNotice(result.message);
  }

  async function submit() {
    if (resetToken) {
      if (password.length < 8) throw new Error("Mật khẩu phải có ít nhất 8 ký tự.");
      if (password !== confirmation) throw new Error("Mật khẩu xác nhận không khớp.");
      await completePasswordReset(challengeId, resetToken, password);
      onSuccess();
    } else if (challengeId) {
      if (!/^\d{6}$/.test(code)) throw new Error("Vui lòng nhập mã OTP gồm 6 chữ số.");
      const result = await verifyPasswordReset(challengeId, code);
      setResetToken(result.resetToken);
      setCode("");
      setNotice("");
    } else {
      await sendCode();
    }
  }

  function startOver() {
    setChallengeId("");
    setResetToken("");
    setPassword("");
    setConfirmation("");
    setCode("");
    setNotice("");
    setError("");
  }

  function close() {
    if (!inFlight.current) onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.center}>
          <View style={s.card} accessibilityViewIsModal>
            <View style={s.header}>
              <Text accessibilityRole="header" style={s.title}>
                {resetToken ? "Đặt mật khẩu mới" : challengeId ? "Nhập mã OTP" : "Quên mật khẩu"}
              </Text>
              <Pressable accessibilityRole="button" onPress={close} disabled={busy} hitSlop={8}>
                <Text style={s.link}>Đóng</Text>
              </Pressable>
            </View>

            {resetToken ? (
              <>
                <TextInput style={s.input} accessibilityLabel="Mật khẩu mới" placeholder="Mật khẩu mới (ít nhất 8 ký tự)" secureTextEntry autoComplete="new-password" autoCapitalize="none" value={password} onChangeText={setPassword} editable={!busy} />
                <TextInput style={s.input} accessibilityLabel="Xác nhận mật khẩu mới" placeholder="Xác nhận mật khẩu mới" secureTextEntry autoComplete="new-password" autoCapitalize="none" value={confirmation} onChangeText={setConfirmation} editable={!busy} />
              </>
            ) : challengeId ? (
              <>
                <Text style={s.notice}>{notice}</Text>
                <Text style={s.notice}>Kiểm tra hộp thư đến và thư rác.</Text>
                <TextInput style={s.input} accessibilityLabel="Mã OTP" placeholder="Mã OTP 6 chữ số" keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} value={code} onChangeText={value => setCode(value.replace(/\D/g, ""))} editable={!busy} />
              </>
            ) : (
              <>
                <Text style={s.notice}>Nhập email đã lưu trong tài khoản để nhận mã OTP. Bạn cũng có thể dùng mã này để tạo mật khẩu lần đầu cho tài khoản Google.</Text>
                <TextInput
                  style={s.input}
                  accessibilityLabel="Email đã lưu trong tài khoản"
                  placeholder="Email đã lưu trong tài khoản"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!busy}
                />
              </>
            )}

            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(submit)} style={[s.button, busy && s.disabled]}>
              <Text style={s.buttonText}>
                {busy ? "Đang xử lý…" : resetToken ? "Đổi mật khẩu" : challengeId ? "Xác thực OTP" : "Gửi mã OTP"}
              </Text>
            </Pressable>
            {!!challengeId && (
              <View style={s.actions}>
                {!resetToken && (
                  <Pressable accessibilityRole="button" disabled={busy || resendCoolingDown} onPress={() => void run(sendCode)}>
                    <Text style={resendCoolingDown ? s.notice : s.link}>
                      {resendCoolingDown ? `Gửi lại sau ${secondsUntilResend}s` : "Gửi lại mã"}
                    </Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" disabled={busy} onPress={startOver}>
                  <Text style={s.link}>{resetToken ? "Yêu cầu mã mới" : "Đổi địa chỉ email"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(32,26,23,0.45)" },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 380, borderRadius: 16, backgroundColor: "#FFF8F6", padding: 20, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  title: { color: "#201A17", fontWeight: "800", fontSize: 20 },
  link: { color: "#A23A00", fontWeight: "700", fontSize: 14 },
  notice: { color: "#735A51", lineHeight: 20 },
  input: { minHeight: 48, padding: 12, backgroundColor: "#FFFFFF", borderColor: "#EED9CF", borderWidth: 1, borderRadius: 10, color: "#201A17", fontSize: 14 },
  error: { color: "#A12622", lineHeight: 20 },
  button: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#A23A00" },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
  disabled: { opacity: 0.6 },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 14 },
});
