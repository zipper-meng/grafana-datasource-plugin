import {lastValueFrom, of} from 'rxjs';
import {map} from 'rxjs/operators';

import {DataSourceInstanceSettings, MetricFindValue} from "@grafana/data";
import {DataSourceWithBackend, getBackendSrv, getTemplateSrv, TemplateSrv} from '@grafana/runtime';
import {BackendSrvRequest} from "@grafana/runtime/services/backendSrv";

import {CnosDataSourceOptions, CnosQuery} from './types';
import {each, findIndex, zip} from "lodash";
import {DataFrameJSON} from "@grafana/data/dataframe/DataFrameJSON";

export class CnosDataSource extends DataSourceWithBackend<CnosQuery, CnosDataSourceOptions> {
  datasourceUid: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<CnosDataSourceOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.datasourceUid = instanceSettings.uid;
  }

  async metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
    const interpolated = this.templateSrv.replace(query, undefined, 'regex');
    return lastValueFrom(this._fetchMetric(interpolated)).then((results) => {
      let ret = this._parse(query, results);
      console.log("Metric query final", ret);
      return ret;
    });
  }

  _fetchMetric(query: string) {
    if (!query) {
      return of({results: []});
    }
    return this._doRequest(query);
  }

  _doRequest(query: string, options?: any) {
    const req: BackendSrvRequest = {
      method: 'POST',
      url: '/api/ds/query',
      data: {
        queries: [{
          refId: "MetricQuery",
          datasource: {uid: this.datasourceUid},
          rawQuery: true,
          queryText: query,
        }],
      },
    };
    console.log("Metric query request", req);

    return getBackendSrv()
      .fetch(req)
      .pipe(
        map((result: any) => {
          console.log("Metric query result", result);
          const {data} = result;
          return data;
        }),
      );
  }

  _parseSchema(frame: DataFrameJSON, fields: string[]): number[] {
    if (!frame.schema?.fields || frame.schema.fields.length === 0) {
      return []
    }
    const schemaFields = frame.schema.fields;
    const indexes: number[] = [];
    each(fields, (f, i) => {
      const foundIndex = findIndex(schemaFields, {name: f});
      if (foundIndex !== -1) {
        indexes.push(foundIndex);
      }
    });
    return indexes;
  }

  _parse(query: string, results: { results: any }): MetricFindValue[] {
    if (!results?.results?.MetricQuery) {
      return [];
    }

    const frames = results.results.MetricQuery.frames;
    if (!frames || frames.length === 0) {
      return [];
    }

    const frame: DataFrameJSON = frames[0];
    if (!frame.data?.values || frame.data.values.length === 0) {
      return [];
    }

    const values: any[][] = frame.data.values;

    const ret = new Set<string>();
    if (query.indexOf('SHOW TABLES') === 0) {
      let indexes = this._parseSchema(frame, ['Table']);
      if (indexes.length !== 1) {
        return [];
      }
      each(values[indexes[0]], (v) => {
        ret.add(v.toString())
      });
    } else if (query.indexOf('-- tag;\nDESCRIBE TABLE') === 0) {
      let indexes = this._parseSchema(frame, ['FIELDNAME', 'ISTAG']);
      if (indexes.length !== 2) {
        return [];
      }
      each(zip(values[indexes[0]], values[indexes[1]]), ([col, isTag]) => {
        if (isTag === true) {
          ret.add(col.toString());
        }
      });
    } else if (query.indexOf('-- field;\nDESCRIBE TABLE') === 0) {
      let indexes = this._parseSchema(frame, ['FIELDNAME', 'ISTAG']);
      if (indexes.length !== 2) {
        return [];
      }
      each(zip(values[indexes[0]], values[indexes[1]]), ([col, isTag]) => {
        if (isTag === false) {
          ret.add(col.toString());
        }
      });
    } else {
      console.log('No matches for query', query);
    }

    return Array.from(ret).map((v) => ({text: v}));
  }

}
