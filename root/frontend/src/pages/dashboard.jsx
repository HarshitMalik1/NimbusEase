import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Shield, 
  FileText, 
  Activity, 
  AlertTriangle, 
  Database,
  TrendingUp,
  Users
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import ThreatAlerts from './ThreatAlerts';
import FileManagement from './fileManagement';
import ActivityLogs from './ActivityLogs';
import BlockchainVerification from './BlockchainVerification';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [realtimeAlerts, setRealtimeAlerts] = useState([]);

  useEffect(() => {
    loadDashboardStats();
    connectWebSocket();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const response = await apiClient.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const connectWebSocket = () => {
    const ws = new WebSocket(process.env.REACT_APP_WS_URL);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'SECURITY_ALERT') {
        setRealtimeAlerts(prev => [data.payload, ...prev].slice(0, 10));
      }
    };

    return () => ws.close();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab stats={stats} alerts={realtimeAlerts} />;
      case 'files':
        return <FileManagement />;
      case 'activity':
        return <ActivityLogs />;
      case 'threats':
        return <ThreatAlerts />;
      case 'blockchain':
        return <BlockchainVerification />;
      default:
        return <OverviewTab stats={stats} alerts={realtimeAlerts} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                SecureCloud Platform
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {user?.role}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'files', label: 'Files', icon: FileText },
              { id: 'activity', label: 'Activity', icon: Activity },
              { id: 'threats', label: 'Threats', icon: AlertTriangle },
              { id: 'blockchain', label: 'Blockchain', icon: Database },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </main>
    </div>
  );
};

const OverviewTab = ({ stats, alerts }) => {
  if (!stats) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Files"
          value={stats.totalFiles}
          icon={FileText}
          trend="+12%"
          color="blue"
        />
        <StatCard
          title="Security Score"
          value={`${stats.securityScore}/100`}
          icon={Shield}
          trend="+5%"
          color="green"
        />
        <StatCard
          title="Active Threats"
          value={stats.activeThreats}
          icon={AlertTriangle}
          trend="-8%"
          color="red"
        />
        <StatCard
          title="Blockchain Records"
          value={stats.blockchainRecords}
          icon={Database}
          trend="+15%"
          color="purple"
        />
      </div>

      {/* Real-time Alerts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Real-time Security Alerts</h2>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent alerts</p>
          ) : (
            alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-red-50 border-red-500'
                    : alert.severity === 'HIGH'
                    ? 'bg-orange-50 border-orange-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{alert.type}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Activity Overview</h2>
        <div className="h-64 flex items-center justify-center text-gray-400">
          {/* Chart implementation */}
          Activity chart visualization
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, trend, color }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          {trend && (
            <p className="text-sm text-green-600 mt-2 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;