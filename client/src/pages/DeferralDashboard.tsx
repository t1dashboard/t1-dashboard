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

function calculateDaysOver90(schedStartDate: string | null | undefined): number | null {
  if (!schedStartDate) return null;
  const d = new Date(schedStartDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 90) return null;
  return diffDays - 90;
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

  // Filter deferral orders to only allowed statuses, exclude Cancelled, and >90 days
  const filteredOrders = useMemo(() => {
    return deferralOrders.filter((wo) => {
      const status = (wo["Status"] || "").trim();
      // Exclude cancelled work orders
      if (EXCLUDED_STATUSES.some(s => status.toLowerCase() === s.toLowerCase())) return false;
      if (!ALLOWED_STATUSES.some(s => status.toLowerCase() === s.toLowerCase())) return false;
      const daysOver = calculateDaysOver90(wo["Sched. Start Date"]);
      return daysOver !== null && daysOver > 0;
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
    // Get all WO numbers from the deferral files
    const deferralWONumbers = new Set(
      deferralOrders.map(wo => String(wo["Work Order"]).trim())
    );

    // Known deferral category values (actual codes, not just "YES")
    const knownDeferralCategories = DEFERRAL_CATEGORIES.map(c => c.match.toLowerCase());

    // Find main WOs with a real deferral code that are NOT in any deferral file
    return workOrders
      .filter((wo) => {
        const deferral = (wo["Deferral Reason Selected"] || "").trim().toLowerCase();
        // Only include WOs that have an actual deferral category code
        // Exclude "yes" (no specific category) and empty/no values
        if (!deferral || deferral === "no" || deferral === "yes") return false;
        // Must be a recognized deferral category
        if (!knownDeferralCategories.includes(deferral)) return false;
        const status = (wo["Status"] || "").trim();
        // Exclude cancelled
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
  function renderCategoryTable(orders: (DeferralWorkOrder | WorkOrder)[], showAssignedTo = true) {
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

    return (
      <div className="space-y-6">
        {dataCenters.map((dc) => (
          <div key={dc}>
            <h4 className="text-sm font-semibold text-foreground mb-2 px-2 py-1 bg-muted/50 rounded">
              {dc} ({byDataCenter[dc].length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium">Work Order</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Data Center</th>
                    {showAssignedTo && <th className="text-left py-2 px-3 font-medium">Assigned To</th>}
                    <th className="text-left py-2 px-3 font-medium">Sched Start Date</th>
                    <th className="text-right py-2 px-3 font-medium">Days {">"}90</th>
                  </tr>
                </thead>
                <tbody>
                  {byDataCenter[dc].map((wo: any) => {
                    const daysOver = calculateDaysOver90(wo["Sched. Start Date"]);
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
                        <td className="py-2 px-3">{wo["Description"]}</td>
                        <td className="py-2 px-3 font-medium">{wo["Data Center"]}</td>
                        {showAssignedTo && <td className="py-2 px-3">{wo["Assigned To Name"] || "—"}</td>}
                        <td className="py-2 px-3 text-muted-foreground">{wo["Sched. Start Date"] || "—"}</td>
                        <td className="py-2 px-3 text-right">
                          {daysOver !== null ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                              daysOver > 60 ? "bg-red-100 text-red-700" :
                              daysOver > 30 ? "bg-orange-100 text-orange-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              +{daysOver} days
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
            {totalFiltered} work orders with status Planning, Ready to Schedule, Approved, or Work Complete that are {">"}90 days past scheduled start date
          </p>
        </div>
        <div className="flex-shrink-0">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            missingCount > 0 ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"
          }`}>
            <span className={`text-2xl font-bold ${missingCount > 0 ? "text-red-600" : "text-green-600"}`}>
              {missingCount}
            </span>
            <span className={`text-sm ${missingCount > 0 ? "text-red-700" : "text-green-700"}`}>
              Missing Deferral
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
          return (
            <TabsContent key={cat.key} value={cat.key}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {cat.label}
                    <span className="text-sm font-normal text-muted-foreground">
                      — {orders.length} work order{orders.length !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderCategoryTable(orders)}
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
