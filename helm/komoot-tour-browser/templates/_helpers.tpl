{{/*
Expand the name of the chart.
*/}}
{{- define "komoot-tour-browser.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Full name: release + chart name, capped at 63 chars.
*/}}
{{- define "komoot-tour-browser.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "komoot-tour-browser.name" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "komoot-tour-browser.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ include "komoot-tour-browser.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "komoot-tour-browser.selectorLabels" -}}
app.kubernetes.io/name: {{ include "komoot-tour-browser.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}