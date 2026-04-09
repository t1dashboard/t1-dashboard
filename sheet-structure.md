# Google Sheet Structure

Spreadsheet ID: 1dRpuEeq0uaIeXDOjV1kV9FLDupU3uzlkkGtQSksggTE

## Tab 1: Active Work Orders (16,920 rows, 12 columns)
Headers: Work Order, Description, Data Center, Status, Type, Priority, Sched Start Date, Shift, Assigned To, Supervisor, Equipment Description, Organization

## Tab 2: Scheduled Labor (70,001 rows, 8 columns)
Headers: Work Order, Description, Activity, Trade, Estimated Hours, People Required, Start Date, Task Plan Status

## Tab 3: Comments (17,001 rows, 5 columns)
Headers: Work Order, Description, Status, Most Recent Comment, Last Comment Date

## Mapping to DB
- Active Work Orders → work_orders table (need to map "Sched Start Date" → sched_start_date, "Assigned To" → assigned_to_name, etc.)
- Scheduled Labor → scheduled_labor table (just need Work Order number)
- Comments → work_order_comments table (Work Order → work_order_number, Most Recent Comment → latest_comment, Last Comment Date → comment_date)
