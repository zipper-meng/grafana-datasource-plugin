import {css} from '@emotion/css';
import React from 'react';

import {GrafanaTheme2} from '@grafana/data';
import {InlineLabel, SegmentSection, useStyles2} from '@grafana/ui';

import {DataSource} from '../datasource';
import {MyQuery} from '../types';
import {
  addNewGroupByPart,
  addNewSelectPart,
  changeGroupByPart,
  changeSelectPart,
  normalizeQuery,
  removeGroupByPart,
  removeSelectPart,
} from '../query_utils';
import {getNewGroupByPartOptions, getNewSelectPartOptions, makePartList} from './part_list_utils';
import {FromSection} from './FromSection';
import {TagsSection} from './TagsSection';
import {PartListSection} from './PartListSection';
import {InputSection} from './InputSection';

// function getTemplateVariableOptions() {
//   return (
//     getTemplateSrv()
//       .getVariables()
//       // we make them regex-params, i'm not 100% sure why.
//       // probably because this way multi-value variables work ok too.
//       .map((v) => `/^$${v.name}$/`)
//   );
// }

// // helper function to make it easy to call this from the widget-render-code
// function withTemplateVariableOptions(optionsPromise: Promise<string[]>): Promise<string[]> {
//   return optionsPromise.then((options) => [...getTemplateVariableOptions(), ...options]);
// }

type Props = {
  query: MyQuery;
  onChange: (query: MyQuery) => void;
  onRunQuery: () => void;
  datasource: DataSource;
};

export const VisualQueryEditor = (props: Props): JSX.Element => {
  const styles = useStyles2(getStyles);
  const query = normalizeQuery(props.query);
  const {table, rawTagsExpr} = query;

  const selectLists = (query.select ?? []).map((sel) => makePartList(sel, new Map([
    [
      'field_0',
      () => {
        return Promise.resolve([])
      },
    ],
  ])));

  const groupByList = makePartList(query.groupBy ?? [], new Map([
    [
      'tag_0',
      () => {
        return Promise.resolve([])
      },
    ],
  ]));

  const onAppliedChange = (newQuery: MyQuery) => {
    props.onChange(newQuery);
    props.onRunQuery();
  };

  const handleFromSectionChange = (table: string | undefined) => {
    onAppliedChange({
      ...query,
      table: table,
    });
  };

  const handleTagsSectionChange = (tagExpr: string) => {
    onAppliedChange({
      ...query,
      rawTagsExpr: tagExpr,
    });
  };

  return (
    <div>
      <SegmentSection label="FROM" fill={true}>
        <FromSection
          table={table}
          onChange={handleFromSectionChange}
        />
        <InlineLabel width="auto" className={styles.inlineLabel}>
          WHERE
        </InlineLabel>
        <TagsSection tagExpr={rawTagsExpr} onTagExprChange={handleTagsSectionChange}/>
      </SegmentSection>
      {selectLists.map((sel, index) => (
        <SegmentSection key={index} label={index === 0 ? 'SELECT' : ''} fill={true}>
          <PartListSection
            parts={sel}
            getNewPartOptions={() => Promise.resolve(getNewSelectPartOptions())}
            onChange={(partIndex, newParams) => {
              const newQuery = changeSelectPart(query, index, partIndex, newParams);
              onAppliedChange(newQuery);
            }}
            onAddNewPart={(type) => {
              onAppliedChange(addNewSelectPart(query, type, index));
            }}
            onRemovePart={(partIndex) => {
              onAppliedChange(removeSelectPart(query, partIndex, index));
            }}
          />
        </SegmentSection>
      ))}
      <SegmentSection label="GROUP BY" fill={true}>
        <PartListSection
          parts={groupByList}
          getNewPartOptions={() => getNewGroupByPartOptions(query, () => Promise.resolve([]))}
          onChange={(partIndex, newParams) => {
            const newQuery = changeGroupByPart(query, partIndex, newParams);
            onAppliedChange(newQuery);
          }}
          onAddNewPart={(type) => {
            onAppliedChange(addNewGroupByPart(query, type));
          }}
          onRemovePart={(partIndex) => {
            onAppliedChange(removeGroupByPart(query, partIndex));
          }}
        />
      </SegmentSection>
      <SegmentSection label="LIMIT" fill={true}>
        <InputSection
          placeholder="(optional)"
          value={query.limit?.toString()}
          onChange={(limit) => {
            onAppliedChange({...query, limit});
          }}
        />
      </SegmentSection>
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

function getStyles(theme: GrafanaTheme2) {
  return {
    inlineLabel: css`
      color: ${theme.colors.primary.text};
    `,
  };
}
