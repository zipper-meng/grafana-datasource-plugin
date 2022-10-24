import React from 'react';

import {Seg} from "./Seg";

type FromSectionProps = {
  onChange: (table: string | undefined) => void;
  table: string | undefined;
};

// TODO Use <select/> to get FROM table.
export const FromSection = ({table, onChange}: FromSectionProps): JSX.Element => {
  return (
    <Seg
      allowCustomValue
      value={table ?? 'default_table'}
      filterByLoadOptions
      onChange={(v) => {
        onChange(v.value);
      }}
    />
    // <Input
    //   type="text"
    //   placeholder="table"
    //   value={table}
    //   width={10}
    //   onChange={(e) => {
    //     console.log("onChange", e.currentTarget.value)
    //     setCurrentValue(e.currentTarget.value);
    //   }}
    //   onBlur={(_) => {
    //     console.log("onBlur", currentValue)
    //     onChange(currentValue);
    //   }}
    // />
  );
};
