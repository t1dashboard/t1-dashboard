/**
 * WO Closure SLA Adherence Tab
 * 
 * Compares Date Completed (closed date) vs Sched End Date (work complete date)
 * SLA: 2 business days for normal WOs, 21 business days for WOs in the invoice SLA overrides DB
 *      or matching the description pattern "[MSME/VENDOR] PROCESS WATER / WASTEWATER SAMPLING"
 * Currently filtered to March only
 * Groups by month and quarter, then by supervisor within each month
 */

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkOrder } from "@/types/workOrder";
import { getInvoiceSLAOverrides, InvoiceSLAOverride } from "@/lib/api";
import { parseExcelDate, formatDate } from "@/lib/dateUtils";
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface WOClosureSLATabProps {
  workOrders: WorkOrder[];
}

interface SLAWorkOrder {
  wo: WorkOrder;
  schedEndDate: Date;
  dateCompleted: Date;
  businessDays: number;
  slaLimit: number;
  withinSLA: boolean;
  isInvoiceWO: boolean;
}

interface SupervisorMetric {
  supervisor: string;
  total: number;
  withinSLA: number;
  outsideSLA: number;
  adherencePercent: number;
  workOrders: SLAWorkOrder[];
}

interface MonthlyData {
  month: string; // YYYY-MM
  label: string; // "Mar 2026"
  total: number;
  withinSLA: number;
  outsideSLA: number;
  adherencePercent: number;
  supervisors: SupervisorMetric[];
  workOrders: SLAWorkOrder[];
}

interface QuarterlyData {
  quarter: string; // "2026-Q1"
  label: string; // "Q1 2026"
  total: number;
  withinSLA: number;
  outsideSLA: number;
  adherencePercent: number;
}

/**
 * Count business days between two dates (excluding weekends)
 * Does NOT count the start date, counts the end date
 */
function countBusinessDays(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  if (e <= s) return 0;
  
  let count = 0;
  const current = new Date(s);
  current.setDate(current.getDate() + 1);
  
  while (current <= e) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

function getQuarterKey(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const m = parseInt(month, 10);
  const q = Math.ceil(m / 3);
  return `${year}-Q${q}`;
}

function getQuarterLabel(quarterKey: string): string {
  const [year, q] = quarterKey.split("-Q");
  return `Q${q} ${year}`;
}

function getAdherenceColor(percent: number): string {
  if (percent >= 90) return "text-green-600 dark:text-green-400";
  if (percent >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getAdherenceBg(percent: number): string {
  if (percent >= 90) return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
  if (percent >= 70) return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
  return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
}

function getProgressColor(percent: number): string {
  if (percent >= 90) return "bg-green-500";
  if (percent >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

// Description patterns that automatically get 21-day SLA
const INVOICE_DESCRIPTION_PATTERNS = [
  "[MSME/VENDOR] PROCESS WATER / WASTEWATER SAMPLING",
  "SAND FILTER SKID ANNUAL PM",
];

function matchesInvoiceDescription(description: string): boolean {
  const upper = (description || "").toUpperCase();
  return INVOICE_DESCRIPTION_PATTERNS.some(pattern => upper.includes(pattern.toUpperCase()));
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

// Supervisors to exclude (no longer employed)
const EXCLUDED_SUPERVISORS = new Set(["ABOSTWICK"]);

export default function WOClosureSLATab({ workOrders }: WOClosureSLATabProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
  const [invoiceOverrides, setInvoiceOverrides] = useState<InvoiceSLAOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(true);

  // Load invoice SLA overrides from database
  useEffect(() => {
    async function loadOverrides() {
      try {
        const overrides = await getInvoiceSLAOverrides();
        setInvoiceOverrides(overrides);
      } catch (error) {
        console.error("Error loading invoice SLA overrides:", error);
      } finally {
        setLoadingOverrides(false);
      }
    }
    loadOverrides();
  }, []);

  // Build set of WO numbers from DB overrides
  const invoiceWOSet = useMemo(() => {
    const set = new Set<string>();
    invoiceOverrides.forEach(override => {
      set.add(String(override.work_order_number));
    });
    return set;
  }, [invoiceOverrides]);

  // Filter and compute SLA for closed/work-complete work orders
  const slaWorkOrders = useMemo(() => {
    const results: SLAWorkOrder[] = [];
    
    workOrders.forEach(wo => {
      const status = (wo["Status"] || "").toUpperCase();
      // Include Closed, Work Complete, and QA Rejected statuses (all have completion dates)
      if (status !== "CLOSED" && status !== "WORK COMPLETE" && status !== "WORKCOMPLETE" && status !== "QA REJECTED") return;
      
      const supervisor = (wo["Supervisor"] || "").trim();
      if (EXCLUDED_SUPERVISORS.has(supervisor.toUpperCase())) return;
      
      const schedEndDate = parseExcelDate(wo["Sched. End Date"]);
      const dateCompleted = parseExcelDate(wo["Date Completed"]);
      
      if (!schedEndDate || !dateCompleted) return;
      
      // Detect likely wrong-year data entry (365 ± 30 days)
      const calendarDaysApart = Math.abs(
        (dateCompleted.getTime() - schedEndDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (calendarDaysApart >= 335 && calendarDaysApart <= 395) return;
      
      const woNumber = String(wo["Work Order"]);
      const description = wo["Description"] || "";
      
      // Check if this WO gets 21-day SLA: either in DB overrides or matches description pattern
      const isInvoiceWO = invoiceWOSet.has(woNumber) || matchesInvoiceDescription(description);
      const slaLimit = isInvoiceWO ? 21 : 2;
      const businessDays = countBusinessDays(schedEndDate, dateCompleted);
      const withinSLA = businessDays <= slaLimit;
      
      results.push({
        wo,
        schedEndDate,
        dateCompleted,
        businessDays,
        slaLimit,
        withinSLA,
        isInvoiceWO,
      });
    });
    
    return results;
  }, [workOrders, invoiceWOSet]);

  // Group by month (based on Date Completed)
  const monthlyData: MonthlyData[] = useMemo(() => {
    const monthMap = new Map<string, SLAWorkOrder[]>();
    
    slaWorkOrders.forEach(swo => {
      const year = swo.dateCompleted.getFullYear();
      const month = String(swo.dateCompleted.getMonth() + 1).padStart(2, "0");
      const monthKey = `${year}-${month}`;
      
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
      monthMap.get(monthKey)!.push(swo);
    });

    const months = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

    return months.map(monthKey => {
      const wos = monthMap.get(monthKey)!;
      const total = wos.length;
      const withinSLA = wos.filter(w => w.withinSLA).length;
      const outsideSLA = total - withinSLA;
      const adherencePercent = total > 0 ? Math.round((withinSLA / total) * 100) : 0;

      // Group by supervisor within this month
      const supervisorMap = new Map<string, SLAWorkOrder[]>();
      wos.forEach(swo => {
        const sup = swo.wo["Supervisor"] || "Unassigned";
        if (!supervisorMap.has(sup)) supervisorMap.set(sup, []);
        supervisorMap.get(sup)!.push(swo);
      });

      const supervisors: SupervisorMetric[] = Array.from(supervisorMap.entries())
        .map(([supervisor, swos]) => {
          const sTotal = swos.length;
          const sWithin = swos.filter(w => w.withinSLA).length;
          const sOutside = sTotal - sWithin;
          const sPercent = sTotal > 0 ? Math.round((sWithin / sTotal) * 100) : 0;

          swos.sort((a, b) => {
            if (a.withinSLA !== b.withinSLA) return a.withinSLA ? 1 : -1;
            return b.businessDays - a.businessDays;
          });

          return { supervisor, total: sTotal, withinSLA: sWithin, outsideSLA: sOutside, adherencePercent: sPercent, workOrders: swos };
        })
        .sort((a, b) => a.adherencePercent - b.adherencePercent);

      return {
        month: monthKey,
        label: formatMonth(monthKey),
        total,
        withinSLA,
        outsideSLA,
        adherencePercent,
        supervisors,
        workOrders: wos,
      };
    });
  }, [slaWorkOrders]);

  // Quarterly rollups
  const quarterlyData: QuarterlyData[] = useMemo(() => {
    const quarterMap = new Map<string, { total: number; withinSLA: number }>();

    monthlyData.forEach(md => {
      const qKey = getQuarterKey(md.month);
      if (!quarterMap.has(qKey)) quarterMap.set(qKey, { total: 0, withinSLA: 0 });
      const entry = quarterMap.get(qKey)!;
      entry.total += md.total;
      entry.withinSLA += md.withinSLA;
    });

    const quarters = Array.from(quarterMap.keys()).sort((a, b) => b.localeCompare(a));

    return quarters.map(qKey => {
      const entry = quarterMap.get(qKey)!;
      const outsideSLA = entry.total - entry.withinSLA;
      const adherencePercent = entry.total > 0 ? Math.round((entry.withinSLA / entry.total) * 100) : 0;
      return { quarter: qKey, label: getQuarterLabel(qKey), total: entry.total, withinSLA: entry.withinSLA, outsideSLA, adherencePercent };
    });
  }, [monthlyData]);

  // Overall metrics
  const overallMetrics = useMemo(() => {
    const total = slaWorkOrders.length;
    const withinSLA = slaWorkOrders.filter(w => w.withinSLA).length;
    const outsideSLA = total - withinSLA;
    const adherencePercent = total > 0 ? Math.round((withinSLA / total) * 100) : 0;
    return { total, withinSLA, outsideSLA, adherencePercent };
  }, [slaWorkOrders]);

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const toggleSupervisor = (key: string) => {
    setExpandedSupervisors(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loadingOverrides) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading SLA data...</p>
        </CardContent>
      </Card>
    );
  }

  if (slaWorkOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No completed work orders with both Sched End Date and Date Completed found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            WO Closure SLA Adherence
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            SLA: 2 business days from work complete to closure. Invoice/vendor WOs get 21 business days. Showing all months with completed work orders.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <div className="text-sm text-muted-foreground">Total Closed WOs</div>
              <div className="text-2xl font-bold mt-1">{overallMetrics.total}</div>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Within SLA
              </div>
              <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{overallMetrics.withinSLA}</div>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> Outside SLA
              </div>
              <div className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{overallMetrics.outsideSLA}</div>
            </div>
            <div className={`p-4 rounded-lg border ${getAdherenceBg(overallMetrics.adherencePercent)}`}>
              <div className="text-sm text-muted-foreground">Overall Adherence</div>
              <div className={`text-2xl font-bold mt-1 ${getAdherenceColor(overallMetrics.adherencePercent)}`}>
                {overallMetrics.adherencePercent}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quarterly Adherence Badges */}
      {quarterlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quarterly Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {quarterlyData.map(qd => (
                <div key={qd.quarter} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${getAdherenceBg(qd.adherencePercent)}`}>
                  <div>
                    <div className="text-sm font-medium">{qd.label}</div>
                    <div className="text-xs text-muted-foreground">{qd.withinSLA}/{qd.total} within SLA</div>
                  </div>
                  <div className={`text-xl font-bold ${getAdherenceColor(qd.adherencePercent)}`}>
                    {qd.adherencePercent}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Breakdown */}
      {monthlyData.map(md => {
        const isMonthExpanded = expandedMonths.has(md.month);
        return (
          <Card key={md.month}>
            <CardHeader className="cursor-pointer" onClick={() => toggleMonth(md.month)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-base">{md.label}</CardTitle>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${getAdherenceBg(md.adherencePercent)}`}>
                    <span className={`text-lg font-bold ${getAdherenceColor(md.adherencePercent)}`}>{md.adherencePercent}%</span>
                    <span className="text-xs text-muted-foreground">
                      {md.withinSLA}/{md.total} within SLA
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="text-green-600 dark:text-green-400">{md.withinSLA} within</span>
                    <span className="text-red-600 dark:text-red-400">{md.outsideSLA} outside</span>
                  </div>
                  {isMonthExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>

            {isMonthExpanded && (
              <CardContent className="pt-0">
                {/* Supervisor breakdown table */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">By Supervisor</h4>
                  {md.supervisors.map(metric => {
                    const supKey = `${md.month}-${metric.supervisor}`;
                    const isSupExpanded = expandedSupervisors.has(supKey);
                    return (
                      <div key={supKey} className="border rounded-lg overflow-hidden">
                        {/* Supervisor row */}
                        <button
                          onClick={() => toggleSupervisor(supKey)}
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="font-medium text-left min-w-[140px] text-sm">{metric.supervisor}</div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{metric.total} WOs</span>
                              <span className="text-green-600 dark:text-green-400">{metric.withinSLA} within</span>
                              <span className="text-red-600 dark:text-red-400">{metric.outsideSLA} outside</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant="outline" 
                              className={`font-bold ${getAdherenceColor(metric.adherencePercent)}`}
                            >
                              {metric.adherencePercent}%
                            </Badge>
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${getProgressColor(metric.adherencePercent)}`}
                                style={{ width: `${metric.adherencePercent}%` }}
                              />
                            </div>
                            {isSupExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </button>

                        {/* Expanded WO details */}
                        {isSupExpanded && (
                          <div className="border-t overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left py-2 px-3 font-medium">Work Order</th>
                                  <th className="text-left py-2 px-3 font-medium">Description</th>
                                  <th className="text-left py-2 px-3 font-medium">Data Center</th>
                                  <th className="text-left py-2 px-3 font-medium">Sched End Date</th>
                                  <th className="text-left py-2 px-3 font-medium">Date Completed</th>
                                  <th className="text-left py-2 px-3 font-medium">Biz Days</th>
                                  <th className="text-left py-2 px-3 font-medium">SLA</th>
                                  <th className="text-left py-2 px-3 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {metric.workOrders.map(swo => (
                                  <tr 
                                    key={swo.wo["Work Order"]} 
                                    className={`border-b last:border-b-0 ${
                                      !swo.withinSLA ? "bg-red-50/50 dark:bg-red-950/10" : ""
                                    }`}
                                  >
                                    <td className="py-2 px-3">
                                      <a
                                        href={`${BASE_URL}${swo.wo["Work Order"]}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline font-medium"
                                      >
                                        {swo.wo["Work Order"]}
                                      </a>
                                    </td>
                                    <td className="py-2 px-3 truncate max-w-[200px]">{swo.wo["Description"]}</td>
                                    <td className="py-2 px-3">{swo.wo["Data Center"]}</td>
                                    <td className="py-2 px-3">{formatDate(swo.wo["Sched. End Date"])}</td>
                                    <td className="py-2 px-3">{formatDate(swo.wo["Date Completed"])}</td>
                                    <td className="py-2 px-3 font-medium">
                                      <span className={swo.withinSLA ? "" : "text-red-600 dark:text-red-400"}>
                                        {swo.businessDays}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      <Badge variant="outline" className="text-xs">
                                        {swo.isInvoiceWO ? "21 days" : "2 days"}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-3">
                                      {swo.withinSLA ? (
                                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                          Within SLA
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                                          {swo.businessDays - swo.slaLimit}d over
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
