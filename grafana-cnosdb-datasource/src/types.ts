import { Column, DataQuery, DataSourceJsonData, QueryResultMeta, TableData } from '@grafana/data';

export interface CnosQuery extends DataQuery {
  rawQuery: boolean;
  version: number;

  queryText?: string;

  table?: string;
  select?: string;
  groupBy?: string;
  limit?: string | number;
}

export const defaultQuery: Partial<CnosQuery> = {
  version: 1.0,
};

/**
 * Options configured for CnosDB DataSource instance
 */
export interface CnosDataSourceOptions extends DataSourceJsonData {
  host?: string;
  database?: string;
  user_id?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface SecureJsonData {
  apiKey?: string;
}

class CnosResponseResult {
  statement_id
}

export class CnosResponse {
  results: CnosResponseResult[];
  
}
