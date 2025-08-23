import {
  StateGraph,
  MessagesAnnotation,
  MemorySaver,
} from "@langchain/langgraph";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { END } from "@langchain/langgraph";
import { DEFAULT_RECIPIES } from "@/data/DefaultRecipies";
import { PromptTemplate } from "@langchain/core/prompts";

const DietSchema = z.enum([
  "vegan",
  "vegetarian",
  "gluten_free",
  "dairy_free",
  "nut_free",
  "halal_friendly",
]);

const FiltersSchema = z.object({
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
    .enum(["search_recipes", "pick_candidate"])
    .describe(
      "the intent of the user: is he picking a recipe from the list or searching for a new recipe",
    ),
});
type Diet = z.infer<typeof DietSchema>;

type Filters = z.infer<typeof FiltersSchema>;
type Candidate = {
  id: string;
  title: string;
  cuisine: string;
  time: number;
  diet: Diet[];
  score: number;
};

type Facts = {
  filters: Filters;
  candidates: Candidate[];
  iterations: number;
};

const GraphState = Annotation.Root({
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
      iterations: 0,
    }),
  }),
});
type State = typeof GraphState.State;

const chatModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
});

async function graphSearch(facts: Facts): Promise<Candidate[]> {
  // expand via substitutions graph (respect dietsAllowed), score, return top-k
  return DEFAULT_RECIPIES.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    time: recipe.time_minutes,
    diet: recipe.diet.map((d) => d as Diet),
    cuisine: recipe.cuisine,
    score: 0,
  }));
}
async function semanticSearch(
  query: string,
  facts: Facts,
): Promise<Candidate[]> {
  // vector/RAG over recipes (local or Neo4jVector)
  return DEFAULT_RECIPIES.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    time: recipe.time_minutes,
    diet: recipe.diet.map((d) => d as Diet),
    cuisine: recipe.cuisine,
    score: 0,
  }));
}

async function getRecipe(id: string) {
  return DEFAULT_RECIPIES.find((r) => r.id === id);
}

// ---- State methods ----

function getScoredCandidates(state: State) {
  const f = state.facts;
  return f.candidates.map((candidate) => {
    let score = 0;
    if (f.filters.constraints.length > 0) {
      score += f.filters.constraints.every((c) => candidate.diet.includes(c))
        ? 1
        : -10;
    }
    if (f.filters.cuisine) {
      score += candidate.cuisine === f.filters.cuisine ? 1 : -1;
    }
    if (f.filters.time_minutes > 0) {
      score += candidate.time <= f.filters.time_minutes ? 1 : -1;
    }
    return { ...candidate, score };
  });
}

// ---- Nodes ----

enum NodeName {
  Parser = "parser",
  Router = "router",
  GraphSearch = "graph_search",
  SemanticSearch = "semantic_search",
  Retrieve = "retrieve",
  AskToPickCandidate = "ask_to_pick_candidate",
  HandleNoCandidates = "handle_no_candidates",

  Done = "done",
}

async function Conversation(state: State, additionalInstructions: string) {
  const f = state.facts;
  const lastHumanMessages = state.messages.slice(-1);
  const systemPrompt = `
    You are a grounded cooking assistant. 
    Maintain dialog with the user to help him find a recipe.
    Never try to pick or bring in the recipe yourself unless specifically instructed.

    Additional instructions:

    ${additionalInstructions}
  `;
  const response = await chatModel.invoke([
    new SystemMessage(systemPrompt),
    ...lastHumanMessages,
  ]);
  return { messages: [response] };
}

const Nodes = {
  [NodeName.Parser]: async (state: State) => {
    const lastMessage = state.messages.at(-1);
    const response = await chatModel
      .withStructuredOutput(FiltersSchema)
      .invoke([
        new HumanMessage(
          `You should detect user's intent (is he picking a recipe from the list or 
          searching for a new recipe) and extract filters from the following message: ${lastMessage?.content}`,
        ),
      ]);

    return { facts: { filters: response } };
  },
  [NodeName.Router]: async (state: State) => {
    return {};
  },
  [NodeName.GraphSearch]: async (state: State) => {
    const f = { ...state.facts, iterations: (state.facts.iterations ?? 0) + 1 };
    f.candidates = await graphSearch(f);
    return { facts: f };
  },
  [NodeName.SemanticSearch]: async (state: State) => {
    const f = { ...state.facts, iterations: (state.facts.iterations ?? 0) + 1 };
    const query = String(state.messages.at(-1)?.content ?? "");
    f.candidates = await semanticSearch(query, f);
    return { facts: f };
  },
  [NodeName.AskToPickCandidate]: async (state: State) => {
    const f = state.facts;
    if (f.filters.constraints.length === 0 && f.filters.cuisine === "") {
      const availableConstraints = [
        ...new Set(f.candidates.flatMap((c) => c.diet)),
      ];
      const availableCuisines = [
        ...new Set(f.candidates.map((c) => c.cuisine)),
      ];
      return Conversation(
        state,
        `We have many recipes available that satisfy the user's requirements. 
        Let's ask if user wants to provide additional criteria to narrow down the list. 
        Available constraints: ${availableConstraints.join(", ")}. Available cuisines: ${availableCuisines.join(", ")}.`,
      );
    }
    return Conversation(
      state,
      `Ask the user to pick a candidate from the following list: ${f.candidates.map((c) => c.title).join(", ")}. 
      Don't try to pick a recipe yourself. Make sure to provide a full list to the user.`,
    );
  },
  [NodeName.Retrieve]: async (state: State) => {
    return {};
  },
  [NodeName.HandleNoCandidates]: async (state: State) => {
    return Conversation(
      state,
      "No candidates found. Ask the user to refine their filters.",
    );
  },
  [NodeName.Done]: async (state: State) => {
    let pickedCandidateIndex = 0;
    if (state.facts.candidates.length > 1) {
      // TODO: User picked a candidate, we need to interpret his choice
    }
    const recipe = await getRecipe(
      state.facts.candidates[pickedCandidateIndex].id,
    );

    return Conversation(
      state,
      `Recipe was found. here it is: 
      
      ---
      ${JSON.stringify(recipe)}. 
      ---
      
      Describe it in detail.`,
    );
  },
};

// ---- Edges ----

function shouldContinue(state: State) {
  const f = state.facts;
  if (f.filters.intent !== "search_recipes") return NodeName.Done;
  if (state.facts.candidates.length > 1) return NodeName.AskToPickCandidate;
  if (state.facts.candidates.length === 0 && f.iterations === 0)
    return NodeName.Retrieve;
  return NodeName.Done;
}

export const graph = new StateGraph(GraphState)
  .addNode(NodeName.Parser, Nodes[NodeName.Parser])
  .addNode(NodeName.Router, Nodes[NodeName.Router])
  .addNode(NodeName.GraphSearch, Nodes[NodeName.GraphSearch])
  .addNode(NodeName.SemanticSearch, Nodes[NodeName.SemanticSearch])
  .addNode(NodeName.AskToPickCandidate, Nodes[NodeName.AskToPickCandidate])
  .addNode(NodeName.HandleNoCandidates, Nodes[NodeName.HandleNoCandidates])
  .addNode(NodeName.Done, Nodes[NodeName.Done])
  .addNode(NodeName.Retrieve, Nodes[NodeName.Retrieve])
  .addEdge("__start__", NodeName.Parser)
  .addEdge(NodeName.Parser, NodeName.Router)
  .addConditionalEdges(NodeName.Router, shouldContinue)
  .addEdge(NodeName.Retrieve, NodeName.GraphSearch)
  .addEdge(NodeName.Retrieve, NodeName.SemanticSearch)
  .addEdge(NodeName.GraphSearch, NodeName.Router)
  .addEdge(NodeName.SemanticSearch, NodeName.Router)
  .addEdge(NodeName.HandleNoCandidates, END)
  .addEdge(NodeName.AskToPickCandidate, END)
  .addEdge(NodeName.Done, END)
  .compile({
    checkpointer: new MemorySaver(),
  });
