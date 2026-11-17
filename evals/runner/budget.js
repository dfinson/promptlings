import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * What a finished trial costs the budget. A trial whose Copilot process never launched costs 0. A launched
 * trial costs its derived credits. A launched trial without usage data costs its full cap, flagged as
 * estimated, because its real spend is unknown.
 */
export function trialCharge(record, cap) {
  if (record?.launched !== true) return { credits: 0, estimated: false };
  if (typeof record.aiCredits === "number" && record.aiCredits >= 0) return { credits: record.aiCredits, estimated: false };
  return { credits: cap, estimated: true };
}

// Credit ceiling. Each trial reserves its cap before it starts, so concurrent trials cannot jointly exceed
// the ceiling, and settles to its charge when it finishes. `priorSpent` carries spend already recorded by
// earlier runs that share the ceiling.
export class StageBudget {
  constructor(ceiling, priorSpent = 0) {
    this.ceiling = ceiling ?? Infinity;
    this.priorSpent = priorSpent;
    this.spent = 0;
    this.reserved = 0;
    this.estimatedTrials = 0;
  }

  canReserve(amount) {
    return this.priorSpent + this.spent + this.reserved + amount <= this.ceiling;
  }

  tryReserve(amount) {
    if (!this.canReserve(amount)) return false;
    this.reserved += amount;
    return true;
  }

  settle(reservedAmount, charge) {
    this.reserved -= reservedAmount;
    this.spent += charge.credits;
    if (charge.estimated) this.estimatedTrials += 1;
  }

  summary() {
    return {
      ceiling: Number.isFinite(this.ceiling) ? this.ceiling : null,
      priorSpent: this.priorSpent,
      spent: this.spent,
      estimatedTrials: this.estimatedTrials,
    };
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

  /**
   * Releases a trial's reservation and charges its final attempt (see trialCharge). Sets `creditsCharged`
   * on the record to the total over every attempt, including retried attempts that retryAttempt charged,
   * and `creditsEstimated` when any attempt's charge was estimated. Returns the final attempt's charge.
   */
  settleTrial(reservedAmount, record) {
    const charge = trialCharge(record, reservedAmount);
    this.settle(reservedAmount, charge);
    if (record) {
      const earlier = (record.attempts ?? []).slice(0, -1);
      const last = record.attempts?.at(-1);
      if (last) Object.assign(last, { creditsCharged: charge.credits, creditsEstimated: charge.estimated });
      record.creditsCharged = earlier.reduce((sum, a) => sum + (a.creditsCharged ?? 0), charge.credits);
      record.creditsEstimated = charge.estimated || earlier.some((a) => a.creditsEstimated === true);
    }
    return charge;
  }

  /**
   * Charges a failed attempt that is about to be retried while the trial keeps its reservation for the
   * next attempt. Returns false, charging nothing, when the charge would not fit under the ceiling; the
   * attempt is then the trial's final attempt and settleTrial charges it.
   */
  retryAttempt(reservedAmount, record) {
    const charge = trialCharge(record, reservedAmount);
    if (!this.stage.canReserve(charge.credits) || (this.group && !this.group.canReserve(charge.credits))) return false;
    record.creditsCharged = charge.credits;
    record.creditsEstimated = charge.estimated;
    this.settle(0, charge);
    return true;
  }

  settle(reservedAmount, charge) {
    this.stage.settle(reservedAmount, charge);
    if (!this.group) return;
    this.group.settle(reservedAmount, charge);
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
