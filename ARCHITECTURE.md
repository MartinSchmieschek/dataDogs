# Architecture Documentation

This documentation describes the architecture of the Data Hunt application, its components, data flows, and execution processes.

## System Overview

The Data Hunt application is an Express.js-based application that organizes data processing units ("Dogs") in configurations ("Kennels") and executes them in dependency order.

## Komponenten-Architektur

```mermaid
graph TB
    subgraph "HTTP Layer"
        Express[Express Server]
        Routes[API Routes]
        UI[UI Routes]
    end
    
    subgraph "Controller Layer"
        NodesController[Controller<br/>SerializedDogs]
        KennelsController[KennelController<br/>KennelConfigs]
        Registry[ControllerRegistry]
    end
    
    subgraph "Business Logic"
        KennelRun[KennelRun<br/>Orchestration]
        SeasonRunner[SeasonRunner<br/>Wave Execution]
        SerializedDog[SerializedDog<br/>VM Code Execution]
        BaseDogs[BaseDogs<br/>Predefined Dogs]
    end
    
    subgraph "Data Layer"
        PrismaStore[PrismaStore<br/>Data Persistence]
        Database[(SQLite Database)]
    end
    
    subgraph "VM Layer"
        VMContext[VM Context<br/>Code Execution]
        ReadTracking[Read Tracking<br/>Data Flow Tracking]
    end
    
    Express --> Routes
    Express --> UI
    Routes --> Registry
    Registry --> NodesController
    Registry --> KennelsController
    UI --> KennelRun
    NodesController --> PrismaStore
    KennelsController --> PrismaStore
    PrismaStore --> Database
    KennelRun --> SeasonRunner
    KennelRun --> SerializedDog
    KennelRun --> BaseDogs
    SeasonRunner --> SerializedDog
    SeasonRunner --> BaseDogs
    SerializedDog --> VMContext
    SerializedDog --> ReadTracking
    SerializedDog --> PrismaStore
```

## Datenfluss-Architektur

### Request-zu-Response Datenfluss

```mermaid
flowchart TD
    Start[HTTP Request] --> Route{Route Type}
    
    Route -->|GET /:kennelId| LoadKennel[Load KennelConfig<br/>from PrismaStore]
    Route -->|GET /api/nodes| ListNodes[List Nodes<br/>BaseDogs + SerializedDogs]
    Route -->|POST /api/nodes| CreateNode[Create SerializedDog]
    
    LoadKennel --> FillKennel[fillKennel<br/>Load/Create Dogs]
    
    FillKennel --> BaseDogCheck{BaseDog?}
    BaseDogCheck -->|Yes| CreateBaseDog[Create BaseDog<br/>Instance]
    BaseDogCheck -->|No| LoadSerializedDog[Load SerializedDog<br/>from PrismaStore]
    
    CreateBaseDog --> AddToKennel[Add to Kennel]
    LoadSerializedDog --> AddToKennel
    
    AddToKennel --> RunSeason[runSeason<br/>Execute Waves]
    
    RunSeason --> CheckReady[Check isReady<br/>for all Dogs]
    CheckReady --> Wave1[Wave 1:<br/>Dogs without Dependencies]
    Wave1 --> ExecuteDogs1[Execute Dogs<br/>collectYield]
    ExecuteDogs1 --> MoveToExhausted1[Dogs to exhausted]
    
    MoveToExhausted1 --> Wave2[Wave 2:<br/>Dogs with fulfilled Dependencies]
    Wave2 --> ExecuteDogs2[Execute Dogs]
    ExecuteDogs2 --> MoveToExhausted2[Dogs to exhausted]
    
    MoveToExhausted2 --> MoreWaves{More<br/>Waves?}
    MoreWaves -->|Yes| Wave2
    MoreWaves -->|No| BuildWaves[Build Waves Structure<br/>with Read-Tracking]
    
    BuildWaves --> ReturnResult[Return Results<br/>HTML or JSON]
    ReturnResult --> End[HTTP Response]
    
    ListNodes --> End
    CreateNode --> SaveToStore[Save to PrismaStore]
    SaveToStore --> End
```

### Datenfluss zwischen Dogs

```mermaid
flowchart LR
    subgraph "Wave 1"
        Dog1[RandomRecipesRetriever<br/>collected: recipes[]]
    end
    
    subgraph "Wave 2"
        Dog2[SerializedDog<br/>theRun: Code]
        Dog3[SerializedDog<br/>theRun: Code]
    end
    
    subgraph "VM Context"
        Context[VM Context<br/>fetch, console<br/>+ Parent Dogs]
    end
    
    subgraph "Read Tracking"
        Tracking[Read Tracking<br/>Property Accesses]
    end
    
    Dog1 -->|collected| Context
    Context -->|globale Variable| Dog2
    Context -->|globale Variable| Dog3
    Dog2 -->|Property-Zugriff| Tracking
    Dog3 -->|Property-Zugriff| Tracking
    Dog2 -->|collected| Results[Results]
    Dog3 -->|collected| Results
```

## Run Process

### Sequence Diagram of a Complete Run

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant KennelRun
    participant SeasonRunner
    participant PrismaStore
    participant BaseDog
    participant SerializedDog
    participant VM
    
    Client->>Express: GET /:kennelId
    Express->>PrismaStore: load(kennelId)
    PrismaStore-->>Express: KennelConfig
    
    Express->>KennelRun: new KennelRun(config)
    KennelRun->>KennelRun: fillKennel()
    
    loop For each Dog in dogIds
        alt BaseDog (base:xxx)
            KennelRun->>BaseDog: new BaseDogClass()
            BaseDog-->>KennelRun: Dog Instance
        else SerializedDog
            KennelRun->>PrismaStore: findLatestVersionsByType(ids)
            PrismaStore-->>KennelRun: SerializedDog Configs
            KennelRun->>SerializedDog: new SerializedDog(config, id)
            SerializedDog-->>KennelRun: Dog Instance
        end
    end
    
    KennelRun->>SeasonRunner: new SeasonRunner({ kennel })
    KennelRun->>SeasonRunner: run()
    
    SeasonRunner->>SeasonRunner: Filter ready Dogs (Wave 1)
    SeasonRunner->>BaseDog: collectYield(season)
    BaseDog-->>SeasonRunner: collected
    SeasonRunner->>SerializedDog: collectYield(season)
    
    SerializedDog->>SerializedDog: runExternalCode(season)
    SerializedDog->>VM: createContext(contextObj)
    SerializedDog->>VM: runInContext(wrappedCode)
    
    Note over VM: Code has access to<br/>Parent Dogs via<br/>global variables
    
    VM-->>SerializedDog: result
    SerializedDog-->>SeasonRunner: collected
    
    SeasonRunner->>SeasonRunner: Filter ready Dogs (Wave 2)
    SeasonRunner->>SerializedDog: collectYield(season)
    SerializedDog->>VM: runInContext(wrappedCode)
    VM-->>SerializedDog: result
    SerializedDog-->>SeasonRunner: collected
    
    SeasonRunner-->>KennelRun: IHuntingSeason (mit Waves)
    KennelRun->>KennelRun: buildWavesHtml(waves)
    KennelRun-->>Express: HTML
    Express-->>Client: HTTP Response
```

## Dependency Resolution

### How Dependencies are Resolved

```mermaid
flowchart TD
    Start[Kennel with Dogs] --> InitSeason[Initialize Season<br/>exhausted: []<br/>withBeesInThePants: all Dogs]
    
    InitSeason --> CheckReady[Check isReady<br/>for all Dogs]
    
    CheckReady --> CheckRequired{Required<br/>Parents<br/>fulfilled?}
    CheckRequired -->|No| NotReady[Dog not ready<br/>stays in<br/>withBeesInThePants]
    CheckRequired -->|Yes| CheckOptional{Optional<br/>Parents<br/>fulfilled?}
    
    CheckOptional -->|Still in<br/>withBeesInThePants| NotReady
    CheckOptional -->|All in<br/>exhausted| Ready[Dog is ready<br/>can run in Wave]
    
    Ready --> AddToWave[Add to<br/>current Wave]
    AddToWave --> ExecuteDog[Execute Dog<br/>collectYield]
    
    ExecuteDog --> MoveToExhausted[Add Dog to<br/>exhausted]
    MoveToExhausted --> RemoveFromBees[Remove Dog from<br/>withBeesInThePants]
    
    RemoveFromBees --> MoreDogs{More<br/>ready Dogs?}
    MoreDogs -->|Yes| CheckReady
    MoreDogs -->|No| NextWave{Next<br/>Wave?}
    
    NextWave -->|Yes| CheckReady
    NextWave -->|No| Done[All Dogs<br/>executed]
    
    NotReady --> MoreDogs
```

### Dependency Matching for SerializedDogs

```mermaid
flowchart LR
    Start[SerializedDog<br/>parentsRequired:<br/>['node-v1', 'base:QueryRetriever']] --> MatchParent{Parent<br/>found?}
    
    MatchParent -->|SerializedDog| CheckStorageId[Check storageId<br/>node-v1 === storageId?]
    MatchParent -->|BaseDog| CheckName[Check name<br/>QueryRetriever === name?]
    
    CheckStorageId -->|Yes| Found[Parent found<br/>in exhausted]
    CheckStorageId -->|No| NotFound[Parent not<br/>found]
    
    CheckName -->|Yes| Found
    CheckName -->|No| NotFound
    
    Found --> AddToContext[Add collected<br/>to VM-Context<br/>as global variable]
    AddToContext --> Ready[Parent available<br/>in code]
    
    NotFound --> Wait[Wait for<br/>Parent]
```

## VM Context and Read Tracking

### How the VM Context is Created

```mermaid
flowchart TD
    Start[SerializedDog<br/>runExternalCode] --> BuildBase[buildBaseContext<br/>fetch, console]
    
    BuildBase --> GetParents[Get Parent IDs<br/>from Config<br/>parentsRequired +<br/>parentsOptional]
    
    GetParents --> FindParents[Find Parent Dogs<br/>in season.exhausted<br/>by storageId/name]
    
    FindParents --> AddToContext[Add collected<br/>from Parent Dogs<br/>to Context]
    
    AddToContext --> CreateVM[vm.createContext<br/>contextObj]
    
    CreateVM --> WrapCode[Wrap Code<br/>in async function]
    
    WrapCode --> RunCode[script.runInContext<br/>context]
    
    RunCode --> TrackAccess{Property<br/>Access?}
    
    TrackAccess -->|Yes| ProxyGet[Proxy.get<br/>tracks access]
    ProxyGet --> AddTracking[Add to<br/>readTracking<br/>waveIndex, reader,<br/>source, propertyPath]
    
    AddTracking --> ReturnValue[Return Value]
    TrackAccess -->|No| ReturnValue
    
    ReturnValue --> Result[Return result<br/>as collected]
```

### Read Tracking Details

```mermaid
flowchart LR
    subgraph "Season"
        Exhausted[exhausted:<br/>Array of Dogs]
    end
    
    subgraph "Proxy Layer"
        ProxyExhausted[Proxy around<br/>exhausted Array]
        ProxyDog[Proxy around<br/>each Dog]
        ProxyCollected[Proxy around<br/>collected Object]
    end
    
    subgraph "Code Execution"
        Code[SerializedDog Code<br/>const data = exhausted[0].collected.value]
    end
    
    subgraph "Tracking"
        ReadTracking[readTracking Array<br/>waveIndex: 1<br/>readerInstance: Dog2<br/>sourceInstance: Dog1<br/>propertyPath: 'value']
    end
    
    Exhausted --> ProxyExhausted
    ProxyExhausted --> ProxyDog
    ProxyDog -->|collected access| ProxyCollected
    ProxyCollected -->|Property access| Code
    Code -->|get 'value'| ProxyCollected
    ProxyCollected -->|track| ReadTracking
```

## Version Management

### How Versions are Managed

```mermaid
flowchart TD
    Start[Save SerializedDog<br/>id: 'my-node'<br/>version: 1] --> CheckExists{Already<br/>exists?}
    
    CheckExists -->|No| CreateV1[Create<br/>my-node-v1]
    CheckExists -->|Yes| LoadExisting[Load existing<br/>versions]
    
    LoadExisting --> GetMaxVersion[Find max<br/>Version]
    GetMaxVersion --> Increment[Increment<br/>Version]
    Increment --> CreateNew[Create<br/>my-node-v2]
    
    CreateV1 --> SaveToStore[Save to<br/>PrismaStore]
    CreateNew --> SaveToStore
    
    SaveToStore --> Done[Version saved]
    
    Load[Load SerializedDog<br/>id: 'my-node'] --> FindVersions[Find all<br/>versions of<br/>my-node]
    
    FindVersions --> SortVersions[Sort by<br/>Version DESC]
    SortVersions --> GetLatest[Take latest<br/>Version]
    GetLatest --> Return[Return<br/>my-node-v2]
    
    LoadSpecific[Load SerializedDog<br/>id: 'my-node-v1'] --> LoadExact[Load exact<br/>Version]
    LoadExact --> Return
```

## Data Structures

### IHuntingSeason

```typescript
interface IHuntingSeason {
    withBeesInThePants: IHuntingDog<unknown>[];  // Dogs that still need to run
    exhausted: IHuntingDog<unknown>[];          // Dogs that are finished
    runIndex: number;                           // Current run index
    maxRuns: number;                            // Maximum number of runs
    wave: Array<IWaveEntry[]>;                 // Array of waves
    readTracking: IReadTrackingEntry[];         // Tracking of property accesses
    currentWaveIndex?: number;                  // Current wave index
}
```

### IKennelConfig

```typescript
interface IKennelConfig {
    id: string;
    name?: string;
    description?: string;
    dogIds: string[];                           // Array of dog IDs
    defaultQuery?: Record<string, string>;      // Default query parameters
    defaultBody?: any;                          // Default body data
    createdAt?: Date;
    updatedAt?: Date;
}
```

### ISerializedDogConfig

```typescript
interface ISerializedDogConfig {
    id: string;
    theRun: string;                             // TypeScript code as string
    version: number;                            // Version number
    parentsRequired?: string[];                 // Required parent IDs
    parentsOptional?: string[];                 // Optional parent IDs
}
```

## Important Files

- **[main.ts](main.ts)**: Entry point, Express server setup, route handlers
- **[KennelRun.ts](KennelRun.ts)**: Run orchestration, fillKennel, runSeason
- **[harverster.ts](harverster.ts)**: SeasonRunner for wave execution
- **[dogs/SerializedDog.ts](dogs/SerializedDog.ts)**: VM code execution, context creation
- **[store/PrismaStore.ts](store/PrismaStore.ts)**: Data persistence, version management
- **[core/enities/abstractHuntingDog.ts](core/enities/abstractHuntingDog.ts)**: Base dog logic, dependency resolution, read tracking

