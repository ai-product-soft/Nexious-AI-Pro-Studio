import { runWorker } from './index.js';

// Polyfill localStorage and window for Node.js
global.window = {};
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

import { initDb } from '../../data/db.js';

async function testWorkerExecution() {
  console.log("=== MABISHION AI WORKER REAL-WORLD TEST ===");
  console.log("Initializing SQLite DB...");
  await initDb();
  
  const workerName = "blueprint_maker";
  const projectId = "test-project-landing-page";
  
  // Real-world client context
  const clientContext = {
    requirements_override: `
Type of Build: Single Landing Page
Business Domain: E-Commerce / Retail
Custom Ideas: Client is "Sharma Electronics". They want a highly converting single landing page for their Diwali Mega Sale (Smart TVs and Appliances). Need a hero section with a countdown timer, a grid of top 6 discounted products, and a lead capture form for 'Get Extra 10% Off Coupon'. No multi-page routing. Clean, fast, mobile-first.
Reference URL: https://amazon.in/diwali-sale (for vibe)
    `.trim()
  };

  console.log(`\nTriggering ${workerName} for a Single Landing Page...`);
  console.log("Client Requirement:\n", clientContext.requirements_override);
  console.log("\nExecuting...");

  try {
    const result = await runWorker(workerName, projectId, clientContext);
    console.log("\n✅ WORKER EXECUTION SUCCESSFUL!");
    console.log("\n--- GENERATED PRODUCT (BLUEPRINT) ---");
    console.log(JSON.stringify(result, null, 2).substring(0, 1500) + "\n\n... [TRUNCATED FOR DISPLAY] ...");
  } catch (error) {
    console.error("\n❌ WORKER EXECUTION FAILED:");
    console.error(error);
  }
  
  process.exit(0);
}

testWorkerExecution();
