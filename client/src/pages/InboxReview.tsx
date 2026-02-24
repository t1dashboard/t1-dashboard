/**
 * Inbox Review: Contains WO Campaign, Scheduled Labor Review, and WOs Awaiting Closure sub-tabs
 */

import { useState, useMemo } from "react";
import { WorkOrder, ScheduledLabor } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatDate, parseExcelDate } from "@/lib/dateUtils";
import ScheduledLaborReviewTab from "@/components/ScheduledLaborReviewTab";

interface InboxReviewProps {
  workOrders: WorkOrder[];
  scheduledLabor: ScheduledLabor[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Inbox Review</h2>
        <p className="text-sm text-muted-foreground mt-1">Review work order campaigns, scheduled labor, and work orders awaiting closure</p>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
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
                        <th className="text-left py-3 px-4 font-medium">Assigned To</th>
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
                          <td className="py-3 px-4">{wo["Assigned To Name"]}</td>
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
                            <th className="text-left py-3 px-4 font-medium">Assigned To</th>
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
                              <td className="py-3 px-4">{wo["Assigned To Name"]}</td>
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
      </Tabs>
    </div>
  );
}
