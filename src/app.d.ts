declare global {
	namespace App {
		interface Locals {
			user?: {
				UserName?: string;
				username?: string;
				Dept?: string;
				[key: string]: unknown;
			} | null;
			dbSource?: "live" | "backup";
		}
	}
}

export {};
