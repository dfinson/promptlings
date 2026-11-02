# Ticket writing

Apply to Jira, Azure DevOps, GitHub Issues, Linear, and similar work trackers. Use the project's actual work-item type, fields, template, hierarchy, and workflow. The guidance below is portable content guidance, not a universal tracker schema or a backlog execution procedure.

## Common rules

- Give the item a concrete title describing its outcome or observed defect. Avoid "Improve experience" or "Enhance reliability" without naming the affected behavior.
- Explain the problem, who or what is affected, why it matters, and the bounded outcome. Include enough context to act without reconstructing the conversation. Link the relevant requirement, design, ADR, parent item, or evidence instead of pasting the whole source document.
- Separate required behavior and confirmed constraints from suggested implementation. Include implementation detail when it is essential to a technical task or an already approved design. Do not present an arbitrary recipe as a product requirement.
- State scope and material exclusions. Make real prerequisites and blockers explicit, using existing item IDs and the target's supported relationships. A parent relationship is not a dependency, and numbered list order does not establish one.
- Preserve upstream requirement and acceptance IDs. Cover one coherent, verifiable outcome at the chosen backlog level. If an item contains independent deliverables or is too large for the team's planning unit, propose a split with traceability and dependencies preserved. Do not create or reparent items as part of a writing edit.
- Keep unknown requirements visibly unresolved. Never invent priority, estimates, assignees, dates, status, severity, project fields, or numeric targets. Distinguish suggestions from confirmed field values.
- Keep secrets, private machine paths, and unrelated personal or organizational information out of externally published content. Use appropriate repository-relative links and authorized evidence.

## Acceptance criteria

Write observable pass/fail conditions for this item, using the project's checklist, scenario format, or dedicated field. Given/When/Then is useful when preconditions and events need to be explicit, not a required syntax.

Each criterion should name the relevant condition or input and expected result clearly enough to derive a check. Include material empty, invalid, unauthorized, failure, and recovery cases when they are part of the affected contract. Preserve numeric limits supplied by the requirement. If a necessary threshold is missing, flag the gap rather than inventing one.

"Works correctly", "is user-friendly", "handles errors", and "tests pass" alone do not define acceptance. A test command can be supporting evidence, but it does not replace the required behavior. Distinguish item-specific criteria from the team's shared Definition of Done. Do not weaken an end-to-end criterion into a unit test.

## Match the item type

| Type | Content emphasis |
| --- | --- |
| Story or backlog item | User or stakeholder need, intended value, observable behavior, and acceptance. Use "As a ... I want ... so that ..." only when useful or required. A real user need matters more than the sentence pattern. |
| Technical task | Concrete engineering outcome, relevant constraints and dependencies, deliverable, and verification. Do not invent an end-user persona for a migration, build change, or maintenance task. |
| Bug | Observed versus expected behavior, reproduction steps and conditions, affected version/environment, impact, and relevant logs or screenshots. Label a suspected cause as a hypothesis. If reproduction is unavailable, state that rather than inventing steps. |
| Epic or feature | Broader outcome, boundaries, success measures, and links to smaller deliverables at the project's actual hierarchy level. Do not force leaf-task detail into every portfolio item. |
| Spike or investigation | Specific question, why the answer is needed, agreed bounds or timebox when supplied, and expected evidence or decision output. Completing the investigation does not imply delivering a product feature. |

## Respect the platform and owner

- **Jira:** Retain configured issue types, required/custom fields, project conventions, and supported links. Do not assume a universal acceptance-criteria field or hierarchy.
- **Azure DevOps:** Resolve the actual process and work-item type. Agile, Scrum, Basic, CMMI, and customized processes differ. Preserve dedicated Description, Acceptance Criteria, Repro Steps, and other fields when present. Match the destination's supported content format rather than pasting Markdown into an HTML-only field.
- **GitHub:** Preserve issue templates or form fields and their required sections. Keep implementation suggestions, acceptance, and evidence distinguishable in the supported body format.
- **Other trackers:** Use the same content checks with the observed schema. Do not infer platform capabilities from another product's conventions.
- **Method-owned backlog:** Pass the writing requirements to the planner or supported customization. It retains item decomposition, field mapping, approvals, and tracker writes.

## Example

Assume the approved requirement already says duplicate submissions must reuse the pending job.

Vague: "Improve report job handling and add tests."

Concrete title: "Reuse the pending report job on duplicate submission"

Context: "Submitting the same report twice currently starts two jobs. The approved design requires duplicate submissions to reuse a pending job for the same requester and report parameters."

Acceptance:

- While that matching job is pending, submitting again returns its existing job identifier and starts no second job.
- A submission with different report parameters creates a separate job.

These are illustrations, not requirements to copy. Add failure or permission criteria only when supported by the actual contract.

## Research basis

[Atlassian's user-story guidance](https://www.atlassian.com/agile/project-management/user-stories) supports value, conversation, confirmation, and flexible story wording. Its [acceptance-criteria guidance](https://www.atlassian.com/work-management/project-management/acceptance-criteria) supports clear, testable, outcome-focused conditions. These principles do not require every work item to be a user story.

Microsoft documents [process-specific work-item types](https://learn.microsoft.com/en-us/azure/devops/boards/work-items/guidance/agile-process?view=azure-devops), [features and epics](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/define-features-epics?view=azure-devops), [work-item fields and relationship purposes](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/manage-work-items?view=azure-devops), and [bug management](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/manage-bugs?view=azure-devops). These support type-aware content, traceability, evidence, and distinct hierarchy/dependency links.

[GitHub's issue guidance](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue) supports repository templates, descriptive titles and bodies, and links to related evidence. The common checks above are a Promptlings synthesis, not a claim that every tracker mandates the same fields.
