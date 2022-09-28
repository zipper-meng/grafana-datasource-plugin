package plugin

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

// Make sure CnosDbDataSource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler, backend.StreamHandler interfaces. Plugin should not
// implement all these interfaces - only those which are required for a particular task.
// For example if plugin does not need streaming functionality then you are free to remove
// methods that implement backend.StreamHandler. Implementing instancemgmt.InstanceDisposer
// is useful to clean up resources used by previous datasource instance when a new datasource
// instance created upon datasource settings changed.
var (
	_ backend.QueryDataHandler      = (*CnosDbDataSource)(nil)
	_ backend.CheckHealthHandler    = (*CnosDbDataSource)(nil)
	// _ backend.StreamHandler         = (*CnosDbDataSource)(nil)
	_ instancemgmt.InstanceDisposer = (*CnosDbDataSource)(nil)
)

// CnosDbDataSource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type CnosDbDataSource struct{
	log              log.Logger

	HTTPClient *http.Client
	URL        string

	Database      string `json:"database"`
	TimeInterval  string `json:"timeInterval"`
	MaxSeries     int    `json:"maxSeries"`
}

func newCnosDbDataSource(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	opts, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}

	client, err := httpclient.New(opts)
	if err != nil {
		return nil, err
	}

	jsonData := CnosDbDatasource{}
	err = json.Unmarshal(settings.JSONData, &jsonData)
	if err != nil {
		return nil, fmt.Errorf("error reading settings: %w", err)
	}
	maxSeries := jsonData.MaxSeries
	if maxSeries == 0 {
		maxSeries = 1000
	}
	model := &CnosDbDataSource{
		HTTPClient:    client,
		URL:           settings.URL,
		Database:      settings.Database,
		TimeInterval:  jsonData.TimeInterval,
		MaxSeries:     maxSeries,
	}
	return model, nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using newCnosDbDataSource factory function.
func (s *CnosDbDataSource) Dispose() {
	// Clean up datasource instance resources.
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (s *CnosDbDataSource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	s.log.Info("QueryData called", "request", req)

	s.log.Debug("Building sql query")

	var rawQueries string
	var queryModels []QueryModel

	for _, reqQuery := range req.Queries {
		queryModel, rawQuery, err := BuildQuery(req)
		if err != nil {
			return &backend.QueryDataResponse{}, err
		}

		rawQueries = rawQueries + rawQuery + ";"

		queryModel.RefID = reqQuery.RefID
		queryModel.RawQuery = rawQuery
		queryModels = append(queryModels, *queryModel)
	}

	if setting.Env == setting.Dev {
		s.log.Debug("CnosDB query", "raw query", rawQueries)
	}

	request, err := s.createRequest(ctx, datasource, rawQueries)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}

	res, err := datasource.HTTPClient.Do(request)
	if err != nil {
		return &backend.QueryDataResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			s.log.Warn("Failed to close response body", "err", err)
		}
	}()
	if res.StatusCode/100 != 2 {
		return &backend.QueryDataResponse{}, fmt.Errorf("CnosDB returned error status: %s", res.Status)
	}

	resp := BuildResponse(res.Body, queryModels)

	return resp, nil
}

func (s *CnosDbDataSource) createRequest(ctx context.Context, datasource *CnosDbDataSource, query string) (*http.Request, error) {
	u, err := url.Parse(datasource.URL)
	if err != nil {
		return nil, err
	}

	u.Path = path.Join(u.Path, "query")

	bodyValues := url.Values{}
	bodyValues.Add("q", query)
	body := bodyValues.Encode()
	req, err = http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Grafana")
	req.Header.Set("database", datasource.Database)
	req.Header.Set("user_id", "123")

	req.Header.Set("Content-type", "application/x-www-form-urlencoded")

	s.log.Debug("CnosDB request", "url", req.URL.String())
	return req, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (s *CnosDbDataSource) CheckHealth(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	log.DefaultLogger.Info("CheckHealth called", "request", req)

	// TODO: call /ping

	var status = backend.HealthStatusOk
	var message = "Data source is working"

	// if rand.Int()%2 == 0 {
	// 	status = backend.HealthStatusError
	// 	message = "randomized error"
	// }

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}
