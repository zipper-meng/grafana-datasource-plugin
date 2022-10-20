package plugin

import "github.com/grafana/grafana-plugin-sdk-go/backend"

import (
	"fmt"
	"strings"
)

var renders map[string]QueryDefinition

type DefinitionParameters struct {
	Name string
	Type string
}

type QueryDefinition struct {
	Renderer func(query *QueryModel, queryContext *backend.QueryDataRequest, part *SelectItem, innerExpr string) string
	Params   []DefinitionParameters
}

func init() {
	renders = make(map[string]QueryDefinition)

	renders["field"] = QueryDefinition{Renderer: fieldRenderer}

	renders["avg"] = QueryDefinition{Renderer: functionRenderer}
	renders["count"] = QueryDefinition{Renderer: functionRenderer}
	renders["min"] = QueryDefinition{Renderer: functionRenderer}
	renders["max"] = QueryDefinition{Renderer: functionRenderer}
	renders["sum"] = QueryDefinition{Renderer: functionRenderer}
	renders["stddev"] = QueryDefinition{Renderer: functionRenderer}
	renders["variance"] = QueryDefinition{Renderer: functionRenderer}

	renders["time"] = QueryDefinition{
		Renderer: timeRenderer,
		Params:   []DefinitionParameters{{Name: "interval", Type: "time"}, {Name: "offset", Type: "time"}},
	}

	renders["fill"] = QueryDefinition{
		Renderer: emptyRenderer,
		Params:   []DefinitionParameters{{Name: "fill", Type: "string"}},
	}

	renders["tag"] = QueryDefinition{
		Renderer: fieldRenderer,
		Params:   []DefinitionParameters{{Name: "tag", Type: "string"}},
	}

	renders["alias"] = QueryDefinition{Renderer: aliasRenderer}
}

func fieldRenderer(query *QueryModel, queryContext *backend.QueryDataRequest, part *SelectItem, innerExpr string) string {
	if part.Params[0] == "*" {
		return "*"
	}
	return fmt.Sprintf(`"%s"`, part.Params[0])
}

func timeRenderer(query *QueryModel, queryContext *backend.QueryDataRequest, part *SelectItem, innerExpr string) string {
	if query.Interval == "" {
		return "time"
	} else {
		return fmt.Sprintf("DATE_BIN(INTERVAL '%s', time, TIMESTAMP '1970-01-01T00:00:00Z')", query.Interval)
	}
}

func functionRenderer(query *QueryModel, queryContext *backend.QueryDataRequest, part *SelectItem, innerExpr string) string {
	if innerExpr != "" {
		part.Params = append([]string{innerExpr}, part.Params...)
	}

	params := strings.Join(part.Params, ", ")

	return fmt.Sprintf("%s(%s)", part.Type, params)
}

func suffixRenderer(query *QueryModel, queryContext *backend.QueryDataRequest, part *SelectItem, innerExpr string) string {
	return fmt.Sprintf("%s %s", innerExpr, part.Params[0])
}

func aliasRenderer(query *QueryModel, queryContext *backend.QueryDataRequest, part *SelectItem, innerExpr string) string {
	return fmt.Sprintf(`%s AS "%s"`, innerExpr, part.Params[0])
}

func emptyRenderer(query *QueryModel, queryContext *backend.QueryDataRequest, part *SelectItem, innerExpr string) string {
	return ""
}
