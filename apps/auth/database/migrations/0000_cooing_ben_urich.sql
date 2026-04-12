CREATE TABLE `users` (
	`loginId` text PRIMARY KEY NOT NULL,
	`passwordHash` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`loginId` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`loginId`) REFERENCES `users`(`loginId`) ON UPDATE no action ON DELETE cascade
);
