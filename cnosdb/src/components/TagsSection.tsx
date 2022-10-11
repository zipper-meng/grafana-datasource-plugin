// import { css } from '@emotion/css';
import React from 'react';

import {Input} from '@grafana/ui';

type Props = {
  tagExpr: string | undefined;
  onTagExprChange: (expr: string) => void;
};

export const TagsSection = ({tagExpr, onTagExprChange}: Props): JSX.Element => {
  return (
    <Input
      type="text"
      placeholder="tag expressions"
      value={tagExpr}
      width={50}
      onBlur={(e) => {
        onTagExprChange(e.currentTarget.value);
      }}
      onChange={(e) => {
        onTagExprChange(e.currentTarget.value);
      }}
    />
  );
};
