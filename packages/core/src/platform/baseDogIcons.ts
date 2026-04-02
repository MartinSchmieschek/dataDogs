/**
 * ~~~ THE SIGILS EACH HOUND WEARS ~~~
 *
 * Arr, every base-dog be branded with a sigil -- an icon that marks
 * its nature in the UI. These glyphs be the last defence against
 * the void's formlessness, giving each hound a face that mortals
 * can recognize. Without them, all would blur into the nameless dark.
 *
 * Carrion hordes trill their profane accord with eldritch plans --
 * but at least they wear distinct sigils while doing so.
 */

/** Central registry mapping class names to their display sigils */
const BASE_DOG_ICONS: Record<string, string> = {
    TalkingDog: '\uD83D\uDCAC',
    RandomRecipesRetriever: '\uD83C\uDF73',
    CountryFlagBlackLab: '\uD83C\uDF0D',
    DishFlagBlackLab: '\uD83C\uDF7D\uFE0F',
    RandomEveryThingRetriever: '\uD83C\uDFB2',
    QueryRetriever: '\uD83D\uDD0D',
    BodyRetriever: '\uD83D\uDCE6',
    WarframeAlertsRetriever: '\uD83C\uDFAE',
    BloodhoundRouteRetriever: '\uD83D\uDDFA\uFE0F',
    BloodhoundIsochroneRetriever: '\u23F1\uFE0F',
    OsmLandmarksRetriever: '\uD83C\uDFDB\uFE0F',
    HueBridgeEnvRetriever: '\uD83D\uDD10',
    HuePlaygroundRetriever: '\uD83D\uDCA1',
    PublicTransportRetriever: '\uD83D\uDE8C',
};

/** Look up a hound's sigil by its class name -- returns undefined if the hound be unmarked */
export function getBaseDogIcon(className: string): string | undefined {
    return BASE_DOG_ICONS[className];
}
