import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Megaphone,
  ShoppingCart,
  FileText,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Card, StatNumber, Sidebar, Badge, SectionHeader } from './components/ui/primitives';
import { formatINR } from './utils/formatters';

interface Opportunity {
  opportunityType: 'winback' | 'cross_sell' | 'upsell';
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  daysInactive?: number;
  pastSpend?: number;
  totalTransactions?: number;

  productA?: { id: string; name: string; price: number };
  productB?: { id: string; name: string; price: number };
  coPurchaseCount?: number;
  coPurchaseRate?: number;
  totalEligibleCount?: number;

  baseProduct?: { id: string; name: string; price: number; marginPct: number };
  premiumProduct?: { id: string; name: string; price: number; marginPct: number };
  basePurchaseCount?: number;
  totalBaseSpend?: number;
  priceDelta?: number;

  estimatedImpact: number;
  confidence: number;
  explanation?: string;
  loadingExplanation?: boolean;
}

export function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenueInfluenced: formatINR(248500),
    activeCampaigns: 4,
    pendingOpportunities: 0,
    auditEventsToday: 18,
  });

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  // Poll audit logs every 2 seconds
  useEffect(() => {
    async function fetchAuditLogs() {
      try {
        const res = await fetch('http://localhost:4000/api/opportunities/audit');
        const data = await res.json();
        if (data.logs) {
          setAuditLogs(data.logs);
          setStats((prev) => ({ ...prev, auditEventsToday: data.logs.length }));
        }
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      }
    }

    fetchAuditLogs();
    const interval = setInterval(fetchAuditLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  // Nav Items - 5 items matching specification
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: activeNav === 'dashboard', onClick: () => setActiveNav('dashboard') },
    { id: 'opportunities', label: 'Opportunities', icon: Sparkles, active: activeNav === 'opportunities', onClick: () => setActiveNav('opportunities') },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone, active: activeNav === 'campaigns', onClick: () => setActiveNav('campaigns') },
    { id: 'checkout', label: 'Checkout Layer', icon: ShoppingCart, active: activeNav === 'checkout', onClick: () => setActiveNav('checkout') },
    { id: 'audit', label: 'Audit Log', icon: FileText, active: activeNav === 'audit', onClick: () => setActiveNav('audit') },
  ];

  // Fetch opportunities on load
  useEffect(() => {
    async function loadOpportunities() {
      try {
        const res = await fetch('http://localhost:4000/api/opportunities');
        const data = await res.json();
        const opps: Opportunity[] = data.allOpportunities || [];
        setOpportunities(opps);
        setStats((prev) => ({
          ...prev,
          pendingOpportunities: opps.length,
        }));

        // Fetch explanations asynchronously
        opps.forEach(async (opp, idx) => {
          const oppId = opp.customerId || (opp.productA && opp.productA.id) || '';
          if (oppId) {
            try {
              const expRes = await fetch(`http://localhost:4000/api/opportunities/${oppId}/explain`, {
                method: 'POST',
              });
              const expData = await expRes.json();
              setOpportunities((current) =>
                current.map((item, i) =>
                  i === idx ? { ...item, explanation: expData.explanation } : item
                )
              );
            } catch (err) {
              console.error('Failed to load explanation for', oppId, err);
            }
          }
        });
      } catch (err) {
        console.error('Error fetching opportunities:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOpportunities();
  }, []);

  const handleApproveClick = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setModalOpen(true);
    setConfirmedSuccess(false);
  };

  const handleRejectClick = (oppId: string) => {
    setOpportunities((prev) => prev.filter((o) => (o.customerId || (o.productA && o.productA.id)) !== oppId));
    setStats((prev) => ({ ...prev, pendingOpportunities: prev.pendingOpportunities - 1 }));
  };

  const handleConfirmExecute = async () => {
    if (!selectedOpp) return;
    setConfirming(true);

    try {
      const oppId = selectedOpp.customerId || (selectedOpp.productA && selectedOpp.productA.id) || 'opp-1';
      const audienceSize = selectedOpp.totalEligibleCount || selectedOpp.totalTransactions || 1;
      const spendCap = Math.round(selectedOpp.estimatedImpact * 0.15) || 5000;

      await fetch('http://localhost:4000/api/opportunities/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedOpp.opportunityType,
          audienceSize,
          offerPct: 15,
          spendCap,
          opportunityId: oppId,
          targetName: selectedOpp.customerName || selectedOpp.productA?.name || 'Target Audience',
        }),
      });

      setConfirmedSuccess(true);
      setStats((prev) => ({
        ...prev,
        activeCampaigns: prev.activeCampaigns + 1,
        pendingOpportunities: Math.max(0, prev.pendingOpportunities - 1),
      }));

      setTimeout(() => {
        setModalOpen(false);
        if (selectedOpp) {
          handleRejectClick(selectedOpp.customerId || (selectedOpp.productA && selectedOpp.productA.id) || '');
        }
      }, 1500);
    } catch (err) {
      console.error('Failed to create campaign', err);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-bg-off text-text-primary">
      <Sidebar items={navItems} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-bg-base border-b border-border px-32 flex items-center justify-between">
          <div className="flex items-center gap-16">
            <span className="text-sm font-semibold text-text-primary">RevGrowth Store (INR Merchant)</span>
            <span className="text-xs text-text-muted">Razorpay Integrated · Last synced: Just now</span>
          </div>
          <div className="flex items-center gap-16 text-text-muted">
            <button title="Search" className="p-8 rounded hover:bg-bg-off">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 p-32 max-w-7xl w-full mx-auto">
          <SectionHeader
            title="Revenue Expansion Dashboard"
            subtitle="Automated win-back, cross-sell, and upsell detection powered by grounded financial analytics in INR."
          />

          {/* Top Stat Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-24 mb-32">
            <Card>
              <StatNumber
                label="Total Revenue Influenced"
                value={stats.totalRevenueInfluenced}
                delta={{ value: "+14.2%", isPositive: true }}
                subtext="Past 30 days"
              />
            </Card>
            <Card>
              <StatNumber
                label="Active Campaigns"
                value={stats.activeCampaigns}
                subtext="Execution in progress"
              />
            </Card>
            <Card>
              <StatNumber
                label="Pending Opportunities"
                value={stats.pendingOpportunities}
                delta={{ value: "Action Required", isRisk: false }}
                subtext="Identified by analytics engine"
              />
            </Card>
            <Card>
              <StatNumber
                label="Audit Events Today"
                value={stats.auditEventsToday}
                subtext="Verified state transitions"
              />
            </Card>
          </div>

          {/* Opportunity Feed / Audit Log Sections */}
          {activeNav === 'audit' ? (
            <div className="space-y-16">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                  Live Audit Log Stream (Polling every 2s)
                </h3>
                <span className="text-xs text-text-muted flex items-center gap-4">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Polling Active
                </span>
              </div>

              <div className="space-y-8">
                {auditLogs.length === 0 ? (
                  <Card className="text-center py-32 text-text-muted text-xs">
                    No campaign audit events recorded yet. Trigger a campaign from the Opportunities tab to see real-time log transitions.
                  </Card>
                ) : (
                  auditLogs.map((log) => {
                    let parsedPayload: any = {};
                    try {
                      parsedPayload = JSON.parse(log.payload);
                    } catch {
                      parsedPayload = { raw: log.payload };
                    }

                    const isError = log.step.includes('REJECTED') || log.step.includes('FAILED') || log.step.includes('EXHAUSTED');
                    const isFallback = log.step.includes('FALLBACK');
                    const badgeVariant = isError ? 'risk' : isFallback ? 'neutral' : 'success';

                    return (
                      <Card key={log.id} className="p-16 space-y-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-12">
                            <Badge variant={badgeVariant}>{log.step}</Badge>
                            <span className="text-xs font-mono text-text-muted">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <span className="text-xs text-text-muted font-mono">ID: {log.id.slice(0, 8)}</span>
                        </div>

                        <div className="bg-bg-off p-12 rounded font-mono text-xs text-text-primary overflow-x-auto">
                          <pre>{JSON.stringify(parsedPayload, null, 2)}</pre>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Opportunity Feed Header */}
              <div className="flex items-center justify-between mb-16">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                  Detected Opportunities ({opportunities.length})
                </h3>
              </div>

              {/* Opportunity Feed Cards */}
              {loading ? (
                <div className="p-32 flex items-center justify-center text-text-muted gap-8">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  <span>Analyzing database for revenue patterns...</span>
                </div>
              ) : (
                <div className="space-y-16">
                  {opportunities.map((opp, idx) => {
                    const oppId = opp.customerId || (opp.productA && opp.productA.id) || `opp-${idx}`;
                    const badgeVariant =
                      opp.opportunityType === 'winback'
                        ? 'risk'
                        : opp.opportunityType === 'upsell'
                        ? 'success'
                        : 'neutral';

                    const rawMetricText =
                      opp.opportunityType === 'winback'
                        ? `${opp.daysInactive} days inactive · ${formatINR(opp.pastSpend || 0)} past spend · ${opp.totalTransactions} orders`
                        : opp.opportunityType === 'cross_sell'
                        ? `${opp.coPurchaseCount} co-purchases · ${(opp.coPurchaseRate! * 100).toFixed(0)}% co-purchase rate · ${opp.totalEligibleCount} target buyers`
                        : `${opp.basePurchaseCount} repeat base buys · ${formatINR(opp.totalBaseSpend || 0)} spend · +${formatINR(opp.priceDelta || 0)} upgrade delta`;

                    return (
                      <Card key={oppId} className="flex flex-col md:flex-row md:items-center justify-between gap-16">
                        <div className="flex-1 space-y-8">
                          <div className="flex items-center gap-12">
                            <Badge variant={badgeVariant}>
                              {opp.opportunityType.replace('_', '-').toUpperCase()}
                            </Badge>
                            <span className="text-xs font-semibold text-text-primary">
                              Estimated Impact: +{formatINR(opp.estimatedImpact)}
                            </span>
                            <span className="text-xs text-text-muted">Confidence: {(opp.confidence * 100).toFixed(0)}%</span>
                          </div>

                          {/* Explanation Sentence */}
                          <p className="text-xs text-text-primary font-normal leading-relaxed">
                            {opp.explanation ? (
                              opp.explanation
                            ) : (
                              <span className="text-text-muted flex items-center gap-8">
                                <Loader2 className="w-3 h-3 animate-spin" /> Generating grounded Gemini narrative...
                              </span>
                            )}
                          </p>

                          {/* Raw Supporting Metric */}
                          <div className="text-xs text-text-muted font-mono bg-bg-off px-8 py-4 rounded inline-block">
                            {rawMetricText}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-12 self-end md:self-center">
                          <button
                            onClick={() => handleRejectClick(oppId)}
                            className="px-16 py-8 rounded border border-border text-xs font-medium text-text-muted hover:bg-bg-off hover:text-text-primary transition-colors flex items-center gap-4"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                          <button
                            onClick={() => handleApproveClick(opp)}
                            className="px-16 py-8 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors flex items-center gap-4"
                          >
                            <CheckCircle className="w-4 h-4" /> Approve
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Confirmation Modal */}
      {modalOpen && selectedOpp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-16 z-50">
          <div className="bg-bg-base border border-border rounded-card p-24 max-w-lg w-full shadow-card-hover space-y-24">
            <div className="flex items-center justify-between border-b border-border pb-16">
              <h3 className="text-sm font-semibold text-text-primary">Confirm Campaign Execution (Razorpay Order)</h3>
              <button onClick={() => setModalOpen(false)} className="text-text-muted hover:text-text-primary text-xs">
                Esc
              </button>
            </div>

            {confirmedSuccess ? (
              <div className="py-24 text-center space-y-12">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                <h4 className="text-sm font-semibold text-text-primary">Razorpay Campaign Order Created (INR)</h4>
                <p className="text-xs text-text-muted">Recorded in paise into Prisma DB audit log.</p>
              </div>
            ) : (
              <>
                <div className="space-y-12 text-xs">
                  <p className="text-text-muted">
                    Review and confirm explicit execution parameters for this{' '}
                    <span className="font-semibold text-text-primary uppercase">{selectedOpp.opportunityType}</span> campaign:
                  </p>

                  <div className="bg-bg-off p-16 rounded space-y-8">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Target Segment:</span>
                      <span className="font-semibold text-text-primary">
                        {selectedOpp.customerName || selectedOpp.productA?.name || 'Selected Cohort'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Audience Size:</span>
                      <span className="font-semibold text-text-primary">
                        {selectedOpp.totalEligibleCount || selectedOpp.totalTransactions || 1} buyers
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Offer Discount / Incentive:</span>
                      <span className="font-semibold text-text-primary">15% Off</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Spend Cap (Razorpay Order):</span>
                      <span className="font-semibold text-text-primary">
                        {formatINR(Math.round(selectedOpp.estimatedImpact * 0.15) || 5000)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Campaign Duration:</span>
                      <span className="font-semibold text-text-primary">14 Days</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-8 mt-8">
                      <span className="text-text-muted">Expected Upside:</span>
                      <span className="font-semibold text-accent">+{formatINR(selectedOpp.estimatedImpact)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-12 pt-8">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-16 py-8 rounded border border-border text-xs font-medium text-text-muted hover:bg-bg-off"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmExecute}
                    disabled={confirming}
                    className="px-16 py-8 rounded bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors flex items-center gap-8"
                  >
                    {confirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Creating Razorpay Order...
                      </>
                    ) : (
                      'Confirm & Execute Campaign'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

