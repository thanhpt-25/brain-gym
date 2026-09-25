/**
 * Binary grading shared by every attempt flow: an answer is correct only when
 * the selected choices are exactly the correct choices (no partial credit).
 */
export function isAnswerCorrect(
  correctChoiceIds: string[],
  selectedChoiceIds: string[],
): boolean {
  return (
    correctChoiceIds.length === selectedChoiceIds.length &&
    correctChoiceIds.every((id) => selectedChoiceIds.includes(id))
  );
}
