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
    OsmTracksRetriever: '\uD83E\uDD7E',
    OsmVegetationRetriever: '\uD83C\uDF33',
    OsmFastRoadsRetriever: '\uD83D\uDEE3\uFE0F',
    HueBridgeEnvRetriever: '\uD83D\uDD10',
    HuePlaygroundRetriever: '\uD83D\uDCA1',
    PublicTransportRetriever: '\uD83D\uDE8C',
    WeatherRetriever: '\u26C5',
    AirQualityRetriever: '\uD83C\uDF2B\uFE0F',
    GeocodingRetriever: '\uD83D\uDCCD',
    WikiNearbyRetriever: '\uD83D\uDCDA',
    SunRetriever: '\u2600\uFE0F',
    SpeciesRetriever: '\uD83E\uDD8E',
    BirdRetriever: '\uD83E\uDD86',
    PhenologyRetriever: '\uD83C\uDF38',
    WebcamRetriever: '\uD83D\uDCF7',
    RegionalNewsRetriever: '\uD83D\uDCF0',
    TransitTripRetriever: '\uD83D\uDE82',
    ElevationRetriever: '\u26F0\uFE0F',
    TrailRetriever: '\uD83E\uDDB6',
    ParkingRetriever: '\uD83C\uDD7F\uFE0F',
    PlaygroundRetriever: '\uD83C\uDFA0',
    DrinkingWaterRetriever: '\uD83D\uDEB0',
    ChargingStationRetriever: '\u26A1',
    NoiseRetriever: '\uD83D\uDD07',
    OpenFoodRetriever: '\uD83C\uDF54',
    AstronomyRetriever: '\uD83C\uDF19',
    WaterRetriever: '\uD83C\uDF0A',
    HistoricalWeatherRetriever: '\uD83D\uDCC5',
    CurrencyRetriever: '\uD83D\uDCB1',
    HolidayRetriever: '\uD83C\uDF89',
    WikiSearchRetriever: '\uD83D\uDD0E',
    SeasonRetriever: '\uD83C\uDF43',
    IPGeoRetriever: '\uD83C\uDF10',
    RandomFactRetriever: '\uD83E\uDD14',
    SpaceRetriever: '\uD83D\uDE80',
    OpenLibraryRetriever: '\uD83D\uDCDA',
    GitHubTrendingRetriever: '\uD83D\uDC19',
};

/** Look up a hound's sigil by its class name -- returns undefined if the hound be unmarked */
export function getBaseDogIcon(className: string): string | undefined {
    return BASE_DOG_ICONS[className];
}
