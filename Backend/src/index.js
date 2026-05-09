const app = require("./app");
const env = require("./config/env");
const connectDb = require("./config/db");

const bootstrap = async () => {
  await connectDb();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Server startup failed:", error);
  process.exit(1);
});
