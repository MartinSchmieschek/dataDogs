/**
 * Reduzierte Base-Dog- und Pact-Registry für NODE_ENV=production und integration.
 * Lädt nur Pakete, die Seeds + StartupTest brauchen (weniger Heap als fullRegistry).
 * Lokal unter NODE_ENV=development wird stattdessen fullRegistry geladen.
 * @see server-registries/fullRegistry.ts für die volle Liste.
 */
import { QueryRetriever, BodyRetriever, JsonStorageRetriever, WebSocketChannelRetriever, ChannelLiveSnippetRetriever } from '@datadogs/core';
import {
    RandomRecipesRetriever,
    RandomEveryThingRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
} from '@datadogs/dogs-demo';
import { TalkingDog, LayoutInputPact } from '@datadogs/dogs-talking';
import { WarframeAlertsRetriever } from '@datadogs/dogs-warframe';
import {
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
    TrailRetriever,
    TrailQueryPact,
} from '@datadogs/dogs-geo';
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

export const allBaseDogClasses = [
    TalkingDog,
    RandomRecipesRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
    RandomEveryThingRetriever,
    QueryRetriever,
    BodyRetriever,
    WarframeAlertsRetriever,
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
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
    JsonStorageRetriever,
    WebSocketChannelRetriever,
    ChannelLiveSnippetRetriever,
] as const;

export const allPacts = [
    LayoutInputPact,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
    PublicTransportQueryPact,
    WeatherQueryPact,
    AirQualityQueryPact,
    GeocodingQueryPact,
    WikiNearbyQueryPact,
    SunQueryPact,
    BiodiversityQueryPact,
    BirdQueryPact,
    PhenologyQueryPact,
    WebcamQueryPact,
    RegionalNewsQueryPact,
    TransitTripQueryPact,
    ElevationQueryPact,
    TrailQueryPact,
] as const;

/** Registrierte Kurznamen (constructor.name) — Abgleich mit `BASE_DOG_PREFIX + '…'` in seed-data. */
export const INTEGRATION_BASE_DOG_NAMES: readonly string[] = [
    ...allBaseDogClasses.map((C) => C.name),
    ...allPacts.map((C) => C.name),
] as const;
