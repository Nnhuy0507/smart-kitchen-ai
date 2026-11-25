import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Sparkles } from "lucide-react-native";
import AppHeader from "../components/AppHeader";
import RequireLogin from "../components/RequireLogin";
import { kitchenRequest } from "../lib/kitchenApi";

type Suggestion = {
  title: string;
  ingredients: { id: string; name: string; quantity: number; unit: string }[];
  steps: string[];
};
type Outcome = { recipe: Suggestion } | { error: string };

const orange = "#A23A00";

function SuggestionScreen() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; outcome: Outcome } | null>(null);
  const key = itemId + ":" + attempt;
  const outcome = result?.key === key ? result.outcome : null;
  const request = useRef<{ key: string; result: Promise<Suggestion> } | null>(null);

  useEffect(() => {
    if (typeof itemId !== "string" || !/^\d+$/.test(itemId)) return;
    if (request.current?.key !== key) {
      request.current = {
        key,
        result: kitchenRequest<Suggestion>(`expiring-recipe/${itemId}`, "POST"),
      };
    }
    let active = true;
    request.current.result.then(
      recipe => { if (active) setResult({ key, outcome: { recipe } }); },
      error => { if (active) setResult({ key, outcome: { error: error instanceof Error ? error.message : "Không thể tạo gợi ý lúc này." } }); },
    );
    return () => { active = false; };
  }, [itemId, key]);

  const validId = typeof itemId === "string" && /^\d+$/.test(itemId);
  return (
    <SafeAreaView style={s.screen} edges={[]}>
      <AppHeader />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.heading}>
          <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.canGoBack() ? router.back() : router.replace("/pantry")} hitSlop={10}>
            <ArrowLeft size={24} color={orange} />
          </Pressable>
          <Text style={s.title}>Gợi ý món từ kho</Text>
        </View>

        {!validId ? (
          <Text style={s.body}>Hãy chọn một nguyên liệu sắp hết hạn trong kho.</Text>
        ) : !outcome ? (
          <View style={s.card} accessibilityLiveRegion="polite">
            <ActivityIndicator color={orange} />
            <Text style={s.body}>AI đang tìm cách kết hợp các nguyên liệu còn trong kho…</Text>
          </View>
        ) : "error" in outcome ? (
          <View style={s.card}>
            <Text accessibilityRole="alert" style={s.body}>{outcome.error}</Text>
            <Pressable accessibilityRole="button" style={s.button} onPress={() => setAttempt(n => n + 1)}>
              <Text style={s.buttonText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.card}>
              <Sparkles size={22} color={orange} />
              <Text style={s.title}>{outcome.recipe.title}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.section}>Nguyên liệu trong kho</Text>
              {outcome.recipe.ingredients.map(item => (
                <Text key={item.id} style={s.body}>{item.name} · {item.quantity.toLocaleString("vi-VN")} {item.unit}</Text>
              ))}
            </View>
            <View style={s.card}>
              <Text style={s.section}>Cách làm</Text>
              {outcome.recipe.steps.map((step, index) => (
                <Text key={index} style={s.body}>{index + 1}. {step}</Text>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ExpiringRecipePage() {
  return <RequireLogin><SuggestionScreen /></RequireLogin>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF8F6" },
  content: { width: "100%", maxWidth: 640, alignSelf: "center", padding: 20, gap: 14 },
  heading: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  title: { color: "#201A17", fontSize: 22, fontWeight: "800", flexShrink: 1 },
  section: { color: "#201A17", fontSize: 16, fontWeight: "700" },
  card: { gap: 10, padding: 16, borderRadius: 15, borderWidth: 1, borderColor: "#EED9CF", backgroundColor: "#FFFFFF" },
  body: { color: "#735A51", fontSize: 14, lineHeight: 22 },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: orange },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
});
