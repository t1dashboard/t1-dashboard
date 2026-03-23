/**
 * WO Closure SLA Adherence Tab
 * 
 * Compares Date Completed (closed date) vs Sched End Date (work complete date)
 * SLA: 2 business days for normal WOs, 21 business days for WOs on the >90 days deferral awaiting invoice sheet
 * Groups by Supervisor to show each supervisor's adherence metric
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkOrder } from "@/types/workOrder";
import { DeferralWorkOrder } from "@/lib/api";
import { parseExcelDate, formatDate } from "@/lib/dateUtils";
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface WOClosureSLATabProps {
  workOrders: WorkOrder[];
  deferralWorkOrders: DeferralWorkOrder[];
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

/**
 * Count business days between two dates (excluding weekends)
 * Does NOT count the start date, counts the end date
 */
function countBusinessDays(start: Date, end: Date): number {
  // Normalize to start of day
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  if (e <= s) return 0;
  
  let count = 0;
  const current = new Date(s);
  current.setDate(current.getDate() + 1); // Start from day after
  
  while (current <= e) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

export default function WOClosureSLATab({ workOrders, deferralWorkOrders }: WOClosureSLATabProps) {
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());

  // Build set of WO numbers that are/were on the Awaiting Invoice deferral sheet
  const invoiceWOSet = useMemo(() => {
    const set = new Set<string>();
    deferralWorkOrders.forEach(dwo => {
      // Only include WOs from the "Awaiting Invoice" category for 21-day SLA
      const category = (dwo["Deferral Reason Selected"] || "").trim();
      if (category === "Awaiting Invoice") {
        set.add(String(dwo["Work Order"]));
      }
    });
    return set;
  }, [deferralWorkOrders]);

  // Filter and compute SLA for closed work orders
  const slaWorkOrders = useMemo(() => {
    const results: SLAWorkOrder[] = [];
    
    workOrders.forEach(wo => {
      const status = (wo["Status"] || "").toUpperCase();
      if (status !== "CLOSED") return;
      
      const schedEndDate = parseExcelDate(wo["Sched. End Date"]);
      const dateCompleted = parseExcelDate(wo["Date Completed"]);
      
      if (!schedEndDate || !dateCompleted) return;
      
      const woNumber = String(wo["Work Order"]);
      const isInvoiceWO = invoiceWOSet.has(woNumber);
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

  // Group by supervisor
  const supervisorMetrics = useMemo(() => {
    const groups: Record<string, SLAWorkOrder[]> = {};
    
    slaWorkOrders.forEach(swo => {
      const supervisor = swo.wo["Supervisor"] || "Unassigned";
      if (!groups[supervisor]) groups[supervisor] = [];
      groups[supervisor].push(swo);
    });
    
    const metrics: SupervisorMetric[] = Object.entries(groups)
      .map(([supervisor, wos]) => {
        const total = wos.length;
        const withinSLA = wos.filter(w => w.withinSLA).length;
        const outsideSLA = total - withinSLA;
        const adherencePercent = total > 0 ? Math.round((withinSLA / total) * 100) : 0;
        
        // Sort WOs: outside SLA first (most overdue), then within SLA
        wos.sort((a, b) => {
          if (a.withinSLA !== b.withinSLA) return a.withinSLA ? 1 : -1;
          return b.businessDays - a.businessDays;
        });
        
        return { supervisor, total, withinSLA, outsideSLA, adherencePercent, workOrders: wos };
      })
      .sort((a, b) => a.adherencePercent - b.adherencePercent); // Worst adherence first
    
    return metrics;
  }, [slaWorkOrders]);

  // Overall metrics
  const overallMetrics = useMemo(() => {
    const total = slaWorkOrders.length;
    const withinSLA = slaWorkOrders.filter(w => w.withinSLA).length;
    const outsideSLA = total - withinSLA;
    const adherencePercent = total > 0 ? Math.round((withinSLA / total) * 100) : 0;
    return { total, withinSLA, outsideSLA, adherencePercent };
  }, [slaWorkOrders]);

  const toggleSupervisor = (supervisor: string) => {
    setExpandedSupervisors(prev => {
      const next = new Set(prev);
      if (next.has(supervisor)) {
        next.delete(supervisor);
      } else {
        next.add(supervisor);
      }
      return next;
    });
  };

  const getAdherenceColor = (percent: number) => {
    if (percent >= 90) return "text-green-600 dark:text-green-400";
    if (percent >= 70) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getAdherenceBg = (percent: number) => {
    if (percent >= 90) return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
    if (percent >= 70) return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
    return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
  };

  const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

  if (slaWorkOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No closed work orders with both Sched End Date and Date Completed found.</p>
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
            SLA: 2 business days from work complete to closure. WOs on the &gt;90 day deferral awaiting invoice sheet get 21 business days.
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

      {/* Supervisor Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>By Supervisor</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click a supervisor row to see their individual work orders
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {supervisorMetrics.map(metric => {
              const isExpanded = expandedSupervisors.has(metric.supervisor);
              return (
                <div key={metric.supervisor} className="border rounded-lg overflow-hidden">
                  {/* Supervisor row */}
                  <button
                    onClick={() => toggleSupervisor(metric.supervisor)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="font-medium text-left min-w-[160px]">{metric.supervisor}</div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
                      {/* Progress bar */}
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            metric.adherencePercent >= 90 ? "bg-green-500" :
                            metric.adherencePercent >= 70 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${metric.adherencePercent}%` }}
                        />
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Expanded WO details */}
                  {isExpanded && (
                    <div className="border-t overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left py-2 px-4 font-medium">Work Order</th>
                            <th className="text-left py-2 px-4 font-medium">Description</th>
                            <th className="text-left py-2 px-4 font-medium">Data Center</th>
                            <th className="text-left py-2 px-4 font-medium">Sched End Date</th>
                            <th className="text-left py-2 px-4 font-medium">Date Completed</th>
                            <th className="text-left py-2 px-4 font-medium">Business Days</th>
                            <th className="text-left py-2 px-4 font-medium">SLA</th>
                            <th className="text-left py-2 px-4 font-medium">Status</th>
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
                              <td className="py-2 px-4">
                                <a
                                  href={`${BASE_URL}${swo.wo["Work Order"]}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline font-medium"
                                >
                                  {swo.wo["Work Order"]}
                                </a>
                              </td>
                              <td className="py-2 px-4 truncate max-w-[200px]">{swo.wo["Description"]}</td>
                              <td className="py-2 px-4">{swo.wo["Data Center"]}</td>
                              <td className="py-2 px-4">{formatDate(swo.wo["Sched. End Date"])}</td>
                              <td className="py-2 px-4">{formatDate(swo.wo["Date Completed"])}</td>
                              <td className="py-2 px-4 font-medium">
                                <span className={swo.withinSLA ? "" : "text-red-600 dark:text-red-400"}>
                                  {swo.businessDays}
                                </span>
                              </td>
                              <td className="py-2 px-4">
                                {swo.isInvoiceWO ? (
                                  <Badge variant="outline" className="text-xs">21 days</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">2 days</Badge>
                                )}
                              </td>
                              <td className="py-2 px-4">
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
      </Card>
    </div>
  );
}
