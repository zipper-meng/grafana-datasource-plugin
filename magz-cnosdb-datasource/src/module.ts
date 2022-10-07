import { DataSourcePlugin } from '@grafana/data';

import ConfigEditor from './components/ConfigEditor';
import StartPage from './components/StartPage';
import { QueryEditor } from './components/QueryEditor';
import CnosDatasource from './datasource';

export const plugin = new DataSourcePlugin(CnosDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setQueryEditorHelp(StartPage);
