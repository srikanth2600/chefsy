// Ingredient Category Emojis
export const CATEGORY_EMOJIS = {
  PROTEINS: '🔴',      // Red
  SPICES: '🟠',        // Orange
  VEGETABLES: '🟢',    // Green
  DAIRY: '🟡',         // Yellow
  HERBS: '🟤',         // Brown/Teal
  LIQUIDS: '🔵',       // Blue
  GRAINS: '⚪',        // White (for grains, flour, etc.)
  FRUITS: '🟣',        // Purple (for fruits)
  OTHER: '⚫',         // Black (for other items)
} as const;

// Ingredient name to emoji mapping
export const INGREDIENT_EMOJIS: Record<string, string> = {
  // Vegetables
  'onion': '🧅',
  'onions': '🧅',
  'garlic': '🧄',
  'tomato': '🍅',
  'tomatoes': '🍅',
  'potato': '🥔',
  'potatoes': '🥔',
  'carrot': '🥕',
  'carrots': '🥕',
  'bell pepper': '🫑',
  'bell peppers': '🫑',
  'pepper': '🫑',
  'peppers': '🫑',
  'cucumber': '🥒',
  'cucumbers': '🥒',
  'broccoli': '🥦',
  'corn': '🌽',
  'mushroom': '🍄',
  'mushrooms': '🍄',
  'lettuce': '🥬',
  'spinach': '🥬',
  'cabbage': '🥬',
  'eggplant': '🍆',
  'aubergine': '🍆',
  'zucchini': '🥒',
  'courgette': '🥒',
  'ginger': '🫚',
  'chili': '🌶️',
  'chili pepper': '🌶️',
  'chilies': '🌶️',
  'chillies': '🌶️',
  'green beans': '🫛',
  'peas': '🫛',
  
  // Proteins
  'chicken': '🍗',
  'chicken breast': '🍗',
  'chicken thigh': '🍗',
  'chicken leg': '🍗',
  'chicken wings': '🍗',
  'beef': '🥩',
  'pork': '🥩',
  'lamb': '🥩',
  'fish': '🐟',
  'salmon': '🐟',
  'tuna': '🐟',
  'shrimp': '🦐',
  'prawns': '🦐',
  'prawn': '🦐',
  'egg': '🥚',
  'eggs': '🥚',
  'tofu': '🫘',
  'paneer': '🧀',
  
  // Dairy
  'milk': '🥛',
  'cheese': '🧀',
  'butter': '🧈',
  'yogurt': '🥛',
  'yoghurt': '🥛',
  'cream': '🥛',
  'sour cream': '🥛',
  'ghee': '🧈',
  
  // Spices & Seasonings
  'salt': '🧂',
  'pepper': '🫘',
  'black pepper': '🫘',
  'cumin': '🫘',
  'cumin seeds': '🫘',
  'turmeric': '🟡',
  'coriander': '🌿',
  'coriander seeds': '🫘',
  'cardamom': '🫘',
  'cinnamon': '🫘',
  'cloves': '🫘',
  'bay leaves': '🌿',
  'bay leaf': '🌿',
  'curry leaves': '🌿',
  'curry leaf': '🌿',
  'mustard seeds': '🫘',
  'fenugreek': '🫘',
  'fennel': '🫘',
  'star anise': '⭐',
  'nutmeg': '🫘',
  'paprika': '🟠',
  'chili powder': '🌶️',
  'red chili powder': '🌶️',
  'garam masala': '🫘',
  'curry powder': '🟠',
  
  // Herbs
  'basil': '🌿',
  'cilantro': '🌿',
  'coriander leaves': '🌿',
  'parsley': '🌿',
  'mint': '🌿',
  'mint leaves': '🌿',
  'oregano': '🌿',
  'thyme': '🌿',
  'rosemary': '🌿',
  'sage': '🌿',
  'dill': '🌿',
  
  // Liquids
  'water': '💧',
  'oil': '🛢️',
  'vegetable oil': '🛢️',
  'olive oil': '🛢️',
  'coconut oil': '🛢️',
  'mustard oil': '🛢️',
  'vinegar': '🫗',
  'lemon juice': '🍋',
  'lime juice': '🍋',
  'wine': '🍷',
  'beer': '🍺',
  'stock': '🍲',
  'broth': '🍲',
  'chicken stock': '🍲',
  'vegetable stock': '🍲',
  
  // Grains & Flours
  'rice': '🍚',
  'basmati rice': '🍚',
  'jasmine rice': '🍚',
  'wheat': '🌾',
  'flour': '🌾',
  'all-purpose flour': '🌾',
  'wheat flour': '🌾',
  'bread': '🍞',
  'pasta': '🍝',
  'noodles': '🍜',
  'quinoa': '🌾',
  'oats': '🌾',
  'barley': '🌾',
  
  // Fruits
  'lemon': '🍋',
  'lime': '🍋',
  'apple': '🍎',
  'banana': '🍌',
  'orange': '🍊',
  'mango': '🥭',
  'avocado': '🥑',
  'coconut': '🥥',
  'dates': '🫒',
  'raisins': '🫒',
  
  // Legumes & Nuts
  'lentils': '🫘',
  'dal': '🫘',
  'chickpeas': '🫘',
  'black beans': '🫘',
  'kidney beans': '🫘',
  'almonds': '🥜',
  'cashews': '🥜',
  'peanuts': '🥜',
  'walnuts': '🥜',
  
  // Other
  'sugar': '🍬',
  'honey': '🍯',
  'yogurt': '🥛',
  'coconut milk': '🥛',
  'tomato paste': '🍅',
  'tomato sauce': '🍅',
};

// Function to get category for an ingredient
export function getIngredientCategory(ingredientName: string): keyof typeof CATEGORY_EMOJIS {
  const name = ingredientName.toLowerCase().trim();
  
  // Proteins
  if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || 
      name.includes('lamb') || name.includes('fish') || name.includes('salmon') || 
      name.includes('tuna') || name.includes('shrimp') || name.includes('prawn') || 
      name.includes('egg') || name.includes('tofu') || name.includes('paneer')) {
    return 'PROTEINS';
  }
  
  // Vegetables
  if (name.includes('onion') || name.includes('garlic') || name.includes('tomato') || 
      name.includes('potato') || name.includes('carrot') || name.includes('pepper') || 
      name.includes('cucumber') || name.includes('broccoli') || name.includes('corn') || 
      name.includes('mushroom') || name.includes('lettuce') || name.includes('spinach') || 
      name.includes('cabbage') || name.includes('eggplant') || name.includes('zucchini') || 
      name.includes('ginger') || name.includes('chili') || name.includes('beans') || 
      name.includes('peas')) {
    return 'VEGETABLES';
  }
  
  // Dairy
  if (name.includes('milk') || name.includes('cheese') || name.includes('butter') || 
      name.includes('yogurt') || name.includes('yoghurt') || name.includes('cream') || 
      name.includes('ghee')) {
    return 'DAIRY';
  }
  
  // Spices
  if (name.includes('salt') || name.includes('pepper') || name.includes('cumin') || 
      name.includes('turmeric') || name.includes('coriander') || name.includes('cardamom') || 
      name.includes('cinnamon') || name.includes('cloves') || name.includes('mustard') || 
      name.includes('fenugreek') || name.includes('fennel') || name.includes('masala') || 
      name.includes('curry powder') || name.includes('paprika') || name.includes('chili powder')) {
    return 'SPICES';
  }
  
  // Herbs
  if (name.includes('basil') || name.includes('cilantro') || name.includes('parsley') || 
      name.includes('mint') || name.includes('oregano') || name.includes('thyme') || 
      name.includes('rosemary') || name.includes('sage') || name.includes('dill') || 
      name.includes('bay leaf') || name.includes('curry leaf')) {
    return 'HERBS';
  }
  
  // Liquids
  if (name.includes('water') || name.includes('oil') || name.includes('vinegar') || 
      name.includes('juice') || name.includes('wine') || name.includes('beer') || 
      name.includes('stock') || name.includes('broth')) {
    return 'LIQUIDS';
  }
  
  // Grains
  if (name.includes('rice') || name.includes('wheat') || name.includes('flour') || 
      name.includes('bread') || name.includes('pasta') || name.includes('noodles') || 
      name.includes('quinoa') || name.includes('oats') || name.includes('barley')) {
    return 'GRAINS';
  }
  
  // Fruits
  if (name.includes('lemon') || name.includes('lime') || name.includes('apple') || 
      name.includes('banana') || name.includes('orange') || name.includes('mango') || 
      name.includes('avocado') || name.includes('coconut') || name.includes('dates') || 
      name.includes('raisins')) {
    return 'FRUITS';
  }
  
  return 'OTHER';
}

// Function to get emoji for an ingredient
export function getIngredientEmoji(ingredientName: string): string {
  const name = ingredientName.toLowerCase().trim();
  
  // Check exact matches first
  if (INGREDIENT_EMOJIS[name]) {
    return INGREDIENT_EMOJIS[name];
  }
  
  // Check partial matches
  for (const [key, emoji] of Object.entries(INGREDIENT_EMOJIS)) {
    if (name.includes(key) || key.includes(name)) {
      return emoji;
    }
  }
  
  // Fallback to category emoji
  const category = getIngredientCategory(ingredientName);
  return CATEGORY_EMOJIS[category];
}

// Function to get both category and ingredient emoji
export function getIngredientEmojis(ingredientName: string): { category: string; ingredient: string } {
  const category = getIngredientCategory(ingredientName);
  const categoryEmoji = CATEGORY_EMOJIS[category];
  const ingredientEmoji = getIngredientEmoji(ingredientName);
  
  return {
    category: categoryEmoji,
    ingredient: ingredientEmoji,
  };
}
