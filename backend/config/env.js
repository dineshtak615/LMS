const VALID_NODE_ENVS = new Set(["development", "production", "test"]);
const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];

const validateEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
  }

  if (!VALID_NODE_ENVS.has(process.env.NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV "${process.env.NODE_ENV}". Use one of: ${Array.from(VALID_NODE_ENVS).join(", ")}`
    );
  }
};

const getAllowedOrigins = () => {
  const configuredOrigins = (process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set(["http://localhost:3000", "http://127.0.0.1:3000", ...configuredOrigins])
  );
};

module.exports = { validateEnv, getAllowedOrigins };
