-- Hot fix: persist the order in which questions were presented during an
-- attempt so the result summary page can display questions in the same
-- order the user was asked, instead of an arbitrary DB fetch order.

ALTER TABLE "answers" ADD COLUMN "question_order" INTEGER NOT NULL DEFAULT 0;
