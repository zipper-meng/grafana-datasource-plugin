package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Make sure CnosDatasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler, backend.StreamHandler interfaces. Plugin should not
// implement all these interfaces - only those which are required for a particular task.
// For example if plugin does not need streaming functionality then you are free to remove
// methods that implement backend.StreamHandler. Implementing instancemgmt.InstanceDisposer
// is useful to clean up resources used by previous datasource instance when a new datasource
// instance created upon datasource settings changed.
var (
	_ backend.QueryDataHandler      = (*CnosDatasource)(nil)
	_ backend.CheckHealthHandler    = (*CnosDatasource)(nil)
	_ instancemgmt.InstanceDisposer = (*CnosDatasource)(nil)
)

// NewCnosDatasource creates a new datasource instance.
func NewCnosDatasource(instanceSettings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	var jsonData map[string]string
	if err := json.Unmarshal(instanceSettings.JSONData, &jsonData); err != nil {
		return nil, err
	}

	log.DefaultLogger.Info(fmt.Sprintf("Building datasource: URL: '%s', db: '%s'",
		instanceSettings.URL, instanceSettings.Database))

	return &CnosDatasource{
		url:      instanceSettings.URL,
		database: instanceSettings.Database,
		client: http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

// CnosDatasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type CnosDatasource struct {
	url      string
	database string

	client http.Client
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewCnosDatasource factory function.
func (d *CnosDatasource) Dispose() {
	// Clean up datasource instance resources.
	log.DefaultLogger.Info("TODO: Implement Dispose().")
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *CnosDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	log.DefaultLogger.Info("CnosDB query", "request", req)

	// Create response struct
	response := backend.NewQueryDataResponse()

	// Loop over queries and execute them individually.
	// TODO: Use goroutine instead of serial execution.
	for _, q := range req.Queries {
		res := d.query(ctx, req, q)

		// Save the response in a hashmap based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

func (d *CnosDatasource) query(ctx context.Context, queryContext *backend.QueryDataRequest, query backend.DataQuery) backend.DataResponse {
	response := backend.DataResponse{}

	auth, exists := queryContext.PluginContext.DataSourceInstanceSettings.DecryptedSecureJSONData["auth"]
	if !exists {
		response.Error = fmt.Errorf("cannot get secure json data 'auth'")
		return response
	}

	log.DefaultLogger.Info("CnosDB query data", "auth", auth, "json", string(query.JSON))

	var queryModel QueryModel
	var err error
	if err = json.Unmarshal(query.JSON, &queryModel); err != nil {
		response.Error = err
		return response
	}
	if err = queryModel.Introspect(); err != nil {
		response.Error = err
		return response
	}

	dbgQueryModel, _ := json.Marshal(queryModel)
	log.DefaultLogger.Info("CnosDB query model", "model", string(dbgQueryModel))

	// Build sql
	sql, err := queryModel.Build(queryContext)
	if err != nil {
		response.Error = err
		return response
	}
	log.DefaultLogger.Info("CnosDB query sql", "sql", sql)

	req, err := http.NewRequestWithContext(ctx, "POST", d.url+"/api/v1/sql?db="+d.database, strings.NewReader(sql))
	if err != nil {
		response.Error = err
		return response
	}
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Accept", "application/json")

	// Handle response
	res, err := d.client.Do(req)
	if err != nil {
		response.Error = err
		return response
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			log.DefaultLogger.Warn("Failed to close response body", "err", err)
		}
	}()
	if res.StatusCode/100 != 2 {
		response.Error = fmt.Errorf("CnosDB returned error status: %s", res.Status)
		return response
	}

	queryData, _ := io.ReadAll(res.Body)

	log.DefaultLogger.Info("CnosDB query response", "response", string(queryData))

	var resRows []map[string]interface{}
	var resultNotEmpty bool = true
	if len(queryData) > 0 {
		if err := json.NewDecoder(bytes.NewReader(queryData)).Decode(&resRows); err != nil {
			log.DefaultLogger.Error("Failed to decode request jsonData", "err", err)
			response.Error = err
			return response
		}
		log.DefaultLogger.Info("CnosDB query response rows", "rows", resRows)
	} else {
		resultNotEmpty = false
	}

	// Create data frame response.
	frame := data.NewFrame("response")
	timeArray := make([]time.Time, len(resRows))
	valueArrayMap := make(map[string][]*float64)
	var columnArray []string

	if resultNotEmpty {
		for i, row := range resRows {
			for col, val := range row {
				if col == "time" {
					parsedTime, err := ParseTimeString(val.(string))
					if err != nil {
						log.DefaultLogger.Error("Failed to convert to time", "err", err)
						response.Error = err
						return response
					}
					timeArray[i] = parsedTime
				} else {
					valArr, ok := valueArrayMap[col]
					if !ok {
						valArr = make([]*float64, len(resRows))
						columnArray = append(columnArray, col)
						valueArrayMap[col] = valArr
					}
					v := val.(float64)
					valArr[i] = &v
				}
			}
		}
	}

	// Add fields.
	frame.Fields = append(frame.Fields,
		data.NewField("time", nil, timeArray),
	)
	for _, col := range columnArray {
		frame.Fields = append(frame.Fields, data.NewField(col, nil, valueArrayMap[col]))
	}

	// Resample if needed
	if resultNotEmpty && queryModel.Fill != "" {
		log.DefaultLogger.Info("Fill detected, need Resample")
		var fillMode data.FillMode
		var fillValue float64 = 0
		switch strings.ToLower(queryModel.Fill) {
		case "previous":
			fillMode = data.FillModePrevious
		case "null":
			fillMode = data.FillModeNull
		default:
			fillMode = data.FillModeValue
			fillValue, err = strconv.ParseFloat(queryModel.Fill, 64)
			if err != nil {
				log.DefaultLogger.Error("Failed to convert to float", "err", err)
				frame.AppendNotices(data.Notice{Text: "Failed to convert fill value to float", Severity: data.NoticeSeverityWarning})
				response.Error = err
				return response
			}
		}
		log.DefaultLogger.Info("Resample-1", fmt.Sprintf("fillMode: %d, fillValue: %f", fillMode, fillValue))
		interval := ParseIntervalString(queryModel.Interval)
		log.DefaultLogger.Info("Resample-2", fmt.Sprintf("interval: %s -> %d", queryModel.Interval, interval))
		if interval != 0 {
			log.DefaultLogger.Info("Begin Resample")
			frame, err = Resample(frame, interval, query.TimeRange, &data.FillMissing{
				Mode:  fillMode,
				Value: fillValue,
			})
			log.DefaultLogger.Info("End Resample")
			if err != nil {
				log.DefaultLogger.Error("Failed to Resample dataframe", "err", err)
				frame.AppendNotices(data.Notice{Text: "Failed to Resample dataframe", Severity: data.NoticeSeverityWarning})
			}
		}
	}

	// Add the frames to the response.
	response.Frames = append(response.Frames, frame)

	return response
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *CnosDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	log.DefaultLogger.Info("CnosDB check health", "request", req)

	res, err := d.client.Get(d.url + "/api/v1/ping")
	if err != nil {
		return nil, err
	}

	jsonDetails, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	var status = backend.HealthStatusOk
	var message = "Data source is working"

	if res.StatusCode/100 != 2 {
		status = backend.HealthStatusError
		message = "Ping CnosDB returned an error"
	}

	return &backend.CheckHealthResult{
		Status:      status,
		Message:     message,
		JSONDetails: jsonDetails,
	}, nil
}
