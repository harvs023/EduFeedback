# EduFeedback comment labeling guide (v1)

For the human labelers in the sentiment evaluation. It follows the same definitions and the same
11 decision rules that Gemini is given (`docs/sentiment-prompt-v1.md`), so humans and Gemini are
judged by the same standard.

## How to work

1. Open the labeling sheet in Excel. Each row is one survey comment.
2. Read the **Survey**, **Section** and **Question** columns first: they tell you what the comment
   is about. Then read the **Comment**.
3. Fill in two columns for every row:
   - **Polarity**: type exactly one of `Positive`, `Neutral`, `Negative`, `Not analyzable`.
   - **Sarcastic**: type `Yes` or `No`.
   - **Notes** is optional (for example, why a row was hard).
4. Do not change the **Item ID** column or delete rows.
5. Work **alone**. Do not discuss labels with the other labeler until both sheets are finished.
6. Names may have been replaced with `[NAME]`. Label the comment as written.
7. Save as **CSV UTF-8 (Comma delimited)** so Filipino characters are kept.

## What the labels mean

The question is: what is the author's **overall attitude toward the thing being evaluated**
(teacher, course, facility, service or school)?

- **Positive**: overall satisfied, praising, approving or grateful.
- **Negative**: overall dissatisfied, complaining, criticizing or frustrated, including polite or
  indirect complaints.
- **Neutral**: no clear evaluation (a plain fact), lukewarm or average ("ok lang", "pwede na",
  "sakto lang", "so-so"), or praise and complaint that are truly equal with no overall lean.
- **Not analyzable**: not a real comment (see rule 10).

## Decision rules

1. Judge the whole comment, not single words. Do not count positive and negative words.
2. Mixed comments: choose the polarity of the main point. In "X, pero Y" / "X but Y" /
   "X, kaso Y", the part after pero / but / kaso / ang problema usually carries the main point.
   Use Neutral only if both sides are truly equal.
3. Lukewarm is Neutral, not Positive: "ok lang", "okay naman", "pwede na", "sakto lang",
   "not bad", "hindi naman masama".
4. "Sana ..." / "I hope ..." / "should ..." wishes imply something is missing: **Negative**.
   Exception: if it asks to keep up something good ("sana ituloy po ang ganda ng turo"), it is
   **Positive**.
5. Gratitude and blessings ("salamat po", "thank you", "God bless") are Positive unless the
   comment also complains.
6. Intensifiers (sobra, super, grabe, ang ...) strengthen the nearby polarity; they do not decide
   it. "Grabe ang bait" is Positive; "grabe ang init" is Negative.
7. Negation flips polarity ("hindi maganda" = Negative, "di naman mabagal" = mildly Positive or
   Neutral). Read Filipino negations (hindi, di, wala, walang, ayaw) carefully.
8. Sarcasm: if praise words are used ironically, such as praise paired with a clear
   contradiction, absurd exaggeration or an obvious complaint, label the **intended** attitude
   (usually Negative) and put **Sarcastic = Yes**. Do not mark sarcasm just because praise is
   strong; there must be a clear cue.
9. Emojis and punctuation count as evidence of tone, but the words decide when they conflict.
10. If the text is empty or not a comment ("wala", "none", "n/a", "-", "wala po", random
    characters, keyboard smashing, jokes with no feedback, or only a name), label it
    **Not analyzable**.
11. Sentiment is about the target of the survey. Ignore unrelated personal remarks.
