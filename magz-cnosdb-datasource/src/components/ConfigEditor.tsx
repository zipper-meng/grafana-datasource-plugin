import { uniqueId } from 'lodash';
import React, { PureComponent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  SelectableValue,
  onUpdateDatasourceOption,
  updateDatasourcePluginResetOption,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { DataSourceHttpSettings, InlineField, InlineFormLabel, LegacyForms, Select } from '@grafana/ui';

const { Input, SecretFormField } = LegacyForms;
import { InfluxOptions, InfluxSecureJsonData, QueryVersion } from '../types';

const versions: Array<SelectableValue<QueryVersion>> = [
  {
    label: 'InfluxQL',
    value: QueryVersion.InfluxQL,
    description: 'The InfluxDB SQL-like query language.',
  },
  {
    label: 'Sql',
    value: QueryVersion.Sql,
    description: 'Structured query language.',
  },
];

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;
type State = {
  maxSeries: string | undefined;
};

export class ConfigEditor extends PureComponent<Props, State> {
  state = {
    maxSeries: '',
  };

  htmlPrefix: string;

  constructor(props: Props) {
    super(props);
    this.state.maxSeries = props.options.jsonData.maxSeries?.toString() || '';
    this.htmlPrefix = uniqueId('influxdb-config');
  }

  onResetPassword = () => {
    updateDatasourcePluginResetOption(this.props, 'password');
  };

  onQueryVersionChanged = (selected: SelectableValue<QueryVersion>) => {
    const { options, onOptionsChange } = this.props;

    const copy: any = {
      ...options,
      jsonData: {
        ...options.jsonData,
        version: selected.value,
      },
    };

    console.log('onQueryVersionChanged', copy);

    onOptionsChange(copy);
  };

  renderInflux1x() {
    const { options } = this.props;
    const { secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as InfluxSecureJsonData;
    const { htmlPrefix } = this;

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel htmlFor={`${htmlPrefix}-db`} className="width-10">
              Database
            </InlineFormLabel>
            <div className="width-20">
              <Input
                id={`${htmlPrefix}-db`}
                className="width-20"
                value={options.database || ''}
                onChange={onUpdateDatasourceOption(this.props, 'database')}
              />
            </div>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel htmlFor={`${htmlPrefix}-user`} className="width-10">
              User
            </InlineFormLabel>
            <div className="width-10">
              <Input
                id={`${htmlPrefix}-user`}
                className="width-20"
                value={options.user || ''}
                onChange={onUpdateDatasourceOption(this.props, 'user')}
              />
            </div>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <SecretFormField
              isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
              value={secureJsonData.password || ''}
              label="Password"
              aria-label="Password"
              labelWidth={10}
              inputWidth={20}
              onReset={this.onResetPassword}
              onChange={onUpdateDatasourceSecureJsonDataOption(this.props, 'password')}
            />
          </div>
        </div>

        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel
              className="width-10"
              tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
				for example 1m if your data is written every minute."
            >
              Min time interval
            </InlineFormLabel>
            <div className="width-10">
              <Input
                className="width-10"
                placeholder="10s"
                value={options.jsonData.timeInterval || ''}
                onChange={onUpdateDatasourceJsonDataOption(this.props, 'timeInterval')}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  render() {
    const { options, onOptionsChange } = this.props;

    return (
      <>
        <h3 className="page-heading">Query Language</h3>
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <Select
                aria-label="Query language"
                className="width-30"
                value={options.jsonData.version === QueryVersion.Sql ? versions[1] : versions[0]}
                options={versions}
                defaultValue={versions[0]}
                onChange={this.onQueryVersionChanged}
              />
            </div>
          </div>
        </div>

        <DataSourceHttpSettings
          dataSourceConfig={options}
          defaultUrl="http://localhost:31007"
          onChange={onOptionsChange}
        />

        <div className="gf-form-group">
          <div>
            <h3 className="page-heading">InfluxDB Details</h3>
          </div>
          {this.renderInflux1x()}
          <div className="gf-form-inline">
            <InlineField
              labelWidth={20}
              label="Max series"
              tooltip="Limit the number of series/tables that Grafana will process. Lower this number to prevent abuse, and increase it if you have lots of small time series and not all are shown. Defaults to 1000."
            >
              <Input
                placeholder="1000"
                type="number"
                className="width-10"
                value={this.state.maxSeries}
                onChange={(event) => {
                  // We duplicate this state so that we allow to write freely inside the input. We don't have
                  // any influence over saving so this seems to be the only way to do this.
                  this.setState({ maxSeries: event.currentTarget.value });
                  const val = parseInt(event.currentTarget.value, 10);
                  updateDatasourcePluginJsonDataOption(this.props, 'maxSeries', Number.isFinite(val) ? val : undefined);
                }}
              />
            </InlineField>
          </div>
        </div>
      </>
    );
  }
}

export default ConfigEditor;
