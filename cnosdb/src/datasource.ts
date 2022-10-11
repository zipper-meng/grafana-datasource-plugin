import {cloneDeep, isString, map} from 'lodash';
import {map as map_rx, Observable, of, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';

import {
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateMath,
} from '@grafana/data';
import {DataSourceWithBackend, getBackendSrv, getTemplateSrv, TemplateSrv} from '@grafana/runtime';

import {MyDataSourceOptions, MyQuery} from './types';
import {HttpClient} from 'http_client';
import ResponseParser from './response_parser';
import CnosdbQueryModel from 'cnosql_query_model';

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  url: string;
  database: string;
  auth: string;
  httpClient: HttpClient;
  responseParser: ResponseParser;

  constructor(
    instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    console.log('Datasource constructing', instanceSettings);
    super(instanceSettings);

    this.url = instanceSettings.url ?? instanceSettings.jsonData.url ?? '';
    this.database = instanceSettings.database ?? instanceSettings.jsonData.database ?? '';
    this.auth = instanceSettings.jsonData.auth ?? '';
    this.httpClient = new HttpClient(this.url);
    this.responseParser = new ResponseParser();
    console.log('Datasource constructed', this);
  }

  // query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {
  //   return this._query(options);
  // }

  // async testDatasource() {
  //   // Implement a health check for your data source.
  //   return {
  //     status: 'success',
  //     message: 'Success',
  //   };
  // }

  // async metricFindQuery(
  //   query: string,
  //   options?: any
  // ): Promise<Array<{
  //   text: string;
  //   value?: string | number;
  //   expandable?: boolean;
  // }>> {
  //   console.log('Quering metrics', query, options);
  //   if (options && options.range) {
  //     const timeFilter = this.getTimeFilter({rangeRaw: options.range, timezone: options.timezone});
  //     query = query.replace('$timeFilter', timeFilter);
  //   }
  //   const interpolated = this.templateSrv.replace(query, undefined, 'regex');

  //   return lastValueFrom(
  //     this.httpClient.post(
  //       '/api/v1/sql',
  //       interpolated,
  //       {db: this.database},
  //       {
  //         Accept: 'application/json',
  //         Authorization: this.auth,
  //       }
  //     )
  //   ).then((resp) => {
  //     return this.responseParser.parse(query, resp);
  //   });
  // }

  _query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {
    const scopedVars = options.scopedVars;
    const targets = cloneDeep(options.targets);

    let queryTargets: any[] = [];

    let allQueries = map(targets, (target) => {
      if (target.hide) {
        return '';
      }
      queryTargets.push(target);
      scopedVars.interval = scopedVars.__interval;
      return new CnosdbQueryModel(target, this.templateSrv, scopedVars).render(true);
    }).reduce((acc, current) => {
      if (current !== '') {
        acc += ';' + current;
      }
      return acc;
    });

    console.log('Request', allQueries);

    if (allQueries === '') {
      return of({data: []});
    }

    // // add global adhoc filters to timeFilter
    // const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    // if (adhocFilters.length > 0) {
    //   const tmpQuery = new CnosdbQueryModel({ refId: 'A' }, this.templateSrv, scopedVars);
    //   timeFilter += ' AND ' + tmpQuery.renderAdhocFilters(adhocFilters);
    // }

    // // replace grafana variables
    // scopedVars.timeFilter = { value: timeFilter };

    // replace templated variables
    allQueries = this.templateSrv.replace(allQueries, scopedVars);
    if (options && options.range) {
      const timeFilter = this.getTimeFilter({rangeRaw: options.range, timezone: options.timezone});
      allQueries = allQueries.replace('$timeFilter', timeFilter);
    }

    console.log('Replaces request', allQueries);

    return this._backendRequest(allQueries, queryTargets, options);
  }

  _backendRequest(query: string, targets: any[], options: DataQueryRequest<MyQuery>) {
    const req: any = {
      method: 'POST',
      url: this.url + '/api/v1/sql',
      params: {db: this.database},
      data: query,
    };
    req.headers['Content-type'] = 'plain/text';
    return getBackendSrv().fetch(req)
      .pipe(
        map_rx((result: any) => {
          console.log("Backend service response", result);
          const {data} = result;
          if (data) {
            data.executedQueryString = query;
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

          return throwError(this._handleErrors(err));
        })
      );
  }

  _handleErrors(err: any) {
    const error: DataQueryError = {
      message:
        (err && err.status) ||
        (err && err.message) ||
        'Unknown error during query transaction. Please check JS console logs.',
    };

    if ((Number.isInteger(err.status) && err.status !== 0) || err.status >= 300) {
      if (err.data && err.data.error) {
        error.message = 'CnosDB Error: ' + err.data.error;
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

  getTimeFilter(options: any) {
    const from = this.parseTime(options.rangeRaw.from, false, options.timezone);
    const to = this.parseTime(options.rangeRaw.to, true, options.timezone);

    return 'time >= ' + from + ' and time <= ' + to;
  }

  parseTime(date: any, roundUp: any, timezone: any) {
    if (isString(date)) {
      if (date === 'now') {
        return 'now()';
      }

      const parts = /^now-(\d+)([dhms])$/.exec(date);
      if (parts) {
        const amount = parseInt(parts[1], 10);
        const unit = parts[2];
        return 'now() - ' + amount + unit;
      }
      date = dateMath.parse(date, roundUp, timezone);
    }

    return date.valueOf() + 'ms';
  }
}

// we detect the field type based on the value-array
// function getFieldType(values: unknown[]): FieldType {
//   // the values-array may contain a lot of nulls.
//   // we need the first not-null item
//   const firstNotNull = values.find((v) => v !== null);
//
//   if (firstNotNull === undefined) {
//     // we could not find any not-null values
//     return FieldType.number;
//   }
//
//   const valueType = typeof firstNotNull;
//
//   switch (valueType) {
//     case 'string':
//       return FieldType.string;
//     case 'boolean':
//       return FieldType.boolean;
//     case 'number':
//       return FieldType.number;
//     default:
//       // this should never happen, values
//       // can only be numbers, strings and booleans.
//       throw new Error(`CnosQL: invalid value type ${valueType}`);
//   }
// }

// this conversion function is specialized to work with the timeseries
// data returned by MyDataSource.getTimeSeries()
// function timeSeriesToDataFrame(timeSeries: TimeSeries): DataFrame {
//   const times: number[] = [];
//   const values: unknown[] = [];
//
//   // the data we process here is not correctly typed.
//   // the typescript types say every data-point is number|null,
//   // but in fact it can be string or boolean too.
//
//   const points = timeSeries.datapoints;
//   for (const point of points) {
//     values.push(point[0]);
//     times.push(point[1] as number);
//   }
//
//   const timeField = {
//     name: TIME_SERIES_TIME_FIELD_NAME,
//     type: FieldType.time,
//     config: {},
//     values: new ArrayVector<number>(times),
//   };
//
//   const valueField = {
//     name: TIME_SERIES_VALUE_FIELD_NAME,
//     type: getFieldType(values),
//     config: {
//       displayNameFromDS: timeSeries.title,
//     },
//     values: new ArrayVector<unknown>(values),
//     labels: timeSeries.tags,
//   };
//
//   const fields = [timeField, valueField];
//
//   return {
//     name: timeSeries.target,
//     refId: timeSeries.refId,
//     meta: timeSeries.meta,
//     fields,
//     length: values.length,
//   };
// }
