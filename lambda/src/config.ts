/**
 * Settings. The defaults are production values: an Alexa-hosted skill cannot set Lambda
 * environment variables, so nothing here may be secret. The environment can override them
 * (own Lambda later, tests).
 */
const env = process.env;

export const config = {
  /** Jahresrad API, see docs/API.md in apachler/pacnaturgarten. */
  apiBaseUrl: env.JAHRESRAD_API_BASE_URL ?? 'https://naturgarten.bio/api/v1/jahresrad',
  /** Per request; Alexa allows about 8 s for the whole response. */
  apiTimeoutMs: Number(env.JAHRESRAD_API_TIMEOUT_MS ?? 3000),
  /** Cached answers are asked again (If-None-Match) after this long, at the latest at local midnight. */
  revalidateAfterMs: 60 * 60 * 1000,
  /** Time zone when the Alexa Settings API does not answer; also the API's own default. */
  defaultTimeZone: 'Europe/Vienna',
  timeZoneLookupMs: 800,
  siteUrl: 'https://naturgarten.bio',
  profileUrl: 'https://naturgarten.bio/profil',
  /** Provided by Alexa-hosted skills; without them attributes live in memory only. */
  dynamoTable: env.DYNAMODB_PERSISTENCE_TABLE_NAME,
  dynamoRegion: env.DYNAMODB_PERSISTENCE_REGION,
};
