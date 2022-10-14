import {DataSourceWithBackend} from '@grafana/runtime';

import {CnosDataSourceOptions, CnosQuery} from './types';
import {DataSourceInstanceSettings} from "@grafana/data";

export class DataSource extends DataSourceWithBackend<CnosQuery, CnosDataSourceOptions> {

  constructor(
    instanceSettings: DataSourceInstanceSettings<CnosDataSourceOptions>
  ) {
    super(instanceSettings);
  }
}
