# Data Hunt

A data aggregation platform that collects, processes, and combines data from various sources. Dogs are sent out to hunt for data - processing units ("Dogs") are organized in configurations ("Kennels") and executed in dependency order ("Waves").

## Overview

A Node.js application that enables:

- **Data Aggregation**: Collect data from various sources (APIs, databases, etc.)
- **Dynamic Code Execution**: Execute custom TypeScript code in a secure VM environment
- **Dependency Management**: Automatic resolution of dependencies between processing units
- **Version Control**: Full version control for custom code units
- **Data Flow Tracking**: Track which data is read by which units

## Concepts

### Dogs

Dogs are the fundamental data processing units. There are two types:

#### BaseDogs
Predefined dogs implemented in code:
- **RandomRecipesRetriever**: Fetches random recipes from APIs
- **QueryRetriever**: Extracts query parameters from HTTP requests
- **BodyRetriever**: Extracts body data from HTTP requests
- **CountryFlagBlackLab**: Loads country flag data
- **DishFlagBlackLab**: Loads dish flag data
- **RandomEveryThingRetriever**: Fetches random data from various APIs
- **TalkingDog**: Example dog for demonstrations

#### SerializedDogs
Custom dogs whose code is stored as TypeScript strings in the database:
- Code is executed at runtime in a VM environment
- Support full TypeScript syntax
- Have access to results from parent dogs via VM context
- Are versioned (e.g., "node-v1", "node-v2")

### Kennels

A kennel is a configuration that defines:
- Which dogs to execute (`dogIds`)
- Default query parameters (`defaultQuery`)
- Default body data (`defaultBody`)
- Name and description

Kennels are stored in the database and can be managed via the API.

### Waves

Dogs are executed in "waves":
- **Wave 1**: All dogs without dependencies
- **Wave 2**: All dogs whose dependencies were fulfilled in Wave 1
- **Wave N**: Additional waves until all dogs are executed

Execution order is automatically calculated based on dependencies.

### Dependencies

Dogs can have dependencies on other dogs:

- **Required Parents**: Must be executed before this dog runs
- **Optional Parents**: Used if available, but don't block execution

Dependencies are referenced by IDs:
- BaseDogs: `base:RandomRecipesRetriever`
- SerializedDogs: `node-v1` or `node` (latest version)

## Features

### 1. Data Aggregation

The app collects data from various sources:
- HTTP APIs (via `fetch`)
- Query parameters from requests
- Body data from requests
- Results from other dogs

### 2. TypeScript Code Execution

SerializedDogs execute custom TypeScript code:
- Code runs in a Node.js VM environment
- Security through VM isolation
- Access to parent dog results as global variables
- Support for `async/await`

Example:
```typescript
const result = await fetch('https://api.example.com/data');
const processed = result.map(item => item.value * 2);
return processed;
```

### 3. Version Control

SerializedDogs are automatically versioned:
- Saving creates a new version (e.g., `node-v2`)
- Old versions are preserved
- Latest version is automatically loaded if no specific version is specified
- Specific versions can be referenced by full ID

### 4. Dependency Tracking

The app automatically tracks:
- Which dogs depend on which other dogs
- Which wave a dog was executed in
- Which properties were read from which dogs (read tracking)

### 5. Read Tracking

Every access to data from parent dogs is tracked:
- Which property was read?
- From which dog was it read?
- In which wave did the access occur?

This enables complete traceability of data flow.

## API Endpoints

### Kennel Endpoints

- `GET /` - List all kennels
- `GET /edit/:kennelId` - Editor UI for a kennel
- `GET /:kennelId` - Execute a kennel and return the first dog's result
- `POST /:kennelId` - Execute a kennel with body data

### API Endpoints

- `GET /api/nodes` - List all nodes (BaseDogs + SerializedDogs)
- `GET /api/nodes/:id` - Load a node
- `POST /api/nodes` - Create a new SerializedDog
- `PUT /api/nodes/:id` - Update a SerializedDog (creates new version)
- `DELETE /api/nodes/:id` - Delete a node

- `GET /api/kennels` - List all kennels
- `GET /api/kennels/:id` - Load a kennel
- `POST /api/kennels` - Create a new kennel
- `PUT /api/kennels/:id` - Update a kennel (creates new version)
- `DELETE /api/kennels/:id` - Delete a kennel

## Technology Stack

- **Express.js**: Web framework for HTTP server
- **TypeScript**: Typed programming language
- **Prisma**: ORM for database access
- **SQLite**: Database (can be extended to PostgreSQL)
- **Node.js VM**: Secure code execution for SerializedDogs
- **Monaco Editor**: Code editor in UI (via CDN)

## Installation

```bash
npm install
npm run prisma:sync
npm start
```

The app runs on `http://localhost:3000`.

## Usage

### 1. Create a Kennel

Create a kennel via API or UI:

```bash
curl -X POST http://localhost:3000/api/kennels \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-kennel",
    "name": "My Kennel",
    "dogIds": ["base:RandomRecipesRetriever"]
  }'
```

### 2. Create a SerializedDog

Create a custom dog:

```bash
curl -X POST http://localhost:3000/api/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-node",
    "theRun": "return { message: \"Hello World\" };"
  }'
```

### 3. Execute a Kennel

Execute a kennel:

```bash
curl http://localhost:3000/my-kennel
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture diagrams and data flow descriptions.

## Development

### Startup Tests

The app automatically runs tests on startup:
- Store functionality
- Controller functionality
- BaseDogs availability
- TypeDefBuilder functionality
- SerializedDog functionality

### Seeds

Seed data is automatically loaded on startup (if available):
- Example SerializedDogs
- Example Kennels

## License

See LICENSE file (if available).

