const LEGACY_C2_METHOD_IDS = Object.freeze(['rapid', 'economical', 'high-yield']);

function freezeAlias(recipe, legacyMethodId) {
  const id = `${recipe.id}--${legacyMethodId}`;
  const inputs = Object.freeze((recipe.inputs || []).map((input) => Object.freeze({ ...input })));
  return Object.freeze({
    ...recipe,
    id,
    recipeId: id,
    baseRecipeId: recipe.baseRecipeId || recipe.id,
    productionMethodId: legacyMethodId,
    legacyProductionMethod: true,
    inputs,
    input: inputs.length === 1 ? inputs[0] : null,
    output: Object.freeze({ ...recipe.output }),
  });
}

export function appendLegacyC2RecipeAliases(facility, recipes) {
  if (facility?.complexity !== 'C2') return recipes;
  const baseRecipes = (recipes || []).filter(
    (recipe) => (recipe.productionMethodId || 'standard') === 'standard',
  );
  return Object.freeze([
    ...(recipes || []),
    ...baseRecipes.flatMap((recipe) => (
      LEGACY_C2_METHOD_IDS.map((legacyMethodId) => freezeAlias(recipe, legacyMethodId))
    )),
  ]);
}