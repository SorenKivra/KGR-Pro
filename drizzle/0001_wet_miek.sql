CREATE TABLE `kgr_batches` (
	`id` varchar(36) NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`queryMode` enum('quoted','unquoted') NOT NULL,
	`exactProvider` enum('scrapingdog','scrapingbee') NOT NULL,
	`keywordCount` int NOT NULL,
	`exactCount` int NOT NULL DEFAULT 0,
	`hotCount` int NOT NULL DEFAULT 0,
	`status` enum('completed','partial','failed') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kgr_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kgr_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(36) NOT NULL,
	`visitorId` varchar(64) NOT NULL,
	`keyword` varchar(240) NOT NULL,
	`monthlySearchVolume` int NOT NULL,
	`allintitleCount` int,
	`kgr` double,
	`tier` enum('hot','ok','competitive','unavailable') NOT NULL,
	`classicEligible` boolean NOT NULL DEFAULT false,
	`status` enum('exact','unavailable') NOT NULL,
	`reason` text,
	`source` varchar(120) NOT NULL,
	`queriedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kgr_results_id` PRIMARY KEY(`id`)
);
