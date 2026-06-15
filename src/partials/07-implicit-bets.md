Separate from open forks, some choices in the diff are resolved (the code picks one option cleanly) but the choice implies a subjective position the reviewer should consciously agree with. These are not bugs (nothing breaks). They are not forks (only one option is in the diff). They are bets: technically sound decisions that trade one failure mode for another, or commit the codebase to a direction that is expensive to reverse.

A candidate qualifies as an implicit bet if:

1. The code is internally consistent and correct.
2. A defensible alternative exists that the author did not take.
3. The choice has real consequences (cost to reverse, failure mode shape, who bears the operational burden).

Hard rules:

- **Keep bets tight.** If you found many, most are obvious-good decisions you are second-guessing. Ask "would a reviewer actually push back on this?" If no, drop it.
- **Do not editorialize.** State the mechanical tradeoff. Do not say "this is a good bet" or "this is defensible." The reviewer decides.
- **Every bet must have a "question to answer."** This is what separates a bet from narration. The question forces the reviewer to form an opinion.
- **Bets the diff's own docs already defend with citations are still bets.** Include the defense in "why it's defensible" and let the reviewer decide if they agree.
