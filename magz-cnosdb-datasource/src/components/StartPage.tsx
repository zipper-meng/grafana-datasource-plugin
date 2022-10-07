import React, { PureComponent } from 'react';

import { QueryEditorHelpProps } from '@grafana/data';

const DOC_ITEMS = [
  {
    title: 'Getting started',
    label:
      'Start by selecting a measurement and field from the dropdown above. You can then use the tag selector to further narrow your search.',
  },
];

const Documentation = (props: any) => (
  <div>
    <h2>CnosDB Documentation</h2>
    {DOC_ITEMS.map((item) => (
      <div className="cheat-sheet-item" key={item.title}>
        <div className="cheat-sheet-item__title">{item.title}</div>
        <div className="cheat-sheet-item__label">{item.label}</div>
      </div>
    ))}
  </div>
);

export default class StartPage extends PureComponent<QueryEditorHelpProps> {
  render() {
    return <Documentation onClickExample={this.props.onClickExample} />;
  }
}
