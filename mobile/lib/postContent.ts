// Chức năng: Tách nội dung bài chia sẻ thành các mục, giữ nguyên toàn bộ phần chữ.
const headings = [
  "THÔNG TIN MÓN",
  "DINH DƯỠNG ƯỚC TÍNH / KHẨU PHẦN",
  "NGUYÊN LIỆU",
  "CÁCH LÀM",
  "MẸO NHỎ",
];
export function parsePostContent(description: string) {
  const tags: string[] = [];
  const text = description
    .split("\n")
    .filter((line) => {
      if (/^\s*(#[^\s#]+\s*)+$/u.test(line)) {
        tags.push(...(line.match(/#[^\s#]+/gu) || []));
        return false;
      }
      return true;
    })
    .join("\n");
  const sections: { title: string; body: string }[] = [];
  let current = { title: "", body: "" };
  for (const line of text.split("\n")) {
    if (headings.includes(line.trim())) {
      if (current.body.trim())
        sections.push({ ...current, body: current.body.trim() });
      current = { title: line.trim(), body: "" };
    } else current.body += `${line}\n`;
  }
  if (current.body.trim())
    sections.push({ ...current, body: current.body.trim() });
  return {
    intro: sections
      .filter((s) => !s.title)
      .map((s) => s.body)
      .join("\n\n"),
    sections: sections.filter((s) => s.title),
    tags: [...new Set(tags)],
  };
}

type Ingredient = { name: string; quantity: string; unit: string };
type Step = { title: string; instruction: string };

export type PostDraft = {
  visibility: "PUBLIC" | "PRIVATE";
  mode: "recipe" | "tip";
  title: string;
  description: string;
  image: string;
  category: string;
  tags: string;
  minutes: string;
  servings: string;
  difficulty: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  ingredients: Ingredient[];
  steps: Step[];
  tip: string;
};

function optionalIntegerIsValid(value: string, max: number) {
  const number = Number(value);
  return !value.trim() || (Number.isInteger(number) && number >= 1 && number <= max);
}

export function postDraftIssues(draft: PostDraft) {
  const issues: string[] = [];
  if (!draft.category.trim()) issues.push("Chọn danh mục bài viết.");
  if (!draft.title.trim()) issues.push("Nhập tên món hoặc tiêu đề.");
  if (!draft.description.trim()) issues.push("Nhập phần mô tả / cảm nghĩ ở phía trên.");
  if (draft.mode === "recipe") {
    if (!optionalIntegerIsValid(draft.minutes, 1440)) issues.push("Thời gian phải từ 1–1440 phút.");
    if (!optionalIntegerIsValid(draft.servings, 100)) issues.push("Khẩu phần phải từ 1–100 người.");
    if (draft.ingredients.some(({ name, quantity }) =>
      name.trim() && quantity.trim() && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0),
    )) issues.push("Số lượng nguyên liệu phải lớn hơn 0.");
    if ([draft.calories, draft.protein, draft.carbs, draft.fat].some(
      value => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0),
    )) issues.push("Dinh dưỡng phải là số không âm.");
  }
  return issues;
}

export function composePostContent(draft: PostDraft) {
  const description = draft.description.trim();
  const tags = draft.tags.trim();
  if (draft.mode === "tip") return [description, tags].filter(Boolean).join("\n\n");

  const metrics = [
    draft.minutes.trim() && `${draft.minutes.trim()} phút`,
    draft.servings.trim() && `${draft.servings.trim()} người`,
    draft.difficulty.trim(),
  ].filter(Boolean).join(" · ");
  const nutrition = [
    ["Năng lượng", draft.calories, "kcal"],
    ["Đạm", draft.protein, "g"],
    ["Tinh bột", draft.carbs, "g"],
    ["Chất béo", draft.fat, "g"],
  ].filter(([, value]) => value.trim())
    .map(([label, value, unit]) => `${label}: ${value.trim()} ${unit}`)
    .join(" · ");
  const ingredients = draft.ingredients.filter(item => item.name.trim()).map(item => {
    const quantity = item.quantity.trim();
    const amount = quantity && [quantity, item.unit.trim()].filter(Boolean).join(" ");
    return `• ${item.name.trim()}${amount ? ` — ${amount}` : ""}`;
  });
  const steps = draft.steps.filter(step => step.title.trim() || step.instruction.trim()).map((step, index) =>
    [`${index + 1}. ${step.title.trim() || `Bước ${index + 1}`}`, step.instruction.trim()].filter(Boolean).join("\n"),
  );
  const tip = draft.tip.trim();
  return [
    description,
    metrics && `THÔNG TIN MÓN\n${metrics}`,
    nutrition && `DINH DƯỠNG ƯỚC TÍNH / KHẨU PHẦN\n${nutrition}`,
    ingredients.length && `NGUYÊN LIỆU\n${ingredients.join("\n")}`,
    steps.length && `CÁCH LÀM\n${steps.join("\n\n")}`,
    tip && `MẸO NHỎ\n${tip}`,
    tags,
  ].filter(Boolean).join("\n\n");
}
