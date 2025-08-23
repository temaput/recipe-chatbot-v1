import { z } from "zod";
export type DietTag =
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "dairy_free"
  | "nut_free"
  | "halal_friendly";
export type IngredientQty = {
  name: string;
  amount?: string;
  optional?: boolean;
};
export type Recipe = {
  id: string;
  title: string;
  cuisine?: string;
  diet: DietTag[];
  ingredients: IngredientQty[]; // canonical names
  steps: string[]; // 6–12 short steps
  time_minutes: number; // total est.
  notes?: string[]; // optional tips
};

export type SubRule = {
  from: string; // canonical ingredient
  to: string[]; // 1..N suggestions
  diets?: DietTag[]; // valid for these diets
  ratio?: string; // e.g., "1:1", "1 egg → 1 Tbsp flax + 3 Tbsp water"
  quality: 1 | 2 | 3; // 3=excellent, 1=acceptable
  notes?: string;
};

export const StateZ = z.object({
  userMessage: z.string(),
  parsed: z
    .object({
      ingredients: z.array(z.string()).default([]),
      constraints: z.array(z.string()).default([]),
    })
    .default({ ingredients: [], constraints: [] }),
  retrieved: z.array(z.any()).default([]), // recipe docs
  candidates: z.array(z.any()).default([]),
  final: z.string().optional(), // rendered markdown
  citations: z.array(z.string()).default([]),
});
export type State = z.infer<typeof StateZ>;
