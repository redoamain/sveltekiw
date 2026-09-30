declare global {
	namespace App {
		interface Locals {
			user?: {
				UserName?: string;
				username?: string;
				Bagian?: string;
				role?: string;
				Dept?: string;
				isSuperAdmin?: boolean;
				roleLabel?: string;
				GroupID?: string;
				[key: string]: unknown;
			} | null;
			dbSource?: "live" | "backup";
		}
	}
}

export {};
