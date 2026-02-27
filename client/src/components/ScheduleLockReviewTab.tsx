/**
 * Swiss Rationalism: Schedule Lock Review tab showing unplanned and incomplete locked work orders
 */

import { useMemo, useState, useEffect } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, parseExcelDate } from "@/lib/dateUtils";
import { getWorkWeekLeaders } from "@/lib/workWeekLeaders";
import { getScheduleLocks, ScheduleLock } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface ScheduleLockReviewTabProps {
  workOrders: WorkOrder[];
}

interface LockedWorkOrder {
  workOrderNumber: string | number;
  description: string;
  dataCenter: string;
  schedStartDate: any;
  assignedTo: string;
  status: string;
  type: string;
  equipmentDescription: string;
  priority: string;
  shift: string;
  lockWeek: string;
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function ScheduleLockReviewTab({ workOrders }: ScheduleLockReviewTabProps) {
  const [serverLocks, setServerLocks] = useState<ScheduleLock[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(true);

  useEffect(() => {
    async function loadLocks() {
      try {
        const locks = await getScheduleLocks();
        setServerLocks(locks);
      } catch (error) {
        console.error("Error loading schedule locks:", error);
      } finally {
        setLoadingLocks(false);
      }
    }
    loadLocks();
  }, []);

  const { lotoOrders, buildingGroups, unplannedTotal, incompleteLockedOrders } = useMemo(() => {
    // Get previous week's date range
    // Use date-only comparison (YYYY-MM-DD strings) to avoid timezone issues
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);
    
    // Helper to get YYYY-MM-DD string for date-only comparison
    const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const lastMondayStr = toDateStr(lastMonday);
    const lastSundayStr = toDateStr(lastSunday);
    
    // Lock week offset: lock_week is when the lock was CREATED.
    // Locked WOs are planned for the FOLLOWING week.
    // So for previous week review (e.g., Feb 16-22), we need the lock list
    // created the week BEFORE that (e.g., lock_week = Feb 9-15).
    const lockCreatedMonday = new Date(lastMonday);
    lockCreatedMonday.setDate(lastMonday.getDate() - 7);
    const lockCreatedSunday = new Date(lockCreatedMonday);
    lockCreatedSunday.setDate(lockCreatedMonday.getDate() + 6);
    const lockCreatedMondayStr = toDateStr(lockCreatedMonday);
    const lockCreatedSundayStr = toDateStr(lockCreatedSunday);

    // Use server locks instead of localStorage
    const lockedOrders: LockedWorkOrder[] = serverLocks.map(lock => ({
      workOrderNumber: lock.workOrderNumber,
      description: lock.description || "",
      dataCenter: lock.dataCenter || "",
      schedStartDate: lock.schedStartDate,
      assignedTo: lock.assignedTo || "",
      status: lock.status || "",
      type: lock.type || "",
      equipmentDescription: lock.equipmentDescription || "",
      priority: lock.priority || "",
      shift: lock.shift || "",
      lockWeek: lock.lockWeek
    }));
    
    // Filter for the lock list that was created for the previous week.
    // lock_week stores when the lock was created (e.g., Feb 9).
    // Those WOs are planned for the following week (e.g., Feb 16-22).
    // So we look for lock_week in the week BEFORE the previous week.
    const previousWeekLocked = lockedOrders.filter(locked => {
      const lockWeekStr = locked.lockWeek; // Already "YYYY-MM-DD" format
      return lockWeekStr >= lockCreatedMondayStr && lockWeekStr <= lockCreatedSundayStr;
    });

    // Build a map of locked WO numbers to their stored sched start dates
    const lockedWOMap = new Map<string, string | null>();
    previousWeekLocked.forEach(wo => {
      lockedWOMap.set(String(wo.workOrderNumber), wo.schedStartDate || null);
    });
    const lockedWONumbers = new Set(previousWeekLocked.map(wo => String(wo.workOrderNumber)));

    // Shift codes to exclude unless description contains LOTO or PTW
    const EXCLUDED_SHIFT_CODES = new Set(["GNSF", "GNSG", "GNSH", "GNSI", "GNSJ"]);

    // Helper to normalize dates for comparison
    const normalizeDateStr = (dateVal: any): string => {
      const parsed = parseExcelDate(dateVal);
      if (!parsed) return "";
      return toDateStr(parsed);
    };

    // Find unplanned work orders:
    // Only include WOs that were in the locked schedule but whose sched start date
    // was CHANGED compared to the stored lock data.
    // RULES:
    // 1. Only include Work Complete or Closed status
    // 2. Exclude descriptions containing "000"
    // 3. Exclude cancelled, CMCC, weekly
    // 4. Exclude shift codes GNSF/GNSG/GNSH/GNSI/GNSJ unless description contains LOTO or PTW
    // 5. WO must have been locked AND its current sched start date differs from the locked sched start date
    //    OR WO was NOT locked but appeared in previous week (truly unplanned)
    const unplanned = workOrders.filter((wo) => {
      const status = wo["Status"]?.toUpperCase() || "";
      const description = wo["Description"]?.toUpperCase() || "";
      
      // Only include Work Complete or Closed
      const isWorkCompleteOrClosed = status === "WORK COMPLETE" || status === "CLOSED";
      if (!isWorkCompleteOrClosed) return false;
      
      // Exclude descriptions containing "000"
      if (description.includes("000")) return false;
      
      // Existing exclusions
      const isCMCC = description.includes("CMCC");
      const isWeekly = description.includes("WEEKLY");
      if (isCMCC || isWeekly) return false;
      
      // Exclude shift codes GNSF, GNSG, GNSH, GNSI, GNSJ unless description has LOTO or PTW
      const shift = wo["Shift"]?.toUpperCase()?.trim() || "";
      const hasLotoPtw = description.includes("LOTO") || description.includes("PTW");
      if (EXCLUDED_SHIFT_CODES.has(shift) && !hasLotoPtw) return false;
      
      const schedDate = parseExcelDate(wo["Sched. Start Date"]);
      const isInPreviousWeek = schedDate ? (() => {
        const schedStr = toDateStr(schedDate);
        return schedStr >= lastMondayStr && schedStr <= lastSundayStr;
      })() : false;
      
      const woNumber = String(wo["Work Order"]);
      
      if (lockedWONumbers.has(woNumber)) {
        // WO was locked — only show if sched start date was changed
        const lockedSchedDate = normalizeDateStr(lockedWOMap.get(woNumber));
        const currentSchedDate = normalizeDateStr(wo["Sched. Start Date"]);
        const dateChanged = lockedSchedDate !== currentSchedDate;
        return isInPreviousWeek && dateChanged;
      } else {
        // WO was NOT locked — truly unplanned work
        return isInPreviousWeek;
      }
    });

    // Separate LOTO/PTW work orders from the rest
    const loto: WorkOrder[] = [];
    const rest: WorkOrder[] = [];
    
    unplanned.forEach(wo => {
      const description = wo["Description"]?.toUpperCase() || "";
      if (description.includes("LOTO") || description.includes("PTW")) {
        loto.push(wo);
      } else {
        rest.push(wo);
      }
    });

    // Sort LOTO/PTW by data center
    loto.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });

    // Group remaining by building (Data Center), sorted alphabetically
    const groups: Record<string, WorkOrder[]> = {};
    rest.forEach(wo => {
      const dc = wo["Data Center"] || "Unknown";
      if (!groups[dc]) groups[dc] = [];
      groups[dc].push(wo);
    });

    // Sort within each building group by sched start date
    Object.values(groups).forEach(groupWOs => {
      groupWOs.sort((a, b) => {
        const dateA = parseExcelDate(a["Sched. Start Date"]);
        const dateB = parseExcelDate(b["Sched. Start Date"]);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      });
    });

    // Sort building keys alphabetically
    const sortedGroups = Object.keys(groups).sort().map(key => ({
      building: key,
      orders: groups[key]
    }));

    // Find incomplete locked orders (locked but not Work Complete or Closed)
    // Also exclude shift codes GNSF/GNSG/GNSH/GNSI/GNSJ unless description contains LOTO or PTW
    const incomplete = previousWeekLocked.filter(locked => {
      const currentWO = workOrders.find(wo => String(wo["Work Order"]) === String(locked.workOrderNumber));
      
      // Exclude shift codes GNSF/GNSG/GNSH/GNSI/GNSJ unless description has LOTO or PTW
      const lockedDesc = locked.description?.toUpperCase() || "";
      const lockedShift = locked.shift?.toUpperCase()?.trim() || "";
      const lockedHasLotoPtw = lockedDesc.includes("LOTO") || lockedDesc.includes("PTW");
      if (EXCLUDED_SHIFT_CODES.has(lockedShift) && !lockedHasLotoPtw) return false;
      
      if (!currentWO) return true;
      
      const status = currentWO?.["Status"]?.toUpperCase() || "";
      // Exclude Work Complete, Closed, and In Process
      return status !== "WORK COMPLETE" && status !== "CLOSED" && status !== "IN PROCESS";
    }).sort((a, b) => {
      const dcA = a.dataCenter || "";
      const dcB = b.dataCenter || "";
      return dcA.localeCompare(dcB);
    });

    return {
      lotoOrders: loto,
      buildingGroups: sortedGroups,
      unplannedTotal: unplanned.length,
      incompleteLockedOrders: incomplete
    };
  }, [workOrders, serverLocks]);

  // Get Work Week Leaders for previous week
  const previousWeekLeaders = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    
    return getWorkWeekLeaders(lastMonday);
  }, []);

  const renderTableHeader = () => (
    <thead>
      <tr className="border-b border-border bg-muted/30">
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Type</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Equipment Description</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Priority</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
        <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
      </tr>
    </thead>
  );

  const renderColgroup = () => (
    <colgroup>
      <col style={{ width: "8%" }} />
      <col style={{ width: "20%" }} />
      <col style={{ width: "10%" }} />
      <col style={{ width: "16%" }} />
      <col style={{ width: "8%" }} />
      <col style={{ width: "8%" }} />
      <col style={{ width: "7%" }} />
      <col style={{ width: "7%" }} />
      <col style={{ width: "10%" }} />
      <col style={{ width: "10%" }} />
    </colgroup>
  );

  const renderWorkOrderRow = (wo: WorkOrder) => (
    <tr 
      key={wo["Work Order"]} 
      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
      style={{ borderBottomWidth: '0.5px' }}
    >
      <td className="py-3 px-4">
        <a
          href={`${BASE_URL}${wo["Work Order"]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-destructive hover:underline font-medium"
        >
          {wo["Work Order"]}
        </a>
      </td>
      <td className="py-3 px-4 text-sm truncate" title={wo["Description"]}>{wo["Description"]}</td>
      <td className="py-3 px-4 text-sm">{wo["Type"]}</td>
      <td className="py-3 px-4 text-sm truncate" title={wo["Equipment Description"]}>{wo["Equipment Description"]}</td>
      <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
      <td className="py-3 px-4 text-sm font-medium">{wo["Data Center"]}</td>
      <td className="py-3 px-4 text-sm">{wo["Priority"]}</td>
      <td className="py-3 px-4 text-sm">{wo["Shift"]}</td>
      <td className="py-3 px-4 text-sm">{formatDate(wo["Sched. Start Date"])}</td>
    </tr>
  );

  if (loadingLocks) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading schedule lock data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unplanned Work Orders Section */}
      <div>
        <Card className="bg-destructive/5 border-destructive/20 mb-4">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-destructive">{unplannedTotal}</div>
              <div className="text-sm text-muted-foreground mt-2">Unplanned Work Orders (Previous Week)</div>
              <div className="text-xs text-muted-foreground mt-1">Work Complete or Closed, scheduled but not on locked list</div>
            </div>
          </CardContent>
        </Card>

        {unplannedTotal > 0 ? (
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl font-medium">Unplanned Schedule Review</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Work orders with Work Complete or Closed status, scheduled for previous week but not on the locked schedule
              </p>
              {previousWeekLeaders && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-sm font-semibold text-muted-foreground mb-2">Previous Week Leaders:</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span><span className="font-semibold">COM:</span> {previousWeekLeaders.COM}</span>
                    <span><span className="font-semibold">LBE:</span> {previousWeekLeaders.LBE}</span>
                    <span><span className="font-semibold">SME Lead:</span> {previousWeekLeaders.SMELead}</span>
                    <span><span className="font-semibold">cSME:</span> {previousWeekLeaders.cSME}</span>
                    <span><span className="font-semibold">mSME:</span> {previousWeekLeaders.mSME}</span>
                    <span><span className="font-semibold">eSME:</span> {previousWeekLeaders.eSME}</span>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {/* LOTO/PTW Section at the top */}
              {lotoOrders.length > 0 && (
                <div className="border-b border-border">
                  <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-border">
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      LOTO / PTW ({lotoOrders.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      {renderColgroup()}
                      {renderTableHeader()}
                      <tbody>
                        {lotoOrders.map(wo => renderWorkOrderRow(wo))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Building sections */}
              {buildingGroups.map(group => (
                <div key={group.building} className="border-b border-border last:border-b-0">
                  <div className="px-4 py-3 bg-muted/40 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">
                      {group.building} ({group.orders.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      {renderColgroup()}
                      {renderTableHeader()}
                      <tbody>
                        {group.orders.map(wo => renderWorkOrderRow(wo))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {lotoOrders.length === 0 && buildingGroups.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">No unplanned work orders from previous week</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No unplanned work orders from previous week</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Incomplete Locked Orders Section */}
      <div>
        <Card className="bg-primary/5 border-primary/20 mb-4">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{incompleteLockedOrders.length}</div>
              <div className="text-sm text-muted-foreground mt-2">Incomplete Locked Work Orders</div>
              <div className="text-xs text-muted-foreground mt-1">Not in Work Complete or Closed status</div>
            </div>
          </CardContent>
        </Card>

        {incompleteLockedOrders.length > 0 ? (
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl font-medium">Locked Schedule Review</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Previous week's locked work orders not yet completed or closed
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  {renderColgroup()}
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Equipment Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Priority</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incompleteLockedOrders.map((locked) => {
                      const currentWO = workOrders.find(wo => String(wo["Work Order"]) === String(locked.workOrderNumber));
                      const currentStatus = currentWO?.["Status"] || locked.status;
                      
                      return (
                        <tr 
                          key={locked.workOrderNumber} 
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          style={{ borderBottomWidth: '0.5px' }}
                        >
                          <td className="py-3 px-4">
                            <a
                              href={`${BASE_URL}${locked.workOrderNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium"
                            >
                              {locked.workOrderNumber}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm truncate" title={locked.description}>{locked.description}</td>
                          <td className="py-3 px-4 text-sm">{locked.type}</td>
                          <td className="py-3 px-4 text-sm truncate" title={locked.equipmentDescription}>{locked.equipmentDescription}</td>
                          <td className="py-3 px-4 text-sm">{currentStatus}</td>
                          <td className="py-3 px-4 text-sm font-medium">{locked.dataCenter}</td>
                          <td className="py-3 px-4 text-sm">{locked.priority}</td>
                          <td className="py-3 px-4 text-sm">{locked.shift}</td>
                          <td className="py-3 px-4 text-sm">{formatDate(locked.schedStartDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">All locked work orders from previous week are complete or closed</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
