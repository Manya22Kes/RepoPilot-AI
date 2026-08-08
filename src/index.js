const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const config = require("./config");
const webhookRoutes = require("./routes/webhooks");
const apiRoutes = require("./api");
const logger = require("./utils/logger");

const app = express();

app.use(helmet());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.use("/webhooks", webhookRoutes);
app.use("/api", apiRoutes);

const dashboardDistPath = path.join(__dirname, "..", "dashboard", "dist");
if (fs.existsSync(dashboardDistPath)) {
  app.use("/dashboard", express.static(dashboardDistPath));
  app.get("/dashboard/*", (req, res) => {
    res.sendFile(path.join(dashboardDistPath, "index.html"));
  });
} else {
  logger.warn(
    "Dashboard build not found — /dashboard will 404 until `npm run build` is run inside dashboard/",
    {
      expectedPath: dashboardDistPath,
    },
  );
}

/* istanbul ignore next -- exercised via integration/manual testing, not unit tests */
if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`GitHub Ops Agent listening on port ${config.port}`, {
      env: config.nodeEnv,
    });
  });
}

module.exports = app;
