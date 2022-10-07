import { DataQuery, DataSourceJsonData } from '@grafana/data';

export enum QueryVersion {
  InfluxQL = 'InfluxQL',
  Sql = 'Sql',
  PgSql = "PgSql",
}

export interface InfluxOptions extends DataSourceJsonData {
  version?: QueryVersion;
  timeInterval?: string;
  maxSeries?: number;
}

export interface InfluxSecureJsonData {
  password?: string;
}

export interface InfluxQueryPart {
  type: string;
  params?: Array<string | number>;
  // FIXME: `interval` does not seem to be used.
  // check all the influxdb parts (query-generation etc.),
  // if it is really so, and if yes, remove it
  interval?: string;
}

export interface InfluxQueryTag {
  key: string;
  operator?: string;
  condition?: string;
  value: string;
}

export type ResultFormat = 'time_series' | 'table' | 'logs';

export interface InfluxQuery extends DataQuery {
  policy?: string;
  measurement?: string;
  resultFormat?: ResultFormat;
  orderByTime?: string;
  tags?: InfluxQueryTag[];
  groupBy?: InfluxQueryPart[];
  select?: InfluxQueryPart[][];
  limit?: string | number;
  slimit?: string | number;
  tz?: string;
  // NOTE: `fill` is not used in the query-editor anymore, and is removed
  // if any change happens in the query-editor. the query-generation still
  // supports it for now.
  fill?: string;
  rawQuery?: boolean;
  query?: string;
  alias?: string;
  // for migrated InfluxQL annotations
  queryType?: string;
  fromAnnotations?: boolean;
  tagsColumn?: string;
  textColumn?: string;
  timeEndColumn?: string;
  titleColumn?: string;
  name?: string;
  textEditor?: boolean;
}
