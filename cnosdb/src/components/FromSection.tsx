import {Input} from '@grafana/ui';
import React from 'react';

// import { toSelectableValue } from '../utils';
// import { Seg } from './Seg';

type FromSectionProps = {
  onChange: (table: string | undefined) => void;
  table: string | undefined;
};

// TODO FromSection:
// > FROM $table: TableOptions
// > Time column $time: $column in FieldOptions
// > Metric column $metric: $column in TagOptions
//   => sql: select "$time", "$metric", "$field" from "$table" group by "metric"
export const FromSection = ({onChange, table}: FromSectionProps): JSX.Element => {
  return (
    <Input
      type="text"
      placeholder="table"
      value={table}
      width={10}
      onBlur={(e) => {
        onChange(e.currentTarget.value);
      }}
      onChange={(e) => {
        onChange(e.currentTarget.value);
      }}
    />
  );
};
