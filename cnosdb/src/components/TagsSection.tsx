import {css} from '@emotion/css';
import React from 'react';

import {Input} from '@grafana/ui';
import {useShadowedState} from "./use_shadowed_state";

type Props = {
  tagExpr: string | undefined;
  onTagExprChange: (expr: string) => void;
};

// TODO Use <select/> to get Tag filters.
export const TagsSection = ({tagExpr, onTagExprChange}: Props): JSX.Element => {
  const [currentValue, setCurrentValue] = useShadowedState(tagExpr);

  return (
    <div className={css({flexGrow: 1})}>
      <Input
        type="text"
        placeholder="tag expressions"
        value={currentValue}
        className={css({width: '100%'})}
        onChange={(e) => {
          setCurrentValue(e.currentTarget.value);
        }}
        onBlur={(_) => {
          onTagExprChange(currentValue ?? '');
        }}
      />
    </div>
  );
};
