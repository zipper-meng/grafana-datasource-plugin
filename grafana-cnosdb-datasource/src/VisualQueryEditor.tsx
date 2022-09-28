import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { CodeEditor } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';

import { DataSource } from './datasource';
import { defaultQuery, CnosDataSourceOptions, CnosQuery } from './types';

type Props = QueryEditorProps<DataSource, CnosQuery, CnosDataSourceOptions>;

export class VisualQueryEditor extends PureComponent<Props> {
  onQueryTextChange = (queryText: string) => {
    console.log("onQueryTextChange", queryText);
    this.props.onChange({ ...this.props.query, queryText });
    this.props.onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { queryText } = query;

    return (
      <>
        <CodeEditor
          width=""
          height="100px"
          language="sql"
          value={queryText || ''}
          onBlur={this.onQueryTextChange}
          onSave={this.onQueryTextChange}
          showMiniMap={false}
          showLineNumbers={true}
        />
      </>
    );
  }
}
