# Komoot API Documentation

This document provides a comprehensive reference for the Komoot APIs, compiled from the official partner documentation, public repository analysis, and real API testing. It covers three distinct API surfaces, their authentication mechanisms, all known endpoints, request/response schemas, and version-specific behavior differences.

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Authentication](#2-authentication)
3. [Internal API — `api.komoot.de`](#3-internal-api--apikomootde)
4. [Rename API — `www.komoot.com/api`](#4-rename-api--wwwkomootcomapi)
5. [Public Partner API — `external-api.komoot.de`](#5-public-partner-api--external-apikomootde)
6. [OAuth 2.0 — `auth.komoot.de`](#6-oauth-20--authkomootde)
7. [API Version Differences (v006 vs v007)](#7-api-version-differences-v006-vs-v007)
8. [Data Schemas](#8-data-schemas)
9. [Sport Types](#9-sport-types)
10. [Implementation Notes](#10-implementation-notes)

---

## 1. API Overview

Komoot exposes three API domains:

| Domain | Auth Method | Purpose |
|---|---|---|
| `api.komoot.de` | Basic Auth (email:password → userId:token) | Full internal API: login, tour CRUD, coordinates, exports |
| `www.komoot.com/api` | Basic Auth (userId:token) | Tour modification (rename via PATCH) |
| `external-api.komoot.de` | OAuth 2.0 Bearer token | Official partner API: read tours, upload tours |

Authentication for the partner API is handled by `auth.komoot.de` (or the configurable `auth-api.main.komoot.net`).

### General API Characteristics

- Responses use **HAL+JSON** format (`application/hal+json`) with `_embedded`, `_links`, and pagination metadata.
- The server may add new properties at any time. Clients must ignore unknown properties (backwards compatible).
- Enumeration values (sport types, direction types, etc.) can be extended. Clients must handle unknown values gracefully.
- `Cache-Control`, `Last-Modified`, and ETag headers are set where applicable.
- The `Accept-Language` header controls i18n content in responses.
- Error responses follow the format: `{ "error": "ErrorCode", "message": "Human-readable message", "status": 403 }`

---

## 2. Authentication

### 2.1. Internal API Authentication (Basic Auth)

The internal API uses a two-step process:

1. **Login** — `GET /v006/account/email/{email}/` with HTTP Basic Auth (`email:password`).
2. The response contains `username` (a numeric user ID) and `password` (a session token).
3. **All subsequent requests** use HTTP Basic Auth with `userId:token`.

**Important:** The `password` field in the login response is the **session token**, not the user's actual password. Only the token should be stored (e.g., in `sessionStorage`), never the original credentials.

**Unicode-safe Base64 encoding** is required for the Authorization header, since passwords may contain non-Latin1 characters. Use `TextEncoder` → byte-by-byte `String.fromCodePoint` → `btoa`:

```js
function encodeBase64(str) {
  return btoa(String.fromCodePoint(...new TextEncoder().encode(str)));
}
// Header: "Basic " + encodeBase64(userId + ":" + token)
```

### 2.2. OAuth 2.0 Authentication (Partner API)

See [Section 6](#6-oauth-20--authkomootde) for the full OAuth 2.0 flow.

**OAuth Scopes:**
- `profile` — Required to fetch tour lists and tour details.
- `tour-upload` — Required to upload new tours.

---

## 3. Internal API — `api.komoot.de`

### 3.1. Login

#### `GET /v006/account/email/{email}/`

> **Note:** This endpoint exists only on v006. There is no v007 equivalent.

- **Auth:** HTTP Basic (`email:password`)
- **Path Parameters:**
    - `{email}` — URL-encoded email address
- **Response (`200 OK`):**
  ```json
  {
    "email": "user@example.com",
    "username": "1234567890",
    "password": "session-token-string",
    "user": {
      "createdAt": "2021-10-24 07:38:44 +0000",
      "username": "actual_username",
      "displayname": "Display Name",
      "firstname": "John",
      "content": { "hasImage": true },
      "state": "1",
      "newsletter": false,
      "welcomeMails": false,
      "metric": true,
      "locale": "de_DE",
      "imageUrl": "https://...",
      "fitness": { "personalised": false }
    }
  }
  ```
- **Key fields:**
    - `username` → numeric user ID, used as the Basic Auth username for all subsequent requests
    - `password` → session token, used as the Basic Auth password for all subsequent requests
    - `user.displayname` → human-readable display name
- **Error:** `401`/`403` for invalid credentials.

---

### 3.2. Tour List

#### `GET /v007/users/{userId}/tours/`

- **Auth:** Basic (`userId:token`)
- **Path Parameters:**
    - `{userId}` — Numeric user ID from login response
- **Query Parameters:**

  | Parameter | Type | Default | Description |
    |---|---|---|---|
  | `page` | integer | `0` | Page number (0-indexed) |
  | `limit` | integer | — | Results per page. **No enforced maximum**; `limit=1000` returns all tours in one page. |
  | `status` | string | — | `public`, `private`, `friends`. Required when requesting another user's tours (must be `public`). |
  | `type` | string | — | `tour_planned` or `tour_recorded` |
  | `sort_field` | string | `date` | One of: `name`, `elevation`, `duration`, `date`, `proximity` |
  | `sort_direction` | string | `desc` | `asc` or `desc` |
  | `name` | string | — | Filter by name (case-insensitive substring match) |
  | `sport_types` | string | — | Comma-separated sport types to include |
  | `start_date` | ISO 8601 date | — | Include tours from this date |
  | `end_date` | ISO 8601 date | — | Include tours up to this date |
  | `center` | string | — | Geo-search center point: `"lat,lng"` |
  | `max_distance` | number | — | Max distance from center in meters (required if `center` is set) |
  | `only_unlocked` | boolean | `false` | Filter to unlocked tours only. All recorded tours are unlocked. Planned tours are unlocked if the user has a valid region or complete package. |

- **Response (`200 OK`):**
  ```json
  {
    "_embedded": {
      "tours": [ /* array of tour objects */ ]
    },
    "_links": {
      "self": { "href": "..." },
      "next": { "href": "...?page=1&limit=50" },
      "prev": { "href": "..." }
    },
    "page": {
      "size": 50,
      "totalElements": 522,
      "totalPages": 11,
      "number": 0
    }
  }
  ```
- **Tour object fields** (within `_embedded.tours[]`):

  | Field | Type | Description |
    |---|---|---|
  | `id` | number | Tour ID |
  | `name` | string | Full tour name (may contain `/` as folder separator) |
  | `type` | string | `tour_recorded` or `tour_planned` |
  | `status` | string | `public`, `private`, or `friends` |
  | `date` | ISO 8601 | Tour date |
  | `sport` | string | Sport type (see [Section 9](#9-sport-types)) |
  | `distance` | number | Distance in meters |
  | `duration` | number | Total duration in seconds |
  | `elevation_up` | number | Elevation gain in meters |
  | `elevation_down` | number | Elevation loss in meters |
  | `time_in_motion` | number | Active time in seconds (duration minus pauses) |
  | `kcal_active` | number | Active calories |
  | `kcal_resting` | number | Resting calories |
  | `changed_at` | ISO 8601 | Last modification timestamp |
  | `start_point` | object | `{ lat: number, lng: number, alt: number }` |
  | `summary` | object | Contains `surfaces[]` and `way_types[]` breakdown arrays |
  | `difficulty` | object | `{ grade, explanation_technical, explanation_fitness }` |
  | `constitution` | number | Fitness constitution level |
  | `segments` | array | Route segments `[{ type: "Routed", from, to }]` |
  | `path` | array | Waypoints with location, index, and references |
  | `routing_version` | string | Routing engine version |
  | `query` | string | Encoded routing query |
  | `tour_information` | array | Special info like movable bridges |
  | `potential_route_update` | boolean | Whether the route can be updated |
  | `map_image` | object | Static map image URL (templated with `{width}`, `{height}`, `{crop}`) |
  | `map_image_preview` | object | Smaller preview variant |
  | `vector_map_image` | object | Vector-based map image |
  | `vector_map_image_preview` | object | Vector preview variant |
  | `source` | string (JSON) | Source metadata as a JSON string |
  | `_embedded.creator` | object | Creator profile (see below) |
  | `_links` | object | HAL links to sub-resources |

- **Creator object** (`_embedded.creator`):
  ```json
  {
    "username": "1234567890",
    "display_name": "User Name",
    "is_premium": false,
    "status": "public",
    "avatar": { "src": "https://...?width={width}&height={height}&crop={crop}", "templated": true, "type": "image/*" },
    "_links": {
      "self": { "href": "https://api.komoot.de/v007/users/1234567890/profile_embedded" },
      "relation": { "href": "https://api.komoot.de/v007/users/{username}/relations/1234567890", "templated": true }
    }
  }
  ```
- **`_links` per tour** (discovered sub-resources):

  | Link key | Endpoint |
    |---|---|
  | `self` | `/v007/tours/{id}` |
  | `coordinates` | `/v007/tours/{id}/coordinates` |
  | `tour_line` | `/v007/tours/{id}/tour_line` |
  | `participants` | `/v007/tours/{id}/participants/` |
  | `way_types` | `/v007/tours/{id}/way_types` |
  | `surfaces` | `/v007/tours/{id}/surfaces` |
  | `directions` | `/v007/tours/{id}/directions` |
  | `timeline` | `/v007/tours/{id}/timeline/` |
  | `translations` | `/v007/tours/{id}/translations` |
  | `cover_images` | `/v007/tours/{id}/cover_images/` |
  | `tour_rating` | `/v007/tours/{id}/ratings/{userId}` |
  | `faqs` | `/v007/tours/{id}/faqs` |
  | `details` | `/v007/tours/{id}/details` |
  | `master` | `/v007/tours/{masterTourId}?_embedded=` |
  | `creator` | `/v007/users/{userId}/profile_embedded` |

- **Error:** `403` if requesting private tours from another user.

---

### 3.3. Single Tour

#### `GET /v007/tours/{tourId}`

- **Auth:** Basic (`userId:token`)
- **Path Parameters:**
    - `{tourId}` — Tour ID
- **Query Parameters:**

  | Parameter | Type | Description |
    |---|---|---|
  | `_embedded` | string | Comma-separated resources to embed: `coordinates`, `way_types`, `surfaces`, `directions`, `participants`, `timeline`, `cover_images` |
  | `directions` | string | Directions version, e.g. `v2` |
  | `fields` | string | Additional fields, e.g. `timeline` |
  | `format` | string | Coordinate format, e.g. `coordinate_array` |
  | `timeline_highlights_fields` | string | E.g. `tips,recommenders` |
  | `share_token` | string | Access token that bypasses visibility rules for a specific tour |

- **Response (`200 OK`):** Full tour object (same fields as list response) plus any requested `_embedded` resources.
- **Response types:**
    - `application/hal+json` — JSON tour data
    - `application/vnd.ant.fit` — FIT file bytes (when requesting `.fit`)
    - `application/gpx+xml` — GPX XML (when requesting `.gpx`)
- **Error:**
    - `403` for private tours of other users
    - `403` for embedding coordinates/waytypes/directions/surfaces on locked planned tours (user lacks region or complete package)
  ```json
  { "error": "TourAccessDenied", "message": "Tour is locked", "status": 403 }
  ```

---

### 3.4. Tour Coordinates

#### `GET /v007/tours/{tourId}/coordinates`

- **Auth:** Basic (`userId:token`)
- **Response (`200 OK`):**
  ```json
  {
    "items": [
      { "lat": 47.674873, "lng": 12.475037, "alt": 728.2, "t": 0 },
      { "lat": 47.674918, "lng": 12.475220, "alt": 728.2, "t": 65967 },
      { "lat": 47.674987, "lng": 12.475309, "alt": 728.2, "t": 70969 }
    ],
    "_links": {
      "self": { "href": "https://api.komoot.de/v007/tours/{tourId}/coordinates" }
    }
  }
  ```
- **Coordinate fields:**

  | Field | Type | Description |
    |---|---|---|
  | `lat` | number | Latitude (WGS84) |
  | `lng` | number | Longitude (WGS84) |
  | `alt` | number | Altitude in meters |
  | `t` | number | Time offset in milliseconds from tour start |

> **Note:** This endpoint returns `404` for some recorded tours and works reliably for planned tours. Sub-resources `way_types`, `surfaces`, `directions`, and `tour_line` also return `200` only for planned tours in testing.

---

### 3.5. Tour Export

#### `GET /v007/tours/{tourId}.gpx`

- **Auth:** Basic (`userId:token`)
- **Query Parameters:**
    - `max_bytes` (number) — Maximum file size in bytes. If the file would be larger, the geometry is simplified.
    - `share_token` (string) — Bypasses visibility rules.
- **Response (`200 OK`):** GPX XML document.
- **Error:** `403` for private tours of other users.

#### `GET /v007/tours/{tourId}.fit`

- **Auth:** Basic (`userId:token`)
- **Query Parameters:** Same as `.gpx`.
- **Response (`200 OK`):** FIT binary file.
- **Note:** FIT export is confirmed working for planned tours. Recorded tours may return `400`.

> **Important:** v006 `.gpx` and `.fit` suffixes return JSON, not the actual file format. Always use v007 for exports.

---

### 3.6. Tour Upload

#### `POST /v007/tours/?data_type={format}`

- **Auth:** Basic (`userId:token`)
- **Required Headers:**
    - `User-Agent` — Must be set to a string identifying your application (e.g. `com.my-app/1.0`).
- **Query Parameters:**

  | Parameter | Type | Required | Description |
    |---|---|---|---|
  | `data_type` | string | Yes | `gpx`, `fit`, or `tcx` |
  | `sport` | string | GPX only | Sport type (see [Section 9](#9-sport-types)) |
  | `name` | string | No | Tour name. If omitted, read from file metadata. |
  | `time_in_motion` | integer | GPX only | Active time in seconds. Must not exceed total duration. |
  | `status` | string | No | `public`, `private`, `friends` |

- **Body:** Raw binary file data (`application/octet-stream`).
- **Response:**
    - `201 Created` — Tour created. Body contains the tour object with `id`.
    - `202 Accepted` — Duplicate tour detected. Body contains existing tour with `id`.
    - `400 Bad Request` — File missing, unreadable, or parameter error.
    - `401 Unauthorized` / `403 Forbidden`.

---

### 3.7. Tour Deletion

#### `DELETE /v007/tours/{tourId}`

- **Auth:** Basic (`userId:token`)
- **Headers:** `Accept: application/hal+json,application/json`
- **Response:** `200 OK` on success.

---

### 3.8. Tour Sub-Resources (all GET)

| Endpoint | Description |
|---|---|
| `/v007/tours/{tourId}/coordinates` | Coordinate array (see 3.4) |
| `/v007/tours/{tourId}/tour_line` | Simplified tour polyline |
| `/v007/tours/{tourId}/way_types` | Way type breakdown for the route |
| `/v007/tours/{tourId}/surfaces` | Surface type breakdown |
| `/v007/tours/{tourId}/directions` | Turn-by-turn directions |
| `/v007/tours/{tourId}/timeline/` | Paginated timeline events |
| `/v007/tours/{tourId}/participants/` | List of participants |
| `/v007/tours/{tourId}/translations` | Tour translations/localization |
| `/v007/tours/{tourId}/cover_images/` | Cover images |
| `/v007/tours/{tourId}/ratings/{userId}` | Tour rating for a specific user |
| `/v007/tours/{tourId}/faqs` | FAQs associated with the tour |
| `/v007/tours/{tourId}/details` | Additional tour details |

---

### 3.9. User Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/v007/users/{userId}/profile_embedded` | GET | Compact user profile: avatar, display_name, status, is_premium |
| `/v007/users/{userId}/relations/{targetUserId}` | GET | Relationship between two users (templated) |
| `/v007/users/{userId}/config` | GET | User configuration |

---

### 3.10. Other

| Endpoint | Method | Description |
|---|---|---|
| `/v007/mail/c/?u={userId}&d={digestId}&r={redirectUrl}` | GET | Email link tracking/redirect |

---

## 4. Rename API — `www.komoot.com/api`

Tour renaming uses a **different base URL** than the main API.

#### `PATCH https://www.komoot.com/api/v007/tours/{tourId}?hl=de`

- **Auth:** Basic (`userId:token`) — same credentials as the internal API.
- **Headers:**
    - `Content-Type: application/json`
    - `Authorization: Basic ...`
- **Query Parameters:**
    - `hl` (string) — Language hint, e.g. `de`.
- **Request Body:**
  ```json
  {
    "name": "New Tour Name",
    "sport": "hike",
    "status": "private"
  }
  ```
  All fields are optional. Only provided fields are updated.
- **Response:** `200 OK` with updated tour object.
- **Error:** `401`/`403` for invalid/expired auth.

> **Note:** The `name` field is the **full path name** including folder separators. For example, renaming from `"Austria / Alps / Trail Run"` to `"Germany / Bavaria / Trail Run"` effectively moves the tour between folders in the tree view. Directory renaming is not possible — you must rename each tour individually.

---

## 5. Public Partner API — `external-api.komoot.de`

This is the official API for third-party developers. It uses OAuth 2.0 and is limited to read access and tour upload.

### 5.1. Endpoints

#### `GET /v007/users/{username}/tours/`

- **Auth:** OAuth 2.0 Bearer Token.
- **Parameters:** Same as the internal API (see [Section 3.2](#32-tour-list)).
- **Note:** `{username}` can be a username string or numeric ID (e.g., `tobias`, `104567979941`).
- **Response:** Same HAL+JSON structure as the internal API.
- **Error:** `403` if requesting both public and private tours from a different user.

#### `GET /v007/users/me/tours/`

- **Auth:** OAuth 2.0 Bearer Token.
- **Description:** Shorthand for the currently authenticated user's tours.
- **Parameters and Response:** Same as above.

#### `GET /v007/tours/{id}`

- **Auth:** OAuth 2.0 Bearer Token.
- **Parameters:** Same as internal API (see [Section 3.3](#33-single-tour)).
- **Note:** `_embedded` values available: `coordinates`, `way_types`, `surfaces`, `directions`, `participants`.

#### `GET /v007/tours/{id}.gpx`

- Same as internal API (see [Section 3.5](#35-tour-export)).

#### `GET /v007/tours/{id}.fit`

- Same as internal API (see [Section 3.5](#35-tour-export)).

#### `POST /v007/tours/?data_type={format}`

- Same as internal API (see [Section 3.6](#36-tour-upload)). Requires `tour-upload` scope.

---

## 6. OAuth 2.0 — `auth.komoot.de`

### 6.1. Configuration

| Property | Value |
|---|---|
| Authorization URL | `https://auth.komoot.de/oauth/authorize` |
| Token URL | `https://auth.komoot.de/oauth/token` |
| Alternative base URL | `https://auth-api.main.komoot.net/` (configurable) |
| Token auth method | HTTP Basic (`client_id:client_secret`) |
| Scopes | `profile`, `tour-upload` |

### 6.2. Authorization Code Flow

**Step 1: Redirect user to authorize**
```
https://auth.komoot.de/oauth/authorize
  ?client_id={client_id}
  &response_type=code
  &redirect_uri={redirect_uri}
  &scope=profile
```

**Step 2: Exchange code for tokens**
```
POST https://auth.komoot.de/oauth/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={code}&redirect_uri={redirect_uri}
```

**Step 3: Token response**
```json
{
  "access_token": "jwt-access-token",
  "refresh_token": "refresh-token-string",
  "expires_in": 7200,
  "scope": "profile",
  "username": "1234567890"
}
```

**Step 4: Refresh expired tokens**
```
POST https://auth.komoot.de/oauth/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token={refresh_token}
```

**Using the token:**
```
Authorization: Bearer {access_token}
Accept: application/hal+json
```

> **Note:** The internal API session token from `/v006/account/email/` is **not** a JWT and cannot be used as a Bearer token on `external-api.komoot.de`. These are two completely separate authentication systems.

---

## 7. API Version Differences (v006 vs v007)

### 7.1. Authentication

| Aspect | v006 | v007 |
|---|---|---|
| Login endpoint | ✅ `GET /v006/account/email/{email}/` | ❌ Does not exist (404) |
| Basic auth (userId:token) | ✅ | ✅ |
| OAuth2 Bearer | ❌ | ✅ (partner API) |

### 7.2. Tour List

| Aspect | v006 | v007 |
|---|---|---|
| Response format | Plain JSON array | HAL+JSON with `_embedded`, `_links`, `page` |
| Pagination | ❌ Ignores `limit`/`page`, dumps all | ✅ Proper pagination, no enforced max limit |
| Total count metadata | ❌ Not provided | ✅ `page.totalElements`, `page.totalPages` |
| `type` filter | ❌ Ignored, always returns recorded only | ✅ `tour_planned` / `tour_recorded` |
| Other query filters | ❌ All ignored | ✅ `status`, `sport_types`, `start_date`, `end_date`, `sort_field`, `sort_direction`, `name`, `center`, `max_distance`, `only_unlocked` |
| Tour type values | `RECORDED_1` | `tour_recorded` / `tour_planned` |
| Status values | Uppercase: `FRIENDS`, `PUBLIC` | Lowercase: `friends`, `public`, `private` |
| Coordinate format | Mercator projection (`x`/`y`/`z`) | WGS84 (`lat`/`lng`/`alt`) |
| Field naming | camelCase (`altUp`, `createdAt`, `motionDuration`) | snake_case (`elevation_up`, `changed_at`, `time_in_motion`) |
| Tours returned (tested) | **264** (recorded only) | **522** (264 recorded + 258 planned) |

### 7.3. Single Tour

| Aspect | v006 | v007 |
|---|---|---|
| Endpoint | ✅ `GET /v006/tours/{id}` — returns JSON | ✅ `GET /v007/tours/{id}` — richer JSON with `_links` |
| Coordinates sub-endpoint | ❌ 404 | ✅ `/v007/tours/{id}/coordinates` |
| `description`, `difficulty` fields | ❌ | ✅ |

### 7.4. Export Formats

| Aspect | v006 | v007 |
|---|---|---|
| `.gpx` suffix | ❌ Returns JSON | ✅ Returns valid GPX XML |
| `.fit` suffix | ❌ Returns JSON | ✅ Returns valid FIT binary (planned tours) |
| `way_types`, `surfaces`, `directions` | ❌ | ✅ (planned tours only; 404 for some recorded) |
| `tour_line` | ❌ | ✅ (planned tours only) |

### 7.5. Recommendation

Use **v006 only for login**. Use **v007 for everything else**.

---

## 8. Data Schemas

### 8.1. Tour Object (v007)

```typescript
interface Tour {
  id: number;
  name: string;
  type: "tour_recorded" | "tour_planned";
  status: "public" | "private" | "friends";
  date: string; // ISO 8601
  sport: string;
  distance: number; // meters
  duration: number; // seconds
  elevation_up?: number; // meters
  elevation_down?: number; // meters
  time_in_motion?: number; // seconds
  kcal_active: number;
  kcal_resting: number;
  changed_at: string; // ISO 8601
  start_point?: { lat: number; lng: number; alt: number };
  source: string; // JSON-encoded source metadata
  routing_version?: string;
  query?: string;
  constitution?: number;
  summary?: {
    surfaces: Array<{ type: string; amount: number }>;
    way_types: Array<{ type: string; amount: number }>;
  };
  difficulty?: {
    grade: string; // "easy", "moderate", "difficult"
    explanation_technical: string;
    explanation_fitness: string;
  };
  segments?: Array<{ type: string; from: number; to: number }>;
  path?: Array<{ location: { lat: number; lng: number }; index: number; reference?: string; referenceKey?: string }>;
  tour_information?: Array<{ type: string; segments: Array<{ from: number; to: number }> }>;
  potential_route_update: boolean;
  map_image: TemplatedImage;
  map_image_preview: TemplatedImage;
  vector_map_image: TemplatedImage;
  vector_map_image_preview: TemplatedImage;
  _embedded: { creator: CreatorProfile };
  _links: Record<string, { href: string; templated?: boolean }>;
}

interface TemplatedImage {
  src: string; // URL with optional {width}, {height}, {crop} placeholders
  templated: boolean;
  type: string; // "image/*"
  attribution?: string;
}

interface CreatorProfile {
  username: string;
  display_name: string;
  is_premium: boolean;
  status: string;
  avatar: TemplatedImage;
  _links: {
    self: { href: string };
    relation: { href: string; templated: boolean };
  };
}
```

### 8.2. Coordinate Object

```typescript
interface Coordinate {
  lat: number;  // WGS84 latitude
  lng: number;  // WGS84 longitude
  alt: number;  // altitude in meters
  t: number;    // time offset in milliseconds from tour start
}
```

### 8.3. Pagination Object

```typescript
interface PageInfo {
  size: number;          // items per page
  totalElements: number; // total items across all pages
  totalPages: number;    // total number of pages
  number: number;        // current page (0-indexed)
}
```

### 8.4. Login Response (v006)

```typescript
interface LoginResponse {
  email: string;
  username: string; // numeric user ID
  password: string; // session token
  user: {
    createdAt: string;
    username: string;
    displayname: string;
    firstname?: string;
    content: { hasImage: boolean };
    state: string;
    newsletter: boolean;
    welcomeMails: boolean;
    metric: boolean;
    locale: string;
    imageUrl: string;
    fitness: { personalised: boolean };
  };
}
```

### 8.5. Tour Object (v006)

```typescript
interface TourV006 {
  id: number;
  name: string;
  type: "RECORDED_1";
  status: "FRIENDS" | "PUBLIC" | "PRIVATE";
  creator: string;
  createdAt: string; // "2026-01-24 14:11:48 +0000"
  changedAt: string;
  recordedAt: string;
  startpoint: { x: number; y: number; z: number }; // Mercator projection
  distance: number;
  duration: number;
  altUp: number;
  altDown: number;
  altDiff: number;
  sport: string;
  motionDuration: number;
  mobile: boolean;
  kcalActive: number;
  kcalResting: number;
  poorQuality: boolean;
  trackSourceDevice: string; // JSON string
  tags: string[];
  content: { hasImage: boolean };
  usersetting: { creator: string; status: string; label: string };
}
```

---

## 9. Sport Types

Known sport types from API responses and client libraries:

| Sport Type Key | Display | Category |
|---|---|---|
| `hike` / `hiking` | 🥾 Hiking | Walking |
| `mountaineering` | ⛰️ Mountaineering | Walking |
| `nordic_walking` | 🚶 Nordic Walking | Walking |
| `touringbicycle` | 🚴 Touring Bicycle | Cycling |
| `racebike` | 🚴‍♂️ Race Bike | Cycling |
| `gravel_cycling` | 🚴 Gravel Cycling | Cycling |
| `mtb` | 🚵 Mountain Bike | Cycling |
| `mtb_easy` | 🚵 MTB Easy | Cycling |
| `mtb_advanced` | 🚵 MTB Advanced | Cycling |
| `mtb_enduro` | 🚵 MTB Enduro | Cycling |
| `e_touringbicycle` | ⚡ E-Touring | E-Bike |
| `e_mtb` | ⚡ E-MTB | E-Bike |
| `e_racebike` | ⚡ E-Race Bike | E-Bike |
| `jogging` / `running` | 🏃 Running | Running |
| `nordic` | ⛷️ Cross-Country Skiing | Winter |
| `skitour` | ⛷️ Ski Tour | Winter |
| `snowshoe` | 🏔️ Snowshoeing | Winter |
| `climbing` | 🧗 Climbing | Other |

Additional sport types from the kompy library (uppercase format used in some contexts): `BIKING`, `E_BIKING`, `ROAD_CYCLING`, `MT_BIKING`, `E_MT_BIKING`, `E_BIKE_TOURING`, `RUNNING`, `TRAIL_RUNNING`, `HIKING`, `WALKING`, `CLIMBING`, `SKIING`, `CROSS_COUNTRY_SKIING`, `SNOWSHOEING`, `PADDLING`, `INLINE_SKATING`.

> The API may introduce new sport types at any time. Clients should handle unknown values gracefully with a sensible default.

---

## 10. Implementation Notes

### 10.1. Recommended Authentication Flow

1. Login via `GET https://api.komoot.de/v006/account/email/{email}/` with Basic Auth (`email:password`).
2. Extract `username` (userId) and `password` (token) from the response.
3. Store only `{ userId, token, displayName }` in `sessionStorage`. **Never store the original email/password.**
4. Use Basic Auth (`userId:token`) for all subsequent requests to `api.komoot.de` and `www.komoot.com/api`.
5. On any `401`/`403` response, clear the stored auth and redirect to login with a "session expired" message.

### 10.2. Fetching All Tours Efficiently

```
GET /v007/users/{userId}/tours/?limit=500&page=0
```
- Use `limit=500` (or even `1000`) to minimize round-trips. No server-side max is enforced.
- Loop pages until `page >= totalPages` or an empty page is returned.
- There is **no server-side field filtering** — the full tour object is always returned. Filter fields client-side.

### 10.3. Folder/Directory Convention

Tours are organized into a virtual folder hierarchy using `/` as the separator in the `name` field. For example:
- `"Austria / Alps / Mountain Hike"` → folder `Austria/Alps`, leaf name `Mountain Hike`
- `"My Tour"` → root level, no folder

Renaming a tour's `name` field via PATCH effectively moves it between folders. There is no dedicated directory/folder API.

### 10.4. Coordinate Availability

- Coordinates for **planned tours** are generally always available.
- Coordinates for **recorded tours** may return `404` on the `/coordinates` sub-endpoint. As a fallback, use the `start_point` from the tour object to show a marker on the map.
- Coordinates are cacheable — they do not change for a given tour ID.

### 10.5. Elevation Profile Data

The `alt` field in coordinate data provides elevation for building elevation profiles. The `t` field provides time offsets for time-based analysis. Use Haversine cumulative distance for an accurate distance-proportional x-axis.

### 10.6. Endpoint Summary Table

| Method | Endpoint | Domain | Auth | Description |
|---|---|---|---|---|
| GET | `/v006/account/email/{email}/` | `api.komoot.de` | Basic (email:pw) | Login |
| GET | `/v007/users/{userId}/tours/` | `api.komoot.de` | Basic (id:token) | List tours |
| GET | `/v007/users/me/tours/` | `external-api.komoot.de` | Bearer | List own tours (OAuth) |
| GET | `/v007/tours/{id}` | `api.komoot.de` or `external-api` | Basic or Bearer | Get tour detail |
| GET | `/v007/tours/{id}/coordinates` | `api.komoot.de` | Basic | Get coordinates |
| GET | `/v007/tours/{id}.gpx` | `api.komoot.de` | Basic | Download GPX |
| GET | `/v007/tours/{id}.fit` | `api.komoot.de` | Basic | Download FIT |
| POST | `/v007/tours/?data_type={fmt}` | `api.komoot.de` or `external-api` | Basic or Bearer | Upload tour |
| PATCH | `/v007/tours/{id}?hl=de` | `www.komoot.com/api` | Basic (id:token) | Rename/update tour |
| DELETE | `/v007/tours/{id}` | `api.komoot.de` | Basic | Delete tour |
| GET | `/v007/tours/{id}/timeline/` | `api.komoot.de` | Basic | Timeline events |
| GET | `/v007/tours/{id}/participants/` | `api.komoot.de` | Basic | Participants |
| GET | `/v007/tours/{id}/way_types` | `api.komoot.de` | Basic | Way types |
| GET | `/v007/tours/{id}/surfaces` | `api.komoot.de` | Basic | Surfaces |
| GET | `/v007/tours/{id}/directions` | `api.komoot.de` | Basic | Directions |
| GET | `/v007/tours/{id}/tour_line` | `api.komoot.de` | Basic | Tour polyline |
| GET | `/v007/tours/{id}/translations` | `api.komoot.de` | Basic | Translations |
| GET | `/v007/tours/{id}/cover_images/` | `api.komoot.de` | Basic | Cover images |
| GET | `/v007/tours/{id}/ratings/{userId}` | `api.komoot.de` | Basic | Tour rating |
| GET | `/v007/tours/{id}/faqs` | `api.komoot.de` | Basic | FAQs |
| GET | `/v007/tours/{id}/details` | `api.komoot.de` | Basic | Additional details |
| GET | `/v007/users/{id}/profile_embedded` | `api.komoot.de` | Basic | User profile |
| GET | `/v007/users/{id}/relations/{targetId}` | `api.komoot.de` | Basic | User relations |
| GET | `/v007/users/{id}/config` | `api.komoot.de` | Basic | User config |
| GET | `/oauth/authorize` | `auth.komoot.de` | — | OAuth authorization |
| POST | `/oauth/token` | `auth.komoot.de` | Basic (client) | OAuth token exchange |
