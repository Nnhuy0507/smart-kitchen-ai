import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Sparkles } from "lucide-react-native";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import RequireLogin from "../components/RequireLogin";
import { daysUntil, getIngredients, type Ingredient } from "../lib/ingredients";

const orange = "#A23A00";

function ExpiringFoodScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Ingredient[] | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    getIngredients().then(rows => { if (active) setItems(rows); }).catch(error => {
      if (active) {
        setItems([]);
        Alert.alert("Không thể tải dữ liệu", error instanceof Error ? error.message : "Vui lòng thử lại.");
      }
    });
    return () => { active = false; };
  }, []));

  const expiring = (items ?? []).flatMap(item => {
    const days = daysUntil(item.expiryDate);
    return days !== null && days <= 3 && item.quantity > 0 ? [{ item, days }] : [];
  });

  return (
    <SafeAreaView style={s.screen} edges={[]}>
      <AppHeader />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.heading}>
          <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8} onPress={() => router.canGoBack() ? router.back() : router.replace("/pantry")}>
            <ArrowLeft size={23} color={orange} />
          </Pressable>
          <Text style={s.title}>Sắp hết hạn</Text>
        </View>
        {items === null ? <ActivityIndicator color={orange} /> : !expiring.length ? (
          <Text style={s.body}>Không có thực phẩm sắp hết hạn.</Text>
        ) : expiring.map(({ item, days }) => (
          <View key={item.id} style={s.card}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.body}>{item.quantity} {item.unit} · {days < 0 ? "Đã hết hạn" : days === 0 ? "Hết hạn hôm nay" : `Còn ${days} ngày`}</Text>
            {days >= 0 && (
              <Pressable accessibilityRole="button" style={s.button} onPress={() => router.push({ pathname: "/expiring-recipe", params: { itemId: item.id } } as Href)}>
                <Sparkles size={17} color="#FFFFFF" />
                <Text style={s.buttonText}>Gợi ý món</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

export default function ExpiringFoodPage() {
  return <RequireLogin><ExpiringFoodScreen /></RequireLogin>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF8F6" },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, gap: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  title: { color: "#201A17", fontSize: 20, fontWeight: "800" },
  card: { borderRadius: 15, borderWidth: 1, borderColor: "#EED9CF", padding: 17, gap: 8, backgroundColor: "#FFFFFF" },
  name: { color: "#201A17", fontSize: 15, fontWeight: "700" },
  body: { color: "#735A51", fontSize: 13, lineHeight: 20 },
  button: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, backgroundColor: orange },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
});
