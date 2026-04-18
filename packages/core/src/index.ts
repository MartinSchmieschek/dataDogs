/**
 * ~~~ THE MANIFEST OF ALL SOULS ABOARD ~~~
 *
 * Arr, here be the ledger of every cursed spirit bound to this vessel.
 * From brooding gulfs are we beheld, by that which bears no name --
 * and yet we name them all the same, catalogued in ink that
 * bleeds through dimensions. Each export be a soul plundered
 * from the deep, pressed into service aboard this accursed ship.
 *
 * To cosmic forms from tangent planes, we end as we began.
 */

// The pacts every hound must honour, and the skeleton they wear
export { IHuntingDog, DogClass } from './core/entities/IHuntingDog';
export { Dog } from './core/entities/abstractHuntingDog';
export { IHuntingSeason, IWaveEntry, IReadTrackingEntry } from './core/entities/IHuntingSeason';

// The captain and the hunt -- orchestration of the abyss
export { KennelRun, IKennelConfig, BASE_DOG_PREFIX, type MimicAdopter } from './KennelRun';
export { isRuntimeLogVerbose } from './runtimeLog';
export {
    KENNEL_RESERVED_SLUGS,
    kennelLineageIdBlockedReason,
    kennelDisplayNameBlockedReason,
} from './kennelReservedNames';
export {
    suggestKennelImportTarget,
    kennelImportNeedsUserChoice,
    isKennelIdTakenInList,
    isKennelNameTakenInList,
    kennelListRef,
    type KennelIdNameListEntry,
} from './kennelImportTarget';
export { SeasonRunner } from './harverster';

// Spirits trapped in code, running in sandboxed voids
export {
    SerializedDog,
    ISerializedDogConfig,
    IUpdateInput,
    type SerializedDogVmGlobalsSupplier,
} from './dogs/SerializedDog';

// Eldritch contracts between hounds
export { createPact, type CreatePactFromSourceOptions } from './dogs/createPact';

// Through endless faces, countless forms -- the shapeshifter
export { MimicDog, IMimicDogConfig } from './dogs/MimicDog';

// The cache pacts -- memory across voyages, dedup of in-flight hunts, area-based geo caching
export { ICacheHandler } from './cache/ICacheHandler';
export { ICacheable, isCacheable } from './cache/ICacheable';
export { IAreaCache, IAreaCacheable, isAreaCacheable, CachedArea, GeoBBox } from './cache/IAreaCache';
export { geoBucketKey, geoBucketCenter, defaultGeoBucketM, type GeoBucketOptions } from './cache/geoBucket';
export { GEO_CACHE_TTL_OSM_MS, GEO_CACHE_TTL_WEATHER_MS, GEO_CACHE_TTL_AIR_QUALITY_MS } from './cache/geoCacheTtl';

// The map-reader, the cargo-bearer, the far-sailing dog, and the sigils they wear
export { QueryRetriever } from './platform/QueryRetriever';
export { BodyRetriever } from './platform/BodyRetriever';
export { FetchBaseDog } from './platform/FetchBaseDog';

// Lobby-Hunde — eine Channel-Id oeffnet eine Lobby; Teilnehmer teilen ein eigenes shared-Objekt
export { WebSocketChannelRetriever } from './socket/WebSocketChannelRetriever';
export { ChannelLiveSnippetRetriever, type LobbyLeadYield } from './socket/ChannelLiveSnippetRetriever';
export type { ChannelPeer, ChannelState, IChannelHub } from './socket/IChannelHub';

// JSON-Ablage — eigene SQLite-Truhe, jsonStore.get/set/delete/list als VM-Globals
export { JsonStorageRetriever, type JsonStorageSnapshot } from './storage/JsonStorageRetriever';
export type { IJsonStorage } from './storage/IJsonStorage';
