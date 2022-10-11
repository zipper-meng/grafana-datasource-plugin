package plugin

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const DEFAULT_LIMIT = 1000

type SelectItem struct {
	Def    *QueryDefinition
	Type   string   `json:"type,omitempty"`
	Params []string `json:"params,omitempty"`
}

func (s *SelectItem) Render(query *QueryModel, queryContext *backend.QueryDataRequest, expr string) string {
	return s.Def.Renderer(query, queryContext, s, expr)
}

type TagItem struct {
	Key       string `json:"key,omitempty"`
	Operator  string `json:"operator,omitempty"`
	Condition string `json:"condition,omitempty"`
	Value     string `json:"value,omitempty"`
}

type QueryModel struct {
	Table       string          `json:"table,omitempty"`
	Select      [][]*SelectItem `json:"select,omitempty"`
	Tags        []*TagItem      `json:"tags,omitempty"`
	RawTagsExpr string          `json:"rawTagsExpr,omitempty"`
	GroupBy     []*SelectItem   `json:"groupBy,omitempty"`
	Interval    string          `json:"interval,omitempty"`
	Fill        string          `json:"fill,omitempty"`
	OrderByTime string          `json:"orderByTime,omitempty"`
	Limit       string          `json:"limit,omitempty"`
	Tz          string          `json:"tz,omitempty"`

	RawQuery  bool   `json:"rawQuery,omitempty"`
	QueryText string `json:"queryText,omitempty"`
	Alias     string `json:"alias,omitempty"`
}

func (query *QueryModel) Introspect() error {
	for _, sel := range query.Select {
		for _, s := range sel {
			def, exists := renders[s.Type]
			if !exists {
				return fmt.Errorf("missing query definition for %q", s.Type)
			}
			s.Def = &def
		}
	}
	for _, s := range query.GroupBy {
		if s.Type == "time" {
			// from: GROUP BY time($interval)
			// to: "GROUP BY time", "DATE_BIN(... $interval ...) AS time"
			query.Interval = s.Params[0]
			s.Params[0] = "time"
			s.Type = "field"
		} else if s.Type == "fill" {
			query.Fill = s.Params[0]
		}
		def, exists := renders[s.Type]
		if !exists {
			return fmt.Errorf("missing query definition for %q", s.Type)
		}
		s.Def = &def
	}

	return nil
}

var (
	regexpOperatorPattern    = regexp.MustCompile(`^\/.*\/$`)
	regexpMeasurementPattern = regexp.MustCompile(`^\/.*\/$`)
)

func (query *QueryModel) Build(queryContext *backend.QueryDataRequest) (string, error) {
	var res string
	if query.RawQuery && query.QueryText != "" {
		res = query.QueryText
	} else {
		res = query.renderSelectors(queryContext)
		res += query.renderMeasurement()
		res += query.renderWhereClause()
		res += query.renderTimeFilter(queryContext)
		res += query.renderGroupBy(queryContext)
		res += query.renderOrderByTime()
		res += query.renderLimit()
	}

	res = strings.ReplaceAll(res, "$timeFilter", query.renderTimeFilter(queryContext))
	res = strings.ReplaceAll(res, "$__interval", query.Interval)

	return res, nil
}

func (query *QueryModel) renderTimeFilter(queryContext *backend.QueryDataRequest) string {
	timeRange := &queryContext.Queries[0].TimeRange
	if timeRange == nil {
		return ""
	}
	return fmt.Sprintf("time >= %d and time <= %d", timeRange.From.UnixNano(), timeRange.To.UnixNano())
}

func (query *QueryModel) renderSelectors(queryContext *backend.QueryDataRequest) string {
	res := "SELECT "
	if query.Interval != "" {
		res += fmt.Sprintf("DATE_BIN(INTERVAL '%s', time, TIMESTAMP '1970-01-01T00:00:00Z') AS time, ", query.Interval)
	} else {
		res += "time, "
	}

	var selectors []string
	for _, sel := range query.Select {
		stk := ""
		for _, s := range sel {
			stk = s.Render(query, queryContext, stk)
		}
		selectors = append(selectors, stk)
	}

	return res + strings.Join(selectors, ", ")
}

func (query *QueryModel) renderMeasurement() string {
	return fmt.Sprintf(` FROM %s`, query.Table)
}

func (query *QueryModel) renderWhereClause() string {
	res := " WHERE "
	// TODO: Implement `DESCRIBE TABLE` or `SHOW TAG KEYS`
	// to use []TagItem to generate WHERE clause
	conditions := query.RawTagsExpr
	if len(conditions) > 0 {
		res += "(" + conditions + ")"
		res += " AND "
	}

	return res
}

func (query *QueryModel) renderGroupBy(queryContext *backend.QueryDataRequest) string {
	groupBy := ""
	for i, group := range query.GroupBy {
		if i == 0 {
			groupBy += " GROUP BY"
		}

		if i > 0 && group.Type != "fill" {
			groupBy += ", "
		} else {
			groupBy += " "
		}

		groupBy += group.Render(query, queryContext, "")
	}

	return groupBy
}

func (query *QueryModel) renderOrderByTime() string {
	orderByTime := query.OrderByTime
	if orderByTime == "" {
		return ""
	}
	return fmt.Sprintf(" ORDER BY time %s", orderByTime)
}

func (query *QueryModel) renderLimit() string {
	limit := query.Limit
	if limit == "" {
		return fmt.Sprintf(" limit %d", DEFAULT_LIMIT)
	}
	return fmt.Sprintf(" limit %s", limit)
}
