export const findRecipesByIngredients = `
WITH $ingredientList AS inputIngredients, $diets AS dietaryRestrictions

// Find available ingredients using fuzzy search
UNWIND inputIngredients AS availableIngredient
CALL db.index.fulltext.queryNodes('ingredient_fuzzy_search', availableIngredient.name + "~") 
YIELD node AS matchedAvailableIngredient, score
WHERE score > 0.5

// Use variable-length path to find recipes that can use this ingredient directly OR via substitution
MATCH (r:Recipe)-[:REQUIRES]->(requiredIngredient)<-[:SUBS*0..1]-(usableIngredient)
WHERE usableIngredient = matchedAvailableIngredient
  // Apply dietary restrictions on both recipe and substitution
  AND (size(dietaryRestrictions) = 0 OR any(d IN dietaryRestrictions WHERE (r)-[:HAS_DIET]->(:Diet {name: d})))

// Handle the path to determine match type and quality
WITH r, availableIngredient, matchedAvailableIngredient, requiredIngredient, score,
     CASE 
       WHEN requiredIngredient = usableIngredient THEN 'direct'
       ELSE 'substitute'
     END AS matchType,
     CASE 
       WHEN requiredIngredient = usableIngredient THEN 1.0
       ELSE [(usableIngredient)-[sub:SUBS]->(requiredIngredient) 
             WHERE (size(dietaryRestrictions) = 0 OR size(sub.dietsAllowed) = 0) 
                OR any(d IN sub.dietsAllowed WHERE d IN dietaryRestrictions)
             | sub.quality][0]
     END AS substitutionQuality

WHERE substitutionQuality IS NOT NULL

// Group by recipe and calculate statistics  
WITH r,
     collect(DISTINCT {
       requiredIngredient: requiredIngredient.name,
       sourceIngredient: availableIngredient.name,
       matchType: matchType,
       similarity: score,
       substitutionQuality: substitutionQuality,
       combinedScore: score * substitutionQuality
     }) AS ingredientMatches

// Get all required ingredients for this recipe and find missing ones
WITH r, ingredientMatches,
     [(r)-[:REQUIRES]->(allRequired) | allRequired.name] AS allRequiredIngredients,
     [match IN ingredientMatches | match.requiredIngredient] AS satisfiedIngredientNames

WITH r, ingredientMatches, allRequiredIngredients,
     [ingredient IN allRequiredIngredients WHERE NOT ingredient IN satisfiedIngredientNames] AS missingIngredients,
     size(allRequiredIngredients) AS totalRequiredIngredients,
     size(ingredientMatches) AS satisfiedIngredients,
     (toFloat(size(ingredientMatches)) / size(allRequiredIngredients)) AS satisfactionRatio,
     reduce(sum = 0.0, match IN ingredientMatches | sum + match.combinedScore) / size(ingredientMatches) AS avgCombinedScore

WHERE satisfiedIngredients > 0

RETURN r {.*, embedding: null}, 
       totalRequiredIngredients,
       satisfiedIngredients,
       size(missingIngredients) AS missingIngredientsCount,
       satisfactionRatio,
       avgCombinedScore,
       (satisfactionRatio * avgCombinedScore) AS overallScore,
       ingredientMatches,
       missingIngredients
ORDER BY overallScore DESC
LIMIT 10;
`;

export const getRecipeById = `
MATCH (r:Recipe)
WHERE r.id = $id
RETURN r {.*, embedding: null} AS recipe
`;
