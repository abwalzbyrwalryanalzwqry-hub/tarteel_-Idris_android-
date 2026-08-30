CREATE TABLE `quran_sync_operations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`operationId` varchar(96) NOT NULL,
	`operationType` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quran_sync_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `quran_sync_operations_user_operation_unique` UNIQUE(`userId`,`operationId`)
);
--> statement-breakpoint
CREATE INDEX `quran_sync_operations_user_created_idx` ON `quran_sync_operations` (`userId`,`createdAt`);