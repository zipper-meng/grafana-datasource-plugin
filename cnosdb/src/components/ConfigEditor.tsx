import { uniqueId } from 'lodash';
import React, { PureComponent, ChangeEvent } from 'react';
import { Base64 } from 'js-base64';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Alert, InlineField, InlineFormLabel, LegacyForms, LegacyInputStatus } from '@grafana/ui';

import { MyDataSourceOptions, MySecureJsonData } from '../types';

const { Input, SecretFormField } = LegacyForms;

type ConfigInputProps = {
  label: string;
  htmlPrefix: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>, status?: LegacyInputStatus) => void;
  value: string;
};

const ConfigInput = ({ label, htmlPrefix, onChange, value }: ConfigInputProps): JSX.Element => {
  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel htmlFor={htmlPrefix} className="width-10">
          {label}
        </InlineFormLabel>
        <div className="width-20">
          <Input id={htmlPrefix} className="width-20" value={value || ''} onChange={onChange} />
        </div>
      </div>
    </div>
  );
};

export type Props = DataSourcePluginOptionsEditorProps<MyDataSourceOptions>;
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
    this.state.maxSeries = this.props.options.jsonData.maxSeries?.toString() || '';
    this.htmlPrefix = uniqueId('cnosdb-config');
  }

  onDsJsonDataChange = (property: keyof MyDataSourceOptions) => {
    return onUpdateDatasourceJsonDataOption(this.props, property);
  };

  onUserChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        user: event.target.value,
      },
    });
    this.onAuthChange(event.target.value, undefined);
  };

  onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...options.secureJsonData,
        password: event.target.value,
      },
    });
    this.onAuthChange(undefined, event.target.value);
  };

  onAuthChange = (user?: string, password?: string) => {
    const { options } = this.props;

    if (!user) {
      user = options.jsonData.user;
    }
    if (!password) {
      if (options.secureJsonData) {
        password = (options.secureJsonData as MySecureJsonData).password;
      } else {
        password = '';
      }
    }

    options.jsonData.auth = 'Basic ' + Base64.encode(user + ':' + password);
    console.log('Generating new auth', user, password, options.jsonData.auth);
    onUpdateDatasourceJsonDataOption(this.props, 'auth');
  };

  onResetPassword = () => {
    updateDatasourcePluginResetOption(this.props, 'password');
  };

  render() {
    const { options } = this.props;
    const { secureJsonFields, jsonData } = options;

    // TODO: Add proxy mode (need Golang codes).
    options.access = 'direct';
    let secureJsonData;
    if (options.secureJsonData) {
      secureJsonData = options.secureJsonData as MySecureJsonData;
    } else {
      secureJsonData = {} as MySecureJsonData;
      options.secureJsonData = secureJsonData;
    }

    return (
      <>
        {options.access === 'direct' && (
          <Alert title="Deprecation Notice" severity="warning">
            Browser access mode may produce CORS problems.
          </Alert>
        )}

        <div className="gf-form-group">
          <div>
            <h3 className="page-heading">CnosDB Connection</h3>
          </div>
          <ConfigInput
            label="URL"
            htmlPrefix={`${this.htmlPrefix}-url`}
            onChange={this.onDsJsonDataChange('url')}
            value={jsonData.url || ''}
          />
          <ConfigInput
            label="Database"
            htmlPrefix={`${this.htmlPrefix}-database`}
            onChange={this.onDsJsonDataChange('database')}
            value={jsonData.database || ''}
          />
          <ConfigInput
            label="User"
            htmlPrefix={`${this.htmlPrefix}-user`}
            onChange={this.onUserChange}
            value={jsonData.user || ''}
          />
          <div className="gf-form-inline">
            <div className="gf-form">
              <SecretFormField
                isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
                value={secureJsonData.password}
                label="Password"
                aria-label="Password"
                labelWidth={10}
                inputWidth={20}
                onReset={this.onResetPassword}
                onChange={this.onPasswordChange}
              />
            </div>
          </div>
        </div>

        <div className="gf-form-group">
          <div>
            <h3 className="page-heading">CnosDB Details</h3>
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
                  value={jsonData.timeInterval || ''}
                  onChange={this.onDsJsonDataChange('timeInterval')}
                />
              </div>
            </div>
          </div>
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
                  // any influence over saving so this seems to be only way to do this.
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
