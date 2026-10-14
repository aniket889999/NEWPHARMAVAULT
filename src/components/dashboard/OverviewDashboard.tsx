import React, { useState, useEffect } from 'react';
import {
  Pill,
  Shield,
  AlertTriangle,
  TrendingUp,
  Users,
  FileText,
  GitCompare,
  Activity
} from 'lucide-react';
import { AnalyticsData } from '../../types';
import { enhancedMedicines } from '../../data/enhancedMedicines';
import DashboardVisuals from './DashboardVisuals';

const OverviewDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading analytics data
    const loadAnalytics = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockAnalytics: AnalyticsData = {
        totalMedicines: enhancedMedicines.length,
        totalUsers: 1247,
        totalPharmacies: 89,
        authenticityChecks: 3456,
        interactionAlerts: 234,
        prescriptionAnalyses: 567,
        popularMedicines: enhancedMedicines.slice(0, 5),
        recentActivity: [
          {
            id: '1',
            userId: 'user-123',
            action: 'Medicine Search',
            details: 'Searched for Paracetamol alternatives',
            timestamp: new Date(Date.now() - 1000 * 60 * 5),
            category: 'search'
          },
          {
            id: '2',
            userId: 'user-456',
            action: 'Authenticity Check',
            details: 'Verified Amoxicillin batch AMX2024002',
            timestamp: new Date(Date.now() - 1000 * 60 * 15),
            category: 'authenticity'
          },
          {
            id: '3',
            userId: 'user-789',
            action: 'Drug Interaction',
            details: 'Checked interactions for 3 medicines',
            timestamp: new Date(Date.now() - 1000 * 60 * 30),
            category: 'interaction'
          }
        ]
      };

      setAnalytics(mockAnalytics);
      setLoading(false);
    };

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Medicines',
      value: analytics?.totalMedicines.toLocaleString() || '0',
      icon: Pill,
      change: '+12%',
      changeType: 'increase' as const,
      color: 'bg-blue-500'
    },
    {
      name: 'Authenticity Checks',
      value: analytics?.authenticityChecks.toLocaleString() || '0',
      icon: Shield,
      change: '+23%',
      changeType: 'increase' as const,
      color: 'bg-green-500'
    },
    {
      name: 'Interaction Alerts',
      value: analytics?.interactionAlerts.toLocaleString() || '0',
      icon: AlertTriangle,
      change: '-8%',
      changeType: 'decrease' as const,
      color: 'bg-yellow-500'
    },
    {
      name: 'Active Users',
      value: analytics?.totalUsers.toLocaleString() || '0',
      icon: Users,
      change: '+18%',
      changeType: 'increase' as const,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">
          Welcome to PharmaVault - Your comprehensive medicine management platform
        </p>
      </div>

      {/* GSAP Dashboard Visualization */}
      <DashboardVisuals
        analytics={analytics}
        onStatClick={(statName: string) => {
          console.log(`Clicked on ${statName}`);
          // Add navigation or modal logic here
        }}
        onMedicineClick={(medicine: any) => {
          console.log(`Clicked on medicine: ${medicine.name}`);
          // Add medicine details modal or navigation
        }}
        onActionClick={(action: string) => {
          console.log(`Clicked action: ${action}`);
          // Add routing logic for actions
        }}
      />

      {/* Stats Grid (Fallback 2D) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                    }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Medicines */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Popular Medicines</h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {analytics?.popularMedicines.map((medicine, index) => (
              <div key={medicine.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-800 text-sm font-medium">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{medicine.name}</p>
                    <p className="text-xs text-gray-500">{medicine.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">₹{medicine.price}</p>
                  <p className={`text-xs ${medicine.inStock ? 'text-green-600' : 'text-red-600'}`}>
                    {medicine.inStock ? 'In Stock' : 'Out of Stock'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {analytics?.recentActivity.map((activity) => {
              const getActivityIcon = (category: string) => {
                switch (category) {
                  case 'search': return <Pill className="h-4 w-4" />;
                  case 'authenticity': return <Shield className="h-4 w-4" />;
                  case 'interaction': return <AlertTriangle className="h-4 w-4" />;
                  case 'comparison': return <GitCompare className="h-4 w-4" />;
                  case 'prescription': return <FileText className="h-4 w-4" />;
                  default: return <Activity className="h-4 w-4" />;
                }
              };

              const getActivityColor = (category: string) => {
                switch (category) {
                  case 'search': return 'bg-blue-100 text-blue-600';
                  case 'authenticity': return 'bg-green-100 text-green-600';
                  case 'interaction': return 'bg-yellow-100 text-yellow-600';
                  case 'comparison': return 'bg-purple-100 text-purple-600';
                  case 'prescription': return 'bg-indigo-100 text-indigo-600';
                  default: return 'bg-gray-100 text-gray-600';
                }
              };

              return (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 p-2 rounded-full ${getActivityColor(activity.category)}`}>
                    {getActivityIcon(activity.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-sm text-gray-500">{activity.details}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {activity.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <Shield className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-900">Verify Medicine</span>
          </button>
          <button className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <GitCompare className="h-8 w-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-green-900">Compare Medicines</span>
          </button>
          <button className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <FileText className="h-8 w-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-purple-900">Analyze Prescription</span>
          </button>
          <button className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
            <AlertTriangle className="h-8 w-8 text-yellow-600 mb-2" />
            <span className="text-sm font-medium text-yellow-900">Check Interactions</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;