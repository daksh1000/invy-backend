require('dotenv').config();
const app = require('./src/app');
const { startMonitoringJobs } = require('./src/jobs/monitoringJobs');

const PORT = process.env.PORT || 3000;

// Start background monitoring jobs
startMonitoringJobs();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`🚀 Background monitoring active 24/7`);
});