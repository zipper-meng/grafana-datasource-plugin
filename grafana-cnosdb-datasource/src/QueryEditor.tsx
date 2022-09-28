import { css } from '@emotion/css';
import defaults from 'lodash/defaults';
import React, { PureComponent, useCallback } from 'react';

import { Button, CodeEditor } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';

import { DataSource } from './datasource';
import { defaultQuery, CnosDataSourceOptions, CnosQuery } from './types';
import { FromSection, GroupBySection, LimitSection, OrderBySection, SelectField } from 'components/CnosSegments';

type Props = QueryEditorProps<DataSource, CnosQuery, CnosDataSourceOptions>;

export class QueryEditor extends PureComponent<Props> {
  onQueryTextChange = (queryText: string) => {
    console.log('onQueryTextChange', queryText);
    this.props.onChange({ ...this.props.query, queryText });
    this.props.onRunQuery();
  };

  render() {
    const selectList = useCallback(() => {
      return Promise.resolve();
    }, []);

    const query = defaults(this.props.query, defaultQuery);
    const { queryText } = query;

    const rawSql = false;
    if (rawSql) {
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
    } else {
      return (
        <div className={css({ display: 'flex' })}>
          <div className={css({ flexGrow: 1 })}>
            <FromSection />
            <SelectField />
            <GroupBySection />
            <OrderBySection />
            <LimitSection />
          </div>
          <Button aria-label="Switch to visual editor" icon="pen" variant="secondary" type="button"></Button>
        </div>
      );
    }
  }
}
