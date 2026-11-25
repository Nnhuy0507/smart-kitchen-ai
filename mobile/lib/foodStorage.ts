import { isoDay, parseCalendarDate } from "./calendar";

export type FoodCategory = "Rau củ" | "Thịt cá" | "Sữa & trứng" | "Ngũ cốc" | "Khác";
export type StorageLocation = "Ngăn mát" | "Ngăn đông" | "Bên ngoài";

type StorageDays = Partial<Record<StorageLocation, number>>;
type FoodRule = { terms: string[]; category: FoodCategory; days: StorageDays };

const refrigerated = (fridge: number, freezer?: number): StorageDays =>
  freezer === undefined
    ? { "Ngăn mát": fridge }
    : { "Ngăn mát": fridge, "Ngăn đông": freezer };

// Refrigerated suggestions assume ≤4 °C. Frozen durations at ≤−18 °C are quality estimates.
const rules: FoodRule[] = [
  { terms: ["khoai tây chiên", "bánh pizza", "súp", "hoành thánh", "há cảo"], category: "Khác", days: refrigerated(3, 30) },
  { terms: ["kem lạnh"], category: "Sữa & trứng", days: { "Ngăn đông": 30 } },
  { terms: ["mì sợi", "mì ý", "bánh ngọt"], category: "Ngũ cốc", days: refrigerated(3) },
  { terms: ["bánh quy"], category: "Ngũ cốc", days: { "Bên ngoài": 14 } },
  { terms: ["cà phê", "trà", "hạnh nhân", "hạt điều", "đậu phộng", "chà là", "rong biển"], category: "Khác", days: { "Bên ngoài": 30 } },
  { terms: ["nước ép", "nước sốt", "ô liu"], category: "Khác", days: refrigerated(3) },
  { terms: ["rau mầm"], category: "Rau củ", days: refrigerated(2) },
  { terms: ["đậu gà", "đậu trắng", "chickpeas", "white beans"], category: "Rau củ", days: refrigerated(3) },
  { terms: ["tỏi tây", "leek", "măng tây", "cần tây", "asparagus", "atisô", "artichoke", "đậu bắp", "okra"], category: "Rau củ", days: refrigerated(5) },
  { terms: ["sô cô la", "sôcôla", "chocolate", "tiêu dài", "long pepper"], category: "Khác", days: { "Bên ngoài": 30 } },
  { terms: ["cơm", "cháo", "cooked rice"], category: "Ngũ cốc", days: refrigerated(1, 30) },
  { terms: ["thịt chín", "cá chín", "đồ ăn chín", "đồ ăn thừa", "leftovers", "cooked meat"], category: "Thịt cá", days: refrigerated(3, 60) },
  { terms: ["giăm bông", "ham", "thịt nguội"], category: "Thịt cá", days: refrigerated(3, 30) },
  { terms: ["thịt xay", "thịt băm", "xay", "băm", "mince", "ground meat", "ground beef", "ground pork"], category: "Thịt cá", days: refrigerated(2, 90) },
  { terms: ["xúc xích", "sausage"], category: "Thịt cá", days: refrigerated(2, 30) },
  { terms: ["gà", "vịt", "ngỗng", "gia cầm", "chicken", "turkey", "duck"], category: "Thịt cá", days: refrigerated(2, 270) },
  { terms: ["cá tuyết", "cá bơn", "cod", "flounder"], category: "Thịt cá", days: refrigerated(2, 180) },
  { terms: ["cá", "fish", "salmon", "tuna", "mackerel"], category: "Thịt cá", days: refrigerated(2, 60) },
  { terms: ["tôm", "mực", "bạch tuộc", "shrimp", "squid"], category: "Thịt cá", days: refrigerated(2, 90) },
  { terms: ["cua", "ghẹ", "nghêu", "sò", "hàu", "ốc", "hải sản", "crab", "oyster", "clam"], category: "Thịt cá", days: refrigerated(2, 60) },
  { terms: ["bò", "heo", "lợn", "cừu", "dê", "bê", "beef", "pork", "lamb", "veal"], category: "Thịt cá", days: refrigerated(3, 120) },
  { terms: ["thịt"], category: "Thịt cá", days: refrigerated(2, 60) },
  { terms: ["trứng luộc", "hard boiled egg"], category: "Sữa & trứng", days: refrigerated(7) },
  { terms: ["trứng", "egg", "eggs"], category: "Sữa & trứng", days: refrigerated(21) },
  { terms: ["sữa", "milk", "sữa chua", "yogurt"], category: "Sữa & trứng", days: refrigerated(7) },
  { terms: ["bơ sữa", "butter", "phô mai", "cheese"], category: "Sữa & trứng", days: refrigerated(7) },
  { terms: ["bánh mì", "bread"], category: "Ngũ cốc", days: { "Bên ngoài": 3, "Ngăn đông": 60 } },
  { terms: ["gạo", "bột mì", "yến mạch", "ngũ cốc", "mì khô", "đậu khô", "flour", "oats", "cereal", "dry rice", "dry pasta"], category: "Ngũ cốc", days: { "Bên ngoài": 30 } },
  { terms: ["rau", "xà lách", "cải bó xôi", "rau thơm", "hành lá", "mùi tây", "parsley", "coriander", "spinach", "lettuce", "greens"], category: "Rau củ", days: refrigerated(3) },
  { terms: ["nấm", "mushroom", "đậu hũ", "đậu phụ", "tofu"], category: "Rau củ", days: refrigerated(3) },
  { terms: ["cà rốt", "bắp cải", "củ cải", "củ dền", "gừng", "beet", "ginger", "carrot", "cabbage", "radish"], category: "Rau củ", days: refrigerated(14) },
  { terms: ["cà", "bắp", "bí", "su su", "bông cải", "súp lơ", "dưa leo", "đậu", "ớt", "ngô", "tomato", "broccoli", "cucumber", "vegetable"], category: "Rau củ", days: refrigerated(5) },
  { terms: ["hành tây", "tỏi", "khoai tây", "khoai lang", "onion", "garlic", "potato"], category: "Rau củ", days: { "Bên ngoài": 14 } },
  { terms: ["dâu", "việt quất", "nho", "anh đào", "lý gai", "phúc bồn tử", "cherry", "gooseberry", "raspberry", "strawberry", "blueberry", "grape"], category: "Rau củ", days: refrigerated(3, 90) },
  { terms: ["táo", "cam", "bưởi", "chanh", "lê", "quất", "kumquat", "apple", "orange", "pear"], category: "Rau củ", days: refrigerated(14) },
  { terms: ["bơ", "chuối", "xoài", "đu đủ", "na", "annona", "avocado", "banana", "mango"], category: "Rau củ", days: { "Bên ngoài": 3, "Ngăn mát": 3 } },
  { terms: ["trái cây", "dưa lưới", "dưa hấu", "kiwi", "dứa", "đào", "ổi", "thanh long", "fruit"], category: "Rau củ", days: refrigerated(5) },
];

const categoryDays: Partial<Record<FoodCategory, StorageDays>> = {
  "Thịt cá": refrigerated(2, 60),
  "Sữa & trứng": refrigerated(5),
  "Rau củ": refrigerated(5),
};

function findRule(name: string) {
  const normalized = " " + name.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim() + " ";
  return rules.find(({ terms }) => terms.some(term =>
    term === "cơm" || term === "cháo" ? normalized.startsWith(" " + term + " ") : normalized.includes(" " + term + " "),
  ));
}

export function foodCategory(name: string): FoodCategory {
  return findRule(name)?.category ?? "Khác";
}

export function suggestedLocation(name: string, category: FoodCategory): StorageLocation {
  const rule = findRule(name);
  if (rule?.category === category) {
    if (rule.days["Bên ngoài"] !== undefined) return "Bên ngoài";
    return rule.days["Ngăn mát"] !== undefined ? "Ngăn mát" : "Ngăn đông";
  }
  return category === "Ngũ cốc" ? "Bên ngoài" : "Ngăn mát";
}

export function suggestedExpiry(name: string, category: FoodCategory, location: StorageLocation, purchaseDate: string) {
  const rule = findRule(name);
  const days = (rule?.category === category ? rule.days : categoryDays[category])?.[location];
  const parsed = parseCalendarDate(purchaseDate);
  if (!parsed || days === undefined) return "";

  const date = new Date(Date.UTC(parsed.year, parsed.month, parsed.day + days));
  return isoDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
