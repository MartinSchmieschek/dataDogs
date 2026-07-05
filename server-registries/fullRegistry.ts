/**
 * Volle Base-Dog- und Pact-Registry für development/production.
 * Nur von fullRegistry.ts importieren — nicht in main.ts bündeln, damit Integration weniger Module lädt.
 */
import { QueryRetriever, BodyRetriever, WebSocketChannelRetriever, ChannelLiveSnippetRetriever } from '@datadogs/core';
import {
    RandomRecipesRetriever,
    RandomEveryThingRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
    FoodPornRetriever,
} from '@datadogs/dogs-demo';
import { TalkingDog, LayoutInputPact } from '@datadogs/dogs-talking';
import { WarframeAlertsRetriever } from '@datadogs/dogs-warframe';
import {
    BloodhoundRouteRetriever,
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    OsmTracksRetriever,
    OsmVegetationRetriever,
    OsmFastRoadsRetriever,
    BloodhoundRouteQueryPact,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
    NearbyTracksPact,
    NearbyVegetationPact,
    NearbyFastRoadsPact,
    DrinkingWaterRetriever,
    DrinkingWaterQueryPact,
    OpenFoodRetriever,
    OpenFoodQueryPact,
    NoiseRetriever,
    NoiseQueryPact,
    PlaygroundRetriever,
    PlaygroundQueryPact,
    ParkingRetriever,
    ParkingQueryPact,
    TrailRetriever,
    TrailQueryPact,
} from '@datadogs/dogs-geo';
import { HuePlaygroundRetriever, HueBridgeEnvRetriever, HueBridgeQueryPact } from '@datadogs/dogs-hue';
import { PublicTransportRetriever, PublicTransportQueryPact } from '@datadogs/dogs-public-transport';
import { WeatherRetriever, WeatherQueryPact } from '@datadogs/dogs-weather';
import { AirQualityRetriever, AirQualityQueryPact } from '@datadogs/dogs-air-quality';
import { GeocodingRetriever, GeocodingQueryPact, ElevationRetriever, ElevationQueryPact } from '@datadogs/dogs-geocoding';
import { WikiNearbyRetriever, WikiNearbyQueryPact } from '@datadogs/dogs-wikipedia';
import { SunRetriever, SunQueryPact } from '@datadogs/dogs-sun';
import { SpeciesRetriever, BiodiversityQueryPact } from '@datadogs/dogs-biodiversity';
import { BirdRetriever, BirdQueryPact } from '@datadogs/dogs-birds';
import { PhenologyRetriever, PhenologyQueryPact } from '@datadogs/dogs-phenology';
import { WebcamRetriever, WebcamQueryPact } from '@datadogs/dogs-webcams';
import { RegionalNewsRetriever, RegionalNewsQueryPact } from '@datadogs/dogs-regional-news';
import { TransitTripRetriever, TransitTripQueryPact } from '@datadogs/dogs-transit-trips';
import { AstronomyRetriever, AstronomyQueryPact } from '@datadogs/dogs-astronomy';
import { WaterRetriever, WaterQueryPact } from '@datadogs/dogs-water';
import { HistoricalWeatherRetriever, HistoricalWeatherQueryPact } from '@datadogs/dogs-historical-weather';
import { ChargingStationRetriever, ChargingQueryPact } from '@datadogs/dogs-charging';
import { CurrencyRetriever, CurrencyQueryPact } from '@datadogs/dogs-currency';
import { HolidayRetriever, HolidayQueryPact } from '@datadogs/dogs-holidays';
import { WikiSearchRetriever, WikiSearchQueryPact } from '@datadogs/dogs-wiki-search';
import { SeasonRetriever, SeasonQueryPact } from '@datadogs/dogs-season';
import { IPGeoRetriever, IPGeoQueryPact } from '@datadogs/dogs-ip-geo';
import { RandomFactRetriever, RandomFactQueryPact } from '@datadogs/dogs-random-fact';
import { SpaceRetriever, SpaceQueryPact } from '@datadogs/dogs-space';
import { OpenLibraryRetriever, OpenLibraryQueryPact } from '@datadogs/dogs-open-library';
import { GitHubTrendingRetriever, GitHubTrendingQueryPact } from '@datadogs/dogs-github-trending';
import { GeoPointPact } from '@datadogs/geo-pact';
import {
    JokeRetriever, JokeQueryPact,
    DadJokeRetriever, DadJokeQueryPact,
    ChuckNorrisRetriever, ChuckNorrisQueryPact,
} from '@datadogs/dogs-humor';
import {
    CatFactRetriever, CatFactQueryPact,
    FoxRetriever, FoxQueryPact,
    DuckRetriever, DuckQueryPact,
} from '@datadogs/dogs-animals-random';
import {
    DictionaryRetriever,
    DatamuseRetriever, DatamuseQueryPact,
    WordQueryPact,
} from '@datadogs/dogs-dictionary';
import {
    QuoteRetriever, QuoteQueryPact,
    GutenbergRetriever, GutenbergQueryPact,
    WikidataRetriever, WikidataQueryPact,
} from '@datadogs/dogs-knowledge';
import {
    StarWarsRetriever, RickMortyRetriever, HarryPotterRetriever, GhibliRetriever,
    PopCultureQueryPact,
} from '@datadogs/dogs-pop-culture';
import {
    MusicBrainzRetriever, MusicBrainzQueryPact,
    LyricsRetriever, LyricsQueryPact,
    RadioBrowserRetriever, RadioBrowserQueryPact,
} from '@datadogs/dogs-music';
import {
    F1Retriever, F1QueryPact,
    SportsDBRetriever, SportsDbQueryPact,
    ChessRetriever, ChessQueryPact,
} from '@datadogs/dogs-sports';
import {
    NpmRetriever, NpmQueryPact,
    StackExchangeRetriever, StackExchangeQueryPact,
    GitHubPublicRetriever, GitHubPublicQueryPact,
} from '@datadogs/dogs-dev';
import {
    AirportRetriever, AirportQueryPact,
    GeoNamesRetriever,
    WikivoyageRetriever, WikivoyageQueryPact,
} from '@datadogs/dogs-travel';
import {
    TriviaRetriever, TriviaQueryPact,
    BoredRetriever, BoredQueryPact,
    RandomUserRetriever, RandomUserQueryPact,
} from '@datadogs/dogs-quiz';
import {
    BibleRetriever, BibleQueryPact,
    QuranRetriever, QuranQueryPact,
} from '@datadogs/dogs-religion';
import {
    DiseaseRetriever, DiseaseQueryPact,
    OpenFdaRetriever, OpenFdaQueryPact,
} from '@datadogs/dogs-health';
import {
    CocktailRetriever, CocktailQueryPact,
    MealRetriever, MealQueryPact,
} from '@datadogs/dogs-cuisine';
import {
    WaybackRetriever, WaybackQueryPact,
} from '@datadogs/dogs-web-archive';
import {
    DogCeoRetriever, DogCeoQueryPact,
    PicsumRetriever, PicsumQueryPact,
    NasaApodRetriever, NasaApodQueryPact,
} from '@datadogs/dogs-images';
import {
    AgifyRetriever,
    NationalizeRetriever,
    GenderizeRetriever,
    NameQueryPact,
} from '@datadogs/dogs-name-insights';
import {
    PokeApiRetriever, PokeApiQueryPact,
    DeckOfCardsRetriever, DeckOfCardsQueryPact,
    ScryfallRetriever, ScryfallQueryPact,
} from '@datadogs/dogs-gaming';
import {
    LibreTranslateRetriever, LibreTranslateQueryPact,
} from '@datadogs/dogs-translate';
import {
    TvMazeRetriever, TvMazeQueryPact,
} from '@datadogs/dogs-tv';
import {
    HackerNewsRetriever, HackerNewsQueryPact,
    LemmyRetriever, LemmyQueryPact,
} from '@datadogs/dogs-social';
import {
    CoinGeckoRetriever, CoinGeckoQueryPact,
} from '@datadogs/dogs-crypto';

export const allBaseDogClasses = [
    TalkingDog,
    RandomRecipesRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
    RandomEveryThingRetriever,
    FoodPornRetriever,
    QueryRetriever,
    BodyRetriever,
    WarframeAlertsRetriever,
    BloodhoundRouteRetriever,
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    OsmTracksRetriever,
    OsmVegetationRetriever,
    OsmFastRoadsRetriever,
    HueBridgeEnvRetriever,
    HuePlaygroundRetriever,
    PublicTransportRetriever,
    WeatherRetriever,
    AirQualityRetriever,
    GeocodingRetriever,
    WikiNearbyRetriever,
    SunRetriever,
    SpeciesRetriever,
    BirdRetriever,
    PhenologyRetriever,
    WebcamRetriever,
    RegionalNewsRetriever,
    TransitTripRetriever,
    ElevationRetriever,
    TrailRetriever,
    AstronomyRetriever,
    WaterRetriever,
    HistoricalWeatherRetriever,
    ChargingStationRetriever,
    NoiseRetriever,
    ParkingRetriever,
    PlaygroundRetriever,
    DrinkingWaterRetriever,
    OpenFoodRetriever,
    CurrencyRetriever,
    HolidayRetriever,
    WikiSearchRetriever,
    SeasonRetriever,
    IPGeoRetriever,
    RandomFactRetriever,
    SpaceRetriever,
    OpenLibraryRetriever,
    GitHubTrendingRetriever,
    WebSocketChannelRetriever,
    ChannelLiveSnippetRetriever,
    JokeRetriever,
    DadJokeRetriever,
    ChuckNorrisRetriever,
    CatFactRetriever,
    FoxRetriever,
    DuckRetriever,
    DictionaryRetriever,
    DatamuseRetriever,
    QuoteRetriever,
    GutenbergRetriever,
    WikidataRetriever,
    StarWarsRetriever,
    RickMortyRetriever,
    HarryPotterRetriever,
    GhibliRetriever,
    MusicBrainzRetriever,
    LyricsRetriever,
    RadioBrowserRetriever,
    F1Retriever,
    SportsDBRetriever,
    ChessRetriever,
    NpmRetriever,
    StackExchangeRetriever,
    GitHubPublicRetriever,
    AirportRetriever,
    GeoNamesRetriever,
    WikivoyageRetriever,
    TriviaRetriever,
    BoredRetriever,
    RandomUserRetriever,
    BibleRetriever,
    QuranRetriever,
    DiseaseRetriever,
    OpenFdaRetriever,
    CocktailRetriever,
    MealRetriever,
    WaybackRetriever,
    DogCeoRetriever,
    PicsumRetriever,
    NasaApodRetriever,
    AgifyRetriever,
    NationalizeRetriever,
    GenderizeRetriever,
    PokeApiRetriever,
    DeckOfCardsRetriever,
    ScryfallRetriever,
    LibreTranslateRetriever,
    TvMazeRetriever,
    HackerNewsRetriever,
    LemmyRetriever,
    CoinGeckoRetriever,
] as const;

export const allPacts = [
    LayoutInputPact, BloodhoundRouteQueryPact, BloodhoundIsochronePact, NearbyLandmarksPact, NearbyTracksPact, NearbyVegetationPact, NearbyFastRoadsPact, HueBridgeQueryPact, PublicTransportQueryPact, WeatherQueryPact, AirQualityQueryPact, GeocodingQueryPact, WikiNearbyQueryPact, SunQueryPact, BiodiversityQueryPact, BirdQueryPact, PhenologyQueryPact, WebcamQueryPact, RegionalNewsQueryPact, TransitTripQueryPact, ElevationQueryPact, TrailQueryPact, AstronomyQueryPact, WaterQueryPact, HistoricalWeatherQueryPact, ChargingQueryPact, NoiseQueryPact, ParkingQueryPact, PlaygroundQueryPact, DrinkingWaterQueryPact, OpenFoodQueryPact, CurrencyQueryPact, HolidayQueryPact, WikiSearchQueryPact, SeasonQueryPact, IPGeoQueryPact, RandomFactQueryPact, SpaceQueryPact, OpenLibraryQueryPact, GitHubTrendingQueryPact, GeoPointPact, JokeQueryPact, DadJokeQueryPact, ChuckNorrisQueryPact, CatFactQueryPact, FoxQueryPact, DuckQueryPact, WordQueryPact, DatamuseQueryPact, QuoteQueryPact, GutenbergQueryPact, WikidataQueryPact, PopCultureQueryPact, MusicBrainzQueryPact, LyricsQueryPact, RadioBrowserQueryPact, F1QueryPact, SportsDbQueryPact, ChessQueryPact, NpmQueryPact, StackExchangeQueryPact, GitHubPublicQueryPact, AirportQueryPact, WikivoyageQueryPact, TriviaQueryPact, BoredQueryPact, RandomUserQueryPact, BibleQueryPact, QuranQueryPact, DiseaseQueryPact, OpenFdaQueryPact, CocktailQueryPact, MealQueryPact, WaybackQueryPact, DogCeoQueryPact, PicsumQueryPact, NasaApodQueryPact, NameQueryPact, PokeApiQueryPact, DeckOfCardsQueryPact, ScryfallQueryPact, LibreTranslateQueryPact, TvMazeQueryPact, HackerNewsQueryPact, LemmyQueryPact, CoinGeckoQueryPact,
] as const;
