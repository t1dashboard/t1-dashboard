/**
 * Swiss Rationalism Design:
 * - 8px grid system for all spacing
 * - Muted teal (oklch(0.55 0.08 200)) for interactive elements
 * - Warm grays for neutral backgrounds
 * - Inter (400/450/500) for body, JetBrains Mono for work order numbers
 * - Hairline dividers (0.5px) between rows
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { WorkOrder, ScheduledLabor } from "@/types/workOrder";
import WorkLoadTab from "@/components/WorkLoadTab";
import RiskIdentificationTab from "@/components/RiskIdentificationTab";
import LOTOReviewTab from "@/components/LOTOReviewTab";

export default function Home() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [scheduledLabor, setScheduledLabor] = useState<ScheduledLabor[]>([]);
  const [activeTab, setActiveTab] = useState("workload");

  const handleWorkOrderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<WorkOrder>(worksheet);
      setWorkOrders(json);
    };
    reader.readAsBinaryString(file);
  };

  const handleScheduledLaborUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<any>(worksheet);
      
      // Extract work order numbers from the first column
      const laborData: ScheduledLabor[] = json.map((row: any) => ({
        workOrderNumber: Number(Object.values(row)[0])
      }));
      setScheduledLabor(laborData);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <h1 className="text-foreground font-medium">T1 Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Work order management and risk assessment</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Upload Section */}
        {workOrders.length === 0 ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Upload Data
              </CardTitle>
              <CardDescription>Upload your work order spreadsheet to begin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Work Order Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">
                    Work Order Spreadsheet
                  </label>
                  <div className="border-2 border-dashed border-border rounded bg-muted/30 p-8 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleWorkOrderUpload}
                      className="hidden"
                      id="workorder-upload"
                    />
                    <label htmlFor="workorder-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-foreground font-medium">Click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">Excel files (.xlsx, .xls)</p>
                    </label>
                  </div>
                </div>

                {/* Scheduled Labor Upload */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">
                    Scheduled Labor (Optional)
                  </label>
                  <div className="border-2 border-dashed border-border rounded bg-muted/30 p-8 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleScheduledLaborUpload}
                      className="hidden"
                      id="labor-upload"
                    />
                    <label htmlFor="labor-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-foreground font-medium">Click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">Work order numbers for labor tracking</p>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded border border-border">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Upload Instructions</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Upload the main work order spreadsheet first</li>
                    <li>Optionally upload scheduled labor data for LOTO Review tracking</li>
                    <li>Work orders in the scheduled labor file will be marked as "No" (red)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Re-upload Section */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {workOrders.length} work orders loaded
                  {scheduledLabor.length > 0 && ` • ${scheduledLabor.length} scheduled labor entries`}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => document.getElementById('workorder-upload')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Re-upload Work Orders
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleWorkOrderUpload}
                  className="hidden"
                  id="workorder-upload"
                />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('labor-upload')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Re-upload Scheduled Labor
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleScheduledLaborUpload}
                  className="hidden"
                  id="labor-upload"
                />
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                <TabsTrigger value="workload" className="py-3">Work Load</TabsTrigger>
                <TabsTrigger value="risk" className="py-3">Risk Identification</TabsTrigger>
                <TabsTrigger value="loto" className="py-3">LOTO Review</TabsTrigger>
              </TabsList>

              <TabsContent value="workload" className="mt-6">
                <WorkLoadTab workOrders={workOrders} />
              </TabsContent>

              <TabsContent value="risk" className="mt-6">
                <RiskIdentificationTab workOrders={workOrders} />
              </TabsContent>

              <TabsContent value="loto" className="mt-6">
                <LOTOReviewTab workOrders={workOrders} scheduledLabor={scheduledLabor} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
