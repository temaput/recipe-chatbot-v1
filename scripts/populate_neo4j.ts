import dotenv from "dotenv";

dotenv.config();
import neo4j from "neo4j-driver";
import { OpenAI } from "openai";
import { DEFAULT_RECIPIES } from "../data/DefaultRecipies";
import { SUBSTITUTIONS } from "../data/Substitutions";

const uri = process.env.NEO4J_URI!;
const user = process.env.NEO4J_USERNAME!;
const password = process.env.NEO4J_PASSWORD!;
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const recipes = DEFAULT_RECIPIES;
const subs = SUBSTITUTIONS;

// Function to generate embeddings for text
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(`Error generating embedding for text: ${text}`, error);
    throw error;
  }
}

// Function to create recipe text for embedding
function createRecipeEmbeddingText(recipe: any): string {
  const ingredients = recipe.ingredients.map((ing: any) => ing.name).join(", ");
  const steps = recipe.steps.join(". ");
  const dietInfo = recipe.diet ? recipe.diet.join(", ") : "";
  
  return `${recipe.title}. ${recipe.cuisine || ""} cuisine. ${dietInfo ? `Diet: ${dietInfo}.` : ""} Ingredients: ${ingredients}. Steps: ${steps}`;
}

// Function to normalize ingredient name for fuzzy search
function normalizeIngredientName(ingredientName: string): string {
  return ingredientName.toLowerCase()
    .replace(/\b(fresh|dried|chopped|sliced|diced|minced|grated|ground|whole|organic|free-range|extra virgin)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  const session = driver.session();

  // 0) Optional wipe
  if (process.env.WIPE === "true") {
    await session.run(`MATCH (n) DETACH DELETE n`);
  }

  // 1) Constraints (id/name uniqueness)
  await session.run(
    `CREATE CONSTRAINT IF NOT EXISTS FOR (r:Recipe) REQUIRE r.id IS UNIQUE`,
  );
  await session.run(
    `CREATE CONSTRAINT IF NOT EXISTS FOR (i:Ingredient) REQUIRE i.name IS UNIQUE`,
  );
  await session.run(
    `CREATE CONSTRAINT IF NOT EXISTS FOR (d:Diet) REQUIRE d.name IS UNIQUE`,
  );

  // 1.5) Create vector indexes for embeddings
  try {
    await session.run(
      `CREATE VECTOR INDEX recipe_embeddings IF NOT EXISTS
       FOR (r:Recipe) ON (r.embedding)
       OPTIONS {
         indexConfig: {
           \`vector.dimensions\`: 1536,
           \`vector.similarity_function\`: 'cosine'
         }
       }`,
    );
    console.log("Created recipe embeddings vector index");
  } catch (error) {
    console.log("Recipe embeddings vector index may already exist or Neo4j version doesn't support vector indexes");
  }

  // Create fuzzy search index for ingredients
  try {
    await session.run(
      `CREATE FULLTEXT INDEX ingredient_fuzzy_search IF NOT EXISTS
       FOR (i:Ingredient) ON EACH [i.name, i.normalized_name]`,
    );
    console.log("Created ingredient fuzzy search index");
  } catch (error) {
    console.log("Ingredient fuzzy search index may already exist");
  }

  // 2) Upsert Diets from recipes
  const allDietNames = new Set<string>();
  recipes.forEach((r) =>
    (r.diet || []).forEach((d: string) => allDietNames.add(d)),
  );
  for (const name of allDietNames) {
    await session.run(`MERGE (:Diet {name: $name})`, { name });
  }

  // 3) Upsert Ingredients + Recipes + REQUIRES edges
  for (const r of recipes) {
    console.log(`Processing recipe: ${r.title}`);
    
    // Generate embedding for recipe
    const recipeText = createRecipeEmbeddingText(r);
    const recipeEmbedding = await generateEmbedding(recipeText);
    
    await session.run(
      `MERGE (rec:Recipe {id:$id})
       SET rec.title=$title, rec.cuisine=$cuisine, rec.time_minutes=$time, rec.steps=$steps, rec.diet=$diet, rec.embedding=$embedding`,
      {
        id: r.id,
        title: r.title,
        cuisine: r.cuisine ?? null,
        time: r.time_minutes,
        steps: r.steps,
        diet: r.diet || [],
        embedding: recipeEmbedding,
      },
    );

    // Diet links
    await session.run(
      `MATCH (rec:Recipe {id:$id})
       UNWIND $diet AS dn
       MATCH (d:Diet {name: dn})
       MERGE (rec)-[:HAS_DIET]->(d)`,
      { id: r.id, diet: r.diet || [] },
    );

    // Ingredients + REQUIRES
    for (const ing of r.ingredients) {
      const name = String(ing.name).toLowerCase();
      const normalizedName = normalizeIngredientName(name);
      
      await session.run(
        `MERGE (i:Ingredient {name:$name})
         SET i.normalized_name=$normalizedName`,
        { 
          name, 
          normalizedName
        }
      );
      
      await session.run(
        `MATCH (rec:Recipe {id:$rid}), (i:Ingredient {name:$name})
         MERGE (rec)-[rel:REQUIRES]->(i)
         SET rel.optional = coalesce($optional,false), rel.amount = $amount`,
        {
          rid: r.id,
          name,
          optional: !!ing.optional,
          amount: ing.amount ?? null,
        },
      );
    }
  }

  // 4) Substitutions (directed edges with properties)
  for (const s of subs) {
    const from = String(s.from).toLowerCase();
    const fromNormalized = normalizeIngredientName(from);
    
    await session.run(
      `MERGE (src:Ingredient {name:$from})
       SET src.normalized_name=$normalizedName`,
      { 
        from, 
        normalizedName: fromNormalized
      }
    );
    
    for (const toName of s.to) {
      const to = String(toName).toLowerCase();
      const toNormalized = normalizeIngredientName(to);
      
      await session.run(
        `MERGE (dst:Ingredient {name:$to})
         SET dst.normalized_name=$normalizedName`,
        { 
          to, 
          normalizedName: toNormalized
        }
      );
      
      await session.run(
        `MATCH (src:Ingredient {name:$from}),(dst:Ingredient {name:$to})
         MERGE (src)-[r:SUBS]->(dst)
         SET r.quality=$quality, r.ratio=$ratio, r.dietsAllowed=$diets, r.notes=$notes`,
        {
          from,
          to,
          quality: s.quality ?? 1,
          ratio: s.ratio ?? null,
          diets: s.diets ?? [],
          notes: s.notes ?? null,
        },
      );
    }
  }

  await session.close();
  await driver.close();
  console.log("Seeding complete with recipe embeddings and ingredient fuzzy search!");
  console.log(`Processed ${recipes.length} recipes and ${subs.length} substitution groups.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
