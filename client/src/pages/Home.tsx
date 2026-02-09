/**
 * Swiss Rationalism: Main dashboard with sidebar navigation
 */

import { useState, useEffect, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { WorkOrder, ScheduledLabor } from "@/types/workOrder";
import T1T3Dashboard from "./T1T3Dashboard";
import T4T8Dashboard from "./T4T8Dashboard";
import ScheduleLockTab from "@/components/ScheduleLockTab";
import ScheduleLockReviewTab from "@/components/ScheduleLockReviewTab";

type ActiveView = "upload" | "schedule-lock" | "schedule-lock-review" | "t1t3" | "t4t8";

export default function Home() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    const saved = localStorage.getItem('t1-work-orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [scheduledLabor, setScheduledLabor] = useState<ScheduledLabor[]>(() => {
    const saved = localStorage.getItem('t1-scheduled-labor');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeView, setActiveView] = useState<ActiveView>(() => {
    // Default to t1t3 if data exists, otherwise upload
    const saved = localStorage.getItem('t1-work-orders');
    return saved && JSON.parse(saved).length > 0 ? "t1t3" : "upload";
  });

  // Persist work orders to localStorage
  useEffect(() => {
    localStorage.setItem('t1-work-orders', JSON.stringify(workOrders));
  }, [workOrders]);

  // Persist scheduled labor to localStorage
  useEffect(() => {
    localStorage.setItem('t1-scheduled-labor', JSON.stringify(scheduledLabor));
  }, [scheduledLabor]);



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
      
      // Extract work order numbers from the first column
      const laborData: ScheduledLabor[] = json.map((row: any) => ({
        workOrderNumber: Object.values(row)[0] as number
      }));
      
      setScheduledLabor(laborData);
    };
    reader.readAsBinaryString(file);
  };



  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        {/* Title - Clickable to go to upload */}
        <button 
          onClick={() => setActiveView("upload")}
          className="p-6 border-b border-border text-left hover:bg-muted/50 transition-colors w-full"
        >
          <h1 className="text-lg font-medium text-foreground">Work Planning Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">Click to upload data</p>
        </button>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">

          <button
            onClick={() => setActiveView("t1t3")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "t1t3"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <div className="font-medium">T1-T3 Dashboard</div>
            <div className="text-xs opacity-80 mt-1">Near-term planning</div>
          </button>
          
          <button
            onClick={() => setActiveView("t4t8")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "t4t8"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <div className="font-medium">T4-T8 Dashboard</div>
            <div className="text-xs opacity-80 mt-1">Extended planning</div>
          </button>
          
          <button
            onClick={() => setActiveView("schedule-lock")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "schedule-lock"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <div className="font-medium">Schedule Lock</div>
            <div className="text-xs opacity-80 mt-1">Lock T1 schedule</div>
          </button>
          
          <button
            onClick={() => setActiveView("schedule-lock-review")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "schedule-lock-review"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <div className="font-medium">Schedule Lock Review</div>
            <div className="text-xs opacity-80 mt-1">Review locked schedule</div>
          </button>
        </nav>
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
                <div className="grid grid-cols-2 gap-6">
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
            <T1T3Dashboard workOrders={workOrders} scheduledLabor={scheduledLabor} />
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
