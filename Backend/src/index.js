const http = require("http");
const app = require("./app");
const env = require("./config/env");
const connectDb = require("./config/db");
const { initSocketIO } = require("./lib/socketIO");

const bootstrap = async () => {
  await connectDb();

  const server = http.createServer(app);
  initSocketIO(server);

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Server startup failed:", error);
  process.exit(1);
});
