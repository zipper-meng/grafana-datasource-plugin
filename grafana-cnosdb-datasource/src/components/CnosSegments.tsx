import React  from 'react';

import { SelectableValue } from '@grafana/data';
import { ActionMeta, InlineLabel, SegmentSection, Select } from '@grafana/ui';

const tableOptions: SelectableValue[] = [
  { label: 'air', value: 'air' },
  { label: 'sea', value: 'sea' },
  { label: 'wind', value: 'wind' },
];
const columnOptions: SelectableValue[] = [
  { label: 'pressure', value: 'pressure' },
  { label: 'station', value: 'station' },
  { label: 'temperature', value: 'temperature' },
  { label: 'time', value: 'time' },
  { label: 'visibility', value: 'visibility' },
];
// const fieldKeyOptions: SelectableValue[] = [
//   { label: 'pressure', value: 'pressure' },
//   { label: 'temperature', value: 'temperature' },
//   { label: 'visibility', value: 'visibility' },
// ];
const onSelectChange = (value: SelectableValue<any>, actionMeta: ActionMeta) => {
  console.log('on change', value);
};

// type FromSectionProps = {
//   onChange: (table: string | undefined) => void;
//   table: string | undefined;
//   getTableOptions: (filter: string) => Promise<string[]>;
// };

// FromSection:
// > FROM $table: TableOptions
// > Time column $time: $column in FieldOptions
// > Metric column $metric: $column in TagOptions
//   => sql: select "$time", "$metric", "$field" from "$table" group by "metric"
export const FromSection = (): JSX.Element => {
  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineLabel width={7}>FROM</InlineLabel>
        <Select options={tableOptions} onChange={onSelectChange} />

        <InlineLabel width={14}>Time column</InlineLabel>
        <Select options={columnOptions} onChange={onSelectChange} />

        <InlineLabel width={14}>Metric column</InlineLabel>
        <Select options={columnOptions} onChange={onSelectChange} />
      </div>
    </div>
  );
};

export const SelectSection = (): JSX.Element => {
  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <SegmentSection key="kEY" label="LABEL" fill={true}>
          {/* <div className={cx('gf-form-label', css({ paddingLeft: '0' }))}></div> */}
          {/*<Segment Component={AddButton} onChange={({ value }) => action('New value added')(value)} options={options} />*/}
        </SegmentSection>
      </div>
    </div>
  );
};

// SelectSection:
// > SelectFieldPart: type=[ Field, Function, Relation ], alias=string
//   > Field $field: $column in FieldOptions
//     => sql: select "$field" as "$alias"
//   > Function: > [ FunctionOption, FieldOption ]
//     => sql: select function("field") as "$alias"
//   > Relation: > [ SelectFieldPart, OperatorOption, SelectFieldPart ]
//     => sql: select ("$field" operator "$field") as "$alias"
//     => sql: select (function("$field") operator function("$field")) as "$alias"
export const SelectField = (): JSX.Element => {
  return (
    <div>
      <InlineLabel width={7}>SELECT</InlineLabel>
    </div>
  );
};

// GroupBySection:
// > GroupByPart: Field, Interval
//   > Field $field: $column in FieldOptions
//   => sql: group by "$field"
//   > Interval $interval: customized | $string in IntervalOptions
//   => sql: group by time($imterval)
export const GroupBySection = (): JSX.Element => {
  return (
    <div>
      <InlineLabel width={14}>GROUP BY</InlineLabel>
    </div>
  );
};

// OrderBySection:
// > Tag $tag: $column in TagOptions
// > $order: > [ ascending, descending ]
//   => sql: order by $tag $order
export const OrderBySection = (): JSX.Element => {
  return (
    <div>
      <InlineLabel width={14}>ORDER BY</InlineLabel>
    </div>
  );
};

// LimitSection:
// > ByLimit: $limit: number
//   => sql: limit limit
// > ByOffsetLimit: $offset, $limit
//   => sql: $offset, $limit
export const LimitSection = (): JSX.Element => {
  return (
    <div>
      <InlineLabel width={14}>LIMIT</InlineLabel>
    </div>
  );
};
