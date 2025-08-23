import dotenv from "dotenv";

dotenv.config();
import neo4j from "neo4j-driver";
import { DEFAULT_RECIPIES } from "../data/DefaultRecipies";
import { SUBSTITUTIONS } from "../data/Substitutions";

const uri = process.env.NEO4J_URI!;
const user = process.env.NEO4J_USERNAME!;
const password = process.env.NEO4J_PASSWORD!;
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

const recipes = DEFAULT_RECIPIES;
const subs = SUBSTITUTIONS;

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
    await session.run(
      `MERGE (rec:Recipe {id:$id})
       SET rec.title=$title, rec.cuisine=$cuisine, rec.time_minutes=$time, rec.steps=$steps, rec.diet=$diet`,
      {
        id: r.id,
        title: r.title,
        cuisine: r.cuisine ?? null,
        time: r.time_minutes,
        steps: r.steps,
        diet: r.diet || [],
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
      await session.run(`MERGE (i:Ingredient {name:$name})`, { name });
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
    await session.run(`MERGE (src:Ingredient {name:$from})`, { from });
    for (const toName of s.to) {
      const to = String(toName).toLowerCase();
      await session.run(`MERGE (dst:Ingredient {name:$to})`, { to });
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
  console.log("Seeding complete.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
