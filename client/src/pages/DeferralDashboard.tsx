import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle } from "lucide-react";
import { getDeferralWorkOrders, DeferralWorkOrder, CommentData } from "@/lib/api";
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
  commentsMap?: Record<string, CommentData>;
}

export default function DeferralDashboard({ workOrders, commentsMap = {} }: DeferralDashboardProps) {
  const [deferralOrders, setDeferralOrders] = useState<DeferralWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (woNum: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(woNum)) next.delete(woNum);
      else next.add(woNum);
      return next;
    });
  };

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
  function renderCategoryTable(orders: (DeferralWorkOrder | WorkOrder)[], _unused = true, isAwaitingInvoice = false) {
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
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium">Work Order</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Data Center</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Assigned To</th>
                    <th className="text-left py-2 px-3 font-medium">Sched Start Date</th>
                    <th className="text-right py-2 px-3 font-medium">{daysColumnLabel}</th>
                    <th className="text-left py-2 px-3 font-medium">Most Recent Comment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {byDataCenter[dc].map((wo: any) => {
                    const woNum = String(wo["Work Order"]);
                    const commentData = commentsMap?.[woNum];
                    const comment = commentData?.comment || "N/A";
                    const commentDate = commentData?.date || null;
                    const isExpanded = expandedRows.has(woNum);
                    const displayDays = isAwaitingInvoice
                      ? calculateBusinessDaysSinceStart(wo["Sched. Start Date"])
                      : calculateDaysSinceStart(wo["Sched. Start Date"]);

                    // Color thresholds differ for awaiting invoice (business days) vs others (calendar days)
                    const getColorClass = (days: number) => {
                      if (isAwaitingInvoice) {
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
                      <>
                        <tr
                          key={woNum}
                          className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                          style={{ borderBottomWidth: isExpanded ? '0px' : '0.5px' }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('a')) return;
                            toggleRow(woNum);
                          }}
                        >
                          <td className="py-2 px-3">
                            <a
                              href={`https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=${woNum}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium"
                            >
                              {woNum}
                            </a>
                          </td>
                          <td className="py-2 px-3 truncate">{wo["Description"]}</td>
                          <td className="py-2 px-3 font-medium">{wo["Data Center"]}</td>
                          <td className="py-2 px-3">{wo["Status"] || "—"}</td>
                          <td className="py-2 px-3">{wo["Assigned To Name"] || wo["Assigned To"] || "—"}</td>
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
                          <td className="py-2 px-3 truncate text-muted-foreground" title={comment}>
                            {comment}
                          </td>
                          <td></td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${woNum}-expanded`} className="border-b border-border/50 bg-muted/10" style={{ borderBottomWidth: '0.5px' }}>
                            <td colSpan={9} className="py-3 px-4">
                              <div className="text-sm">
                                <span className="font-medium text-foreground">Full Comment: </span>
                                <span className="text-muted-foreground">{comment}</span>
                              </div>
                              {commentDate && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium text-foreground">Comment Date: </span>
                                  <span>{commentDate}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Summary: Total per Data Center */}
        {dataCenters.length > 1 && (
          <div className="pt-4 mt-4 border-t">
            <h4 className="text-sm font-semibold text-foreground mb-2">Summary by Data Center</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 text-sm">
              {dataCenters.map(dc => (
                <div key={dc} className="flex justify-between items-center bg-muted/50 px-2 py-1 rounded">
                  <span className="font-medium">{dc}</span>
                  <span className="text-muted-foreground font-mono">{byDataCenter[dc].length}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Tabs defaultValue="pending-procedure" className="w-full">
      <div className="flex justify-between items-end mb-4">
        <TabsList>
          {DEFERRAL_CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.key} value={cat.key}>
              {cat.label} ({categorizedOrders[cat.key]?.length || 0})
            </TabsTrigger>
          ))}
          <TabsTrigger value="missing-deferral" className="text-yellow-600">
            Missing Deferral ({missingCount})
          </TabsTrigger>
        </TabsList>
        <div className="text-sm text-muted-foreground pr-2">Total: {totalFiltered + missingCount}</div>
      </div>

      {DEFERRAL_CATEGORIES.map((cat) => (
        <TabsContent key={cat.key} value={cat.key}>
          <Card>
            <CardHeader>
              <CardTitle>{cat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {renderCategoryTable(categorizedOrders[cat.key], true, cat.key === 'awaiting-invoice')}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
      <TabsContent value="missing-deferral">
        <Card>
          <CardHeader>
            <CardTitle className="text-yellow-600">Missing Deferral</CardTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Work orders with a specific deferral reason that were not found in any of the uploaded deferral spreadsheets.
            </p>
          </CardHeader>
          <CardContent>{renderCategoryTable(missingDeferralOrders, false)}</CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
