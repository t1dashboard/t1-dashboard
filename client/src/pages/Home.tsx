/**
 * Swiss Rationalism: Main dashboard with sidebar navigation
 */

import { useState, useEffect, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { WorkOrder, ScheduledLabor, PMCode } from "@/types/workOrder";
import T1T3Dashboard from "./T1T3Dashboard";
import T4T8Dashboard from "./T4T8Dashboard";
import ScheduleLockTab from "@/components/ScheduleLockTab";
import ScheduleLockReviewTab from "@/components/ScheduleLockReviewTab";
import ScheduledLaborReviewTab from "@/components/ScheduledLaborReviewTab";

type ActiveView = "upload" | "schedule-lock" | "schedule-lock-review" | "scheduled-labor-review" | "t1t3" | "t4t8";

export default function Home() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    const saved = localStorage.getItem('t1-work-orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [scheduledLabor, setScheduledLabor] = useState<ScheduledLabor[]>(() => {
    const saved = localStorage.getItem('t1-scheduled-labor');
    return saved ? JSON.parse(saved) : [];
  });
  const [pmCodes, setPmCodes] = useState<PMCode[]>(() => {
    const saved = localStorage.getItem('t1-pm-codes');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeView, setActiveView] = useState<ActiveView>(() => {
    // Default to t1t3 if data exists, otherwise upload
    const saved = localStorage.getItem('t1-work-orders');
    return saved && JSON.parse(saved).length > 0 ? "t1t3" : "upload";
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Persist work orders to localStorage
  useEffect(() => {
    localStorage.setItem('t1-work-orders', JSON.stringify(workOrders));
  }, [workOrders]);

  // Persist scheduled labor to localStorage
  useEffect(() => {
    localStorage.setItem('t1-scheduled-labor', JSON.stringify(scheduledLabor));
  }, [scheduledLabor]);

  // Persist PM codes to localStorage
  useEffect(() => {
    localStorage.setItem('t1-pm-codes', JSON.stringify(pmCodes));
  }, [pmCodes]);



  const handleWorkOrderUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as WorkOrder[];
      setWorkOrders(json);
    };
    reader.readAsBinaryString(file);
  };

  const handleScheduledLaborUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);
      
      // Extract work order numbers from the "Work Order" column
      const laborData: ScheduledLabor[] = json.map((row: any) => ({
        workOrderNumber: String(row['Work Order'] || Object.values(row)[0])
      }));
      
      setScheduledLabor(laborData);
    };
    reader.readAsBinaryString(file);
  };

  const handlePMCodesUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as PMCode[];
      
      setPmCodes(json);
    };
    reader.readAsBinaryString(file);
  };



  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`border-r border-border bg-card flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        {/* Title - Clickable to go to upload */}
        <div className="border-b border-border">
          <button 
            onClick={() => setActiveView("upload")}
            className="p-6 text-left hover:bg-muted/50 transition-colors w-full"
          >
            {!sidebarCollapsed && (
              <>
                <h1 className="text-lg font-medium text-foreground">Work Planning Dashboard</h1>
                <p className="text-xs text-muted-foreground mt-1">Click to upload data</p>
              </>
            )}
            {sidebarCollapsed && (
              <Upload className="h-5 w-5 mx-auto text-foreground" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">

          <button
            onClick={() => setActiveView("t1t3")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "t1t3"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
            title={sidebarCollapsed ? "T1-T3 Dashboard" : ""}
          >
            {!sidebarCollapsed ? (
              <>
                <div className="font-medium">T1-T3 Dashboard</div>
                <div className="text-xs opacity-80 mt-1">Near-term planning</div>
              </>
            ) : (
              <div className="font-medium text-center">T1-T3</div>
            )}
          </button>
          
          <button
            onClick={() => setActiveView("t4t8")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "t4t8"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
            title={sidebarCollapsed ? "T4-T8 Dashboard" : ""}
          >
            {!sidebarCollapsed ? (
              <>
                <div className="font-medium">T4-T8 Dashboard</div>
                <div className="text-xs opacity-80 mt-1">Extended planning</div>
              </>
            ) : (
              <div className="font-medium text-center">T4-T8</div>
            )}
          </button>
          
          <button
            onClick={() => setActiveView("schedule-lock")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "schedule-lock"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
            title={sidebarCollapsed ? "Schedule Lock" : ""}
          >
            {!sidebarCollapsed ? (
              <>
                <div className="font-medium">Schedule Lock</div>
                <div className="text-xs opacity-80 mt-1">Lock T1 schedule</div>
              </>
            ) : (
              <div className="font-medium text-center text-xs">Lock</div>
            )}
          </button>
          
          <button
            onClick={() => setActiveView("schedule-lock-review")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "schedule-lock-review"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
            title={sidebarCollapsed ? "Schedule Lock Review" : ""}
          >
            {!sidebarCollapsed ? (
              <>
                <div className="font-medium">Schedule Lock Review</div>
                <div className="text-xs opacity-80 mt-1">Review locked schedule</div>
              </>
            ) : (
              <div className="font-medium text-center text-xs">Review</div>
            )}
          </button>
          
          <button
            onClick={() => setActiveView("scheduled-labor-review")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "scheduled-labor-review"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
            title={sidebarCollapsed ? "Scheduled Labor Review" : ""}
          >
            {!sidebarCollapsed ? (
              <>
                <div className="font-medium">Scheduled Labor Review</div>
                <div className="text-xs opacity-80 mt-1">Review scheduled labor</div>
              </>
            ) : (
              <div className="font-medium text-center text-xs">Labor</div>
            )}
          </button>
        </nav>
        
        {/* Toggle Button */}
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container py-8">
          {activeView === "upload" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Upload Data
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload your work order spreadsheets to populate the dashboards
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* Work Order Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Work Order Information</label>
                    <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload</span>
                      <span className="text-xs text-muted-foreground mt-1">Excel files (.xlsx, .xls)</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleWorkOrderUpload}
                        className="hidden"
                      />
                    </label>
                    {workOrders.length > 0 && (
                      <p className="text-xs text-green-600 mt-2">✓ {workOrders.length} work orders loaded</p>
                    )}
                  </div>

                  {/* Scheduled Labor Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Scheduled Labor</label>
                    <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload</span>
                      <span className="text-xs text-muted-foreground mt-1">For LOTO Review tracking</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleScheduledLaborUpload}
                        className="hidden"
                      />
                    </label>
                    {scheduledLabor.length > 0 && (
                      <p className="text-xs text-green-600 mt-2">✓ {scheduledLabor.length} labor records loaded</p>
                    )}
                  </div>

                  {/* PM Codes Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">PM Codes</label>
                    <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload</span>
                      <span className="text-xs text-muted-foreground mt-1">For LOTO/PTW filtering</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handlePMCodesUpload}
                        className="hidden"
                      />
                    </label>
                    {pmCodes.length > 0 && (
                      <p className="text-xs text-green-600 mt-2">✓ {pmCodes.length} PM codes loaded</p>
                    )}
                  </div>
                </div>

                <Card className="bg-muted/30">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs text-primary">i</span>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Upload Instructions</p>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>Upload the work order information spreadsheet first</li>
                          <li>Scheduled labor file: work orders in this list will be marked as "No" in LOTO Review</li>
                          <li>PM codes file: work orders with PM codes requiring LOTO or PTW will appear in LOTO Review</li>
                          <li>WOs &gt;30 Days tab automatically filters corrective work orders based on criteria</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {activeView === "t1t3" && workOrders.length > 0 && (
            <T1T3Dashboard workOrders={workOrders} scheduledLabor={scheduledLabor} pmCodes={pmCodes} />
          )}

          {activeView === "t4t8" && workOrders.length > 0 && (
            <T4T8Dashboard workOrders={workOrders} />
          )}

          {activeView === "schedule-lock" && workOrders.length > 0 && (
            <ScheduleLockTab workOrders={workOrders} />
          )}

          {activeView === "schedule-lock-review" && workOrders.length > 0 && (
            <ScheduleLockReviewTab workOrders={workOrders} />
          )}

          {activeView === "scheduled-labor-review" && workOrders.length > 0 && (
            <ScheduledLaborReviewTab workOrders={workOrders} scheduledLabor={scheduledLabor} />
          )}

          {activeView !== "upload" && workOrders.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No data uploaded yet. Please upload work order data first.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
