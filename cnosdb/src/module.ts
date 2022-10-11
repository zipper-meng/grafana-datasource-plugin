import {DataSourcePlugin} from '@grafana/data';

import {MyDataSourceOptions, MyQuery} from './types';
import {DataSource} from './datasource';
import {ConfigEditor} from './components/ConfigEditor';
import {QueryEditor} from './components/QueryEditor';

export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
