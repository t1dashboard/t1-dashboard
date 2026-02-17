/**
 * Swiss Rationalism: T1-T3 Dashboard page with KPI summary cards
 */

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { WorkOrder, ScheduledLabor, PMCode } from "@/types/workOrder";
import WorkLoadTab, { WeekFilter } from "@/components/WorkLoadTab";
import RiskIdentificationTab from "@/components/RiskIdentificationTab";
import LOTOReviewTab from "@/components/LOTOReviewTab";
import T1NotInReadyTab from "@/components/T1NotInReadyTab";
import T2NotInReadyTab from "@/components/T2NotInReadyTab";
import T3NotInReadyTab from "@/components/T3NotInReadyTab";
import ComplianceCheckTab from "@/components/ComplianceCheckTab";
import { getNextWeekRange, getT2WeekRange, getT3WeekRange, isNextWeek } from "@/lib/dateUtils";
import { getUploadMetadata, getComplianceAlerts, ComplianceAlert } from "@/lib/api";
import {
  Search, ClipboardList, AlertTriangle, CheckCircle2, Clock, Bell, X, Shield
} from "lucide-react";

interface T1T3DashboardProps {
  workOrders: WorkOrder[];
  scheduledLabor: ScheduledLabor[];
  pmCodes: PMCode[];
}

export default function T1T3Dashboard({ workOrders, scheduledLabor, pmCodes }: T1T3DashboardProps) {
  const [activeTab, setActiveTab] = useState("t3notready");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUploaded, setLastUploaded] = useState<string | null>(null);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [workloadWeek, setWorkloadWeek] = useState<WeekFilter>("t1");

  // Load upload metadata and compliance alerts
  useEffect(() => {
    async function loadMetadata() {
      try {
        const metadata = await getUploadMetadata();
        setLastUploaded(metadata.workOrders);
      } catch (e) {
        console.error("Error loading upload metadata:", e);
      }
    }
    async function loadAlerts() {
      try {
        const alerts = await getComplianceAlerts();
        setComplianceAlerts(alerts);
      } catch (e) {
        console.error("Error loading compliance alerts:", e);
      }
    }
    loadMetadata();
    loadAlerts();
  }, []);

  const nextWeekRange = useMemo(() => {
    const { start, end } = getNextWeekRange();
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, []);

  const t2WeekRange = useMemo(() => {
    const { start, end } = getT2WeekRange();
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, []);

  const t3WeekRange = useMemo(() => {
    const { start, end } = getT3WeekRange();
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, []);

  // KPI calculations
  const kpis = useMemo(() => {
    const t1WorkOrders = workOrders.filter(wo => isNextWeek(wo["Sched. Start Date"]));
    const readyCount = t1WorkOrders.filter(wo => (wo["Status"] || "").toLowerCase() === "ready").length;
    const notReadyCount = t1WorkOrders.filter(wo => (wo["Status"] || "").toLowerCase() !== "ready" 
      && (wo["Status"] || "").toLowerCase() !== "closed" 
      && (wo["Status"] || "").toLowerCase() !== "work complete"
      && (wo["Status"] || "").toLowerCase() !== "cancelled").length;
    
    // High risk count
    const highRiskCount = t1WorkOrders.filter(wo => {
      const opsLOR = (wo["Operational LOR"] || "").toLowerCase();
      const ehsLOR = (wo["EHS LOR"] || "").toLowerCase();
      return opsLOR.includes("high") || ehsLOR.includes("high");
    }).length;

    return {
      totalT1: t1WorkOrders.length,
      ready: readyCount,
      notReady: notReadyCount,
      highRisk: highRiskCount,
      complianceAlertCount: complianceAlerts.length,
    };
  }, [workOrders, complianceAlerts]);

  // Filter work orders by search query
  const filteredWorkOrders = useMemo(() => {
    if (!searchQuery.trim()) return workOrders;
    const q = searchQuery.toLowerCase();
    return workOrders.filter(wo =>
      String(wo["Work Order"] || "").toLowerCase().includes(q) ||
      (wo["Description"] || "").toLowerCase().includes(q) ||
      (wo["Data Center"] || "").toLowerCase().includes(q) ||
      (wo["Assigned To Name"] || "").toLowerCase().includes(q) ||
      (wo["Status"] || "").toLowerCase().includes(q) ||
      (wo["Equipment Description"] || "").toLowerCase().includes(q)
    );
  }, [workOrders, searchQuery]);

  // Stale data check (>7 days)
  const isStale = useMemo(() => {
    if (!lastUploaded) return false;
    const uploadDate = new Date(lastUploaded);
    const now = new Date();
    const diffDays = Math.ceil((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  }, [lastUploaded]);

  const formattedUploadDate = useMemo(() => {
    if (!lastUploaded) return null;
    const d = new Date(lastUploaded);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }, [lastUploaded]);

  return (
    <div className="space-y-4">
      {/* Header with search and last uploaded */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-foreground">T1-T3 Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            T1: {nextWeekRange} | T2: {t2WeekRange} | T3: {t3WeekRange}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Last uploaded timestamp */}
          {formattedUploadDate && (
            <div className={`text-xs px-3 py-1.5 rounded-full ${isStale ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              <Clock className="h-3 w-3 inline mr-1" />
              {isStale ? 'Stale data — ' : 'Updated '}
              {formattedUploadDate}
            </div>
          )}
          {/* Search bar */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search work orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Alert Banner */}
      {complianceAlerts.length > 0 && !alertsDismissed && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <Bell className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              Compliance Alert: {complianceAlerts.length} work order{complianceAlerts.length !== 1 ? 's' : ''} within 3 days of compliance deadline
            </p>
            <div className="mt-1 space-y-0.5">
              {complianceAlerts.slice(0, 5).map(alert => (
                <p key={alert.workOrderNumber} className="text-xs text-red-700">
                  WO {alert.workOrderNumber} — {alert.description?.substring(0, 60)}{(alert.description?.length || 0) > 60 ? '...' : ''} ({alert.dataCenter})
                </p>
              ))}
              {complianceAlerts.length > 5 && (
                <p className="text-xs text-red-600 font-medium">
                  ...and {complianceAlerts.length - 5} more
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setAlertsDismissed(true)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">T1 Work Orders</p>
                <p className="text-2xl font-semibold text-foreground mt-0.5">{kpis.totalT1}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Ready</p>
                <p className="text-2xl font-semibold text-foreground mt-0.5">{kpis.ready}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Not Ready</p>
                <p className="text-2xl font-semibold text-foreground mt-0.5">{kpis.notReady}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">High Risk</p>
                <p className="text-2xl font-semibold text-foreground mt-0.5">{kpis.highRisk}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Compliance Alerts</p>
                <p className="text-2xl font-semibold text-foreground mt-0.5">{kpis.complianceAlertCount}</p>
              </div>
              <Shield className="h-8 w-8 text-purple-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search results indicator */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredWorkOrders.length} of {workOrders.length} work orders matching "{searchQuery}"
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-7 h-auto p-1">
          <TabsTrigger value="t3notready" className="py-3">T3 Not in Ready</TabsTrigger>
          <TabsTrigger value="t2notready" className="py-3">T2 Not in Ready</TabsTrigger>
          <TabsTrigger value="t1notready" className="py-3">T1 Not in Ready</TabsTrigger>
          <TabsTrigger value="workload" className="py-3">Workload</TabsTrigger>
          <TabsTrigger value="risk" className="py-3">Risk Identification</TabsTrigger>
          <TabsTrigger value="loto" className="py-3">LOTO Review</TabsTrigger>
          <TabsTrigger value="compliance" className="py-3">Compliance Check</TabsTrigger>
        </TabsList>

        <TabsContent value="t3notready" className="mt-6">
          <T3NotInReadyTab workOrders={filteredWorkOrders} />
        </TabsContent>

        <TabsContent value="t2notready" className="mt-6">
          <T2NotInReadyTab workOrders={filteredWorkOrders} />
        </TabsContent>

        <TabsContent value="t1notready" className="mt-6">
          <T1NotInReadyTab workOrders={filteredWorkOrders} />
        </TabsContent>

        <TabsContent value="workload" className="mt-6">
          <WorkLoadTab workOrders={filteredWorkOrders} weekFilter={workloadWeek} onWeekChange={setWorkloadWeek} />
        </TabsContent>

        <TabsContent value="risk" className="mt-6">
          <RiskIdentificationTab workOrders={filteredWorkOrders} />
        </TabsContent>

        <TabsContent value="loto" className="mt-6">
          <LOTOReviewTab workOrders={filteredWorkOrders} scheduledLabor={scheduledLabor} pmCodes={pmCodes} />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceCheckTab workOrders={filteredWorkOrders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
