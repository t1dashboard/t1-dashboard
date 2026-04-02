/**
 * Swiss Rationalism: Main dashboard with sidebar navigation
 */

import { useState, useEffect, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, ChevronLeft, ChevronRight, Loader2, Lock, KeyRound, Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Input } from "@/components/ui/input";
import { WorkOrder, ScheduledLabor, PMCode } from "@/types/workOrder";
import T1T3Dashboard from "./T1T3Dashboard";
import T4T8Dashboard from "./T4T8Dashboard";
import ScheduleLockTab from "@/components/ScheduleLockTab";
import ScheduleLockReviewTab from "@/components/ScheduleLockReviewTab";
import ScheduledLaborReviewTab from "@/components/ScheduledLaborReviewTab";
import InboxReview from "./InboxReview";
import ScheduleAdherenceTab from "@/components/ScheduleAdherenceTab";
import {
  getWorkOrders, uploadWorkOrdersFile,
  getScheduledLabor, uploadScheduledLaborFile,
  getPMCodes, uploadPMCodesFile,
  getDeferralWorkOrders, uploadDeferralWorkOrdersFile,
  DeferralWorkOrder, DeferralCategory,
  uploadCommentsFile, getComments, CommentData,
} from "@/lib/api";
import { toast } from "sonner";

type ActiveView = "upload" | "schedule-lock" | "schedule-lock-review" | "schedule-adherence" | "scheduled-labor-review" | "inbox-review" | "t1t3" | "t4t8";

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [scheduledLabor, setScheduledLabor] = useState<ScheduledLabor[]>([]);
  const [pmCodes, setPmCodes] = useState<PMCode[]>([]);
  const [deferralWorkOrders, setDeferralWorkOrders] = useState<DeferralWorkOrder[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentData>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<ActiveView>("upload");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadUnlocked, setUploadUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const UPLOAD_PIN = import.meta.env.VITE_UPLOAD_PIN || "1171";

  const handlePinSubmit = () => {
    if (pinInput === UPLOAD_PIN) {
      setUploadUnlocked(true);
      setPinError(false);
      setPinInput("");
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  // Load data from server on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [wo, sl, pm, dwo, cm] = await Promise.all([
          getWorkOrders(),
          getScheduledLabor(),
          getPMCodes(),
          getDeferralWorkOrders(),
          getComments(),
        ]);
        setWorkOrders(wo);
        setScheduledLabor(sl);
        setPmCodes(pm);
        setDeferralWorkOrders(dwo);
        setCommentsMap(cm);
        if (wo.length > 0) {
          setActiveView("t1t3");
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleWorkOrderUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading("workOrders");
    try {
      // Upload file directly to server for parsing
      const result = await uploadWorkOrdersFile(file);
      // Reload data from server
      const wo = await getWorkOrders();
      setWorkOrders(wo);
      toast.success(`Uploaded ${result.count} work orders`);
    } catch (error: any) {
      console.error("Error uploading work orders:", error);
      toast.error("Failed to upload work orders: " + error.message);
    } finally {
      setUploading(null);
    }
  };

  const handleScheduledLaborUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading("scheduledLabor");
    try {
      const result = await uploadScheduledLaborFile(file);
      const sl = await getScheduledLabor();
      setScheduledLabor(sl);
      toast.success(`Uploaded ${result.count} labor records`);
    } catch (error: any) {
      console.error("Error uploading scheduled labor:", error);
      toast.error("Failed to upload scheduled labor: " + error.message);
    } finally {
      setUploading(null);
    }
  };

  const handlePMCodesUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading("pmCodes");
    try {
      const result = await uploadPMCodesFile(file);
      const pm = await getPMCodes();
      setPmCodes(pm);
      toast.success(`Uploaded ${result.count} PM codes`);
    } catch (error: any) {
      console.error("Error uploading PM codes:", error);
      toast.error("Failed to upload PM codes: " + error.message);
    } finally {
      setUploading(null);
    }
  };

  const handleCommentsUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading("comments");
    try {
      const result = await uploadCommentsFile(file);
      const cm = await getComments();
      setCommentsMap(cm);
      toast.success(`Uploaded ${result.count} comments`);
    } catch (error: any) {
      console.error("Error uploading comments:", error);
      toast.error("Failed to upload comments: " + error.message);
    } finally {
      setUploading(null);
    }
  };

  const handleDeferralCategoryUpload = async (e: ChangeEvent<HTMLInputElement>, category: DeferralCategory) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(`deferral-${category}`);
    try {
      const result = await uploadDeferralWorkOrdersFile(file, category);
      const dwo = await getDeferralWorkOrders();
      setDeferralWorkOrders(dwo);
      toast.success(`Uploaded ${result.count} ${category} work orders`);
    } catch (error: any) {
      console.error(`Error uploading ${category} work orders:`, error);
      toast.error(`Failed to upload ${category}: ` + error.message);
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1">
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <h1 className="text-sm font-medium text-foreground">Work Planning Dashboard</h1>
        <div className="w-6" />
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`border-r border-border bg-card flex flex-col transition-all duration-300 fixed md:static z-40 h-full ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        {/* Title + Theme Toggle */}
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-4 pt-4 pb-0">
            {!sidebarCollapsed && <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Dashboard</span>}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
          <button 
            onClick={() => { setActiveView("upload"); setMobileMenuOpen(false); }}
            className="px-6 pb-4 pt-2 text-left hover:bg-muted/50 transition-colors w-full"
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
            onClick={() => { setActiveView("t1t3"); setMobileMenuOpen(false); }}
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
            onClick={() => { setActiveView("t4t8"); setMobileMenuOpen(false); }}
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
            onClick={() => { setActiveView("schedule-lock"); setMobileMenuOpen(false); }}
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
            onClick={() => { setActiveView("schedule-lock-review"); setMobileMenuOpen(false); }}
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
            onClick={() => { setActiveView("inbox-review"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "inbox-review"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
            title={sidebarCollapsed ? "Inbox Review" : ""}
          >
            {!sidebarCollapsed ? (
              <>
                <div className="font-medium">Inbox Review</div>
                <div className="text-xs opacity-80 mt-1">Campaigns, labor & closure</div>
              </>
            ) : (
              <div className="font-medium text-center text-xs">Inbox</div>
            )}
          </button>
          
          <button
            onClick={() => { setActiveView("schedule-adherence"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
              activeView === "schedule-adherence"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
            title={sidebarCollapsed ? "Schedule Adherence" : ""}
          >
            {!sidebarCollapsed ? (
              <>
                <div className="font-medium">Schedule Adherence</div>
                <div className="text-xs opacity-80 mt-1">Monthly reason tracking</div>
              </>
            ) : (
              <div className="font-medium text-center text-xs">Adhere</div>
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
      <main className="flex-1 overflow-auto min-w-0 pt-14 md:pt-0">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {activeView === "upload" && !uploadUnlocked && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Upload Data — Locked
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter the PIN to unlock the upload page.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <KeyRound className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">This page is PIN-protected to prevent accidental data changes.</p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="password"
                      placeholder="Enter PIN"
                      value={pinInput}
                      onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit(); }}
                      className={`w-40 text-center ${pinError ? "border-red-500" : ""}`}
                      maxLength={10}
                    />
                    <Button onClick={handlePinSubmit}>Unlock</Button>
                  </div>
                  {pinError && <p className="text-xs text-red-500">Incorrect PIN. Please try again.</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {activeView === "upload" && uploadUnlocked && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Upload Data
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload your work order spreadsheets to populate the dashboards. Data is stored on the server so all team members see the same information.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* Work Order Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Work Order Information</label>
                    <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors ${uploading === "workOrders" ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploading === "workOrders" ? (
                        <>
                          <Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Click to upload</span>
                          <span className="text-xs text-muted-foreground mt-1">Excel files (.xlsx, .xls)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleWorkOrderUpload}
                        className="hidden"
                        disabled={uploading !== null}
                      />
                    </label>
                    {workOrders.length > 0 && (
                      <p className="text-xs text-green-600 mt-2">✓ {workOrders.length} work orders loaded</p>
                    )}
                  </div>

                  {/* Scheduled Labor Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Scheduled Labor</label>
                    <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors ${uploading === "scheduledLabor" ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploading === "scheduledLabor" ? (
                        <>
                          <Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Click to upload</span>
                          <span className="text-xs text-muted-foreground mt-1">For LOTO Review tracking</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleScheduledLaborUpload}
                        className="hidden"
                        disabled={uploading !== null}
                      />
                    </label>
                    {scheduledLabor.length > 0 && (
                      <p className="text-xs text-green-600 mt-2">✓ {scheduledLabor.length} labor records loaded</p>
                    )}
                  </div>

                  {/* PM Codes Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">PM Codes</label>
                    <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors ${uploading === "pmCodes" ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploading === "pmCodes" ? (
                        <>
                          <Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm text-muted-foreground">Click to upload</span>
                          <span className="text-xs text-muted-foreground mt-1">For LOTO/PTW filtering</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handlePMCodesUpload}
                        className="hidden"
                        disabled={uploading !== null}
                      />
                    </label>
                    {pmCodes.length > 0 && (
                      <p className="text-xs text-green-600 mt-2">✓ {pmCodes.length} PM codes loaded</p>
                    )}
                  </div>
                </div>

                {/* Deferral Work Orders Upload - 6 Categories */}
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-3">{">"}90 Days Deferral Work Orders</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(["Pending Procedure", "Vendor Action Required", "Awaiting Invoice", "Waiting Conditions", "Pending Parts", "OOS Lock"] as DeferralCategory[]).map((cat) => {
                      const catCount = deferralWorkOrders.filter(wo => wo["Deferral Reason Selected"] === cat).length;
                      const isUploading = uploading === `deferral-${cat}`;
                      return (
                        <div key={cat}>
                          <label className={`flex flex-col items-center justify-center h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                            {isUploading ? (
                              <>
                                <Loader2 className="h-5 w-5 text-muted-foreground mb-1 animate-spin" />
                                <span className="text-xs text-muted-foreground">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs text-muted-foreground text-center px-2">{cat}</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={(e) => handleDeferralCategoryUpload(e, cat)}
                              className="hidden"
                              disabled={uploading !== null}
                            />
                          </label>
                          {catCount > 0 && (
                            <p className="text-xs text-green-600 mt-1 text-center">✓ {catCount} loaded</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {deferralWorkOrders.length > 0 && (
                    <p className="text-xs text-green-600 mt-2">✓ {deferralWorkOrders.length} total deferral work orders loaded</p>
                  )}
                </div>

                {/* Comments Upload */}
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-2">Work Order Comments</label>
                  <label className={`flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors ${uploading === "comments" ? "opacity-50 pointer-events-none" : ""}`}>
                    {uploading === "comments" ? (
                      <>
                        <Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Click to upload</span>
                        <span className="text-xs text-muted-foreground mt-1">Hexagon export with latest comments</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleCommentsUpload}
                      className="hidden"
                      disabled={uploading !== null}
                    />
                  </label>
                  {Object.keys(commentsMap).length > 0 && (
                    <p className="text-xs text-green-600 mt-2">✓ {Object.keys(commentsMap).length} comments loaded</p>
                  )}
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
                          <li><strong>Data is shared:</strong> All team members will see the same uploaded data</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {activeView === "t1t3" && workOrders.length > 0 && (
            <T1T3Dashboard workOrders={workOrders} scheduledLabor={scheduledLabor} pmCodes={pmCodes} commentsMap={commentsMap} />
          )}

          {activeView === "t4t8" && workOrders.length > 0 && (
            <T4T8Dashboard workOrders={workOrders} commentsMap={commentsMap} />
          )}

          {activeView === "schedule-lock" && workOrders.length > 0 && (
            <ScheduleLockTab workOrders={workOrders} canLock={uploadUnlocked} />
          )}

          {activeView === "schedule-lock-review" && workOrders.length > 0 && (
            <ScheduleLockReviewTab workOrders={workOrders} />
          )}

          {activeView === "scheduled-labor-review" && workOrders.length > 0 && (
            <ScheduledLaborReviewTab workOrders={workOrders} scheduledLabor={scheduledLabor} />
          )}

          {activeView === "inbox-review" && workOrders.length > 0 && (
            <InboxReview workOrders={workOrders} scheduledLabor={scheduledLabor} deferralWorkOrders={deferralWorkOrders} commentsMap={commentsMap} />
          )}

          {activeView === "schedule-adherence" && (
            <ScheduleAdherenceTab />
          )}

          {activeView !== "upload" && activeView !== "schedule-adherence" && workOrders.length === 0 && (
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
