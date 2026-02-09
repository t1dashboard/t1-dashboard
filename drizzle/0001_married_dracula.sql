CREATE TABLE `schedule_locks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`work_order_number` varchar(64) NOT NULL,
	`description` text,
	`data_center` varchar(128),
	`sched_start_date` varchar(64),
	`assigned_to_name` varchar(256),
	`status` varchar(64),
	`type` varchar(128),
	`equipment_description` text,
	`priority` varchar(64),
	`shift` varchar(64),
	`lock_week` varchar(16) NOT NULL,
	`locked_at` timestamp NOT NULL DEFAULT (now()),
	`locked_by` int NOT NULL,
	CONSTRAINT `schedule_locks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_labor` (
	`id` int AUTO_INCREMENT NOT NULL,
	`work_order_number` varchar(64) NOT NULL,
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	`uploaded_by` int NOT NULL,
	CONSTRAINT `scheduled_labor_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`work_order_number` varchar(64) NOT NULL,
	`description` text,
	`data_center` varchar(128),
	`sched_start_date` varchar(64),
	`assigned_to_name` varchar(256),
	`status` varchar(64),
	`type` varchar(128),
	`equipment_description` text,
	`priority` varchar(64),
	`shift` varchar(64),
	`ehs_lor` varchar(64),
	`operational_lor` varchar(64),
	`deferral_reason_selected` varchar(16),
	`trade` varchar(64),
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	`uploaded_by` int NOT NULL,
	CONSTRAINT `work_orders_id` PRIMARY KEY(`id`)
);
