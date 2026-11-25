import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ChefHat,
  Clock3,
  Flame,
  RefreshCw,
  Plus,
  ShoppingCart,
  Sun,
  Sunset,
  Moon,
  CalendarDays,
  X,
  Check,
  CheckCircle2,
  Table,
} from "lucide-react-native";

import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { getCurrentUserId } from "../lib/auth";
import { apiRequest } from "../lib/api";
import { kitchenRequest } from "../lib/kitchenApi";
import RequireLogin from "../components/RequireLogin";

const STORAGE_KEY_MEAL_PLANS = "smart-kitchen-meal-plans-v2";
const STORAGE_KEY_AI_PLAN = "smart-kitchen-ai-meal-plan-v2";
const accountStorageKey = async (key: string) => key + ":" + await getCurrentUserId();

const C = {
  orange: "#A23A00",
  deep: "#842D00",
  cream: "#FFF8F6",
  peach: "#FEF1EB",
  white: "#FFFFFF",
  dark: "#201A17",
  muted: "#735A51",
  border: "#EED9CF",
  green: "#397C57",
  greenLight: "#E9F5EB",
  blueLight: "#EDF3FF",
  grayLight: "#F5F3F1",
};

export type MealType = "breakfast" | "lunch" | "dinner";

export type Recipe = {
  id: string;
  name: string;
  minutes: number;
  calories: number;
  pantryIngredients?: string[];
  shoppingIngredients?: string[];
  note?: string;
  dishes?: AIMealItem[];
};

export type DayPlan = Record<MealType, Recipe | null>;
export type Plans = Record<string, DayPlan>;

export type AIMealItem = {
  name: string;
  minutes: number;
  calories: number;
  pantryIngredients?: string[];
  shoppingIngredients?: string[];
  note?: string;
  dishes?: AIMealItem[];
};

export type AIDayPlan = {
  dayIndex: number;
  dayLabel: string;
  meals: {
    breakfast?: AIMealItem;
    lunch?: AIMealItem;
    dinner?: AIMealItem;
  };
};

export type AIMealPlanResponse = {
  title: string;
  summary: string;
  days: AIDayPlan[];
  rawReply?: string;
};

const RECIPES: Record<MealType, Recipe[]> = {
  breakfast: [
    { id: "b1", name: "Trứng cuộn rau củ", minutes: 10, calories: 240 },
    { id: "b2", name: "Bánh mì trứng phô mai", minutes: 12, calories: 320 },
    { id: "b3", name: "Sữa chua trái cây", minutes: 5, calories: 180 },
    { id: "b4", name: "Cháo yến mạch", minutes: 15, calories: 250 },
  ],
  lunch: [
    { id: "l1", name: "Ức gà áp chảo sốt tiêu đen", minutes: 25, calories: 420 },
    { id: "l2", name: "Cơm bò xào rau củ", minutes: 25, calories: 480 },
    { id: "l3", name: "Cá hồi áp chảo", minutes: 20, calories: 410 },
    { id: "l4", name: "Cơm gà nấm", minutes: 30, calories: 450 },
  ],
  dinner: [
    { id: "d1", name: "Canh thịt bò rong biển", minutes: 20, calories: 310 },
    { id: "d2", name: "Salad cá hồi sốt mè rang", minutes: 15, calories: 310 },
    { id: "d3", name: "Súp bí đỏ hạt sen", minutes: 20, calories: 245 },
    { id: "d4", name: "Bò cuộn súp lơ baby", minutes: 25, calories: 380 },
  ],
};

const MEALS: {
  key: MealType;
  label: string;
  time: string;
  icon: typeof Sun;
  background: string;
}[] = [
  { key: "breakfast", label: "Bữa sáng", time: "07:00", icon: Sun, background: C.greenLight },
  { key: "lunch", label: "Bữa trưa", time: "12:00", icon: Sunset, background: C.peach },
  { key: "dinner", label: "Bữa tối", time: "18:30", icon: Moon, background: C.blueLight },
];

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const QUICK_PROMPTS = [
  {
    label: "3 bữa/ngày trong 2 ngày từ kho",
    prompt: "Thực đơn 3 bữa/ngày trong 2 ngày từ nguyên liệu trong kho",
    days: 2,
    meals: 3,
    onlyPantry: true,
  },
  {
    label: "Thực đơn 3 ngày thanh đạm, ít dầu mỡ",
    prompt: "Thực đơn 3 ngày eat clean, thanh đạm, ít dầu mỡ và giàu rau xanh",
    days: 3,
    meals: 3,
    onlyPantry: true,
  },
  {
    label: "Thực đơn 7 ngày cả tuần tiết kiệm",
    prompt: "Lập thực đơn 7 ngày cả tuần tiết kiệm, dinh dưỡng cân đối cho gia đình",
    days: 7,
    meals: 3,
    onlyPantry: false,
  },
  {
    label: "Tận dụng đồ sắp hết hạn trong kho",
    prompt: "Ưu tiên tối đa các nguyên liệu sắp hết hạn trong kho để lên thực đơn 2 ngày",
    days: 2,
    meals: 3,
    onlyPantry: true,
  },
];

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(12, 0, 0, 0);
  return result;
}

function addDays(date: Date, count: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function emptyDay(): DayPlan {
  return { breakfast: null, lunch: null, dinner: null };
}

const APPETITE_TIPS: Record<MealType, string[]> = {
  breakfast: [
    "Thưởng thức khi còn ấm để bắt đầu ngày mới thật ngon!",
    "Ăn chậm một chút, cảm nhận trọn vị bữa sáng nhé!",
    "Dọn món thật xinh, bữa sáng thêm hứng khởi!",
  ],
  lunch: [
    "Dùng khi còn nóng, xen kẽ món chính và rau cho tròn vị!",
    "Một chút canh giữa bữa giúp đổi vị thêm ngon!",
    "Tạm gác công việc, thong thả tận hưởng bữa trưa nhé!",
  ],
  dinner: [
    "Bày món ra đĩa, cùng nhau thưởng thức bữa tối ấm cúng!",
    "Ăn chậm, trò chuyện vui, bữa tối thêm ngon!",
    "Thưởng thức từng miếng nhỏ để cảm nhận trọn hương vị!",
  ],
};

function appetiteTip(type: MealType, name: string): string {
  const index = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return APPETITE_TIPS[type][index % APPETITE_TIPS[type].length];
}

function mealDishes(meal: AIMealItem): AIMealItem[] {
  if (meal.dishes?.length) return meal.dishes;
  const names = meal.name.split(/\s*\+\s*|\n/).filter(Boolean);
  return names.map((name) => ({ ...meal, name, dishes: undefined }));
}

function normalizeAIMeal(meal: AIMealItem): AIMealItem {
  const dishes = mealDishes(meal);
  if (!meal.dishes?.length) return { ...meal, dishes };
  return {
    ...meal,
    name: dishes.map((dish) => dish.name).join(" + "),
    calories: dishes.reduce((sum, dish) => sum + dish.calories, 0),
    minutes: dishes.reduce((sum, dish) => sum + dish.minutes, 0),
    pantryIngredients: [...new Set(dishes.flatMap((dish) => dish.pantryIngredients || []))],
    shoppingIngredients: [...new Set(dishes.flatMap((dish) => dish.shoppingIngredients || []))],
    dishes,
  };
}

function normalizeAIPlan(plan: AIMealPlanResponse): AIMealPlanResponse {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      meals: Object.fromEntries(Object.entries(day.meals).map(([type, meal]) => {
        if (!meal) return [type, meal];
        const normalized = normalizeAIMeal(meal);
        const count = normalized.dishes!.length;
        if (type !== "breakfast" && (count < 2 || count > 3)) {
          throw new Error("Mỗi bữa trưa và tối cần có 2–3 món. Hãy tạo lại thực đơn.");
        }
        return [type, normalized];
      })),
    })),
  };
}

function buildFallbackPlan(
  requirement: string,
  daysCount: number,
  mealsPerDay: number
): AIMealPlanResponse {
  const days: AIDayPlan[] = [];
  const baseMeals = [
    {
      breakfast: {
        name: "Trứng cuộn rau củ",
        minutes: 15,
        calories: 250,
        pantryIngredients: ["Trứng gà", "Cà rốt"],
        shoppingIngredients: ["Hành lá"],
        note: "Món sáng nhanh, giàu protein từ trứng trong kho",
      },
      lunch: {
        name: "Thịt heo xào đậu cô ve + Canh cà chua trứng",
        minutes: 25,
        calories: 420,
        pantryIngredients: ["Thịt heo", "Cà chua", "Trứng gà"],
        shoppingIngredients: ["Đậu cô ve", "Tỏi"],
        note: "Đậm đà, cung cấp năng lượng đầy đủ",
      },
      dinner: {
        name: "Canh cà chua trứng thịt băm + Bắp cải xào tỏi",
        minutes: 20,
        calories: 310,
        pantryIngredients: ["Trứng gà", "Cà chua"],
        shoppingIngredients: ["Thịt băm", "Bắp cải", "Tỏi"],
        note: "Thanh mát, dễ tiêu hóa cho bữa tối",
      },
    },
    {
      breakfast: {
        name: "Bánh mì ốp la xúc xích",
        minutes: 10,
        calories: 320,
        pantryIngredients: ["Trứng gà", "Bánh mì"],
        shoppingIngredients: ["Dưa leo"],
        note: "Nhanh gọn, tiện lợi cho buổi sáng",
      },
      lunch: {
        name: "Gà kho sả ớt + Canh bí đỏ",
        minutes: 30,
        calories: 450,
        pantryIngredients: ["Thịt gà", "Ớt"],
        shoppingIngredients: ["Sả", "Bí đỏ"],
        note: "Hao cơm, thơm nồng gia vị",
      },
      dinner: {
        name: "Canh bí đỏ thịt băm + Trứng chiên",
        minutes: 25,
        calories: 290,
        pantryIngredients: ["Bí đỏ"],
        shoppingIngredients: ["Thịt heo", "Trứng gà"],
        note: "Ngọt bùi tự nhiên, tốt cho giấc ngủ",
      },
    },
    {
      breakfast: {
        name: "Cháo yến mạch chuối",
        minutes: 12,
        calories: 230,
        pantryIngredients: ["Yến mạch"],
        shoppingIngredients: ["Chuối"],
        note: "Eat clean, nhẹ bụng",
      },
      lunch: {
        name: "Cá basa áp chảo sốt cà + Bắp cải luộc",
        minutes: 25,
        calories: 410,
        pantryIngredients: ["Cà chua"],
        shoppingIngredients: ["Cá basa", "Bắp cải"],
        note: "Giàu Omega-3 và đạm lành mạnh",
      },
      dinner: {
        name: "Rau củ luộc kho quẹt + Trứng chiên",
        minutes: 20,
        calories: 280,
        pantryIngredients: ["Cà rốt", "Bắp cải"],
        shoppingIngredients: ["Tôm khô", "Trứng gà"],
        note: "Nhiều chất xơ, nhẹ bụng ban đêm",
      },
    },
  ];

  for (let i = 0; i < daysCount; i++) {
    const template = baseMeals[i % baseMeals.length];
    const mealsObj: any = {};
    if (mealsPerDay >= 3) {
      mealsObj.breakfast = template.breakfast;
    }
    mealsObj.lunch = template.lunch;
    mealsObj.dinner = template.dinner;

    days.push({
      dayIndex: i,
      dayLabel: `Ngày ${i + 1}`,
      meals: mealsObj,
    });
  }

  return {
    title: `Thực đơn ${daysCount} ngày tối ưu từ nguyên liệu trong kho`,
    summary: `Kế hoạch ${daysCount} ngày, ${mealsPerDay} bữa/ngày theo yêu cầu: "${requirement}". Ưu tiên tối đa nguyên liệu có sẵn.`,
    days,
    rawReply: `Chef AI đã hoàn thành thực đơn theo yêu cầu "${requirement}". Bạn có thể xem bảng chi tiết và áp dụng vào lịch ăn.`,
  };
}

// Upgrade only the old built-in sample meals; preserve personal meal plans.
function upgradeSavedSampleMeal(recipe: Recipe, type: MealType): Recipe {
  if (type === "breakfast" || recipe.dishes?.length || !recipe.id.startsWith("ai-")) return recipe;
  const templates = buildFallbackPlan("", 3, 3);
  const replacement = templates.days.map((day) => day.meals[type]).find((meal) =>
    meal && meal.name.split(" + ")[0] === recipe.name && meal.note === recipe.note
  );
  return replacement ? { ...replacement, id: recipe.id, dishes: mealDishes(replacement) } : recipe;
}

export default function MealPlanScreen() {
  return <RequireLogin><MealPlanContent /></RequireLogin>;
}

function MealPlanContent() {
  const router = useRouter();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [plans, setPlans] = useState<Plans>({});

  // View mode: 'day' (lịch theo ngày) hoặc 'table' (bảng thực đơn AI)
  const [viewMode, setViewMode] = useState<"day" | "table">("day");

  // Form Modal & AI Generation State
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(
    "Thực đơn ngày 3 món trong 2 ngày từ nguyên liệu trong kho"
  );
  const [selectedDays, setSelectedDays] = useState(2);
  const [selectedMeals, setSelectedMeals] = useState(3);
  const [onlyPantry, setOnlyPantry] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const generateLock = useRef(false);

  // AI Meal Plan Result State
  const [aiMealPlan, setAiMealPlan] = useState<AIMealPlanResponse | null>(null);
  const [isTableModalVisible, setIsTableModalVisible] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const currentPlan = plans[selectedDate] ?? emptyDay();

  const totalCalories = MEALS.reduce(
    (sum, meal) => sum + (currentPlan[meal.key]?.calories ?? 0),
    0
  );

  const mealCount = MEALS.filter((meal) => currentPlan[meal.key] !== null).length;

  // Tải dữ liệu lưu trữ khi mở màn hình
  useEffect(() => {
    (async () => {
      try {
        type SavedRecipe = Omit<Recipe, "calories"> & { calories: number | null };
        const savedSchedule = await kitchenRequest<Record<string, Record<MealType, SavedRecipe[]>>>("plans").catch(() => ({}));
        const imported: Plans = {};
        for (const [date, day] of Object.entries(savedSchedule)) {
          imported[date] = emptyDay();
          for (const { key } of MEALS) {
            const recipes = day[key];
            if (!recipes.length) continue;
            imported[date][key] = {
              id: recipes[0].id,
              name: recipes.map(({ name }) => name).join(" + "),
              minutes: recipes.reduce((sum, recipe) => sum + recipe.minutes, 0),
              calories: recipes.reduce((sum, recipe) => sum + (recipe.calories ?? 0), 0),
              dishes: recipes.map((recipe) => ({ ...recipe, calories: recipe.calories ?? 0 })),
            };
          }
        }
        setPlans(imported);
        const savedPlans = await AsyncStorage.getItem(await accountStorageKey(STORAGE_KEY_MEAL_PLANS));
        if (savedPlans) {
          const restored: Plans = JSON.parse(savedPlans);
          Object.values(restored).forEach((day) => {
            MEALS.forEach(({ key }) => {
              if (day[key]) day[key] = upgradeSavedSampleMeal(day[key]!, key);
            });
          });
          setPlans({ ...imported, ...restored });
          await accountStorageKey(STORAGE_KEY_MEAL_PLANS).then((key) => AsyncStorage.setItem(key, JSON.stringify(restored)));
        }
        const savedAi = await AsyncStorage.getItem(await accountStorageKey(STORAGE_KEY_AI_PLAN));
        if (savedAi) {
          const restored: AIMealPlanResponse = JSON.parse(savedAi);
          restored.days.forEach((day) => {
            MEALS.forEach(({ key }) => {
              const meal = day.meals[key];
              if (meal) {
                const { id: _id, ...updated } = upgradeSavedSampleMeal({ ...meal, id: "ai-saved" }, key);
                day.meals[key] = updated;
              }
            });
          });
          setAiMealPlan(restored);
          await accountStorageKey(STORAGE_KEY_AI_PLAN).then((key) => AsyncStorage.setItem(key, JSON.stringify(restored)));
        }
      } catch (err) {
        console.warn("Không tải được thực đơn đã lưu:", err);
      }
    })();
  }, []);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home" as any);
    }
  };

  const changeWeek = (direction: number) => {
    const nextWeek = addDays(weekStart, direction * 7);
    setWeekStart(nextWeek);
    setSelectedDate(dateKey(nextWeek));
  };

  const updateMeal = (type: MealType, recipe: Recipe | null) => {
    setPlans((previous) => {
      const updated = {
        ...previous,
        [selectedDate]: {
          ...(previous[selectedDate] ?? emptyDay()),
          [type]: recipe,
        },
      };
      accountStorageKey(STORAGE_KEY_MEAL_PLANS).then((key) => AsyncStorage.setItem(key, JSON.stringify(updated))).catch(() => {});
      return updated;
    });
  };

  const changeMeal = (type: MealType) => {
    const options = RECIPES[type];
    const currentId = currentPlan[type]?.id;
    const currentIndex = options.findIndex((recipe) => recipe.id === currentId);
    const next = options[(currentIndex + 1) % options.length];
    if (type === "breakfast") {
      updateMeal(type, next);
    } else {
      const side = options[(currentIndex + 2) % options.length];
      const meal = normalizeAIMeal({ ...next, dishes: [next, side] });
      updateMeal(type, { ...meal, id: next.id });
    }
  };

  const openRecipe = (recipe: Recipe) => {
    router.push({
      pathname: "/recipe-detail" as any,
      params: {
        name: recipe.name,
        id: recipe.id,
      },
    });
  };

  const openShoppingList = () => {
    router.push({ pathname: "/shopping-list", params: { source: "ai-plan" } });
  };

  // Áp dụng thực đơn AI vào state plans
  const applyPlanToDays = (plan: AIMealPlanResponse) => {
    const nextPlans: Plans = { ...plans };
    const baseDate = new Date(`${selectedDate}T12:00:00`);

    plan.days.forEach((day, index) => {
      const targetDate = addDays(baseDate, index);
      const key = dateKey(targetDate);
      const dayPlan: DayPlan = nextPlans[key] ? { ...nextPlans[key] } : emptyDay();

      if (day.meals.breakfast) {
        dayPlan.breakfast = {
          id: `ai-b-${index}-${Date.now()}`,
          name: day.meals.breakfast.name,
          minutes: day.meals.breakfast.minutes || 15,
          calories: day.meals.breakfast.calories || 250,
          pantryIngredients: day.meals.breakfast.pantryIngredients,
          shoppingIngredients: day.meals.breakfast.shoppingIngredients,
          note: day.meals.breakfast.note,
          dishes: mealDishes(day.meals.breakfast),
        };
      }
      if (day.meals.lunch) {
        dayPlan.lunch = {
          id: `ai-l-${index}-${Date.now()}`,
          name: day.meals.lunch.name,
          minutes: day.meals.lunch.minutes || 25,
          calories: day.meals.lunch.calories || 450,
          pantryIngredients: day.meals.lunch.pantryIngredients,
          shoppingIngredients: day.meals.lunch.shoppingIngredients,
          note: day.meals.lunch.note,
          dishes: mealDishes(day.meals.lunch),
        };
      }
      if (day.meals.dinner) {
        dayPlan.dinner = {
          id: `ai-d-${index}-${Date.now()}`,
          name: day.meals.dinner.name,
          minutes: day.meals.dinner.minutes || 30,
          calories: day.meals.dinner.calories || 350,
          pantryIngredients: day.meals.dinner.pantryIngredients,
          shoppingIngredients: day.meals.dinner.shoppingIngredients,
          note: day.meals.dinner.note,
          dishes: mealDishes(day.meals.dinner),
        };
      }

      nextPlans[key] = dayPlan;
    });

    setPlans(nextPlans);
    accountStorageKey(STORAGE_KEY_MEAL_PLANS).then((key) => AsyncStorage.setItem(key, JSON.stringify(nextPlans))).catch(() => {});
  };

  const handleGenerateAIPlan = async () => {
    if (generateLock.current) return;
    generateLock.current = true;
    const requirement = customPrompt.trim() ||
      `Thực đơn ${selectedMeals} bữa/ngày trong ${selectedDays} ngày từ nguyên liệu trong kho`;

    setIsGenerating(true);
    try {
      const result = await apiRequest<{ mealPlan: AIMealPlanResponse | null; reply: string }>("/api/chat", "POST", {
        message: requirement, mode: "meal_plan", daysCount: selectedDays,
        mealsPerDay: selectedMeals, onlyPantry,
      });
      if (!Array.isArray(result.mealPlan?.days) || !result.mealPlan.days.length) {
        throw new Error("AI chưa trả về bảng thực đơn hợp lệ. Vui lòng thử lại.");
      }
      const plan = normalizeAIPlan({ ...result.mealPlan, rawReply: result.reply });
      if (!plan.days.some(day => Object.values(day.meals).some(meal => meal?.name?.trim()))) {
        throw new Error("Bảng thực đơn AI chưa có món ăn. Vui lòng thử lại.");
      }
      const names = plan.days.flatMap(day => Object.values(day.meals).flatMap(meal =>
        Array.isArray(meal?.shoppingIngredients)
          ? meal.shoppingIngredients.filter(name => typeof name === "string" && name.trim()).map(name => name.trim())
          : [],
      ));
      const ingredients = [...new Set(names)];
      await kitchenRequest("shopping/ai-plan", "PUT", { ingredients });

      setAiMealPlan(plan);
      await accountStorageKey(STORAGE_KEY_AI_PLAN).then(key =>
        AsyncStorage.setItem(key, JSON.stringify(plan)),
      ).catch(() => {});
      applyPlanToDays(plan);
      setIsFormModalVisible(false);
      setIsTableModalVisible(true);
    } catch (error) {
      Alert.alert("Không thể tạo thực đơn mới", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      generateLock.current = false;
      setIsGenerating(false);
    }
  };

  const renderMeal = (type: MealType) => {
    const config = MEALS.find((meal) => meal.key === type)!;
    const recipe = currentPlan[type];
    const Icon = config.icon;

    return (
      <View key={type} style={styles.mealCard}>
        <View style={[styles.mealIcon, { backgroundColor: config.background }]}>
          <Icon size={23} color={C.orange} />
        </View>

        <View style={styles.mealInfo}>
          <View style={styles.mealHeading}>
            <Text style={styles.mealLabel}>{config.label}</Text>
            <Text style={styles.mealTime}>{config.time}</Text>
          </View>

          {recipe ? (
            <>
              {mealDishes(recipe).map((dish, index) => (
                <Pressable key={`${index}-${dish.name}`} onPress={() => openRecipe({ ...dish, id: `${recipe.id}-${index}` })}>
                  <Text style={styles.mealName}>
                    {mealDishes(recipe).length > 1 ? `${index + 1}. ` : ""}{dish.name}
                  </Text>
                </Pressable>
              ))}

              <View style={styles.mealMeta}>
                <Clock3 size={12} color={C.muted} />
                <Text style={styles.mealMetaText}>{recipe.minutes} phút</Text>

                <Flame size={12} color={C.orange} />
                <Text style={styles.mealMetaText}>{recipe.calories} kcal</Text>

                {recipe.pantryIngredients && recipe.pantryIngredients.length > 0 && (
                  <View style={styles.pantryBadgeMini}>
                    <Check size={10} color={C.green} />
                    <Text style={styles.pantryBadgeMiniText}>Từ kho</Text>
                  </View>
                )}
              </View>

              <Text style={styles.recipeNoteText}>
                  💡 {appetiteTip(type, recipe.name)}
                </Text>
            </>
          ) : (
            <Text style={styles.emptyMealText}>Chưa chọn món cho bữa ăn này</Text>
          )}

          <View style={styles.mealActions}>
            <Pressable onPress={() => changeMeal(type)} style={styles.mealActionButton}>
              {recipe ? <RefreshCw size={13} color={C.orange} /> : <Plus size={13} color={C.orange} />}
              <Text style={styles.mealActionText}>{recipe ? "Đổi món" : "Thêm món"}</Text>
            </Pressable>

            {recipe && (
              <Pressable onPress={() => openRecipe({ ...mealDishes(recipe)[0], id: recipe.id })} style={styles.detailAction}>
                <Text style={styles.detailActionText}>Xem công thức</Text>
                <ChevronRight size={13} color={C.green} />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Render BẢNG THỰC ĐƠN (Table Component)
  const renderMealPlanTable = () => {
    if (!aiMealPlan) {
      return (
        <View style={styles.emptyTableBox}>
          <Sparkles size={28} color={C.orange} />
          <Text style={styles.emptyTableTitle}>Chưa có bảng thực đơn AI</Text>
          <Text style={styles.emptyTableSub}>
            Nhấn &quot;Tạo thực đơn gợi ý&quot; để Chef AI tự động lên bảng thực đơn từ kho nguyên liệu của bạn.
          </Text>
          <Pressable style={styles.createBtnSmall} onPress={() => setIsFormModalVisible(true)}>
            <Sparkles size={14} color={C.white} />
            <Text style={styles.createBtnSmallText}>Tạo thực đơn ngay</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.tableCardContainer}>
        <View style={styles.tableHeaderBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tableMainTitle}>{aiMealPlan.title}</Text>
            <Text style={styles.tableMainSummary}>{aiMealPlan.summary}</Text>
          </View>
        </View>

        {/* CÁC CỘT CỦA BẢNG */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableColHeader, { width: 85 }]}>Ngày & Bữa</Text>
          <Text style={[styles.tableColHeader, { flex: 1.4 }]}>Món ăn & Calo</Text>
          <Text style={[styles.tableColHeader, { flex: 1 }]}>Từ kho</Text>
          <Text style={[styles.tableColHeader, { flex: 1 }]}>Cần mua</Text>
        </View>

        {/* NỘI DUNG TỪNG NGÀY TRONG BẢNG */}
        {aiMealPlan.days.map((day, dIdx) => (
          <View key={dIdx} style={styles.tableDaySection}>
            <View style={styles.tableDayHeaderBar}>
              <CalendarDays size={13} color={C.orange} />
              <Text style={styles.tableDayHeaderText}>
                {day.dayLabel || `Ngày ${dIdx + 1}`}
              </Text>
            </View>

            {MEALS.map((m) => {
              const item = day.meals[m.key];
              if (!item) return null;
              return (
                <View key={m.key} style={styles.tableDataRow}>
                  {/* Cột 1: Bữa */}
                  <View style={[styles.tableCellCol, { width: 85 }]}>
                    <View style={[styles.mealPill, { backgroundColor: m.background }]}>
                      <m.icon size={11} color={C.orange} />
                      <Text style={styles.mealPillText}>{m.label}</Text>
                    </View>
                  </View>

                  {/* Cột 2: Tên món + thời gian + calo */}
                  <View style={[styles.tableCellCol, { flex: 1.4 }]}>
                    {mealDishes(item).map((dish, index) => (
                      <Text key={`${index}-${dish.name}`} style={styles.tableDishTitle}>
                        {mealDishes(item).length > 1 ? `${index + 1}. ` : ""}{dish.name}
                      </Text>
                    ))}
                    <View style={styles.tableMetaRow}>
                      <Clock3 size={10} color={C.muted} />
                      <Text style={styles.tableMetaText}>{item.minutes}p</Text>
                      <Flame size={10} color={C.orange} />
                      <Text style={styles.tableMetaText}>{item.calories} kcal</Text>
                    </View>
                      <Text style={styles.tableDishNote}>
                        {appetiteTip(m.key, item.name)}
                      </Text>
                  </View>

                  {/* Cột 3: Từ kho */}
                  <View style={[styles.tableCellCol, { flex: 1 }]}>
                    {item.pantryIngredients && item.pantryIngredients.length > 0 ? (
                      item.pantryIngredients.map((ing, i) => (
                        <View key={i} style={styles.pantryChip}>
                          <Check size={9} color={C.green} />
                          <Text style={styles.pantryChipText} numberOfLines={1}>
                            {ing}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyDashText}>-</Text>
                    )}
                  </View>

                  {/* Cột 4: Cần mua */}
                  <View style={[styles.tableCellCol, { flex: 1 }]}>
                    {item.shoppingIngredients && item.shoppingIngredients.length > 0 ? (
                      item.shoppingIngredients.map((ing, i) => (
                        <View key={i} style={styles.shopChip}>
                          <ShoppingCart size={9} color={C.orange} />
                          <Text style={styles.shopChipText} numberOfLines={1}>
                            {ing}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.allInPantryBadge}>
                        <Check size={9} color={C.green} />
                        <Text style={styles.allInPantryText}>Đủ từ kho</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* NÚT THAO TÁC TRÊN BẢNG */}
        <View style={styles.tableActionsRow}>
          <Pressable
            style={styles.applyBtn}
            onPress={() => {
              applyPlanToDays(aiMealPlan);
              Alert.alert(
                "Đã áp dụng!",
                "Thực đơn AI đã được điền vào lịch các ngày trong tuần này. Bạn có thể kiểm tra ở mục 'Lịch theo ngày'."
              );
            }}
          >
            <CheckCircle2 size={16} color={C.white} />
            <Text style={styles.applyBtnText}>Áp dụng vào lịch ăn</Text>
          </Pressable>

          <Pressable style={styles.addShopBtn} onPress={openShoppingList}>
            <ShoppingCart size={15} color={C.orange} />
            <Text style={styles.addShopBtnText}>Nguyên liệu cần mua</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right"]}>
      {/* HEADER CHUNG */}
      <AppHeader />

      {/* NÚT QUAY LẠI + TIÊU ĐỀ */}
      <View style={styles.pageHeader}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <ArrowLeft size={21} color={C.orange} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Lập thực đơn</Text>
          <Text style={styles.headerSubtitle}>Ăn ngon, đủ chất, ít lãng phí</Text>
        </View>

        <CalendarDays size={21} color={C.orange} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>THỰC ĐƠN TUẦN NÀY</Text>

        {/* CHUYỂN TUẦN */}
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>
            {days[0].getDate()}/{days[0].getMonth() + 1}
            {" – "}
            {days[6].getDate()}/{days[6].getMonth() + 1}/{days[6].getFullYear()}
          </Text>

          <View style={styles.weekControls}>
            <Pressable onPress={() => changeWeek(-1)}>
              <ChevronLeft size={21} color={C.orange} />
            </Pressable>

            <Text style={styles.weekControlText}>Tuần</Text>

            <Pressable onPress={() => changeWeek(1)}>
              <ChevronRight size={21} color={C.orange} />
            </Pressable>
          </View>
        </View>

        {/* AI GỢI Ý CARD */}
        <View style={styles.aiCard}>
          <View style={styles.aiIcon}>
            <Sparkles size={22} color={C.white} />
          </View>

          <View style={styles.aiInfo}>
            <Text style={styles.aiTitle}>Chef AI lên thực đơn cho bạn</Text>
            <Text style={styles.aiDescription}>
              Tạo bảng thực đơn theo yêu cầu dựa trên nguyên liệu có sẵn trong kho, cân bằng dinh dưỡng và tiết kiệm.
            </Text>

            <Pressable
              style={styles.generateButton}
              onPress={() => setIsFormModalVisible(true)}
            >
              <Sparkles size={16} color={C.white} />
              <Text style={styles.generateText}>Tạo thực đơn gợi ý</Text>
            </Pressable>

            {aiMealPlan && (
              <Pressable
                style={styles.viewExistingTableBtn}
                onPress={() => setIsTableModalVisible(true)}
              >
                <Table size={14} color={C.orange} />
                <Text style={styles.viewExistingTableText}>Xem bảng thực đơn AI ({aiMealPlan.days.length} ngày)</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* CHUYỂN ĐỔI CHẾ ĐỘ XEM: LỊCH THEO NGÀY vs BẢNG THỰC ĐƠN AI */}
        <View style={styles.viewModeTabs}>
          <Pressable
            style={[styles.viewModeTab, viewMode === "day" && styles.viewModeTabActive]}
            onPress={() => setViewMode("day")}
          >
            <CalendarDays size={14} color={viewMode === "day" ? C.white : C.muted} />
            <Text
              style={[
                styles.viewModeTabText,
                viewMode === "day" && styles.viewModeTabTextActive,
              ]}
            >
              Lịch theo ngày
            </Text>
          </Pressable>

          <Pressable
            style={[styles.viewModeTab, viewMode === "table" && styles.viewModeTabActive]}
            onPress={() => {
              if (!aiMealPlan) {
                setIsFormModalVisible(true);
              } else {
                setViewMode("table");
              }
            }}
          >
            <Table size={14} color={viewMode === "table" ? C.white : C.muted} />
            <Text
              style={[
                styles.viewModeTabText,
                viewMode === "table" && styles.viewModeTabTextActive,
              ]}
            >
              Bảng thực đơn AI {aiMealPlan ? "✓" : ""}
            </Text>
          </Pressable>
        </View>

        {viewMode === "table" ? (
          // CHẾ ĐỘ XEM BẢNG TỔNG HỢP
          renderMealPlanTable()
        ) : (
          // CHẾ ĐỘ XEM LỊCH THEO NGÀY (MẶC ĐỊNH)
          <>
            {/* BANNER THÔNG BÁO BẢNG THỰC ĐƠN ĐANG ĐƯỢC ÁP DỤNG */}
            {aiMealPlan && (
              <View style={styles.appliedBanner}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <CheckCircle2 size={14} color={C.green} />
                    <Text style={styles.appliedBannerTitle}>
                      Đang áp dụng: {aiMealPlan.title}
                    </Text>
                  </View>
                  <Text style={styles.appliedBannerSub}>
                    Đã điền các món vào lịch {aiMealPlan.days.length} ngày bên dưới. Bấm vào T2..CN để xem từng bữa.
                  </Text>
                </View>

                <Pressable
                  style={styles.viewTablePill}
                  onPress={() => setViewMode("table")}
                >
                  <Table size={13} color={C.white} />
                  <Text style={styles.viewTablePillText}>Xem bảng</Text>
                </Pressable>
              </View>
            )}

            {/* CHỌN NGÀY */}
            <Text style={styles.sectionTitle}>Chọn ngày</Text>

            <View style={styles.dayRow}>
              {days.map((date) => {
                const key = dateKey(date);
                const active = selectedDate === key;

                return (
                  <Pressable
                    key={key}
                    style={[styles.dayButton, active && styles.dayButtonActive]}
                    onPress={() => setSelectedDate(key)}
                  >
                    <Text style={[styles.dayLabel, active && styles.activeDayText]}>
                      {WEEKDAYS[date.getDay()]}
                    </Text>

                    <Text style={[styles.dayNumber, active && styles.activeDayText]}>
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* THỰC ĐƠN THEO NGÀY */}
            <View style={styles.selectedDayHeader}>
              <Text style={styles.selectedDayTitle}>
                {formatDate(new Date(`${selectedDate}T12:00:00`))}
              </Text>

              <Text style={styles.mealCount}>{mealCount}/3 bữa ăn</Text>
            </View>

            {MEALS.map((meal) => renderMeal(meal.key))}

            {/* DINH DƯỠNG */}
            <View style={styles.nutritionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nutritionTitle}>Tổng dinh dưỡng hôm nay</Text>
                <Text style={styles.nutritionSubtitle}>
                  Ước tính từ các món đã lên kế hoạch
                </Text>
              </View>

              <Text style={styles.totalCalories}>
                {totalCalories}
                <Text style={styles.calorieUnit}> kcal</Text>
              </Text>
            </View>

            {/* MẸO */}
            <View style={styles.tipCard}>
              <ChefHat size={20} color={C.green} />
              <Text style={styles.tipText}>
                Mẹo Smart Kitchen AI: Ưu tiên các món sử dụng nguyên liệu gần hết hạn để giảm lãng phí.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* NÚT DANH SÁCH MUA SẮM */}
      <View style={styles.bottomAction}>
        <Pressable style={styles.shoppingButton} onPress={openShoppingList}>
          <ShoppingCart size={19} color={C.white} />
          <Text style={styles.shoppingText}>Xem nguyên liệu cần mua</Text>
          <ChevronRight size={18} color={C.white} />
        </Pressable>
      </View>

      {/* ======================================================== */}
      {/* MODAL 1: FORM NHẬP YÊU CẦU LÊN THỰC ĐƠN VỚI AI          */}
      {/* ======================================================== */}
      <Modal
        visible={isFormModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isGenerating) setIsFormModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.formModalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.iconCircle}>
                  <Sparkles size={18} color={C.orange} />
                </View>
                <Text style={styles.modalTitle}>Chef AI Lên Thực Đơn</Text>
              </View>

              <Pressable
                disabled={isGenerating}
                onPress={() => setIsFormModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={20} color={C.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <Text style={styles.formHelpText}>
                Nhập yêu cầu thực đơn của bạn. Chef AI sẽ tự động đối chiếu với nguyên liệu trong kho để tạo bảng thực đơn tối ưu nhất.
              </Text>

              {/* GỢI Ý NHANH (QUICK CHIPS) */}
              <Text style={styles.formSectionLabel}>Gợi ý nhanh yêu cầu:</Text>
              <View style={styles.quickChipsWrapper}>
                {QUICK_PROMPTS.map((qp, idx) => (
                  <Pressable
                    key={idx}
                    style={[
                      styles.quickChip,
                      customPrompt === qp.prompt && styles.quickChipActive,
                    ]}
                    onPress={() => {
                      setCustomPrompt(qp.prompt);
                      setSelectedDays(qp.days);
                      setSelectedMeals(qp.meals);
                      setOnlyPantry(qp.onlyPantry);
                    }}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        customPrompt === qp.prompt && styles.quickChipTextActive,
                      ]}
                    >
                      {qp.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Ô NHẬP NỘI DUNG YÊU CẦU */}
              <Text style={styles.formSectionLabel}>Yêu cầu chi tiết:</Text>
              <TextInput
                style={styles.promptInput}
                multiline
                numberOfLines={3}
                placeholder="Ví dụ: Thực đơn ngày 3 món trong 2 ngày từ nguyên liệu trong kho, ưu tiên món thanh đạm ít dầu mỡ..."
                placeholderTextColor="#A8948D"
                value={customPrompt}
                onChangeText={setCustomPrompt}
                editable={!isGenerating}
              />

              {/* CHỌN SỐ NGÀY */}
              <Text style={styles.formSectionLabel}>Thời gian áp dụng:</Text>
              <View style={styles.optionRow}>
                {[2, 3, 5, 7].map((num) => (
                  <Pressable
                    key={num}
                    style={[
                      styles.optionPill,
                      selectedDays === num && styles.optionPillActive,
                    ]}
                    onPress={() => setSelectedDays(num)}
                    disabled={isGenerating}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        selectedDays === num && styles.optionPillTextActive,
                      ]}
                    >
                      {num} ngày
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* CHỌN SỐ BỮA MỖI NGÀY */}
              <Text style={styles.formSectionLabel}>Số bữa mỗi ngày:</Text>
              <View style={styles.optionRow}>
                {[
                  { value: 3, label: "3 bữa (Sáng, Trưa, Tối)" },
                  { value: 2, label: "2 bữa (Trưa, Tối)" },
                ].map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.optionPillWide,
                      selectedMeals === opt.value && styles.optionPillActive,
                    ]}
                    onPress={() => setSelectedMeals(opt.value)}
                    disabled={isGenerating}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        selectedMeals === opt.value && styles.optionPillTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* TÙY CHỌN NGUYÊN LIỆU KHO */}
              <Pressable
                style={styles.checkboxRow}
                onPress={() => setOnlyPantry(!onlyPantry)}
                disabled={isGenerating}
              >
                <View style={[styles.checkboxBox, onlyPantry && styles.checkboxBoxActive]}>
                  {onlyPantry && <Check size={14} color={C.white} strokeWidth={2.5} />}
                </View>
                <Text style={styles.checkboxLabel}>
                  Ưu tiên tối đa nguyên liệu có sẵn trong kho bếp
                </Text>
              </Pressable>
            </ScrollView>

            {/* BUTTONS */}
            <View style={styles.formModalFooter}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setIsFormModalVisible(false)}
                disabled={isGenerating}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </Pressable>

              <Pressable
                style={[styles.submitButton, isGenerating && styles.submitButtonDisabled]}
                onPress={handleGenerateAIPlan}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <ActivityIndicator size="small" color={C.white} />
                    <Text style={styles.submitButtonText}>Chef AI đang tạo...</Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} color={C.white} />
                    <Text style={styles.submitButtonText}>Tạo bảng thực đơn</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: BẢNG THỰC ĐƠN CHI TIẾT (MEAL PLAN TABLE MODAL)   */}
      {/* ======================================================== */}
      <Modal
        visible={isTableModalVisible}
        animationType="slide"
        onRequestClose={() => setIsTableModalVisible(false)}
      >
        <SafeAreaView style={styles.tableModalScreen}>
          {/* Header Modal */}
          <View style={styles.tableModalHeader}>
            <Pressable
              style={styles.tableModalBackBtn}
              onPress={() => setIsTableModalVisible(false)}
            >
              <ArrowLeft size={20} color={C.orange} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.tableModalHeaderTitle}>Bảng Thực Đơn Chef AI</Text>
              <Text style={styles.tableModalHeaderSub}>
                {aiMealPlan ? aiMealPlan.title : "Thực đơn thông minh"}
              </Text>
            </View>

            <Pressable
              style={styles.recreateBtn}
              onPress={() => {
                setIsTableModalVisible(false);
                setIsFormModalVisible(true);
              }}
            >
              <RefreshCw size={14} color={C.orange} />
              <Text style={styles.recreateBtnText}>Tạo lại</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.tableModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderMealPlanTable()}

            {aiMealPlan && (
              <View style={styles.aiAdviceCard}>
                <View style={styles.aiAdviceHeader}>
                  <ChefHat size={18} color={C.green} />
                  <Text style={styles.aiAdviceTitle}>Ăn ngon cùng Chef AI</Text>
                </View>
                <Text style={styles.aiAdviceBody}>
                  Dọn món khi còn ấm để cảm nhận trọn hương vị. Ăn chậm, xen kẽ các món cho thêm ngon miệng. Chúc bạn có bữa ăn vui vẻ bên người thân!
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Bar */}
          <View style={styles.tableModalFooter}>
            <Pressable
              style={styles.closeFullTableBtn}
              onPress={() => setIsTableModalVisible(false)}
            >
              <Text style={styles.closeFullTableText}>Đóng bảng thực đơn</Text>
            </Pressable>

            <Pressable
              style={styles.applyFullTableBtn}
              onPress={() => {
                if (aiMealPlan) {
                  applyPlanToDays(aiMealPlan);
                  setIsTableModalVisible(false);
                  setViewMode("table");
                  Alert.alert(
                    "Đã áp dụng thành công!",
                    `Đã lưu thực đơn "${aiMealPlan.title}" vào lịch ăn!\n\n• Bảng thực đơn đang hiển thị ngay trên màn hình chính.\n• Bạn cũng có thể bấm tab "Lịch theo ngày" để xem từng bữa sáng, trưa, tối theo từng ngày.`,
                    [{ text: "Đã hiểu" }]
                  );
                }
              }}
            >
              <Check size={18} color={C.white} strokeWidth={2.5} />
              <Text style={styles.applyFullTableText}>Áp dụng vào lịch ăn</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* BOTTOM NAV CHUNG */}
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.cream,
  },
  pageHeader: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: C.peach,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.dark,
  },
  headerSubtitle: {
    fontSize: 10,
    color: C.muted,
    marginTop: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  eyebrow: {
    color: C.orange,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 7,
    marginBottom: 18,
  },
  weekTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: C.dark,
  },
  weekControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.peach,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  weekControlText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: "800",
  },
  aiCard: {
    backgroundColor: C.peach,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 13,
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  aiInfo: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.dark,
  },
  aiDescription: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 17,
    marginTop: 6,
  },
  generateButton: {
    backgroundColor: C.orange,
    borderRadius: 10,
    marginTop: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  generateText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
  },
  viewExistingTableBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  viewExistingTableText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.orange,
  },
  viewModeTabs: {
    flexDirection: "row",
    backgroundColor: C.peach,
    borderRadius: 11,
    padding: 3,
    marginBottom: 18,
    gap: 4,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  viewModeTabActive: {
    backgroundColor: C.orange,
  },
  viewModeTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
  },
  viewModeTabTextActive: {
    color: C.white,
  },
  appliedBanner: {
    backgroundColor: C.greenLight,
    borderWidth: 1,
    borderColor: "#CCE5D3",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  appliedBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.green,
  },
  appliedBannerSub: {
    fontSize: 10,
    color: "#2C5B3E",
    marginTop: 2,
    lineHeight: 14,
  },
  viewTablePill: {
    backgroundColor: C.orange,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewTablePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.white,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.dark,
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 22,
  },
  dayButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  dayButtonActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: C.dark,
    marginTop: 7,
  },
  activeDayText: {
    color: C.white,
  },
  selectedDayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  selectedDayTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.dark,
  },
  mealCount: {
    fontSize: 11,
    fontWeight: "800",
    color: C.orange,
  },
  mealCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 11,
  },
  mealIcon: {
    width: 49,
    height: 49,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  mealInfo: {
    flex: 1,
  },
  mealHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealLabel: {
    fontSize: 11,
    color: C.orange,
    fontWeight: "800",
  },
  mealTime: {
    fontSize: 10,
    color: C.muted,
  },
  mealName: {
    fontSize: 13,
    fontWeight: "800",
    color: C.dark,
    marginTop: 7,
  },
  recipeNoteText: {
    fontSize: 10,
    color: C.green,
    marginTop: 4,
    fontStyle: "italic",
  },
  emptyMealText: {
    fontSize: 11,
    color: C.muted,
    marginTop: 9,
  },
  mealMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  mealMetaText: {
    fontSize: 10,
    color: C.muted,
  },
  pantryBadgeMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: C.greenLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  pantryBadgeMiniText: {
    fontSize: 9,
    fontWeight: "700",
    color: C.green,
  },
  mealActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 14,
    marginTop: 12,
  },
  mealActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mealActionText: {
    fontSize: 10,
    color: C.orange,
    fontWeight: "800",
  },
  detailAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailActionText: {
    fontSize: 10,
    color: C.green,
    fontWeight: "700",
  },
  nutritionCard: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 7,
  },
  nutritionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.dark,
  },
  nutritionSubtitle: {
    fontSize: 9,
    color: C.muted,
    marginTop: 5,
  },
  totalCalories: {
    fontSize: 17,
    fontWeight: "800",
    color: C.green,
  },
  calorieUnit: {
    fontSize: 10,
  },
  tipCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: C.greenLight,
    padding: 14,
    borderRadius: 13,
    marginTop: 15,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: C.green,
    lineHeight: 17,
  },
  bottomAction: {
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  shoppingButton: {
    backgroundColor: C.orange,
    borderRadius: 12,
    height: 44,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  shoppingText: {
    fontSize: 12,
    color: C.white,
    fontWeight: "800",
  },

  // STYLES CHO BẢNG THỰC ĐƠN (TABLE COMPONENT)
  tableCardContainer: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 20,
  },
  tableHeaderBox: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableMainTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.dark,
  },
  tableMainSummary: {
    fontSize: 11,
    color: C.muted,
    marginTop: 4,
    lineHeight: 16,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.peach,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  tableColHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: C.orange,
  },
  tableDaySection: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F4ECE8",
    paddingBottom: 8,
  },
  tableDayHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.grayLight,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  tableDayHeaderText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.dark,
  },
  tableDataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F4ECE8",
  },
  tableCellCol: {
    paddingHorizontal: 3,
  },
  mealPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  mealPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.dark,
  },
  tableDishTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.dark,
  },
  tableMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  tableMetaText: {
    fontSize: 9,
    color: C.muted,
  },
  tableDishNote: {
    fontSize: 9,
    color: C.muted,
    fontStyle: "italic",
    marginTop: 3,
  },
  pantryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: C.greenLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 3,
  },
  pantryChipText: {
    fontSize: 9,
    color: C.green,
    fontWeight: "600",
  },
  shopChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: C.peach,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 3,
  },
  shopChipText: {
    fontSize: 9,
    color: C.orange,
    fontWeight: "600",
  },
  allInPantryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  allInPantryText: {
    fontSize: 9,
    color: C.green,
    fontWeight: "600",
  },
  emptyDashText: {
    fontSize: 11,
    color: C.muted,
  },
  tableActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  applyBtn: {
    flex: 1.2,
    backgroundColor: C.orange,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.white,
  },
  addShopBtn: {
    flex: 1,
    backgroundColor: C.peach,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  addShopBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.orange,
  },
  emptyTableBox: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTableTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.dark,
    marginTop: 10,
  },
  emptyTableSub: {
    fontSize: 11,
    color: C.muted,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 16,
  },
  createBtnSmall: {
    backgroundColor: C.orange,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  createBtnSmallText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.white,
  },

  // STYLES MODAL FORM NHẬP YÊU CẦU
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(32, 26, 23, 0.45)",
    justifyContent: "flex-end",
  },
  formModalCard: {
    backgroundColor: C.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.peach,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.dark,
  },
  closeBtn: {
    padding: 4,
  },
  formHelpText: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 16,
    marginBottom: 12,
  },
  formSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: C.dark,
    marginTop: 10,
    marginBottom: 6,
  },
  quickChipsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  quickChip: {
    backgroundColor: C.grayLight,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#EAE5E2",
  },
  quickChipActive: {
    backgroundColor: C.peach,
    borderColor: C.orange,
  },
  quickChipText: {
    fontSize: 11,
    color: C.dark,
    fontWeight: "600",
  },
  quickChipTextActive: {
    color: C.orange,
    fontWeight: "700",
  },
  promptInput: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: C.dark,
    textAlignVertical: "top",
    minHeight: 70,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  optionPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.grayLight,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAE5E2",
  },
  optionPillWide: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: C.grayLight,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAE5E2",
  },
  optionPillActive: {
    backgroundColor: C.peach,
    borderColor: C.orange,
  },
  optionPillText: {
    fontSize: 11,
    color: C.muted,
    fontWeight: "700",
  },
  optionPillTextActive: {
    color: C.orange,
    fontWeight: "800",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.muted,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
  },
  checkboxBoxActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  checkboxLabel: {
    fontSize: 12,
    color: C.dark,
    fontWeight: "600",
    flex: 1,
  },
  formModalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.muted,
  },
  submitButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.white,
  },

  // STYLES TOÀN MÀN HÌNH BẢNG THỰC ĐƠN CHI TIẾT
  tableModalScreen: {
    flex: 1,
    backgroundColor: C.cream,
  },
  tableModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  tableModalBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.peach,
    alignItems: "center",
    justifyContent: "center",
  },
  tableModalHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.dark,
  },
  tableModalHeaderSub: {
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
  },
  recreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.peach,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  recreateBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.orange,
  },
  tableModalScrollContent: {
    padding: 14,
    paddingBottom: 24,
  },
  aiAdviceCard: {
    backgroundColor: C.greenLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#D2E8D7",
  },
  aiAdviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  aiAdviceTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.green,
  },
  aiAdviceBody: {
    fontSize: 11,
    color: "#28523A",
    lineHeight: 17,
  },
  tableModalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  closeFullTableBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: C.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  closeFullTableText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
  },
  applyFullTableBtn: {
    flex: 1.5,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: C.orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  applyFullTableText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.white,
  },
});
