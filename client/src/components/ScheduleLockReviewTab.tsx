/**
 * Swiss Rationalism: Schedule Lock Review tab showing unplanned and incomplete locked work orders
 * Includes Reason dropdown for incomplete locked orders and Submit button for schedule adherence tracking
 * Also tracks completed locked WOs whose sched start date was moved from the originally locked date
 */

import { useMemo, useState, useEffect } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, parseExcelDate } from "@/lib/dateUtils";
import { getWorkWeekLeaders } from "@/lib/workWeekLeaders";
import { getScheduleLocks, ScheduleLock, submitScheduleAdherence, getScheduleAdherenceByWeek, AdherenceRecord } from "@/lib/api";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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

interface DateMovedOrder extends LockedWorkOrder {
  currentSchedStartDate: any;
  currentStatus: string;
}

const ADHERENCE_REASONS = [
  "Vendor Not Available/Prepared",
  "Missing Parts/Tools",
  "Resource Availability",
  "Weather",
  "XFN Partner Request",
  "Risk Mitigation",
  "Completed Early",
  "SOW Changed",
] as const;

// One-time exclusion of specific work orders from Schedule Lock Review
const EXCLUDED_WORK_ORDERS = new Set(["3335323", "3316827", "3336866", "3335916", "3335907", "3336865"]);

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function ScheduleLockReviewTab({ workOrders }: ScheduleLockReviewTabProps) {
  const [serverLocks, setServerLocks] = useState<ScheduleLock[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(true);
  const [reasonSelections, setReasonSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  // Calculate the lock week for incomplete orders to check for existing adherence data
  const lockCreatedWeekStr = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lockCreatedMonday = new Date(lastMonday);
    lockCreatedMonday.setDate(lastMonday.getDate() - 7);
    const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return toDateStr(lockCreatedMonday);
  }, []);

  // Load existing adherence data for the lock week
  useEffect(() => {
    async function loadAdherence() {
      if (!lockCreatedWeekStr) return;
      try {
        const records = await getScheduleAdherenceByWeek(lockCreatedWeekStr);
        // Pre-populate reason selections from existing data
        const selections: Record<string, string> = {};
        records.forEach(r => {
          selections[String(r.workOrderNumber)] = r.reason;
        });
        if (Object.keys(selections).length > 0) {
          setReasonSelections(prev => ({ ...selections, ...prev }));
          setSubmitted(true);
        }
      } catch (error) {
        console.error("Error loading adherence data:", error);
      }
    }
    loadAdherence();
  }, [lockCreatedWeekStr]);

  const { lotoOrders, buildingGroups, unplannedTotal, incompleteLockedOrders, dateMovedOrders } = useMemo(() => {
    // Get previous week's date range
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
    
    const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const lastMondayStr = toDateStr(lastMonday);
    const lastSundayStr = toDateStr(lastSunday);
    
    const lockCreatedMonday = new Date(lastMonday);
    lockCreatedMonday.setDate(lastMonday.getDate() - 7);
    const lockCreatedSunday = new Date(lockCreatedMonday);
    lockCreatedSunday.setDate(lockCreatedMonday.getDate() + 6);
    const lockCreatedMondayStr = toDateStr(lockCreatedMonday);
    const lockCreatedSundayStr = toDateStr(lockCreatedSunday);

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
    
    const previousWeekLocked = lockedOrders.filter(locked => {
      const lockWeekStr = locked.lockWeek;
      return lockWeekStr >= lockCreatedMondayStr && lockWeekStr <= lockCreatedSundayStr;
    });

    const lockedWOMap = new Map<string, string | null>();
    previousWeekLocked.forEach(wo => {
      lockedWOMap.set(String(wo.workOrderNumber), wo.schedStartDate || null);
    });
    const lockedWONumbers = new Set(previousWeekLocked.map(wo => String(wo.workOrderNumber)));

    const EXCLUDED_SHIFT_CODES = new Set(["GNSF", "GNSG", "GNSH", "GNSI", "GNSJ"]);

    const normalizeDateStr = (dateVal: any): string => {
      const parsed = parseExcelDate(dateVal);
      if (!parsed) return "";
      return toDateStr(parsed);
    };

    const unplanned = workOrders.filter((wo) => {
      // One-time exclusion of specific work orders
      if (EXCLUDED_WORK_ORDERS.has(String(wo["Work Order"]))) return false;
      
      const status = wo["Status"]?.toUpperCase() || "";
      const description = wo["Description"]?.toUpperCase() || "";
      const woType = wo["Type"]?.toUpperCase()?.trim() || "";
      
      const isWorkCompleteOrClosed = status === "WORK COMPLETE" || status === "CLOSED";
      if (!isWorkCompleteOrClosed) return false;
      
      if (description.includes("000")) return false;
      
      // Exclude CBM type work orders
      if (woType === "CBM") return false;
      
      const isCMCC = description.includes("CMCC");
      const isWeekly = description.includes("WEEKLY");
      if (isCMCC || isWeekly) return false;
      
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
        const lockedSchedDate = normalizeDateStr(lockedWOMap.get(woNumber));
        const currentSchedDate = normalizeDateStr(wo["Sched. Start Date"]);
        const dateChanged = lockedSchedDate !== currentSchedDate;
        return isInPreviousWeek && dateChanged;
      } else {
        return isInPreviousWeek;
      }
    });

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

    loto.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });

    const groups: Record<string, WorkOrder[]> = {};
    rest.forEach(wo => {
      const dc = wo["Data Center"] || "Unknown";
      if (!groups[dc]) groups[dc] = [];
      groups[dc].push(wo);
    });

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

    const sortedGroups = Object.keys(groups).sort().map(key => ({
      building: key,
      orders: groups[key]
    }));

    // Incomplete locked orders: not completed/closed/in process
    const incomplete = previousWeekLocked.filter(locked => {
      if (EXCLUDED_WORK_ORDERS.has(String(locked.workOrderNumber))) return false;
      
      const currentWO = workOrders.find(wo => String(wo["Work Order"]) === String(locked.workOrderNumber));
      
      const lockedType = locked.type?.toUpperCase()?.trim() || "";
      if (lockedType === "CBM") return false;
      
      const lockedDesc = locked.description?.toUpperCase() || "";
      const lockedShift = locked.shift?.toUpperCase()?.trim() || "";
      const lockedHasLotoPtw = lockedDesc.includes("LOTO") || lockedDesc.includes("PTW");
      if (EXCLUDED_SHIFT_CODES.has(lockedShift) && !lockedHasLotoPtw) return false;
      
      if (!currentWO) return true;
      
      const status = currentWO?.["Status"]?.toUpperCase() || "";
      return status !== "WORK COMPLETE" && status !== "CLOSED" && status !== "IN PROCESS";
    }).sort((a, b) => {
      const dcA = a.dataCenter || "";
      const dcB = b.dataCenter || "";
      return dcA.localeCompare(dcB);
    });

    // Date moved orders: completed/closed BUT sched start date changed from locked date
    const dateMoved: DateMovedOrder[] = previousWeekLocked.filter(locked => {
      if (EXCLUDED_WORK_ORDERS.has(String(locked.workOrderNumber))) return false;
      
      const lockedType = locked.type?.toUpperCase()?.trim() || "";
      if (lockedType === "CBM") return false;
      
      const lockedDesc = locked.description?.toUpperCase() || "";
      const lockedShift = locked.shift?.toUpperCase()?.trim() || "";
      const lockedHasLotoPtw = lockedDesc.includes("LOTO") || lockedDesc.includes("PTW");
      if (EXCLUDED_SHIFT_CODES.has(lockedShift) && !lockedHasLotoPtw) return false;
      
      // Exclude daily/monthly/quarterly maintenance unless description also contains kitchen
      const isRoutineMaintenance = lockedDesc.includes("DAILY") || lockedDesc.includes("MONTHLY") || lockedDesc.includes("QUARTERLY");
      const hasKitchen = lockedDesc.includes("KITCHEN");
      if (isRoutineMaintenance && !hasKitchen) return false;
      
      const currentWO = workOrders.find(wo => String(wo["Work Order"]) === String(locked.workOrderNumber));
      if (!currentWO) return false;
      
      const status = currentWO["Status"]?.toUpperCase() || "";
      const isCompleted = status === "WORK COMPLETE" || status === "CLOSED";
      if (!isCompleted) return false;
      
      // Check if sched start date changed
      const lockedSchedDate = normalizeDateStr(locked.schedStartDate);
      const currentSchedDate = normalizeDateStr(currentWO["Sched. Start Date"]);
      if (lockedSchedDate === currentSchedDate || lockedSchedDate === "" || currentSchedDate === "") return false;
      
      // Exclude WOs completed early (current date is before locked date) — completing early is good
      // Only include WOs where the date moved later or out of the week entirely
      return currentSchedDate > lockedSchedDate;
    }).map(locked => {
      const currentWO = workOrders.find(wo => String(wo["Work Order"]) === String(locked.workOrderNumber));
      return {
        ...locked,
        currentSchedStartDate: currentWO?.["Sched. Start Date"] || null,
        currentStatus: currentWO?.["Status"] || locked.status,
      };
    }).sort((a, b) => {
      const dcA = a.dataCenter || "";
      const dcB = b.dataCenter || "";
      return dcA.localeCompare(dcB);
    });

    return {
      lotoOrders: loto,
      buildingGroups: sortedGroups,
      unplannedTotal: unplanned.length,
      incompleteLockedOrders: incomplete,
      dateMovedOrders: dateMoved
    };
  }, [workOrders, serverLocks]);

  // Get Work Week Leaders for previous week
  const previousWeekLeaders = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    
    return getWorkWeekLeaders(lastMonday);
  }, []);

  const handleReasonChange = (woNumber: string, reason: string) => {
    setReasonSelections(prev => ({
      ...prev,
      [woNumber]: reason
    }));
    setSubmitted(false);
  };

  // Combine incomplete + date-moved for submission
  const allReasonableOrders = useMemo(() => {
    const incompleteNums = new Set(incompleteLockedOrders.map(o => String(o.workOrderNumber)));
    const dateMovedNums = new Set(dateMovedOrders.map(o => String(o.workOrderNumber)));
    // Build combined list with source info
    return {
      incompleteNums,
      dateMovedNums,
      totalCount: incompleteNums.size + dateMovedNums.size,
    };
  }, [incompleteLockedOrders, dateMovedOrders]);

  const handleSubmit = async () => {
    // Collect reasons from both incomplete and date-moved orders
    const allOrders = [
      ...incompleteLockedOrders.map(o => ({
        workOrderNumber: String(o.workOrderNumber),
        description: o.description || null,
        dataCenter: o.dataCenter || null,
      })),
      ...dateMovedOrders.map(o => ({
        workOrderNumber: String(o.workOrderNumber),
        description: o.description || null,
        dataCenter: o.dataCenter || null,
      })),
    ];

    const records = allOrders
      .filter(o => reasonSelections[o.workOrderNumber])
      .map(o => ({
        workOrderNumber: o.workOrderNumber,
        description: o.description,
        dataCenter: o.dataCenter,
        lockWeek: lockCreatedWeekStr,
        reason: reasonSelections[o.workOrderNumber],
      }));

    if (records.length === 0) {
      toast.error("Please select a reason for at least one work order before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      await submitScheduleAdherence(records);
      setSubmitted(true);
      toast.success(`Submitted ${records.length} adherence reason(s) successfully.`);
    } catch (error: any) {
      console.error("Error submitting adherence:", error);
      toast.error("Failed to submit adherence reasons: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Count total reasons selected across both sections
  const totalReasonsSelected = useMemo(() => {
    const allWONumbers = new Set([
      ...incompleteLockedOrders.map(o => String(o.workOrderNumber)),
      ...dateMovedOrders.map(o => String(o.workOrderNumber)),
    ]);
    return Array.from(allWONumbers).filter(num => reasonSelections[num]).length;
  }, [incompleteLockedOrders, dateMovedOrders, reasonSelections]);

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

  const renderReasonRow = (locked: LockedWorkOrder, currentStatus: string, extraColumns?: React.ReactNode) => {
    const woNum = String(locked.workOrderNumber);
    const selectedReason = reasonSelections[woNum] || "";
    
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
        {extraColumns}
        <td className="py-3 px-3">
          <select
            value={selectedReason}
            onChange={(e) => handleReasonChange(woNum, e.target.value)}
            className="w-full text-sm border border-border rounded-sm px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select reason...</option>
            {ADHERENCE_REASONS.map(reason => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
        </td>
      </tr>
    );
  };

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
                    <span><span className="font-semibold">SME Lead:</span> {previousWeekLeaders.SME}</span>
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
                  <colgroup>
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "20%" }} />
                  </colgroup>
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incompleteLockedOrders.map((locked) => {
                      const currentWO = workOrders.find(wo => String(wo["Work Order"]) === String(locked.workOrderNumber));
                      const currentStatus = currentWO?.["Status"] || locked.status;
                      return renderReasonRow(locked, currentStatus, 
                        <td className="py-3 px-4 text-sm">{formatDate(locked.schedStartDate)}</td>
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

      {/* Sched Start Date Moved Section */}
      <div>
        <Card className="bg-amber-500/5 border-amber-500/20 mb-4">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-600">{dateMovedOrders.length}</div>
              <div className="text-sm text-muted-foreground mt-2">Sched Start Date Moved</div>
              <div className="text-xs text-muted-foreground mt-1">Completed but scheduled start date changed from locked date</div>
            </div>
          </CardContent>
        </Card>

        {dateMovedOrders.length > 0 ? (
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl font-medium">Sched Start Date Moved</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Locked work orders that were completed but had their scheduled start date changed from the originally locked date
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "20%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Equip. Desc.</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Priority</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Shift</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Locked Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Current Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateMovedOrders.map((order) => {
                      const woNum = String(order.workOrderNumber);
                      const selectedReason = reasonSelections[woNum] || "";
                      
                      return (
                        <tr 
                          key={order.workOrderNumber} 
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                          style={{ borderBottomWidth: '0.5px' }}
                        >
                          <td className="py-3 px-4">
                            <a
                              href={`${BASE_URL}${order.workOrderNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-600 hover:underline font-medium"
                            >
                              {order.workOrderNumber}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm truncate" title={order.description}>{order.description}</td>
                          <td className="py-3 px-4 text-sm">{order.type}</td>
                          <td className="py-3 px-4 text-sm truncate" title={order.equipmentDescription}>{order.equipmentDescription}</td>
                          <td className="py-3 px-4 text-sm">{order.currentStatus}</td>
                          <td className="py-3 px-4 text-sm font-medium">{order.dataCenter}</td>
                          <td className="py-3 px-4 text-sm">{order.priority}</td>
                          <td className="py-3 px-4 text-sm">{order.shift}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground line-through">{formatDate(order.schedStartDate)}</td>
                          <td className="py-3 px-4 text-sm font-medium text-amber-600">{formatDate(order.currentSchedStartDate)}</td>
                          <td className="py-3 px-3">
                            <select
                              value={selectedReason}
                              onChange={(e) => handleReasonChange(woNum, e.target.value)}
                              className="w-full text-sm border border-border rounded-sm px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Select reason...</option>
                              {ADHERENCE_REASONS.map(reason => (
                                <option key={reason} value={reason}>{reason}</option>
                              ))}
                            </select>
                          </td>
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
              <p className="text-muted-foreground">No locked work orders had their scheduled start date changed</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Submit Button - covers both incomplete and date-moved orders */}
      {(incompleteLockedOrders.length > 0 || dateMovedOrders.length > 0) && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {totalReasonsSelected} of {allReasonableOrders.totalCount} reasons selected
                <span className="text-xs ml-2 text-muted-foreground/70">
                  ({incompleteLockedOrders.length} incomplete + {dateMovedOrders.length} date moved)
                </span>
              </div>
              <div className="flex items-center gap-3">
                {submitted && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Submitted
                  </span>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || totalReasonsSelected === 0}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white font-medium rounded-sm transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
