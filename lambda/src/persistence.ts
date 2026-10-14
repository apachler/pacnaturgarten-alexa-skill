import { DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { getUserId, type PersistenceAdapter } from 'ask-sdk-core';
import type { RequestEnvelope } from 'ask-sdk-model';
import { config } from './config';

/**
 * The only things the skill remembers per Alexa user. Deleted when the skill is disabled.
 */
export interface UserAttributes {
  /** The default-place hint was given once. */
  locationHintGiven?: boolean;
  /** The user has opened the skill before (welcome only on the first launch). */
  seen?: boolean;
}

/**
 * DynamoDB table of the Alexa-hosted skill (partition key `id`, string). Attributes are stored
 * as one JSON string; AWS SDK v3, because the official adapter still needs the old aws-sdk v2.
 */
export class DynamoAdapter implements PersistenceAdapter {
  constructor(
    private readonly table: string,
    private readonly client: DynamoDBClient,
  ) {}

  async getAttributes(env: RequestEnvelope): Promise<Record<string, unknown>> {
    const out = await this.client.send(new GetItemCommand({ TableName: this.table, Key: { id: { S: getUserId(env) } } }));
    const raw = out.Item?.attributes?.S;
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  async saveAttributes(env: RequestEnvelope, attributes: Record<string, unknown>): Promise<void> {
    await this.client.send(
      new PutItemCommand({ TableName: this.table, Item: { id: { S: getUserId(env) }, attributes: { S: JSON.stringify(attributes) } } }),
    );
  }

  async deleteAttributes(env: RequestEnvelope): Promise<void> {
    await this.client.send(new DeleteItemCommand({ TableName: this.table, Key: { id: { S: getUserId(env) } } }));
  }
}

/** Without a table (local runs, tests): per container only. */
export class MemoryAdapter implements PersistenceAdapter {
  readonly store = new Map<string, Record<string, unknown>>();

  async getAttributes(env: RequestEnvelope): Promise<Record<string, unknown>> {
    return { ...(this.store.get(getUserId(env)) ?? {}) };
  }

  async saveAttributes(env: RequestEnvelope, attributes: Record<string, unknown>): Promise<void> {
    this.store.set(getUserId(env), { ...attributes });
  }

  async deleteAttributes(env: RequestEnvelope): Promise<void> {
    this.store.delete(getUserId(env));
  }
}

export function defaultAdapter(): PersistenceAdapter {
  if (config.dynamoTable) {
    return new DynamoAdapter(config.dynamoTable, new DynamoDBClient({ region: config.dynamoRegion }));
  }
  return new MemoryAdapter();
}
