/**
 * Zerostep API call tracker
 */

let totalCalls = 0;
let callsByCategory: Record<string, number> = {};
let callsByTest: Array<{ test: string; calls: number }> = [];

export function trackZerostepCall(category: string, testName?: string) {
  totalCalls++;
  callsByCategory[category] = (callsByCategory[category] || 0) + 1;

  if (testName) {
    const existing = callsByTest.find(t => t.test === testName);
    if (existing) {
      existing.calls++;
    } else {
      callsByTest.push({ test: testName, calls: 1 });
    }
  }
}

export function getUsageReport() {
  return {
    total: totalCalls,
    byCategory: callsByCategory,
    byTest: callsByTest,
    remaining: 2000 - totalCalls,
    percentUsed: ((totalCalls / 2000) * 100).toFixed(2)
  };
}

export function printUsageReport() {
  const report = getUsageReport();

  console.log('\n📊 Zerostep API Usage Report');
  console.log('═'.repeat(50));
  console.log(`Total Calls: ${report.total} / 2000`);
  console.log(`Remaining: ${report.remaining}`);
  console.log(`Usage: ${report.percentUsed}%`);
  console.log('\nBy Category:');
  Object.entries(report.byCategory).forEach(([category, calls]) => {
    console.log(`  ${category}: ${calls} calls`);
  });
  console.log('\nTop Tests:');
  report.byTest
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 5)
    .forEach(({ test, calls }) => {
      console.log(`  ${test}: ${calls} calls`);
    });
  console.log('═'.repeat(50));
}

export function resetTracker() {
  totalCalls = 0;
  callsByCategory = {};
  callsByTest = [];
}

export function getCategoryUsage(category: string): number {
  return callsByCategory[category] || 0;
}
