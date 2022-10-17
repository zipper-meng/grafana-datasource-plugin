import {DataSourcePlugin} from '@grafana/data';

import {CnosDataSourceOptions, CnosQuery} from './types';
import {DataSource} from './datasource';
import {ConfigEditor} from './components/ConfigEditor';
import {QueryEditor} from './components/QueryEditor';

export const plugin = new DataSourcePlugin<DataSource, CnosQuery, CnosDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
