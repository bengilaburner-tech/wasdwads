import * as schema from "@chirp/db-schema";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const rawClient = createClient({
	url: process.env.DATABASE_URL || "file:./chirp.db",
});

export const queryMetrics = {
	count: 0,
};

export const client = new Proxy(rawClient, {
	get(target, prop, receiver) {
		const value = Reflect.get(target, prop, receiver);
		if (prop === "execute" && typeof value === "function") {
			return async function (...args: unknown[]) {
				queryMetrics.count += 1;
				return await value.apply(target, args);
			};
		}
		return value;
	},
});

export const db = drizzle(client, { schema });

export { schema };
