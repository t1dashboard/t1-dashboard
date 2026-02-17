/**
 * Swiss Rationalism: Schedule Lock tab for selecting and locking T1 work orders
 */

import { useState, useMemo, useEffect } from "react";
import { WorkOrder } from "@/types/workOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, isNextWeek } from "@/lib/dateUtils";
import { toast } from "sonner";
import { Lock, Unlock, Download, Loader2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { getScheduleLocks, lockWorkOrders, unlockWorkOrders, getScheduleLockWeeks, getScheduleLocksByWeek, ScheduleLock } from "@/lib/api";

interface ScheduleLockTabProps {
  workOrders: WorkOrder[];
}

const BASE_URL = "https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum=";

export default function ScheduleLockTab({ workOrders }: ScheduleLockTabProps) {
  const [selectedWorkOrders, setSelectedWorkOrders] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [lockedWorkOrders, setLockedWorkOrders] = useState<Set<string>>(new Set());
  const [allLocks, setAllLocks] = useState<ScheduleLock[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(true);
  const [locking, setLocking] = useState(false);

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [exportingWeek, setExportingWeek] = useState<string | null>(null);

  // Load locked work orders from server
  useEffect(() => {
    async function loadLocks() {
      try {
        const locks = await getScheduleLocks();
        setAllLocks(locks);
        const lockedNumbers = new Set<string>(locks.map(lock => String(lock.workOrderNumber)));
        setLockedWorkOrders(lockedNumbers);
      } catch (error) {
        console.error("Error loading schedule locks:", error);
      } finally {
        setLoadingLocks(false);
      }
    }
    loadLocks();
  }, []);

  const t1WorkOrders = useMemo(() => {
    const filtered = workOrders.filter((wo) => {
      const isCancelled = wo["Status"]?.toUpperCase() === "CANCELLED";
      const isCMCC = wo["Description"]?.toUpperCase().includes("CMCC");
      const isWeekly = wo["Description"]?.toUpperCase().includes("WEEKLY");
      return !isCancelled && !isCMCC && !isWeekly && isNextWeek(wo["Sched. Start Date"]);
    });
    
    // Sort alphabetically by data center
    return filtered.sort((a, b) => {
      const dcA = a["Data Center"] || "";
      const dcB = b["Data Center"] || "";
      return dcA.localeCompare(dcB);
    });
  }, [workOrders]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedWorkOrders(new Set());
    } else {
      const allIds = new Set(t1WorkOrders.map(wo => String(wo["Work Order"])));
      setSelectedWorkOrders(allIds);
    }
    setSelectAll(!selectAll);
  };

  const handleToggleWorkOrder = (woNumber: string) => {
    const newSelected = new Set(selectedWorkOrders);
    if (newSelected.has(woNumber)) {
      newSelected.delete(woNumber);
    } else {
      newSelected.add(woNumber);
    }
    setSelectedWorkOrders(newSelected);
    setSelectAll(newSelected.size === t1WorkOrders.length);
  };

  const handleOpenExportDialog = async () => {
    setShowExportDialog(true);
    setLoadingWeeks(true);
    try {
      const weeks = await getScheduleLockWeeks();
      setAvailableWeeks(weeks);
    } catch (error: any) {
      toast.error("Failed to load available weeks: " + error.message);
    } finally {
      setLoadingWeeks(false);
    }
  };

  const handleExportWeek = async (week: string) => {
    setExportingWeek(week);
    try {
      const locks = await getScheduleLocksByWeek(week);
      if (locks.length === 0) {
        toast.error("No locked work orders found for this week");
        return;
      }

      // Calculate the Monday and Sunday of the lock week for the filename
      const weekDate = new Date(week + "T00:00:00");
      const monday = new Date(weekDate);
      // The lockWeek stores the Monday date, so add 7 days for T1 (next week)
      const t1Monday = new Date(monday);
      t1Monday.setDate(monday.getDate() + 7);
      const t1Sunday = new Date(t1Monday);
      t1Sunday.setDate(t1Monday.getDate() + 6);

      const formatDateForFilename = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDate = formatDateForFilename(t1Monday);
      const endDate = formatDateForFilename(t1Sunday);
      const filename = `Schedule_Lock_${startDate}_to_${endDate}.xlsx`;

      // Prepare data for export
      const exportData = locks.map((order) => ({
        "Work Order": order.workOrderNumber,
        "Description": order.description,
        "Data Center": order.dataCenter,
        "Sched Start Date": order.schedStartDate,
        "Assigned To": order.assignedTo,
        "Status": order.status,
        "Type": order.type,
        "Equipment Description": order.equipmentDescription,
        "Priority": order.priority,
        "Shift": order.shift,
        "Lock Week": order.lockWeek
      }));

      // Create workbook and export
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Locked Schedule");
      XLSX.writeFile(wb, filename);

      toast.success(`Exported ${locks.length} locked work orders`);
      setShowExportDialog(false);
    } catch (error: any) {
      toast.error("Failed to export: " + error.message);
    } finally {
      setExportingWeek(null);
    }
  };

  const formatWeekLabel = (week: string) => {
    const weekDate = new Date(week + "T00:00:00");
    const monday = new Date(weekDate);
    // T1 is next week from when it was locked
    const t1Monday = new Date(monday);
    t1Monday.setDate(monday.getDate() + 7);
    const t1Sunday = new Date(t1Monday);
    t1Sunday.setDate(t1Monday.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${t1Monday.toLocaleDateString('en-US', options)} – ${t1Sunday.toLocaleDateString('en-US', options)}`;
  };

  const handleUnlockSchedule = async () => {
    if (selectedWorkOrders.size === 0) {
      toast.error("Please select at least one work order to unlock");
      return;
    }

    setLocking(true);
    try {
      await unlockWorkOrders(Array.from(selectedWorkOrders));

      // Update local state
      const newLockedNumbers = new Set(lockedWorkOrders);
      selectedWorkOrders.forEach(wo => newLockedNumbers.delete(wo));
      setLockedWorkOrders(newLockedNumbers);
      setAllLocks(prev => prev.filter(lock => !selectedWorkOrders.has(String(lock.workOrderNumber))));

      toast.success(`Unlocked ${selectedWorkOrders.size} work orders`);
      setSelectedWorkOrders(new Set());
      setSelectAll(false);
    } catch (error: any) {
      toast.error("Failed to unlock: " + error.message);
    } finally {
      setLocking(false);
    }
  };

  const handleLockSchedule = async () => {
    if (selectedWorkOrders.size === 0) {
      toast.error("Please select at least one work order to lock");
      return;
    }

    setLocking(true);
    try {
      // Get the current week's Monday date for the lock
      const today = new Date();
      const currentDay = today.getDay();
      const diff = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      const lockWeek = monday.toISOString().split('T')[0];

      // Get selected work order details
      const lockedOrders: ScheduleLock[] = t1WorkOrders
        .filter(wo => selectedWorkOrders.has(String(wo["Work Order"])))
        .map(wo => ({
          workOrderNumber: String(wo["Work Order"]),
          description: wo["Description"],
          dataCenter: wo["Data Center"],
          schedStartDate: wo["Sched. Start Date"],
          assignedTo: wo["Assigned To Name"],
          status: wo["Status"],
          type: wo["Type"],
          equipmentDescription: wo["Equipment Description"],
          priority: wo["Priority"],
          shift: wo["Shift"],
          lockWeek: lockWeek
        }));

      await lockWorkOrders(lockedOrders);

      // Update local state
      const newLockedNumbers = new Set(lockedWorkOrders);
      selectedWorkOrders.forEach(wo => newLockedNumbers.add(wo));
      setLockedWorkOrders(newLockedNumbers);
      setAllLocks(prev => [...prev, ...lockedOrders]);

      toast.success(`Locked ${selectedWorkOrders.size} work orders for week of ${lockWeek}`);
      setSelectedWorkOrders(new Set());
      setSelectAll(false);
    } catch (error: any) {
      toast.error("Failed to lock: " + error.message);
    } finally {
      setLocking(false);
    }
  };

  useEffect(() => {
    setSelectAll(selectedWorkOrders.size === t1WorkOrders.length && t1WorkOrders.length > 0);
  }, [selectedWorkOrders, t1WorkOrders]);

  if (loadingLocks) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading schedule locks...</p>
        </CardContent>
      </Card>
    );
  }

  if (t1WorkOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No T1 work orders available to lock</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export Week Selector Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-medium">Export Locked Schedule</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExportDialog(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingWeeks ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading available weeks...</p>
                </div>
              ) : availableWeeks.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No locked schedules found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">Select a week to export:</p>
                  {availableWeeks.map((week) => (
                    <Button
                      key={week}
                      variant="outline"
                      className="w-full justify-between h-auto py-3 px-4"
                      onClick={() => handleExportWeek(week)}
                      disabled={exportingWeek !== null}
                    >
                      <div className="text-left">
                        <div className="font-medium">{formatWeekLabel(week)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Locked on week of {week}</div>
                      </div>
                      {exportingWeek === week ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              {selectedWorkOrders.size} of {t1WorkOrders.length} work orders selected
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleOpenExportDialog}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Locked
            </Button>
            <Button 
              onClick={handleLockSchedule}
              disabled={selectedWorkOrders.size === 0 || locking}
              className="bg-primary hover:bg-primary/90"
            >
              {locking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Lock Schedule
            </Button>
            <Button 
              onClick={handleUnlockSchedule}
              disabled={selectedWorkOrders.size === 0 || locking}
              variant="destructive"
            >
              Unlock Selected
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-xl font-medium">T1 Work Orders</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select work orders to lock for the schedule
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Work Order</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Data Center</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Sched Start Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Assigned To</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {t1WorkOrders.map((wo) => {
                  const woNumber = String(wo["Work Order"]);
                  const isReady = wo["Status"]?.toUpperCase() === "READY";
                  const isSelected = selectedWorkOrders.has(woNumber);
                  
                  return (
                    <tr 
                      key={woNumber} 
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      style={{ borderBottomWidth: '0.5px' }}
                    >
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={selectedWorkOrders.has(woNumber)}
                          onCheckedChange={() => handleToggleWorkOrder(woNumber)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        {lockedWorkOrders.has(woNumber) ? (
                          <Lock className="h-4 w-4 text-green-600" />
                        ) : (
                          <Unlock className="h-4 w-4 text-red-600" />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <a
                          href={`${BASE_URL}${woNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline font-medium"
                          style={{ color: isReady ? '#22c55e' : '#ef4444' }}
                        >
                          {woNumber}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-sm">{wo["Description"]}</td>
                      <td className="py-3 px-4 text-sm font-medium">{wo["Data Center"]}</td>
                      <td className="py-3 px-4 text-sm">
                        {formatDate(wo["Sched. Start Date"])}
                      </td>
                      <td className="py-3 px-4 text-sm">{wo["Assigned To Name"]}</td>
                      <td className="py-3 px-4 text-sm">{wo["Status"]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
