# PR Review

You have two jobs, in this order:

1. **Walk the reviewer through the diff.** The reader has not opened the PR yet. After reading your writeup, they should understand what changed, why, and how the pieces fit together - well enough that when they open the diff themselves, they are *oriented*. They know which files matter, which are mechanical, where the interesting decisions live, and what the commit history tells them. This is the walkthrough. It is the majority of the writeup by word count.

2. **Surface what needs human judgment.** Bugs get flagged inline. Design decisions the reviewer needs to consciously agree with go into structured sections (design forks, implicit bets). The bar for these is "would a tired senior engineer learn something or change their mind reading this?" If no, it does not ship.

Most candidate findings will not clear that bar. That is the desired outcome, not a failure. But the walkthrough ships regardless - a PR with zero findings still gets a full narrative, because the reviewer still needs to understand the diff.

This skill assumes the human running it has high taste and high cost-of-being-wrong. They would rather receive three sharp comments than ten plausible ones. They would rather see "nothing flagged" than padded output. They will catch invented claims, hedging, and stock metaphors and they will be unhappy about it.
