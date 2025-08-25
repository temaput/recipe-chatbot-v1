export const SUBSTITUTIONS = [
  // Dairy substitutions for ingredients used in recipes
  {
    from: "cow's milk",
    to: ["oat milk", "almond milk", "soy milk"],
    diets: ["vegan", "dairy_free"],
    ratio: "1:1",
    quality: 3,
    notes: "Use unsweetened for savory dishes.",
  },
  {
    from: "butter",
    to: ["olive oil", "coconut oil"],
    diets: ["vegan", "dairy_free"],
    ratio: "1:1",
    quality: 2,
    notes: "Texture changes in baking.",
  },
  {
    from: "parmesan",
    to: ["nutritional yeast + pinch of salt"],
    diets: ["vegan", "dairy_free"],
    ratio: "to taste",
    quality: 2,
  },
  {
    from: "cheese",
    to: ["plant-based cheese", "nutritional yeast"],
    diets: ["vegan", "dairy_free"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "mozzarella",
    to: ["plant-based mozzarella"],
    diets: ["vegan", "dairy_free"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "feta",
    to: ["plant-based feta", "tofu + lemon juice + salt"],
    diets: ["vegan", "dairy_free"],
    ratio: "1:1",
    quality: 2,
  },

  // Egg substitutions
  {
    from: "eggs",
    to: ["1 tbsp ground flax + 3 tbsp water per egg", "1 tbsp chia + 3 tbsp water per egg"],
    diets: ["vegan"],
    ratio: "1:1",
    quality: 2,
    notes: "Best for binding, not meringues.",
  },

  // Sauce and seasoning substitutions
  {
    from: "soy sauce",
    to: ["tamari", "coconut aminos"],
    diets: ["gluten_free"],
    ratio: "1:1",
    quality: 3,
  },

  // Tortilla substitutions
  {
    from: "corn tortillas",
    to: ["lettuce wraps", "gluten-free tortillas"],
    diets: ["low_carb", "keto"],
    ratio: "1:1",
    quality: 2,
  },

  // Meat substitutions (for when we add meat to recipes)
  {
    from: "ham",
    to: ["smoked tempeh", "smoked mushrooms"],
    diets: ["vegan", "vegetarian"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "chicken breast",
    to: ["seasoned tofu", "cauliflower", "chickpeas"],
    diets: ["vegan", "vegetarian"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "pepperoni",
    to: ["plant-based pepperoni", "spiced tempeh slices"],
    diets: ["vegan", "vegetarian"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "salmon fillet",
    to: ["marinated tofu", "king oyster mushrooms"],
    diets: ["vegan", "vegetarian"],
    ratio: "1:1",
    quality: 1,
  },

  // Oil substitutions
  {
    from: "olive oil",
    to: ["avocado oil", "vegetable oil"],
    diets: [],
    ratio: "1:1",
    quality: 3,
  },
  {
    from: "oil",
    to: ["cooking spray", "vegetable broth for sautéing"],
    diets: ["low_fat"],
    ratio: "1:1",
    quality: 2,
  },

  // Grain substitutions
  {
    from: "spaghetti",
    to: ["gluten-free pasta", "zucchini noodles"],
    diets: ["gluten_free", "low_carb"],
    ratio: "1:1",
    quality: 3,
  },
  {
    from: "quinoa",
    to: ["rice", "cauliflower rice"],
    diets: ["low_carb", "keto"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "arborio rice",
    to: ["cauliflower rice", "quinoa"],
    diets: ["low_carb", "gluten_free"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "bread",
    to: ["gluten-free bread", "lettuce wraps"],
    diets: ["gluten_free", "low_carb"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "croutons",
    to: ["toasted nuts", "gluten-free croutons"],
    diets: ["gluten_free"],
    ratio: "1:1",
    quality: 2,
  },
  {
    from: "pizza dough",
    to: ["cauliflower crust", "gluten-free pizza dough"],
    diets: ["gluten_free", "low_carb"],
    ratio: "1:1",
    quality: 2,
  },
];
