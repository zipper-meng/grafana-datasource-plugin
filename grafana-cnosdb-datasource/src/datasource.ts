import {
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { merge } from 'lodash';

import { of, throwError, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { CnosDataSourceOptions, CnosQuery } from './types';

export class DataSource extends DataSourceWithBackend<CnosQuery, CnosDataSourceOptions> {
  database: string;
  userId: string;
  rawQuery: boolean;
  constructor(instanceSettings: DataSourceInstanceSettings<CnosDataSourceOptions>) {
    super(instanceSettings);
    this.database = instanceSettings.database ?? '';
    let { jsonData } = instanceSettings;
    this.userId = jsonData.user_id ?? '';
    this.rawQuery = true;
  }

  // query(request: DataQueryRequest<CnosQuery>): Observable<DataQueryResponse> {
  //   console.log('query', request.targets);

  //   return this.cnosQuery('select * from ma');
  // }

  query(options: DataQueryRequest<CnosQuery>): Observable<DataQueryResponse> {
    const streams: Array<Observable<DataQueryResponse>> = [];
    for (const target of options.targets) {
      console.log('target', target);
      let queryText = target.queryText ?? '';

      streams.push(
        new Observable((subscriber) => {
          console.log('running cnosQuery', queryText);
          cnosQuery(queryText, options);
        })
      );
    }

    return merge(streams);
  }

  interpolateVariablesInQueries(queries: CnosQuery[], scopedVars: ScopedVars | {}): CnosQuery[] {
    console.log('interpolate veriables in queries', queries, scopedVars);

    return queries;
  }

  applyTemplateVariables(query: CnosQuery, scopedVars: ScopedVars): Record<string, any> {
    console.log('apply template variables', query, scopedVars);

    return query;
  }
}

/**
 * 执行 HTTP 请求，并附带 Header
 * @param uri 请求路径，如 '/read', '/write'
 * @param data 请求参数，位于 body 中
 * @param options 面板参数列表
 * @returns Observable<FetchResponse<?>>
 */
export async function doRequest(uri: string, sql: string, options?: any) {
  const headers: any = {};

  if (options) {
    if (options.database) {
      headers.database = options.database;
    }
    if (options.user_id) {
      headers.user_id = options.user_id;
    }
  }

  const req: any = {
    method: 'POST',
    url: 'http://127.0.0.1:31007' + uri,
    data: sql,
  };

  req.headers = headers;
  req.headers['Content-type'] = 'application/x-www-form-urlencoded';

  return getBackendSrv()
    .fetch(req)
    .pipe(
      map((result: any) => {
        const { data } = result;
        if (data) {
          console.log(data);
          data.executedQueryString = sql;
          if (data.results) {
            const errors = result.data.results.filter((elem: any) => elem.error);
            if (errors.length > 0) {
              throw {
                message: 'CnosDB Error: ' + errors[0].error,
                data,
              };
            }
          }
        }
        return data;
      }),
      catchError((err) => {
        if (err.cancelled) {
          return of(err);
        }
        return throwError(handleErrors(err));
      })
    );
}

function handleErrors(err: any): any {
  const error: DataQueryError = {
    message:
      (err && err.status) ||
      (err && err.message) ||
      'Unknown error during query transaction. Please check JS console logs.',
  };

  if ((Number.isInteger(err.status) && err.status !== 0) || err.status >= 300) {
    if (err.data && err.data.error) {
      error.message = 'InfluxDB Error: ' + err.data.error;
      error.data = err.data;
      // @ts-ignore
      error.config = err.config;
    } else {
      error.message = 'Network Error: ' + err.statusText + '(' + err.status + ')';
      error.data = err.data;
      // @ts-ignore
      error.config = err.config;
    }
  }

  return error;
}

async function cnosQuery(sql: string, options?: any) {
  return doRequest('/query', sql, options);
}

async function getDatabases() {
  cnosQuery("SHOW DATABASES")
}
