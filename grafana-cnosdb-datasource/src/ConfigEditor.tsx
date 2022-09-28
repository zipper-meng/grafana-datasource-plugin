import React, { PureComponent } from 'react';
import { FieldSet, InlineField, Input, InlineFieldRow } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, onUpdateDatasourceJsonDataOption } from '@grafana/data';
import { CnosDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<CnosDataSourceOptions> {}

interface State {}

export class ConfigEditor extends PureComponent<Props, State> {
  onDsOptionsChange = (property: keyof CnosDataSourceOptions) => {
    return onUpdateDatasourceJsonDataOption(this.props, property);
  };

  render() {
    const { options } = this.props;
    const jsonData = options.jsonData;

    const labelWidth = 20;

    return (
      <>
      <FieldSet label="CnosDB Connection" width={400}>
         <InlineField labelWidth={labelWidth} label="Host">
            <Input
              width={40}
              name="host"
              value={jsonData.host || ''}
              placeholder="localhost:31007"
              onChange={this.onDsOptionsChange('host')}
            ></Input>
          </InlineField>
          <InlineField labelWidth={labelWidth} label="Database">
          <Input
            width={40}
            name="database"
            value={jsonData.database || ''}
            placeholder="database name"
            onChange={this.onDsOptionsChange('database')}
          ></Input>
        </InlineField>
        <InlineFieldRow>
          <InlineField labelWidth={labelWidth} label="User">
            <Input
              value={jsonData.user_id || ''}
              placeholder="user_id"
              onChange={this.onDsOptionsChange('user_id')}
            ></Input>
          </InlineField>
        </InlineFieldRow>
      </FieldSet>
      </>
    );
  }
}
