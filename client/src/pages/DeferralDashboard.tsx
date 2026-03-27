import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle } from "lucide-react";
import { getDeferralWorkOrders, DeferralWorkOrder } from "@/lib/api";
import { WorkOrder } from "@/types/workOrder";

const DEFERRAL_CATEGORIES = [
  { key: "pending-procedure", label: "Pending Procedure", match: "Pending Procedure" },
  { key: "vendor-action", label: "Vendor Action Required", match: "Vendor Action Required" },
  { key: "awaiting-invoice", label: "Awaiting Invoice", match: "Awaiting Invoice" },
  { key: "waiting-conditions", label: "Waiting Conditions", match: "Waiting Conditions" },
  { key: "pending-parts", label: "Pending Parts", match: "Pending Parts" },
  { key: "oos-lock", label: "OOS Lock", match: "OOS Lock" },
] as const;

const ALLOWED_STATUSES = ["Planning", "Ready to Schedule", "Approved", "Work Complete"];
const EXCLUDED_STATUSES = ["Cancelled"];

/** Calculate calendar days since scheduled start. Returns null if <=90 or invalid. */
function calculateDaysSinceStart(schedStartDate: string | null | undefined): number | null {
  if (!schedStartDate) return null;
  const d = new Date(schedStartDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 90) return null;
  return diffDays;
}

/** Calculate business days (Mon-Fri) since scheduled start. Returns the count regardless of threshold. */
function calculateBusinessDaysSinceStart(schedStartDate: string | null | undefined): number | null {
  if (!schedStartDate) return null;
  const start = new Date(schedStartDate);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  if (now <= start) return 0;

  let businessDays = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }
  return businessDays;
}

interface DeferralDashboardProps {
  workOrders: WorkOrder[];
}

export default function DeferralDashboard({ workOrders }: DeferralDashboardProps) {
  const [deferralOrders, setDeferralOrders] = useState<DeferralWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getDeferralWorkOrders();
        setDeferralOrders(data);
      } catch (error) {
        console.error("Error loading deferral work orders:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter deferral orders: Awaiting Invoice uses >16 business days, all others use >90 calendar days
  const filteredOrders = useMemo(() => {
    return deferralOrders.filter((wo) => {
      const status = (wo["Status"] || "").trim();
      if (EXCLUDED_STATUSES.some(s => status.toLowerCase() === s.toLowerCase())) return false;
      if (!ALLOWED_STATUSES.some(s => status.toLowerCase() === s.toLowerCase())) return false;

      const deferral = (wo["Deferral Reason Selected"] || "").trim().toLowerCase();
      if (deferral === "awaiting invoice") {
        // Awaiting Invoice: only show Work Complete status, >16 business days
        if (status.toLowerCase() !== "work complete") return false;
        const bizDays = calculateBusinessDaysSinceStart(wo["Sched. Start Date"]);
        return bizDays !== null && bizDays > 16;
      } else {
        const totalDays = calculateDaysSinceStart(wo["Sched. Start Date"]);
        return totalDays !== null && totalDays > 90;
      }
    });
  }, [deferralOrders]);

  // Group by deferral category
  const categorizedOrders = useMemo(() => {
    const result: Record<string, DeferralWorkOrder[]> = {};
    for (const cat of DEFERRAL_CATEGORIES) {
      result[cat.key] = filteredOrders
        .filter((wo) => {
          const deferral = (wo["Deferral Reason Selected"] || "").trim().toLowerCase();
          return deferral === cat.match.toLowerCase();
        })
        .sort((a, b) => (a["Data Center"] || "").localeCompare(b["Data Center"] || ""));
    }
    return result;
  }, [filteredOrders]);

  // Missing Deferral: WOs from main data with an actual deferral category code (not just "YES")
  // that are NOT in any of the 6 deferral files
  const missingDeferralOrders = useMemo(() => {
    const deferralWONumbers = new Set(
      deferralOrders.map(wo => String(wo["Work Order"]).trim())
    );
    const knownDeferralCategories = DEFERRAL_CATEGORIES.map(c => c.match.toLowerCase());

    return workOrders
      .filter((wo) => {
        const deferral = (wo["Deferral Reason Selected"] || "").trim().toLowerCase();
        if (!deferral || deferral === "no" || deferral === "yes") return false;
        if (!knownDeferralCategories.includes(deferral)) return false;
        const status = (wo["Status"] || "").trim();
        if (EXCLUDED_STATUSES.some(s => status.toLowerCase() === s.toLowerCase())) return false;
        if (!ALLOWED_STATUSES.some(s => status.toLowerCase() === s.toLowerCase())) return false;
        const woNum = String(wo["Work Order"]).trim();
        return !deferralWONumbers.has(woNum);
      })
      .sort((a, b) => (a["Data Center"] || "").localeCompare(b["Data Center"] || ""));
  }, [workOrders, deferralOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (deferralOrders.length === 0 && missingDeferralOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No deferral work order data uploaded yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Upload the deferral spreadsheets on the Upload Data page.</p>
        </CardContent>
      </Card>
    );
  }

  const totalFiltered = filteredOrders.length;
  const missingCount = missingDeferralOrders.length;

  // Render a category table grouped by data center
  function renderCategoryTable(orders: (DeferralWorkOrder | WorkOrder)[], showShift = true, isAwaitingInvoice = false) {
    if (orders.length === 0) {
      return <p className="text-sm text-muted-foreground py-4 text-center">No work orders in this category.</p>;
    }

    // Group by data center
    const byDataCenter: Record<string, (DeferralWorkOrder | WorkOrder)[]> = {};
    for (const wo of orders) {
      const dc = (wo as any)["Data Center"] || "Unknown";
      if (!byDataCenter[dc]) byDataCenter[dc] = [];
      byDataCenter[dc].push(wo);
    }
    const dataCenters = Object.keys(byDataCenter).sort();

    const daysColumnLabel = isAwaitingInvoice ? "Business Days" : "Days Since Start";

    return (
      <div className="space-y-6">
        {dataCenters.map((dc) => (
          <div key={dc}>
            <h4 className="text-sm font-semibold text-foreground mb-2 px-2 py-1 bg-muted/50 rounded">
              {dc} ({byDataCenter[dc].length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: "9%" }} />
                  <col style={{ width: showShift ? "33%" : "43%" }} />
                  <col style={{ width: "10%" }} />
                  {showShift && <col style={{ width: "15%" }} />}
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium">Work Order</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Data Center</th>
                    {showShift && <th className="text-left py-2 px-3 font-medium">Shift</th>}
                    <th className="text-left py-2 px-3 font-medium">Sched Start Date</th>
                    <th className="text-right py-2 px-3 font-medium">{daysColumnLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {byDataCenter[dc].map((wo: any) => {
                    const displayDays = isAwaitingInvoice
                      ? calculateBusinessDaysSinceStart(wo["Sched. Start Date"])
                      : calculateDaysSinceStart(wo["Sched. Start Date"]);

                    // Color thresholds differ for awaiting invoice (business days) vs others (calendar days)
                    const getColorClass = (days: number) => {
                      if (isAwaitingInvoice) {
                        // 21 = SLA deadline, 19+ = critical, 17-18 = warning
                        if (days >= 21) return "bg-red-100 text-red-700";
                        if (days >= 19) return "bg-orange-100 text-orange-700";
                        return "bg-yellow-100 text-yellow-700";
                      } else {
                        if (days > 180) return "bg-red-100 text-red-700";
                        if (days > 120) return "bg-orange-100 text-orange-700";
                        return "bg-yellow-100 text-yellow-700";
                      }
                    };

                    return (
                      <tr key={wo["Work Order"]} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3">
                          <a
                            href={`https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=${wo["Work Order"]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            {wo["Work Order"]}
                          </a>
                        </td>
                        <td className="py-2 px-3 truncate">{wo["Description"]}</td>
                        <td className="py-2 px-3 font-medium">{wo["Data Center"]}</td>
                        {showShift && <td className="py-2 px-3">{wo["Shift"] || "—"}</td>}
                        <td className="py-2 px-3 text-muted-foreground">{wo["Sched. Start Date"] || "—"}</td>
                        <td className="py-2 px-3 text-right">
                          {displayDays !== null ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getColorClass(displayDays)}`}>
                              {displayDays} {isAwaitingInvoice ? "biz days" : "days"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Summary: Total per Data Center */}
        {dataCenters.length > 1 && (
          <div className="mt-4 pt-4 border-t-2 border-border">
            <h4 className="text-sm font-semibold text-foreground mb-3 px-2">Summary by Data Center</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 px-2">
              {dataCenters.map((dc) => (
                <div key={dc} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-md border border-border/50">
                  <span className="text-sm font-medium text-foreground">{dc}</span>
                  <span className="text-sm font-bold text-primary ml-2">{byDataCenter[dc].length}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-primary/10 rounded-md border border-primary/30">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-sm font-bold text-primary ml-2">{orders.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Missing Deferral counter */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{">"}90 Days Deferral</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Work orders with status Planning, Ready to Schedule, Approved, or Work Complete.
            Awaiting Invoice: {">"}16 business days | All others: {">"}90 calendar days past scheduled start.
          </p>
        </div>
        <div className="flex-shrink-0">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            missingCount > 0 ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"
          }`}>
            <span className={`text-2xl font-bold ${missingCount > 0 ? "text-red-600" : "text-green-600"}`}>
              {missingCount}
            </span>
            <span className={`text-xs ${missingCount > 0 ? "text-red-600" : "text-green-600"}`}>
              Missing<br />Deferral
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue={DEFERRAL_CATEGORIES[0].key}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {DEFERRAL_CATEGORIES.map((cat) => {
            const count = categorizedOrders[cat.key]?.length || 0;
            return (
              <TabsTrigger key={cat.key} value={cat.key} className="relative">
                {cat.label}
                {cat.key === "awaiting-invoice" && (
                  <span className="ml-1 text-xs text-muted-foreground">(16 biz days)</span>
                )}
                {count > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="missing-deferral" className="relative">
            Missing Deferral
            {missingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                {missingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {DEFERRAL_CATEGORIES.map((cat) => {
          const orders = categorizedOrders[cat.key] || [];
          const isAwaitingInvoice = cat.key === "awaiting-invoice";
          return (
            <TabsContent key={cat.key} value={cat.key}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {cat.label}
                    <span className="text-sm font-normal text-muted-foreground">
                      — {orders.length} work order{orders.length !== 1 ? "s" : ""}
                      {isAwaitingInvoice && " (>16 business days, 5 days before 21-day SLA)"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderCategoryTable(orders, true, isAwaitingInvoice)}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        {/* Missing Deferral Tab */}
        <TabsContent value="missing-deferral">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Missing Deferral
                <span className="text-sm font-normal text-muted-foreground">
                  — {missingCount} work order{missingCount !== 1 ? "s" : ""} with deferral = YES not assigned to any category
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderCategoryTable(missingDeferralOrders)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
