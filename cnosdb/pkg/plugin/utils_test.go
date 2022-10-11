package plugin

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestParseIntervalString(t *testing.T) {
	interval := ParseIntervalString("10 minute")
	assert.Equal(t, interval, time.Duration(10)*time.Minute)

	interval = ParseIntervalString("10 seconds")
	assert.Equal(t, interval, time.Duration(10)*time.Second)

	interval = ParseIntervalString("10 hours")
	assert.Equal(t, interval, time.Duration(10)*time.Hour)
}
