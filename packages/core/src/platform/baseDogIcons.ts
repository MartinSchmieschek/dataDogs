/**
 * Zentrale Zuordnung Klassenname → Anzeige-Glyph (z. B. Emoji) für BaseDogs.
 */
const BASE_DOG_ICONS: Record<string, string> = {
    TalkingDog: '💬',
    RandomRecipesRetriever: '🍳',
    CountryFlagBlackLab: '🌍',
    DishFlagBlackLab: '🍽️',
    RandomEveryThingRetriever: '🎲',
    QueryRetriever: '🔍',
    BodyRetriever: '📦',
    WarframeAlertsRetriever: '🎮',
    BloodhoundRouteRetriever: '🗺️',
    BloodhoundIsochroneRetriever: '⏱️',
    OsmLandmarksRetriever: '🏛️',
    HueBridgeEnvRetriever: '🔐',
    HuePlaygroundRetriever: '💡',
};

export function getBaseDogIcon(className: string): string | undefined {
    return BASE_DOG_ICONS[className];
}
