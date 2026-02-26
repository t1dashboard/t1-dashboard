/**
 * Inbox Review: Contains WO Campaign, Scheduled Labor Review, WOs Awaiting Closure, and Production Impact sub-tabs
 */

import { useState, useMemo } from "react";
import { WorkOrder, ScheduledLabor } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatDate, parseExcelDate, getTWeekRange } from "@/lib/dateUtils";
import ScheduledLaborReviewTab from "@/components/ScheduledLaborReviewTab";

interface InboxReviewProps {
  workOrders: WorkOrder[];
  scheduledLabor: ScheduledLabor[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

// Production Impact values to include (exclude 40)
const INCLUDED_PRODUCTION_IMPACTS = [10, 15, 20, 25, 30];

export default function InboxReview({ workOrders, scheduledLabor }: InboxReviewProps) {
  const [activeTab, setActiveTab] = useState("wo-campaign");

  // WO Campaign: filter work orders whose description contains "WO Campaign" (case-insensitive)
  // Exclude Work Complete and Closed statuses, sort by sched start date (oldest first)
  const woCampaignOrders = useMemo(() => {
    const EXCLUDED_STATUSES = ["WORK COMPLETE", "CLOSED", "CANCELLED"];
    return workOrders
      .filter((wo) => {
        const desc = (wo["Description"] || "").toUpperCase();
        const status = (wo["Status"] || "").toUpperCase();
        return desc.includes("WO CAMPAIGN") && !EXCLUDED_STATUSES.includes(status);
      })
      .sort((a, b) => {
        const dateA = parseExcelDate(a["Sched. Start Date"]);
        const dateB = parseExcelDate(b["Sched. Start Date"]);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      });
  }, [workOrders]);

  // WOs Awaiting Closure: Work Complete status + Deferral Reason Selected = "No"
  const awaitingClosureOrders = useMemo(() => {
    return workOrders
      .filter((wo) => {
        const status = (wo["Status"] || "").toUpperCase();
        const deferral = (wo["Deferral Reason Selected"] || "").toUpperCase().trim();
        const isWorkComplete = status === "WORK COMPLETE" || status === "WORKCOMPLETE";
        const deferralNo = deferral === "NO";
        return isWorkComplete && deferralNo;
      })
      .sort((a, b) => {
        const woA = Number(a["Work Order"]) || 0;
        const woB = Number(b["Work Order"]) || 0;
        return woA - woB;
      });
  }, [workOrders]);

  // Group awaiting closure orders by data center
  const awaitingClosureByDC = useMemo(() => {
    const groups: Record<string, WorkOrder[]> = {};
    awaitingClosureOrders.forEach(wo => {
      const dc = wo["Data Center"] || "Unknown";
      if (!groups[dc]) groups[dc] = [];
      groups[dc].push(wo);
    });
    return Object.keys(groups).sort().map(dc => ({
      dataCenter: dc,
      orders: groups[dc]
    }));
  }, [awaitingClosureOrders]);

  // Production Impact: filter work orders with Production Impact of 10, 15, 20, 25, or 30
  // Only include T1-T3 work orders (sched start within next 3 weeks)
  const productionImpactOrders = useMemo(() => {
    const t1Range = getTWeekRange(1);
    const t3Range = getTWeekRange(3);
    const t1Start = t1Range.start;
    const t3End = t3Range.end;

    return workOrders
      .filter((wo) => {
        const impact = Number(wo["Production Impact"]);
        if (!INCLUDED_PRODUCTION_IMPACTS.includes(impact)) return false;
        const schedDate = parseExcelDate(wo["Sched. Start Date"]);
        if (!schedDate) return false;
        return schedDate >= t1Start && schedDate <= t3End;
      })
      .sort((a, b) => {
        // Sort by data center first, then by production impact (ascending)
        const dcA = (a["Data Center"] || "").toUpperCase();
        const dcB = (b["Data Center"] || "").toUpperCase();
        if (dcA !== dcB) return dcA.localeCompare(dcB);
        const impactA = Number(a["Production Impact"]) || 0;
        const impactB = Number(b["Production Impact"]) || 0;
        return impactA - impactB;
      });
  }, [workOrders]);

  // Group production impact orders by data center
  const productionImpactByDC = useMemo(() => {
    const groups: Record<string, WorkOrder[]> = {};
    productionImpactOrders.forEach(wo => {
      const dc = wo["Data Center"] || "Unknown";
      if (!groups[dc]) groups[dc] = [];
      groups[dc].push(wo);
    });
    return Object.keys(groups).sort().map(dc => ({
      dataCenter: dc,
      orders: groups[dc]
    }));
  }, [productionImpactOrders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Inbox Review</h2>
        <p className="text-sm text-muted-foreground mt-1">Review work order campaigns, scheduled labor, work orders awaiting closure, and production impact</p>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="wo-campaign" className="flex items-center gap-2">
            WO Campaign
            <Badge variant="secondary" className="text-xs">{woCampaignOrders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="scheduled-labor" className="flex items-center gap-2">
            Scheduled Labor Review
          </TabsTrigger>
          <TabsTrigger value="awaiting-closure" className="flex items-center gap-2">
            WOs Awaiting Closure
            <Badge variant="secondary" className="text-xs">{awaitingClosureOrders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="production-impact" className="flex items-center gap-2">
            Production Impact
            <Badge variant="secondary" className="text-xs">{productionImpactOrders.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* WO Campaign Tab */}
        <TabsContent value="wo-campaign" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>WO Campaign</CardTitle>
              <p className="text-sm text-muted-foreground">
                {woCampaignOrders.length} work orders with "WO Campaign" in description, sorted by sched start date (oldest first)
              </p>
            </CardHeader>
            <CardContent>
              {woCampaignOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "30%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "15%" }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 font-medium">Work Order</th>
                        <th className="text-left py-3 px-4 font-medium">Description</th>
                        <th className="text-left py-3 px-4 font-medium">Shift</th>
                        <th className="text-left py-3 px-4 font-medium">Sched Start Date</th>
                        <th className="text-left py-3 px-4 font-medium">Sched End Date</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {woCampaignOrders.map((wo) => (
                        <tr key={wo["Work Order"]} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <a
                              href={`${BASE_URL}${wo["Work Order"]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-mono"
                            >
                              {wo["Work Order"]}
                            </a>
                          </td>
                          <td className="py-3 px-4 truncate">{wo["Description"]}</td>
                          <td className="py-3 px-4">{wo["Shift"]}</td>
                          <td className="py-3 px-4">{formatDate(wo["Sched. Start Date"])}</td>
                          <td className="py-3 px-4">{formatDate(wo["Sched. End Date"])}</td>
                          <td className="py-3 px-4">{wo["Status"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No work orders found with "WO Campaign" in description
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Labor Review Tab */}
        <TabsContent value="scheduled-labor" className="mt-6">
          <ScheduledLaborReviewTab workOrders={workOrders} scheduledLabor={scheduledLabor} />
        </TabsContent>

        {/* WOs Awaiting Closure Tab */}
        <TabsContent value="awaiting-closure" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>WOs Awaiting Closure</CardTitle>
              <p className="text-sm text-muted-foreground">
                {awaitingClosureOrders.length} work orders in "Work Complete" status with Deferral Reason Selected = "No"
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {awaitingClosureByDC.length > 0 ? (
                awaitingClosureByDC.map(group => (
                  <div key={group.dataCenter} className="border-b border-border last:border-b-0">
                    <div className="px-4 py-3 bg-muted/40 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground">
                        {group.dataCenter} ({group.orders.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "35%" }} />
                          <col style={{ width: "15%" }} />
                          <col style={{ width: "15%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "15%" }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left py-3 px-4 font-medium">Work Order</th>
                            <th className="text-left py-3 px-4 font-medium">Description</th>
                            <th className="text-left py-3 px-4 font-medium">Shift</th>
                            <th className="text-left py-3 px-4 font-medium">Sched Start Date</th>
                            <th className="text-left py-3 px-4 font-medium">Status</th>
                            <th className="text-left py-3 px-4 font-medium">Deferral Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.orders.map((wo) => (
                            <tr key={wo["Work Order"]} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                              <td className="py-3 px-4">
                                <a
                                  href={`${BASE_URL}${wo["Work Order"]}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline font-mono"
                                >
                                  {wo["Work Order"]}
                                </a>
                              </td>
                              <td className="py-3 px-4 truncate" title={wo["Description"]}>{wo["Description"]}</td>
                              <td className="py-3 px-4">{wo["Shift"]}</td>
                              <td className="py-3 px-4">{formatDate(wo["Sched. Start Date"])}</td>
                              <td className="py-3 px-4">{wo["Status"]}</td>
                              <td className="py-3 px-4">{wo["Deferral Reason Selected"]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No work orders found in "Work Complete" status with Deferral Reason = "No"
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production Impact Tab */}
        <TabsContent value="production-impact" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Production Impact</CardTitle>
              <p className="text-sm text-muted-foreground">
                {productionImpactOrders.length} T1-T3 work orders with Production Impact of 10, 15, 20, 25, or 30 (excluding 40), organized by data center
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {productionImpactByDC.length > 0 ? (
                productionImpactByDC.map(group => (
                  <div key={group.dataCenter} className="border-b border-border last:border-b-0">
                    <div className="px-4 py-3 bg-muted/40 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground">
                        {group.dataCenter} ({group.orders.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "28%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "10%" }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left py-3 px-4 font-medium">Work Order</th>
                            <th className="text-left py-3 px-4 font-medium">Description</th>
                            <th className="text-left py-3 px-4 font-medium">Data Center</th>
                            <th className="text-left py-3 px-4 font-medium">Sched Start Date</th>
                            <th className="text-left py-3 px-4 font-medium">Shift</th>
                            <th className="text-left py-3 px-4 font-medium">Status</th>
                            <th className="text-left py-3 px-4 font-medium">Impact</th>
                            <th className="text-left py-3 px-4 font-medium">Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.orders.map((wo) => {
                            const impact = Number(wo["Production Impact"]);
                            // Color-code by impact severity: lower number = higher impact
                            const impactColor = impact <= 15
                              ? "text-red-600 font-semibold"
                              : impact <= 20
                                ? "text-orange-600 font-semibold"
                                : impact <= 25
                                  ? "text-yellow-600 font-medium"
                                  : "text-foreground";
                            return (
                              <tr key={wo["Work Order"]} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                <td className="py-3 px-4">
                                  <a
                                    href={`${BASE_URL}${wo["Work Order"]}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-mono"
                                  >
                                    {wo["Work Order"]}
                                  </a>
                                </td>
                                <td className="py-3 px-4 truncate" title={wo["Description"]}>{wo["Description"]}</td>
                                <td className="py-3 px-4">{wo["Data Center"]}</td>
                                <td className="py-3 px-4">{formatDate(wo["Sched. Start Date"])}</td>
                                <td className="py-3 px-4">{wo["Shift"]}</td>
                                <td className="py-3 px-4">{wo["Status"]}</td>
                                <td className={`py-3 px-4 ${impactColor}`}>{impact}</td>
                                <td className="py-3 px-4">{wo["Priority"]}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No work orders found with Production Impact of 10, 15, 20, 25, or 30
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
