"""Ingredient emoji mapping for visual anchors."""

# Category emojis
CATEGORY_EMOJIS = {
    "PROTEINS": "🔴",      # Red
    "SPICES": "🟠",        # Orange
    "VEGETABLES": "🟢",    # Green
    "DAIRY": "🟡",         # Yellow
    "HERBS": "🟤",         # Brown/Teal
    "LIQUIDS": "🔵",       # Blue
    "GRAINS": "⚪",        # White (for grains, flour, etc.)
    "FRUITS": "🟣",        # Purple (for fruits)
    "OTHER": "⚫",         # Black (for other items)
}

# Ingredient name to emoji mapping
INGREDIENT_EMOJIS = {
    # Vegetables
    "onion": "🧅",
    "onions": "🧅",
    "garlic": "🧄",
    "tomato": "🍅",
    "tomatoes": "🍅",
    "potato": "🥔",
    "potatoes": "🥔",
    "carrot": "🥕",
    "carrots": "🥕",
    "bell pepper": "🫑",
    "bell peppers": "🫑",
    "pepper": "🫑",
    "peppers": "🫑",
    "cucumber": "🥒",
    "cucumbers": "🥒",
    "broccoli": "🥦",
    "corn": "🌽",
    "mushroom": "🍄",
    "mushrooms": "🍄",
    "lettuce": "🥬",
    "spinach": "🥬",
    "cabbage": "🥬",
    "eggplant": "🍆",
    "aubergine": "🍆",
    "zucchini": "🥒",
    "courgette": "🥒",
    "ginger": "🫚",
    "chili": "🌶️",
    "chili pepper": "🌶️",
    "chilies": "🌶️",
    "chillies": "🌶️",
    "green beans": "🫛",
    "peas": "🫛",
    
    # Proteins
    "chicken": "🍗",
    "chicken breast": "🍗",
    "chicken thigh": "🍗",
    "chicken leg": "🍗",
    "chicken wings": "🍗",
    "beef": "🥩",
    "pork": "🥩",
    "lamb": "🥩",
    "fish": "🐟",
    "salmon": "🐟",
    "tuna": "🐟",
    "shrimp": "🦐",
    "prawns": "🦐",
    "prawn": "🦐",
    "egg": "🥚",
    "eggs": "🥚",
    "tofu": "🫘",
    "paneer": "🧀",
    
    # Dairy
    "milk": "🥛",
    "cheese": "🧀",
    "butter": "🧈",
    "yogurt": "🥛",
    "yoghurt": "🥛",
    "cream": "🥛",
    "sour cream": "🥛",
    "ghee": "🧈",
    
    # Spices & Seasonings
    "salt": "🧂",
    "pepper": "🫘",
    "black pepper": "🫘",
    "cumin": "🫘",
    "cumin seeds": "🫘",
    "turmeric": "🟡",
    "coriander": "🌿",
    "coriander seeds": "🫘",
    "cardamom": "🫘",
    "cinnamon": "🫘",
    "cloves": "🫘",
    "bay leaves": "🌿",
    "bay leaf": "🌿",
    "curry leaves": "🌿",
    "curry leaf": "🌿",
    "mustard seeds": "🫘",
    "fenugreek": "🫘",
    "fennel": "🫘",
    "star anise": "⭐",
    "nutmeg": "🫘",
    "paprika": "🟠",
    "chili powder": "🌶️",
    "red chili powder": "🌶️",
    "garam masala": "🫘",
    "curry powder": "🟠",
    
    # Herbs
    "basil": "🌿",
    "cilantro": "🌿",
    "coriander leaves": "🌿",
    "parsley": "🌿",
    "mint": "🌿",
    "mint leaves": "🌿",
    "oregano": "🌿",
    "thyme": "🌿",
    "rosemary": "🌿",
    "sage": "🌿",
    "dill": "🌿",
    
    # Liquids
    "water": "💧",
    "oil": "🛢️",
    "vegetable oil": "🛢️",
    "olive oil": "🛢️",
    "coconut oil": "🛢️",
    "mustard oil": "🛢️",
    "vinegar": "🫗",
    "lemon juice": "🍋",
    "lime juice": "🍋",
    "wine": "🍷",
    "beer": "🍺",
    "stock": "🍲",
    "broth": "🍲",
    "chicken stock": "🍲",
    "vegetable stock": "🍲",
    
    # Grains & Flours
    "rice": "🍚",
    "basmati rice": "🍚",
    "jasmine rice": "🍚",
    "wheat": "🌾",
    "flour": "🌾",
    "all-purpose flour": "🌾",
    "wheat flour": "🌾",
    "bread": "🍞",
    "pasta": "🍝",
    "noodles": "🍜",
    "quinoa": "🌾",
    "oats": "🌾",
    "barley": "🌾",
    
    # Fruits
    "lemon": "🍋",
    "lime": "🍋",
    "apple": "🍎",
    "banana": "🍌",
    "orange": "🍊",
    "mango": "🥭",
    "avocado": "🥑",
    "coconut": "🥥",
    "dates": "🫒",
    "raisins": "🫒",
    
    # Legumes & Nuts
    "lentils": "🫘",
    "dal": "🫘",
    "chickpeas": "🫘",
    "black beans": "🫘",
    "kidney beans": "🫘",
    "almonds": "🥜",
    "cashews": "🥜",
    "peanuts": "🥜",
    "walnuts": "🥜",
    
    # Other
    "sugar": "🍬",
    "honey": "🍯",
    "coconut milk": "🥛",
    "tomato paste": "🍅",
    "tomato sauce": "🍅",
}


def get_ingredient_category(ingredient_name: str) -> str:
    """Get category for an ingredient."""
    name = ingredient_name.lower().strip()
    
    # Proteins
    if any(x in name for x in ["chicken", "beef", "pork", "lamb", "fish", "salmon", 
                                "tuna", "shrimp", "prawn", "egg", "tofu", "paneer"]):
        return "PROTEINS"
    
    # Vegetables
    if any(x in name for x in ["onion", "garlic", "tomato", "potato", "carrot", "pepper",
                                "cucumber", "broccoli", "corn", "mushroom", "lettuce", 
                                "spinach", "cabbage", "eggplant", "zucchini", "ginger",
                                "chili", "beans", "peas"]):
        return "VEGETABLES"
    
    # Dairy
    if any(x in name for x in ["milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "ghee"]):
        return "DAIRY"
    
    # Spices
    if any(x in name for x in ["salt", "pepper", "cumin", "turmeric", "coriander", 
                                "cardamom", "cinnamon", "cloves", "mustard", "fenugreek",
                                "fennel", "masala", "curry powder", "paprika", "chili powder"]):
        return "SPICES"
    
    # Herbs
    if any(x in name for x in ["basil", "cilantro", "parsley", "mint", "oregano", "thyme",
                                "rosemary", "sage", "dill", "bay leaf", "curry leaf"]):
        return "HERBS"
    
    # Liquids
    if any(x in name for x in ["water", "oil", "vinegar", "juice", "wine", "beer", "stock", "broth"]):
        return "LIQUIDS"
    
    # Grains
    if any(x in name for x in ["rice", "wheat", "flour", "bread", "pasta", "noodles",
                                "quinoa", "oats", "barley"]):
        return "GRAINS"
    
    # Fruits
    if any(x in name for x in ["lemon", "lime", "apple", "banana", "orange", "mango",
                                "avocado", "coconut", "dates", "raisins"]):
        return "FRUITS"
    
    return "OTHER"


def get_ingredient_emoji(ingredient_name: str) -> str:
    """Get emoji for an ingredient."""
    name = ingredient_name.lower().strip()
    
    # Check exact matches first
    if name in INGREDIENT_EMOJIS:
        return INGREDIENT_EMOJIS[name]
    
    # Check partial matches
    for key, emoji in INGREDIENT_EMOJIS.items():
        if key in name or name in key:
            return emoji
    
    # Fallback to category emoji
    category = get_ingredient_category(ingredient_name)
    return CATEGORY_EMOJIS[category]


def get_ingredient_emojis(ingredient_name: str) -> dict[str, str]:
    """Get both category and ingredient emoji."""
    category = get_ingredient_category(ingredient_name)
    category_emoji = CATEGORY_EMOJIS[category]
    ingredient_emoji = get_ingredient_emoji(ingredient_name)
    
    return {
        "category": category_emoji,
        "emoji": ingredient_emoji,
    }
