import { cloneDeep, extend, has, isString, map as _map, omit, pick, reduce } from 'lodash';
import { lastValueFrom, merge, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  AnnotationEvent,
  ArrayVector,
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  dateMath,
  FieldType,
  MetricFindValue,
  QueryResultMeta,
  ScopedVars,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
  TimeSeries,
  toDataFrame,
} from '@grafana/data';

import { AnnotationEditor } from './components/AnnotationEditor';
import InfluxQueryModel from './query_model';
import InfluxSeries from './influx_series';
import { prepareAnnotation } from './migrations';
// import { buildRawQuery } from './queryUtils';
import { InfluxQueryBuilder } from './query_builder';
import ResponseParser from './response_parser';
import { InfluxOptions, InfluxQuery } from './types';
import { HttpClient } from './http_client';

// we detect the field type based on the value-array
function getFieldType(values: unknown[]): FieldType {
  // the values-array may contain a lot of nulls.
  // we need the first not-null item
  const firstNotNull = values.find((v) => v !== null);

  if (firstNotNull === undefined) {
    // we could not find any not-null values
    return FieldType.number;
  }

  const valueType = typeof firstNotNull;

  switch (valueType) {
    case 'string':
      return FieldType.string;
    case 'boolean':
      return FieldType.boolean;
    case 'number':
      return FieldType.number;
    default:
      // this should never happen, influxql values
      // can only be numbers, strings and booleans.
      throw new Error(`InfluxQL: invalid value type ${valueType}`);
  }
}

// this conversion function is specialized to work with the timeseries
// data returned by InfluxDatasource.getTimeSeries()
function timeSeriesToDataFrame(timeSeries: TimeSeries): DataFrame {
  const times: number[] = [];
  const values: unknown[] = [];

  // the data we process here is not correctly typed.
  // the typescript types say every data-point is number|null,
  // but in fact it can be string or boolean too.

  const points = timeSeries.datapoints;
  for (const point of points) {
    values.push(point[0]);
    times.push(point[1] as number);
  }

  const timeField = {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {},
    values: new ArrayVector<number>(times),
  };

  const valueField = {
    name: TIME_SERIES_VALUE_FIELD_NAME,
    type: getFieldType(values),
    config: {
      displayNameFromDS: timeSeries.title,
    },
    values: new ArrayVector<unknown>(values),
    labels: timeSeries.tags,
  };

  const fields = [timeField, valueField];

  return {
    name: timeSeries.target,
    refId: timeSeries.refId,
    meta: timeSeries.meta,
    fields,
    length: values.length,
  };
}

export default class CnosDatasource extends DataSourceApi<InfluxQuery, InfluxOptions> {
  type: string;
  urls: string[];
  username: string;
  password: string;
  name: string;
  database: any;
  basicAuth: any;
  withCredentials: any;
  interval: any;
  httpClient: HttpClient;
  responseParser: any;

  constructor(instanceSettings: DataSourceInstanceSettings<InfluxOptions>) {
    super(instanceSettings);

    console.log('InfluxDatasource_constructor', instanceSettings);

    this.type = 'influxdb';
    this.urls = (instanceSettings.url ?? '').split(',').map((url) => {
      return url.trim();
    });

    this.username = instanceSettings.username ?? '';
    this.password = instanceSettings.password ?? '';
    this.name = instanceSettings.name;
    this.database = instanceSettings.database;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    const settingsData = instanceSettings.jsonData || ({} as InfluxOptions);
    this.interval = settingsData.timeInterval;
    this.httpClient = new HttpClient();
    this.responseParser = new ResponseParser();

    this.annotations = {
      QueryEditor: AnnotationEditor,
      prepareAnnotation,
    };
  }

  query(request: DataQueryRequest<InfluxQuery>): Observable<DataQueryResponse> {
    return this._classicQuery(request);
  }

  testDatasource(): Promise<any> {
    return lastValueFrom(this.httpClient.get('/ping')).then((data: any) => {
      console.log('ping response', data);
    });
  }

  /**
   * Returns false if the query should be skipped
   */
  filterQuery(query: InfluxQuery): boolean {
    console.log("Filtering query to skip", query);
    return true;
  }

  getQueryDisplayText(query: InfluxQuery) {
    console.log("Getting query display text", query);
    return new InfluxQueryModel(query).render(false);
  }

  async metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
    console.log('metric find query: query', query);
    return lastValueFrom(this._seriesQuery(query, options)).then((resp) => {
      console.log('metric find query: response', resp);
      return this.responseParser.parse(query, resp);
    });
  }

  getTagKeys(options: any = {}) {
    console.log('get tag keys', this);
    const queryBuilder = new InfluxQueryBuilder({ measurement: options.measurement || '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('TAG_KEYS');
    return this.metricFindQuery(query, options);
  }

  getTagValues(options: any = {}) {
    console.log('get tag values', this);
    const queryBuilder = new InfluxQueryBuilder({ measurement: options.measurement || '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('TAG_VALUES', options.key);
    return this.metricFindQuery(query, options);
  }

  interpolateVariablesInQueries(queries: InfluxQuery[], scopedVars: ScopedVars): InfluxQuery[] {
    console.log("Interpolate variables in queries: ", queries, scopedVars);
    if (!queries || queries.length === 0) {
      return [];
    }

    return queries.map((query) => {
      return {
        ...query,
        datasource: this.getRef(),
        ...this._applyVariables(query, scopedVars, scopedVars),
      };
    });
  }

  _classicQuery(options: any): Observable<DataQueryResponse> {
    console.log("Classic query", options);

    // migrate annotations
    if (options.targets.some((target: InfluxQuery) => target.fromAnnotations)) {
      const streams: Array<Observable<DataQueryResponse>> = [];
      console.log("Classic query: annotation");
      for (const target of options.targets) {
        if (target.query) {
          streams.push(
            new Observable((subscriber) => {
              this._annotationEvents(options, target)
                .then((events) => subscriber.next({ data: [toDataFrame(events)] }))
                .catch((ex) => subscriber.error(new Error(ex)))
                .finally(() => subscriber.complete());
            })
          );
        }
      }

      return merge(...streams);
    }

    console.log("Classic query: others");

    let timeFilter = this.getTimeFilter(options);
    const scopedVars = options.scopedVars;
    const targets = cloneDeep(options.targets);
    const queryTargets: any[] = [];

    let i, y;

    let allQueries = _map(targets, (target) => {
      if (target.hide) {
        return '';
      }

      queryTargets.push(target);

      // backward compatibility
      scopedVars.interval = scopedVars.__interval;

      return new InfluxQueryModel(target, scopedVars).render(true);
    }).reduce((acc, current) => {
      if (current !== '') {
        acc += ';' + current;
      }
      return acc;
    });

    if (allQueries === '') {
      return of({ data: [] });
    }

    // replace grafana variables
    scopedVars.timeFilter = { value: timeFilter };

    return this._seriesQuery(allQueries, options).pipe(
      map((data: any) => {
        if (!data || !data.results) {
          return { data: [] };
        }

        const seriesList = [];
        for (i = 0; i < data.results.length; i++) {
          const result = data.results[i];
          if (!result || !result.series) {
            continue;
          }

          const target = queryTargets[i];
          let alias = target.alias;
          // if (alias) {
          //   alias = this.templateSrv.replace(target.alias, options.scopedVars);
          // }

          const meta: QueryResultMeta = {
            executedQueryString: data.executedQueryString,
          };

          const influxSeries = new InfluxSeries({
            refId: target.refId,
            series: data.results[i].series,
            alias: alias,
            meta,
          });

          switch (target.resultFormat) {
            case 'logs':
              meta.preferredVisualisationType = 'logs';
            case 'table': {
              seriesList.push(influxSeries.getTable());
              break;
            }
            default: {
              const timeSeries = influxSeries.getTimeSeries();
              for (y = 0; y < timeSeries.length; y++) {
                seriesList.push(timeSeriesToDataFrame(timeSeries[y]));
              }
              break;
            }
          }
        }

        return { data: seriesList };
      })
    );
  }

  async _annotationEvents(options: DataQueryRequest, annotation: InfluxQuery): Promise<AnnotationEvent[]> {
    console.log("Annotation events", annotation);
    // InfluxQL puts a query string on the annotation
    if (!annotation.query) {
      return Promise.reject({
        message: 'Query missing in annotation definition',
      });
    }

    const timeFilter = this.getTimeFilter({ rangeRaw: options.range.raw, timezone: options.timezone });
    let query = annotation.query.replace('$timeFilter', timeFilter);

    return lastValueFrom(this._seriesQuery(query, options)).then((data: any) => {
      console.log("Annotation events: resp", data);
      if (!data || !data.results || !data.results[0]) {
        throw { message: 'No results in response from InfluxDB' };
      }
      return new InfluxSeries({
        series: data.results[0].series,
        annotation: annotation,
      }).getAnnotations();
    });
  }

  // targetContainsTemplate(target: any) {
  //   // for flux-mode we just take target.query,
  //   // for influxql-mode we use InfluxQueryModel to create the text-representation
  //   const queryText = buildRawQuery(target);
  //
  //   return this.templateSrv.containsTemplate(queryText);
  // }

  _applyVariables(query: InfluxQuery, scopedVars: ScopedVars, rest: ScopedVars) {
    return query;

    // const expandedQuery = { ...query };
    // if (query.groupBy) {
    //   expandedQuery.groupBy = query.groupBy.map((groupBy) => {
    //     return {
    //       ...groupBy,
    //       params: groupBy.params?.map((param) => {
    //         return this.templateSrv.replace(param.toString(), undefined, 'regex');
    //       }),
    //     };
    //   });
    // }
    //
    // if (query.select) {
    //   expandedQuery.select = query.select.map((selects) => {
    //     return selects.map((select: any) => {
    //       return {
    //         ...select,
    //         params: select.params?.map((param: any) => {
    //           return this.templateSrv.replace(param.toString(), undefined, 'regex');
    //         }),
    //       };
    //     });
    //   });
    // }
    //
    // if (query.tags) {
    //   expandedQuery.tags = query.tags.map((tag) => {
    //     return {
    //       ...tag,
    //       value: this.templateSrv.replace(tag.value, scopedVars, 'regex'),
    //     };
    //   });
    // }
    //
    // return {
    //   ...expandedQuery,
    //   query: this.templateSrv.replace(query.query ?? '', rest, 'regex'), // The raw query text
    //   alias: this.templateSrv.replace(query.alias ?? '', scopedVars),
    //   limit: this.templateSrv.replace(query.limit?.toString() ?? '', scopedVars, 'regex'),
    //   measurement: this.templateSrv.replace(query.measurement ?? '', scopedVars, 'regex'),
    //   policy: this.templateSrv.replace(query.policy ?? '', scopedVars, 'regex'),
    //   slimit: this.templateSrv.replace(query.slimit?.toString() ?? '', scopedVars, 'regex'),
    //   tz: this.templateSrv.replace(query.tz ?? '', scopedVars),
    // };
  }

  _seriesQuery(query: string, options?: any) {
    console.log('_seriesQuery', query, options);
    if (!query) {
      return of({ results: [] });
    }

    if (options && options.range) {
      const timeFilter = this.getTimeFilter({ rangeRaw: options.range, timezone: options.timezone });
      query = query.replace('$timeFilter', timeFilter);
    }

    return this._influxRequest('POST', '/query', { q: query, epoch: 'ms' }, options);
  }

  serializeParams(params: any) {
    if (!params) {
      return '';
    }

    return reduce(
      params,
      (memo, value, key) => {
        if (value === null || value === undefined) {
          return memo;
        }
        memo.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        return memo;
      },
      [] as string[]
    ).join('&');
  }

  _influxRequest(method: string, url: string, data: any, options?: any) {
    const currentUrl = this.urls.shift()!;
    this.urls.push(currentUrl);

    const params: any = {};

    if (options && options.database) {
      params.db = options.database;
    } else if (this.database) {
      params.db = this.database;
    }

    const { q } = data;

    console.log('query', q);

    if (method === 'POST' && has(data, 'q')) {
      // verb is POST and 'q' param is defined
      extend(params, omit(data, ['q']));
      data = this.serializeParams(pick(data, ['q']));
    } else if (method === 'GET' || method === 'POST') {
      // verb is GET, or POST without 'q' param
      extend(params, data);
      data = null;
    }

    console.log("Preparing http post", url, data, params)

    // return Observable.from()
    return this.httpClient.post(url, data, params).pipe(
      map((result: any) => {
        const { data } = result;
        if (data) {
          data.executedQueryString = q;
          if (data.results) {
            const errors = result.data.results.filter((elem: any) => elem.error);

            if (errors.length > 0) {
              throw {
                message: 'InfluxDB Error: ' + errors[0].error,
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

        return throwError(this.handleErrors(err));
      })
    );
  }

  handleErrors(err: any) {
    console.log("Handling error", err);
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

  getTimeFilter(options: any) {
    const from = this.getInfluxTime(options.rangeRaw.from, false, options.timezone);
    const until = this.getInfluxTime(options.rangeRaw.to, true, options.timezone);
    console.log("Get time filter", from, until);

    return 'time >= ' + from + ' and time <= ' + until;
  }

  getInfluxTime(date: any, roundUp: any, timezone: any) {
    console.log("Get influx time", date, roundUp, timezone);
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
