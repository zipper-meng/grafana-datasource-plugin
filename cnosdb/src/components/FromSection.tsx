import {Input} from '@grafana/ui';
import React from 'react';
import {useShadowedState} from "./use_shadowed_state";

type FromSectionProps = {
  onChange: (table: string | undefined) => void;
  table: string | undefined;
};

// TODO Use <select/> to get FROM table.
export const FromSection = ({table, onChange}: FromSectionProps): JSX.Element => {
  const [currentValue, setCurrentValue] = useShadowedState(table);
  return (
    <Input
      type="text"
      placeholder="table"
      value={table}
      width={10}
      onChange={(e) => {
        setCurrentValue(e.currentTarget.value);
      }}
      onBlur={(_) => {
        onChange(currentValue);
      }}
    />
  );
};
