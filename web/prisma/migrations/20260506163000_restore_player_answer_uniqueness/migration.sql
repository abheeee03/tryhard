-- Restore one answer per player per question. A question must be answerable by
-- both players in a PvP match.
DROP INDEX IF EXISTS "Answer_questionId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Answer_userId_questionId_key" ON "Answer"("userId", "questionId");
