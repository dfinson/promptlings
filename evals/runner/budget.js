import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Credit ceiling. Each trial reserves its cap before it starts and settles to its reported credits
// (or keeps the full cap when usage is unknown), so concurrent trials cannot jointly exceed the ceiling.
// `priorSpent` carries spend already recorded by earlier runs that share the ceiling.
export class StageBudget {
  constructor(ceiling, priorSpent = 0) {
    this.ceiling = ceiling ?? Infinity;
    this.priorSpent = priorSpent;
    this.spent = 0;
    this.reserved = 0;
  }

  canReserve(amount) {
    return this.priorSpent + this.spent + this.reserved + amount <= this.ceiling;
  }

  tryReserve(amount) {
    if (!this.canReserve(amount)) return false;
    this.reserved += amount;
    return true;
  }

  settle(reservedAmount, actual) {
    this.reserved -= reservedAmount;
    this.spent += typeof actual === "number" && actual >= 0 ? actual : reservedAmount;
  }

  summary() {
    return { ceiling: Number.isFinite(this.ceiling) ? this.ceiling : null, priorSpent: this.priorSpent, spent: this.spent };
  }
}

function readLedger(file) {
  if (!existsSync(file)) return { runs: {} };
  return JSON.parse(readFileSync(file, "utf8"));
}

/**
 * The stage budget plus, for stages with a `ceilingGroup`, a group budget whose prior spend comes from a
 * ledger at <artifactRoot>/ceilings/<suite>/<group>.json shared by every run in the group.
 */
export class RunBudget {
  constructor({ plan, suite, artifactRoot, runId }) {
    this.stage = new StageBudget(plan.ceiling);
    this.group = null;
    if (plan.group) {
      this.ledgerFile = join(artifactRoot, "ceilings", suite, `${plan.group}.json`);
      const ledger = readLedger(this.ledgerFile);
      const prior = Object.entries(ledger.runs ?? {})
        .filter(([id]) => id !== runId)
        .reduce((sum, [, entry]) => sum + (entry.spent ?? 0), 0);
      this.group = new StageBudget(plan.groupCeiling, prior);
      this.groupName = plan.group;
      this.runId = runId;
      this.stageName = plan.name;
    }
  }

  tryReserve(amount) {
    if (!this.stage.canReserve(amount) || (this.group && !this.group.canReserve(amount))) return false;
    this.stage.tryReserve(amount);
    this.group?.tryReserve(amount);
    return true;
  }

  settle(reservedAmount, actual) {
    this.stage.settle(reservedAmount, actual);
    if (!this.group) return;
    this.group.settle(reservedAmount, actual);
    const ledger = readLedger(this.ledgerFile);
    ledger.group = this.groupName;
    ledger.ceiling = this.group.summary().ceiling;
    ledger.runs = { ...(ledger.runs ?? {}), [this.runId]: { stage: this.stageName, spent: this.group.spent } };
    mkdirSync(dirname(this.ledgerFile), { recursive: true });
    writeFileSync(this.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  }

  summary() {
    return {
      ...this.stage.summary(),
      group: this.group ? { name: this.groupName, ...this.group.summary(), ledger: this.ledgerFile } : null,
    };
  }
}
