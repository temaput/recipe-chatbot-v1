import { z } from "zod";
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

const DietSchema = z.enum([
  "vegan",
  "vegetarian",
  "gluten_free",
  "dairy_free",
  "nut_free",
  "halal_friendly",
]);

export const FiltersSchema = z.object({
  ingredients: z
    .array(z.string())
    .describe("the ingredients that the user wants to use"),
  constraints: z
    .array(DietSchema)
    .describe("the dietary constraints that the user has"),
  cuisine: z.string().describe("the cuisine that the user wants to use"),
  time_minutes: z
    .number()
    .describe("the time in minutes that the user wants to spend on the recipe"),
  intent: z
    .enum(["search_recipes", "pick_candidate", "search_substitutes", "other"])
    .describe(
      "the intent of the user: is he picking a recipe from the list or searching for a new recipe or searching for substitutes or asking other questions",
    ),
});
type Diet = z.infer<typeof DietSchema>;

type Filters = z.infer<typeof FiltersSchema>;
export type Candidate = {
  id: string;
  title: string;
  cuisine: string;
  time: number;
  diet: Diet[];
  totalRequiredIngredients: number;
  satisfiedIngredients: number;
  satisfactionRatio: number;
  avgCombinedScore: number;
  overallScore: number;
  missingIngredients: string[];
  ingredientMatches: {
    requiredIngredient: string;
    sourceIngredient: string;
    matchType: "direct" | "substitute";
    similarity: number;
    substitutionQuality: number;
    combinedScore: number;
  }[];
};

export type Facts = {
  filters: Filters;
  graphCandidates: Candidate[];
  semanticCandidates: Candidate[];
  candidates: Candidate[];
  flags: { didRetrieval: boolean; didAskForMoreContext: boolean };
  substitutes: object[];
};

export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  facts: Annotation<Facts>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({
      filters: {
        ingredients: [],
        constraints: [],
        cuisine: "",
        time_minutes: 0,
        intent: "search_recipes",
      },
      candidates: [],
      graphCandidates: [],
      semanticCandidates: [],
      flags: { didRetrieval: false, didAskForMoreContext: false },
      substitutes: [],
    }),
  }),
});
export type State = typeof GraphState.State;
