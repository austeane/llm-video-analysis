#!/usr/bin/env bun

import { db } from "../src/lib/db.ts";

async function checkBilling() {
  try {
    const records = await db
      .selectFrom("billing_usage_ledger")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(5)
      .execute();

    console.log("📊 Recent billing records:");
    console.log(JSON.stringify(records, null, 2));

    if (records.length > 0) {
      const totalCost = records.reduce((sum, r) => sum + Number(r.cost_usd), 0);
      console.log(`\n💰 Total cost from recent records: $${totalCost.toFixed(4)}`);
    }
  } catch (error) {
    console.error("❌ Error checking billing:", error);
  } finally {
    await db.destroy();
  }
}

checkBilling();