export const challenges = {
  shapes: {
    question:
      "Which way does the long tail point in a right-skewed distribution?",
    choices: [
      "Toward smaller values",
      "Toward larger values",
      "Toward the tallest bar",
    ],
    answer: 1,
    explanation:
      "The tail points toward larger values. Most observations can still sit on the left.",
  },
  outlier: {
    question:
      "Move the largest village from 6,000 to 600. Which center changes?",
    choices: ["Only the mean", "Only the median", "Both centers"],
    answer: 0,
    explanation:
      "The total falls, so the mean falls. Both middle villages still have 450 people.",
  },
  median: {
    question:
      "After crossing off pairs from 230 villages, how many middle villages remain?",
    choices: ["One", "Two", "Ten"],
    answer: 1,
    explanation:
      "230 is even. Positions 115 and 116 remain, and both have 450 people.",
  },
  spread: {
    question:
      "Double every distance from the mean. How much does variance grow?",
    choices: ["2 times", "4 times", "It stays the same"],
    answer: 1,
    explanation:
      "Each squared distance becomes four times as large. Standard deviation doubles.",
  },
  simpson: {
    question: "Why can A lead overall while B leads in both departments?",
    choices: [
      "A applies more to the easier department",
      "B has fewer applicants overall",
      "Averages cannot reverse",
    ],
    answer: 0,
    explanation:
      "Both groups have 100 applicants. Their department mixes provide different weights for the overall rates.",
  },
};

export function checkPrediction(activity, choice) {
  const challenge = challenges[activity];
  if (
    !challenge ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= challenge.choices.length
  )
    return null;
  return {
    correct: choice === challenge.answer,
    explanation: challenge.explanation,
  };
}
