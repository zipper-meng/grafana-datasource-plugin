import {CnosDataSource} from './datasource';
import {TagItem} from "./types";

export async function getAllTables(
  filter: string | undefined,
  datasource: CnosDataSource
): Promise<string[]> {
  const data = await datasource.metricFindQuery('SHOW TABLES', datasource);
  return data.map((item) => item.text);
}

export async function getTagKeysFromTable(
  table: string | undefined,
  tags: TagItem[],
  datasource: CnosDataSource
): Promise<string[]> {
  const data = await datasource.metricFindQuery('-- tag;\nDESCRIBE TABLE ' + table, datasource);
  return data.map((item) => item.text);
}

export async function getFieldNamesFromTable(
  table: string | undefined,
  datasource: CnosDataSource
): Promise<string[]> {
  const data = await datasource.metricFindQuery('-- field;\nDESCRIBE TABLE ' + table, datasource);
  return data.map((item) => item.text);
}
