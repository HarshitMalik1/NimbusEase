import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  Brain, 
  Activity,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { apiClient } from '../services/api';

const ThreatAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
    loadAnomalies();
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await apiClient.get('/monitoring/alerts');
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnomalies = async () => {
    try {
      const response = await apiClient.get('/monitoring/anomalies');
      setAnomalies(response.data);
    } catch (error) {
      console.error('Failed to load anomalies:', error);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await apiClient.patch(`/monitoring/alerts/${alertId}/resolve`);
      loadAlerts();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const handleDismiss = async (alertId) => {
    try {
      await apiClient.patch(`/monitoring/alerts/${alertId}/dismiss`);
      loadAlerts();
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: 'bg-red-100 border-red-500 text-red-900',
      HIGH: 'bg-orange-100 border-orange-500 text-orange-900',
      MEDIUM: 'bg-yellow-100 border-yellow-500 text-yellow-900',
      LOW: 'bg-blue-100 border-blue-500 text-blue-900',
    };
    return colors[severity] || colors.MEDIUM;
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'HIGH':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'MEDIUM':
        return <Shield className="h-5 w-5 text-yellow-600" />;
      default:
        return <Activity className="h-5 w-5 text-blue-600" />;
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'ALL') return true;
    return alert.severity === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Security Threats & Anomalies</h2>
          <div className="flex space-x-2">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  filter === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-red-50 rounded">
            <p className="text-2xl font-bold text-red-600">
              {alerts.filter(a => a.severity === 'CRITICAL').length}
            </p>
            <p className="text-xs text-gray-600">Critical</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded">
            <p className="text-2xl font-bold text-orange-600">
              {alerts.filter(a => a.severity === 'HIGH').length}
            </p>
            <p className="text-xs text-gray-600">High</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded">
            <p className="text-2xl font-bold text-yellow-600">
              {alerts.filter(a => a.severity === 'MEDIUM').length}
            </p>
            <p className="text-xs text-gray-600">Medium</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded">
            <p className="text-2xl font-bold text-blue-600">
              {alerts.filter(a => a.severity === 'LOW').length}
            </p>
            <p className="text-xs text-gray-600">Low</p>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">Active Alerts</h3>
        </div>
        <div className="divide-y">
          {filteredAlerts.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No security alerts in this category</p>
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div key={alert.id} className="px-6 py-4">
                <div
                  className={`p-4 rounded-lg border-l-4 ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold">{alert.type}</h4>
                          <span className="px-2 py-0.5 bg-white rounded text-xs font-medium">
                            {alert.severity}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{alert.description}</p>
                        
                        {alert.llmAnalysis && expandedAlert === alert.id && (
                          <div className="mt-4 p-4 bg-white rounded border">
                            <div className="flex items-center space-x-2 mb-3">
                              <Brain className="h-4 w-4 text-purple-600" />
                              <span className="text-sm font-medium text-purple-600">
                                AI Analysis
                              </span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Risk Level: </span>
                                <span className={`font-semibold ${
                                  alert.llmAnalysis.riskLevel === 'CRITICAL' ? 'text-red-600' :
                                  alert.llmAnalysis.riskLevel === 'HIGH' ? 'text-orange-600' :
                                  alert.llmAnalysis.riskLevel === 'MEDIUM' ? 'text-yellow-600' :
                                  'text-blue-600'
                                }`}>
                                  {alert.llmAnalysis.riskLevel}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium">Confidence: </span>
                                <span>{(alert.llmAnalysis.confidence * 100).toFixed(0)}%</span>
                              </div>
                              <div className="mt-3">
                                <p className="font-medium mb-1">Analysis Summary:</p>
                                <p className="text-gray-700 whitespace-pre-wrap">
                                  {alert.llmAnalysis.summary}
                                </p>
                              </div>
                              {alert.llmAnalysis.recommendations && alert.llmAnalysis.recommendations.length > 0 && (
                                <div className="mt-3">
                                  <p className="font-medium mb-1">Recommendations:</p>
                                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                                    {alert.llmAnalysis.recommendations.map((rec, idx) => (
                                      <li key={idx}>{rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {alert.llmAnalysis && (
                        <button
                          onClick={() => setExpandedAlert(
                            expandedAlert === alert.id ? null : alert.id
                          )}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {expandedAlert === alert.id ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded"
                        title="Mark as Resolved"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Dismiss"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-600">
                    Detected: {new Date(alert.detectedAt).toLocaleString()}
                    {alert.userId && ` • User: ${alert.userId.substring(0, 8)}...`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Anomalies */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold">Recent Behavior Anomalies</h3>
        </div>
        <div className="divide-y">
          {anomalies.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent anomalies detected
            </div>
          ) : (
            anomalies.slice(0, 5).map(anomaly => (
              <div key={anomaly.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-orange-600" />
                      <span className="font-medium">
                        Anomaly Score: {anomaly.score.toFixed(3)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      User: {anomaly.userId.substring(0, 8)}... • 
                      {new Date(anomaly.detectedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      anomaly.status === 'ANALYZED' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {anomaly.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ThreatAlerts;