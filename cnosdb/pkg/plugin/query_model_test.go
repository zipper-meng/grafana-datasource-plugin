package plugin

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestParseQuery(t *testing.T) {
	var requestJson = `
{
    "table": "mq",
    "select": [
        [
            { "type": "field", "params": [ "fa"] },
            { "type": "avg" }
        ]
    ],
    "groupBy": [
        { "type": "time", "params": [ "10 minutes" ] },
        { "type": "fill", "params": [ "null" ] }
    ],
    "orderByTime": "ASC"
}`
	queryContext := &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				JSON: []byte(requestJson),
				TimeRange: backend.TimeRange{
					From: time.Date(2022, 10, 10, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2022, 10, 17, 0, 0, 0, 0, time.UTC),
				},
			},
		},
	}
	var queryModel QueryModel
	if err := json.Unmarshal([]byte(requestJson), &queryModel); err != nil {
		t.Error(err)
	}
	if err := queryModel.Introspect(); err != nil {
		t.Error(err)
	}

	sql, err := queryModel.Build(queryContext)
	if err != nil {
		t.Error(err)
	}

	fmt.Println(sql)
}

func TestParseQuery2(t *testing.T) {
	var requestJson = `
{
    "datasource": {
        "type": "cnosdb-grafana-datasource",
        "uid": "Jn47KMS4z"
    },
    "datasourceId": 32,
    "groupBy": [
        { "params": [ "10 minutes" ], "type": "time" },
        { "params": [ "10" ], "type": "fill" }
    ],
    "intervalMs": 30000,
    "maxDataPoints": 500,
    "orderByTime": "ASC",
    "rawTagsExpr": "",
    "refId": "A",
    "select": [
        [
            { "params": [ "fa" ], "type": "field" },
            { "params": [], "type": "avg" },
            { "params": [ "value" ], "type": "alias" }
        ]
    ],
    "table": "ma",
    "tags": []
}`
	queryContext := &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				JSON: []byte(requestJson),
				TimeRange: backend.TimeRange{
					From: time.Date(2022, 10, 10, 0, 0, 0, 0, time.UTC),
					To:   time.Date(2022, 10, 17, 0, 0, 0, 0, time.UTC),
				},
			},
		},
	}
	var queryModel QueryModel
	if err := json.Unmarshal([]byte(requestJson), &queryModel); err != nil {
		t.Error(err)
	}
	if err := queryModel.Introspect(); err != nil {
		t.Error(err)
	}

	sql, err := queryModel.Build(queryContext)
	if err != nil {
		t.Error(err)
	}

	fmt.Println(sql)
}
