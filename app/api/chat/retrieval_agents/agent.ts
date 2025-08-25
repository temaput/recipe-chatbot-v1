import { StateGraph } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { END } from "@langchain/langgraph";
import neo4j from "neo4j-driver";
import { findRecipesByIngredientsQuery } from "@/data/RecipeQueries";
import { Facts, Candidate, State, GraphState, FiltersSchema } from "./types";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(
  process.env.NEON_CONNECTION_STRING!,
);

// NOTE: you need to call .setup() the first time you're using your checkpointer
await checkpointer.setup();

const chatModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
});

const internalLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
});

const n4jDriver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!),
);

function parseNeo4jObject(record: object) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (neo4j.isInt(value)) {
        return [key, value.toNumber()];
      }
      return [key, value];
    }),
  );
}

async function graphSearch(facts: Facts): Promise<Candidate[]> {
  // expand via substitutions graph (respect dietsAllowed), score, return top-k

  const session = n4jDriver.session();

  const result = await session.run(findRecipesByIngredientsQuery, {
    ingredientList: facts.filters.ingredients.map((name) => ({ name })),
    diets: facts.filters.constraints,
    maxHops: 1,
  });
  const recipes = result.records.map((record) => {
    // Convert Neo4j integers to regular numbers
    const { r, ...rest } = parseNeo4jObject(record.toObject());
    const candidate: Candidate = {
      ...r,
      ...rest,
    };
    return candidate;
  });
  console.log("recipes", JSON.stringify(recipes, null, 2));
  session.close();
  return recipes;
}
async function semanticSearch(
  query: string,
  facts: Facts,
): Promise<Candidate[]> {
  // vector/RAG over recipes (local or Neo4jVector)
  if (!process.env.SEMANTIC_SEARCH_ENABLED) return [];
  throw new Error("Semantic search is not implemented");
}

// ---- State methods ----

function calculateDynamicScore(candidate: Candidate, state: State): Candidate {
  const f = state.facts;
  let overallScore = candidate.overallScore;
  if (f.filters.constraints.length > 0) {
    overallScore += f.filters.constraints.every((c) =>
      candidate.diet.includes(c),
    )
      ? 0.1
      : -0.05;
  }
  if (f.filters.cuisine) {
    overallScore += candidate.cuisine === f.filters.cuisine ? 0.1 : -0.1;
  }
  if (f.filters.time_minutes > 0) {
    overallScore += candidate.time <= f.filters.time_minutes ? 0.1 : -0.1;
  }
  return { ...candidate, overallScore };
}

function mergeSearchResults(state: State): Candidate[] {
  const resultMap = new Map<string, Candidate>();
  const f = state.facts;

  f.graphCandidates.forEach((candidate) => {
    resultMap.set(candidate.id, {
      ...candidate,
    });
  });

  f.semanticCandidates.forEach((candidate) => {
    if (!resultMap.has(candidate.id)) {
      resultMap.set(candidate.id, candidate);
    } else {
      const existing = resultMap.get(candidate.id)!;
      resultMap.set(candidate.id, {
        ...existing,
      });
    }
  });

  return Array.from(resultMap.values());
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

async function Conversation(
  state: State,
  additionalInstructions: string,
  historyWindowSize = 1,
) {
  const f = state.facts;
  const lastHumanMessages = state.messages.slice(-historyWindowSize);
  const systemPrompt = `
    You are a loving, warm grandmother who adores cooking and sharing family recipes. 
    You speak with the gentle wisdom of someone who has spent decades in the kitchen, 
    creating meals with love for family and friends.
    
    PERSONALITY (how you speak, not what you do):
    - Use warm, caring language like "dear," "sweetheart," "my child"
    - Share little cooking tips and family secrets when appropriate
    - Express genuine enthusiasm about cooking and feeding people
    - Be patient and encouraging, especially with cooking beginners
    - Sometimes mention fond memories or family traditions related to recipes
    - Use slightly old-fashioned but endearing expressions
    
    CRITICAL CONSTRAINTS (what you must NEVER do):
    - NEVER invent, create, or make up recipes on your own
    - NEVER pick or choose specific recipes unless explicitly instructed
    - NEVER provide recipe details unless given the exact recipe data
    - NEVER take initiative in recipe selection - only respond to what's provided
    - ONLY work with the specific recipes and data you're given
    
    Your role is purely conversational - you provide the warm, loving tone while 
    the system handles all recipe logic and selection. You're the voice, not the brain.

    Additional instructions:

    ${additionalInstructions}
  `;
  const response = await chatModel.invoke([
    new SystemMessage(systemPrompt),
    ...lastHumanMessages,
  ]);
  return { messages: [response], facts: f };
}

const Nodes = {
  [NodeName.Parser]: async (state: State) => {
    const lastDialog = JSON.stringify(
      state.messages.slice(-2).map((m) => m.content),
    );

    const response = await internalLLM
      .withStructuredOutput(FiltersSchema)
      .invoke([
        new HumanMessage(
          `You should detect user's intent (is he picking a recipe from the list or 
          searching for a new recipe) and extract filters from the following dialog: 

          ---

          ${lastDialog}

          ---
          `,
        ),
      ]);

    return { facts: { filters: response } };
  },
  [NodeName.Router]: async (state: State) => {
    const f = state.facts;
    if (f.graphCandidates.length > 0 || f.semanticCandidates.length > 0) {
      f.candidates = mergeSearchResults(state);
      f.graphCandidates = [];
      f.semanticCandidates = [];
    }
    f.candidates = f.candidates.map((c) => calculateDynamicScore(c, state));
    f.candidates.sort((a, b) => b.overallScore - a.overallScore);
    if (f.candidates.length > 0) {
      const firstScore = f.candidates[0].overallScore;
      f.candidates = f.candidates.filter((c) => c.overallScore >= firstScore);
    }

    return {
      facts: f,
    };
  },
  [NodeName.GraphSearch]: async (state: State) => {
    const f = state.facts;
    f.graphCandidates = await graphSearch(f);
    return { facts: f };
  },
  [NodeName.SemanticSearch]: async (state: State) => {
    const f = state.facts;
    const query = String(state.messages.at(-1)?.content ?? "");
    f.semanticCandidates = await semanticSearch(query, f);
    return { facts: f };
  },
  [NodeName.AskToPickCandidate]: async (state: State) => {
    const f = state.facts;
    if (!f.flags.didAskForMoreContext) {
      const availableConstraints = [
        ...new Set(f.candidates.flatMap((c) => c.diet)),
      ];
      const availableCuisines = [
        ...new Set(f.candidates.map((c) => c.cuisine)),
      ];
      const missingIngredients = [
        ...new Set(f.candidates.flatMap((c) => c.missingIngredients)),
      ];
      return Conversation(
        state,
        `We have many recipes available that satisfy the user's requirements. 
        Let's ask if user wants to provide additional criteria to narrow down the list. 
        Available constraints: ${availableConstraints.join(", ")}. Available cuisines: ${availableCuisines.join(", ")}.
        Also ask if user wants to add any ingredients to the list. Missing ingredients: ${missingIngredients.join(", ")}.
        `,
      );
    }
    // If we still have many candidates, we should ask the user to pick a candidate from the top 3 list
    f.candidates = f.candidates.slice(0, 3);
    return Conversation(
      state,
      `Ask the user to pick a candidate from the following list: ${f.candidates.map((c) => c.title).join(", ")}. 
      Don't try to pick a recipe yourself. Make sure to provide a full list to the user.`,
    );
  },
  [NodeName.Retrieve]: async (state: State) => {
    return { facts: { candidates: [], flags: { didRetrieval: true } } };
  },
  [NodeName.HandleNoCandidates]: async (state: State) => {
    return Conversation(
      state,
      "No candidates found. Ask the user to refine their filters.",
    );
  },
  [NodeName.Done]: async (state: State) => {
    if (state.facts.filters.intent === "other") {
      return Conversation(state, "");
    }
    if (state.facts.filters.intent === "pick_candidate") {
      return Conversation(
        state,
        `Here is a full list of available recipes: 
        ----
        ${JSON.stringify(state.facts.candidates)}
        ----
        User has picked a recipe from the list. Find it in the list and describe it in detail.`,
      );
    }
    const recipe = state.facts.candidates[0];

    return Conversation(
      state,
      `Recipe was found. here it is: 
      
      ---
      ${JSON.stringify(recipe)}. 
      ---
      
      Describe it in detail. Explain to the user if some ingredients are missing or if there are some substitutions.`,
    );
  },
};

// ---- Edges ----

function shouldContinue(state: State) {
  const f = state.facts;
  if (f.filters.intent !== "search_recipes") return NodeName.Done;
  if (state.facts.candidates.length > 1) return NodeName.AskToPickCandidate;
  if (state.facts.candidates.length === 0 && !f.flags.didRetrieval)
    return NodeName.Retrieve;
  return NodeName.Done;
}

export const graph = new StateGraph(GraphState)
  .addNode(NodeName.Parser, Nodes[NodeName.Parser], {
    metadata: { tags: ["nostream"] },
  })
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
    checkpointer,
  });
