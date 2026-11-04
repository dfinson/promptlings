## Dependent actions

Parallelize only independent operations. Wait for successful staging before
committing, and for both a successful test-only commit and the intended failing
run before product edits. A failed prerequisite blocks dependent actions.
Test-only Git history created after editing code does not establish this
chronology.
