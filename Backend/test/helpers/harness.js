/**
 * Test harness: boots the real Express app against an in-memory MongoDB and a
 * recording fake Stripe client. Nothing here touches a network service.
 *
 *   const h = await startHarness({ replSet: true });
 *   const res = await h.api("GET", "/api/v1/cart", { token });
 *   await h.stop();
 *
 * replSet: true  -> transactions work (placeOrdersWithTransaction path)
 * replSet: false -> standalone mongod (placeOrdersWithCompensation path)
 */
const path = require("path");

// env.js throws on missing vars and dotenv never overrides what is set here.
const TEST_ENV = {
  NODE_ENV: "test",
  PORT: "0",
  MONGODB_URI: "mongodb://placeholder/test", // replaced once the server is up
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: "test-refresh-secret",
  JWT_ACCESS_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
  PLATFORM_CURRENCY: "gbp",
  NOTIFICATIONS_ENABLED: "false",
  STRIPE_SECRET_KEY: "sk_test_fake_never_used",
  STRIPE_WEBHOOK_SECRET: "whsec_fake",
  GOOGLE_MAPS_API_KEY: "",
  AWS_ACCESS_KEY_ID: "",
  AWS_SECRET_ACCESS_KEY: "",
  AWS_BUCKET_NAME: "",
};
for (const [k, v] of Object.entries(TEST_ENV)) process.env[k] = v;

const SRC = path.join(__dirname, "..", "..", "src");

const installFakeStripe = () => {
  const calls = [];
  let n = 0;
  const fakeClient = {
    paymentIntents: {
      create: async (args) => {
        n += 1;
        calls.push({ api: "paymentIntents.create", args });
        return { id: `pi_test_${n}`, client_secret: `pi_test_${n}_secret` };
      },
    },
    checkout: {
      sessions: {
        create: async (args) => {
          n += 1;
          calls.push({ api: "checkout.sessions.create", args });
          return {
            id: `cs_test_${n}`,
            url: `https://stripe.invalid/cs_test_${n}`,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          };
        },
      },
    },
    customers: {
      create: async (args) => {
        n += 1;
        calls.push({ api: "customers.create", args });
        return { id: `cus_test_${n}` };
      },
    },
    ephemeralKeys: {
      create: async (args) => {
        calls.push({ api: "ephemeralKeys.create", args });
        return { secret: `ek_test_${args.customer}` };
      },
    },
    paymentMethods: {
      list: async ({ customer }) => ({ data: [{ id: "pm_test_1", customer, card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 } }] }),
      retrieve: async (id) => (id === "pm_test_1" ? { id, customer: "cus_test_1" } : { id, customer: "cus_someone_else" }),
      detach: async (id) => {
        calls.push({ api: "paymentMethods.detach", args: { id } });
        return { id };
      },
    },
    refunds: {
      create: async (args) => {
        n += 1;
        calls.push({ api: "refunds.create", args });
        return { id: `re_test_${n}`, status: "succeeded" };
      },
    },
  };
  const file = require.resolve(path.join(SRC, "lib", "stripeClient"));
  require.cache[file] = {
    id: file,
    filename: file,
    loaded: true,
    exports: {
      getStripeClient: () => fakeClient,
      isStripeConfigured: () => true,
    },
  };
  return calls;
};

const startHarness = async ({ replSet = true } = {}) => {
  // eslint-disable-next-line global-require
  const { MongoMemoryServer, MongoMemoryReplSet } = require("mongodb-memory-server");
  const mongod = replSet
    ? await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } })
    : await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  const stripeCalls = installFakeStripe();

  // eslint-disable-next-line global-require
  const mongoose = require("mongoose");
  await mongoose.connect(uri, { dbName: "test" });

  // eslint-disable-next-line global-require
  const app = require(path.join(SRC, "app"));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const api = async (method, urlPath, { token, body, headers = {} } = {}) => {
    const res = await fetch(base + urlPath, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_e) {
      json = null;
    }
    return { status: res.status, headers: res.headers, body: json, text };
  };

  const resetDb = async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    stripeCalls.length = 0;
  };

  const stop = async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  };

  return { api, base, mongoose, stripeCalls, resetDb, stop, src: SRC };
};

module.exports = { startHarness, SRC };
