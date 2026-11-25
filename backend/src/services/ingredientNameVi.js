const vietnameseLabels = require('../ai_service/ingredient_labels_vi.json');

function ingredientNameVi(name) {
  if (typeof name !== 'string') return name;
  const label = name.trim();
  const key = label.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return Object.hasOwn(vietnameseLabels, key) ? vietnameseLabels[key] : label;
}

module.exports = ingredientNameVi;
