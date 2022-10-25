package plugin

type ResponseRow struct {
	Time   string  `json:"time,omitempty"`
	Metric string  `json:"metric,omitempty"`
	Value  float64 `json:"value,omitempty"`
}

type Array struct {
	stringArray  []*string
	float64Array []*float64
	boolArray    []*bool
}
