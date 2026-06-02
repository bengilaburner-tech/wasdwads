import { readFileSync, existsSync } from "node:fs";
import {
	AdminService,
	AuthService,
	BookmarksService,
	CommentsService,
	FeedService,
	FollowsService,
	LikesService,
	NotificationsService,
	PostsService,
	SearchService,
	UsersService,
} from "@chirp/proto";
import { Server, ServerCredentials } from "@grpc/grpc-js";
import { adaptService } from "@protobuf-ts/grpc-backend";
import { adminHandler } from "./handlers/admin.handler";
import { authHandler } from "./handlers/auth.handler";
import { bookmarksHandler } from "./handlers/bookmarks.handler";
import { commentsHandler } from "./handlers/comments.handler";
import { feedHandler } from "./handlers/feed.handler";
import { followsHandler } from "./handlers/follows.handler";
import { likesHandler } from "./handlers/likes.handler";
import { notificationsHandler } from "./handlers/notifications.handler";
import { postsHandler } from "./handlers/posts.handler";
import { searchHandler } from "./handlers/search.handler";
import { usersHandler } from "./handlers/users.handler";

const isProduction = process.env.NODE_ENV === "production";

export function createGrpcServerCredentials(): ServerCredentials {
	const keyFile = process.env.GRPC_TLS_KEY_FILE;
	const certFile = process.env.GRPC_TLS_CERT_FILE;
	const hasTlsFiles = Boolean(keyFile && certFile && existsSync(keyFile) && existsSync(certFile));

	if (isProduction && !hasTlsFiles) {
		throw new Error(
			"Production gRPC server requires GRPC_TLS_KEY_FILE and GRPC_TLS_CERT_FILE to establish a trusted TLS channel",
		);
	}

	if (hasTlsFiles) {
		const privateKey = readFileSync(keyFile!, "utf8");
		const certChain = readFileSync(certFile!, "utf8");
		return ServerCredentials.createSsl(Buffer.from([]), [{ private_key: privateKey, cert_chain: certChain }], false);
	}

	return ServerCredentials.createInsecure();
}

export function startGrpcServer(port: number): Promise<Server> {
	const server = new Server();

	// Register all service handlers
	server.addService(...adaptService(AuthService, authHandler));
	server.addService(...adaptService(PostsService, postsHandler));
	server.addService(...adaptService(CommentsService, commentsHandler));
	server.addService(...adaptService(LikesService, likesHandler));
	server.addService(...adaptService(FollowsService, followsHandler));
	server.addService(...adaptService(FeedService, feedHandler));
	server.addService(...adaptService(SearchService, searchHandler));
	server.addService(...adaptService(UsersService, usersHandler));
	server.addService(...adaptService(AdminService, adminHandler));
	server.addService(...adaptService(NotificationsService, notificationsHandler));
	server.addService(...adaptService(BookmarksService, bookmarksHandler));

	const serverCredentials = createGrpcServerCredentials();

	return new Promise((resolve, reject) => {
		server.bindAsync(`0.0.0.0:${port}`, serverCredentials, (error, boundPort) => {
			if (error) {
				console.error("Failed to bind gRPC server:", error);
				reject(error);
				return;
			}
			console.log(`   gRPC server bound to port ${boundPort}`);
			resolve(server);
		});
	});
}
