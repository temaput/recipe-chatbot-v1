export const findRecipesByIngredientsQuery = `
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
LIMIT 5;
`;

export const findSubstitutesByIngredientsQuery = `
WITH $ingredientList AS missingIngredients, $diets AS dietaryRestrictions

// Find missing ingredients using fuzzy search - get best match for each
UNWIND missingIngredients AS missingIngredient
CALL db.index.fulltext.queryNodes('ingredient_fuzzy_search', missingIngredient.name + "~") 
YIELD node AS candidateIngredient, score
WHERE score > 0.5
WITH missingIngredient, candidateIngredient, score, dietaryRestrictions
ORDER BY missingIngredient.name, score DESC
WITH missingIngredient, collect(candidateIngredient)[0] AS matchedMissingIngredient, collect(score)[0] AS score, dietaryRestrictions
WHERE matchedMissingIngredient IS NOT NULL

// Find ingredients that can substitute for the missing ingredients
MATCH (matchedMissingIngredient)-[sub:SUBS]->(substitute:Ingredient)
WHERE (size(dietaryRestrictions) = 0 OR size(sub.dietsAllowed) = 0) 
   OR any(d IN sub.dietsAllowed WHERE d IN dietaryRestrictions)

// Calculate combined score and order by it
WITH missingIngredient, matchedMissingIngredient, substitute, sub, score, dietaryRestrictions,
     (score * sub.quality) AS combinedScore
ORDER BY missingIngredient.name, combinedScore DESC

// Group substitutes by missing ingredient
WITH missingIngredient.name AS originalMissingIngredient,
     matchedMissingIngredient.name AS missingIngredientName,
     collect({
       substituteIngredient: substitute {.*},
       substitutionQuality: sub.quality,
       ratio: sub.ratio,
       dietsAllowed: sub.dietsAllowed,
       similarity: score,
       combinedScore: combinedScore
     })[0..5] AS topSubstitutes,
     count(*) AS totalSubstitutesFound
     
RETURN originalMissingIngredient,
       missingIngredientName,
       topSubstitutes,
       totalSubstitutesFound
ORDER BY originalMissingIngredient;
`;

export const semanticSearchQuery = `
      CALL db.index.vector.queryNodes('recipe_embeddings', $limit, $queryVector)
      YIELD node AS r, score
      WHERE score >= $threshold
        AND (size($diets) = 0 OR any(d IN $diets WHERE (r)-[:HAS_DIET]->(:Diet {name: d})))
        AND ($maxTime = 0 OR r.time_minutes <= $maxTime)
      
      // Get all ingredients for scoring
      OPTIONAL MATCH (r)-[:REQUIRES]->(ingredient:Ingredient)
      WITH r, score, collect(ingredient.name) AS allIngredients
      
      // Calculate basic compatibility scores
      WITH r, score, allIngredients,
           size(allIngredients) AS totalRequiredIngredients,
           0 AS satisfiedIngredients,
           0.1 AS satisfactionRatio,
           score AS avgCombinedScore,
           allIngredients AS missingIngredients,
           [] AS ingredientMatches
      
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
    `;