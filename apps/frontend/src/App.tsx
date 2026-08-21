import { useState } from 'react';
import { LayoutDashboard, TrendingUp, Users, DollarSign, Activity, Settings } from 'lucide-react';
import { Card, StatNumber, Sidebar, Badge, DataBar, SectionHeader } from './components/ui/primitives';

export function App() {
  const [activeNav, setActiveNav] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: activeNav === 'dashboard', onClick: () => setActiveNav('dashboard') },
    { id: 'growth', label: 'Growth', icon: TrendingUp, active: activeNav === 'growth', onClick: () => setActiveNav('growth') },
    { id: 'retention', label: 'Retention', icon: Users, active: activeNav === 'retention', onClick: () => setActiveNav('retention') },
    { id: 'revenue', label: 'Revenue', icon: DollarSign, active: activeNav === 'revenue', onClick: () => setActiveNav('revenue') },
    { id: 'analytics', label: 'Analytics', icon: Activity, active: activeNav === 'analytics', onClick: () => setActiveNav('analytics') },
    { id: 'settings', label: 'Settings', icon: Settings, active: activeNav === 'settings', onClick: () => setActiveNav('settings') },
  ];

  return (
    <div className="flex min-h-screen bg-bg-off text-text-primary">
      <Sidebar items={navItems} />

      <main className="flex-1 p-32 max-w-7xl mx-auto">
        <SectionHeader
          title="RevGrowth Design System Primitives"
          subtitle="Strict palette: single accent (#3B5BFF), neutral base (#FFFFFF / #F7F8FA), no gradients, no emoji."
          action={
            <button className="bg-accent hover:bg-accent-hover text-white text-xs font-medium px-16 py-8 rounded transition-colors">
              Primary Action
            </button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-24 mb-32">
          <Card>
            <StatNumber
              label="Net Revenue Retention (NRR)"
              value="118.4%"
              delta={{ value: "+2.4%", isPositive: true }}
              subtext="Vs previous 30-day cohort"
            />
          </Card>

          <Card>
            <StatNumber
              label="CAC Payback Period"
              value="7.2 mo"
              delta={{ value: "-0.8 mo", isPositive: true }}
              subtext="Target threshold: < 12 mo"
            />
          </Card>

          <Card>
            <StatNumber
              label="Top-of-Funnel Churn Risk"
              value="14.2%"
              delta={{ value: "+3.1%", isRisk: true }}
              subtext="Unmatched cohort drop-off rate"
            />
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-16">Hero Volume Indicator</h3>
            <div className="space-y-16">
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-4">
                  <span>Paid Search Conversion (Hero Chart Accent)</span>
                  <span className="font-semibold text-text-primary">78%</span>
                </div>
                <DataBar percentage={78} isHero={true} />
              </div>
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-4">
                  <span>Organic Traffic Retention</span>
                  <span className="font-semibold text-text-primary">45%</span>
                </div>
                <DataBar percentage={45} isHero={false} />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-16">Status Badges</h3>
            <div className="flex flex-wrap gap-12 items-center">
              <Badge variant="success">Healthy Growth</Badge>
              <Badge variant="risk">High Cohort Churn</Badge>
              <Badge variant="neutral">Pending Verification</Badge>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default App;
